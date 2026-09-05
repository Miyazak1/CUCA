import {
  officialSubmissionProviderIdempotencyKey,
  validateOfficialSubmissionDeliveryResult,
  validateOfficialSubmissionProviderName,
  type OfficialSubmissionDeliveryResult,
} from "./contract.ts";
import type { PostgresOfficialSubmissionOutbox } from "./postgres-outbox.ts";

export type OfficialSubmissionProvider = {
  readonly name: string;
  deliver(serialized: string, options: {
    idempotencyKey: string;
    payloadSha256: string;
    signal: AbortSignal;
  }): Promise<unknown>;
};

export async function processOneOfficialSubmission(
  outbox: PostgresOfficialSubmissionOutbox,
  provider: OfficialSubmissionProvider,
  timeoutMs = 30_000,
) {
  const providerName = validateOfficialSubmissionProviderName(provider.name);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error("Official submission delivery timeout is invalid.");
  }
  const lease = await outbox.claim();
  if (!lease) return { status: "idle" as const };
  const job = await outbox.prepare(lease, providerName);
  if (!job) return { status: "skipped" as const };
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let result: OfficialSubmissionDeliveryResult = {
    status: "unknown",
    providerName,
    payloadSha256: job.payloadSha256,
  };
  try {
    const unknown = new Promise<OfficialSubmissionDeliveryResult>(resolve => {
      timeout = setTimeout(() => {
        controller.abort();
        resolve({ status: "unknown", providerName, payloadSha256: job.payloadSha256 });
      }, timeoutMs);
    });
    const response = await Promise.race([
      provider.deliver(job.serialized, {
        idempotencyKey: officialSubmissionProviderIdempotencyKey(job.groupId),
        payloadSha256: job.payloadSha256,
        signal: controller.signal,
      }),
      unknown,
    ]);
    result = validateOfficialSubmissionDeliveryResult(response as OfficialSubmissionDeliveryResult,
      { providerName, payloadSha256: job.payloadSha256 });
  } catch {
    // Provider failures can contain student material or credentials. Persist only an unknown outcome.
    result = { status: "unknown", providerName, payloadSha256: job.payloadSha256 };
  } finally {
    clearTimeout(timeout);
  }
  const recorded = await outbox.finish(lease, result);
  return { status: recorded ? result.status : "unconfirmed" as const };
}
