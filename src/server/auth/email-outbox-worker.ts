import { composeEmailVerificationMessage, composePasswordResetMessage, validateAuthEmailDeliveryConfig, type AuthEmailMessage, type AuthEmailDeliveryConfig } from "./email-delivery.ts";
import { PostgresAuthEmailOutbox, type EmailDeliveryResult } from "./postgres-email-outbox.ts";

export type AuthEmailProvider = {
  deliver(message: AuthEmailMessage, options: { idempotencyKey: string; signal: AbortSignal }): Promise<{ status: EmailDeliveryResult }>;
};

// Explicit one-shot worker only. No runtime scheduler or external provider is enabled here.
export async function processOneAuthEmail(outbox: PostgresAuthEmailOutbox, provider: AuthEmailProvider, input: AuthEmailDeliveryConfig) {
  const config = validateAuthEmailDeliveryConfig(input);
  const lease = await outbox.claim();
  if (!lease) return { status: "idle" as const };
  const job = await outbox.prepare(lease);
  if (!job) return { status: "skipped" as const };
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let result: EmailDeliveryResult = "unknown";
  try {
    const message = job.messageType === "auth.email_verification"
      ? composeEmailVerificationMessage(config, { ...job, verificationToken: job.token })
      : composePasswordResetMessage(config, { ...job, resetToken: job.token });
    const unknown = new Promise<{ status: "unknown" }>(resolve => {
      timeout = setTimeout(() => { controller.abort(); resolve({ status: "unknown" }); }, 10_000);
    });
    const response = await Promise.race([provider.deliver(message, { idempotencyKey: `auth-email:${job.id}`, signal: controller.signal }), unknown]);
    if (response && ["accepted", "not_accepted", "unknown"].includes(response.status)) result = response.status;
  } catch {
    // Provider errors may include the recipient or credential URL. Never persist or return them.
    result = "unknown";
  } finally { clearTimeout(timeout); }
  const recorded = await outbox.finish(lease, result);
  return { status: recorded ? result : "unconfirmed" as const };
}
