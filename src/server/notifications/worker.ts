import type {
  NotificationDeliveryLease,
  NotificationDeliveryResult,
  PostgresNotificationDeliveryQueue,
  PreparedNotificationDelivery,
} from "./delivery-queue.ts";

export type NotificationProviderFacade = {
  deliver(message: PreparedNotificationDelivery, options: {
    idempotencyKey: string;
    signal: AbortSignal;
  }): Promise<{ status: NotificationDeliveryResult; providerMessageId?: string }>;
};

// One committed job per invocation. Scheduling and provider enablement remain explicit runtime concerns.
export async function processOneNotificationDelivery(queue: PostgresNotificationDeliveryQueue, provider: NotificationProviderFacade) {
  const lease = await queue.claim();
  if (!lease) return { status: "idle" as const };
  const job = await queue.prepare(lease);
  if (!job) return { status: "skipped" as const };
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let result: NotificationDeliveryResult = "unknown";
  let providerMessageId: string | undefined;
  try {
    const unknown = new Promise<{ status: "unknown" }>(resolve => {
      timeout = setTimeout(() => { controller.abort(); resolve({ status: "unknown" }); }, 10_000);
    });
    const response = await Promise.race([
      provider.deliver(job, { idempotencyKey: `notification-delivery:${job.id}`, signal: controller.signal }),
      unknown,
    ]);
    if (["accepted", "not_accepted", "unknown"].includes(response.status)) {
      result = response.status;
      providerMessageId = "providerMessageId" in response ? response.providerMessageId : undefined;
    }
  } catch {
    result = "unknown";
  } finally {
    clearTimeout(timeout);
  }
  const recorded = await queue.finish(lease as NotificationDeliveryLease, result, providerMessageId);
  return { status: recorded ? result : "unconfirmed" as const };
}
