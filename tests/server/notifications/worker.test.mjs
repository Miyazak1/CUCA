import assert from "node:assert/strict";
import test from "node:test";
import { processOneNotificationDelivery } from "../../../src/server/notifications/worker.ts";

const lease = { id: "11111111-1111-4111-8111-111111111111", recipientUserId: "22222222-2222-4222-8222-222222222222", leaseId: "33333333-3333-4333-8333-333333333333" };
const job = { id: lease.id, channel: "email", to: "student@example.invalid", title: "Update", body: "Safe body", actionPath: "/application.html" };

test("notification worker calls provider only after prepare and forwards stable idempotency", async () => {
  const order = [];
  const queue = { async claim() { order.push("claim"); return lease; }, async prepare(value) { assert.deepEqual(value, lease); order.push("prepare"); return job; },
    async finish(value, status, providerId) { assert.deepEqual(value, lease); order.push([status, providerId]); return true; } };
  const result = await processOneNotificationDelivery(queue, { async deliver(message, options) {
    assert.deepEqual(order, ["claim", "prepare"]); assert.equal(message.to, "student@example.invalid");
    assert.equal(options.idempotencyKey, `notification-delivery:${job.id}`);
    return { status: "accepted", providerMessageId: "provider-1" };
  } });
  assert.deepEqual(result, { status: "accepted" });
  assert.deepEqual(order.at(-1), ["accepted", "provider-1"]);
});

test("notification worker skips absent jobs and quarantines provider uncertainty", async () => {
  let sent = 0, finished;
  const queue = { async claim() { return lease; }, async prepare() { return null; }, async finish(_lease, result) { finished = result; return true; } };
  const provider = { async deliver() { sent++; throw new Error("PRIVATE_PROVIDER_ERROR"); } };
  assert.deepEqual(await processOneNotificationDelivery(queue, provider), { status: "skipped" });
  assert.equal(sent, 0);
  queue.prepare = async () => job;
  assert.deepEqual(await processOneNotificationDelivery(queue, provider), { status: "unknown" });
  assert.equal(finished, "unknown");
  provider.deliver = async () => ({ status: "invented" });
  assert.deepEqual(await processOneNotificationDelivery(queue, provider), { status: "unknown" });
});

test("notification worker marks hung provider unknown without retrying itself", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ready = Promise.withResolvers();
  let signal, status;
  const work = processOneNotificationDelivery({ async claim() { return lease; }, async prepare() { return job; },
    async finish(_lease, result) { status = result; return true; } }, { deliver(_message, options) {
    signal = options.signal; ready.resolve(); return new Promise(() => {});
  } });
  await ready.promise;
  t.mock.timers.tick(10_000);
  assert.deepEqual(await work, { status: "unknown" });
  assert.equal(signal.aborted, true);
  assert.equal(status, "unknown");
});
