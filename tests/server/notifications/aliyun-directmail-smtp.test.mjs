import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createNotificationAliyunDirectMailProvider } from "../../../src/server/notifications/aliyun-directmail-smtp.ts";

const config = {
  from: "no-reply@example.invalid",
  publicAppUrl: "https://cuac.example.invalid",
  region: "cn-hangzhou",
  username: "no-reply@example.invalid",
  password: "PRIVATE_SMTP_PASSWORD",
};
const delivery = {
  id: "11111111-1111-4111-8111-111111111111",
  channel: "email",
  to: "student@example.invalid",
  title: "Application update",
  body: "Review <your> application & next steps.",
  actionPath: "/application.html?schoolApplicationId=22222222-2222-4222-8222-222222222222",
};

test("notification Aliyun provider fixes TLS posture and builds bounded same-origin mail", async () => {
  let transportOptions, outgoing;
  const provider = createNotificationAliyunDirectMailProvider(config, { createTransport(options) {
    transportOptions = options;
    return { async sendMail(message) {
      outgoing = message;
      return { accepted: [{ address: "STUDENT@example.invalid" }], messageId: "provider-message-1" };
    } };
  } });
  const idempotencyKey = `notification-delivery:${delivery.id}`;
  const result = await provider.deliver(delivery, { idempotencyKey, signal: new AbortController().signal });

  assert.deepEqual(result, { status: "accepted", providerMessageId: "provider-message-1" });
  assert.deepEqual(transportOptions, {
    host: "smtpdm.aliyun.com", port: 465, secure: true,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000, dnsTimeout: 5000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: "smtpdm.aliyun.com" },
    logger: false, debug: false, transactionLog: false, disableFileAccess: true, disableUrlAccess: true,
  });
  assert.equal(outgoing.from, config.from);
  assert.equal(outgoing.to, delivery.to);
  assert.equal(outgoing.subject, delivery.title);
  assert.match(outgoing.text, /https:\/\/cuac\.example\.invalid\/application\.html\?schoolApplicationId=/);
  assert.match(outgoing.html, /Review &lt;your&gt; application &amp; next steps\./);
  assert.doesNotMatch(outgoing.html, /PRIVATE_SMTP_PASSWORD/);
  const digest = createHash("sha256").update(idempotencyKey).digest("hex");
  assert.equal(outgoing.messageId, `<cuac-notification-${digest}@example.invalid>`);
  assert.equal(outgoing.disableFileAccess, true);
  assert.equal(outgoing.disableUrlAccess, true);
});

test("notification Aliyun provider distinguishes explicit rejection from uncertainty", async () => {
  const outcomes = [
    { result: { rejected: [delivery.to] }, expected: "not_accepted" },
    { error: { rejected: [{ address: delivery.to }] }, expected: "not_accepted" },
    { error: new Error("PRIVATE_PROVIDER_FAILURE"), expected: "unknown" },
    { result: {}, expected: "unknown" },
  ];
  for (const outcome of outcomes) {
    const provider = createNotificationAliyunDirectMailProvider(config, { createTransport() {
      return { async sendMail() {
        if (outcome.error) throw outcome.error;
        return outcome.result;
      } };
    } });
    const result = await provider.deliver(delivery, {
      idempotencyKey: `notification-delivery:${delivery.id}`, signal: new AbortController().signal,
    });
    assert.equal(result.status, outcome.expected);
    assert.equal(JSON.stringify(result).includes("PRIVATE_PROVIDER_FAILURE"), false);
  }
});

test("notification Aliyun provider fails closed before SMTP for malformed content or destinations", async () => {
  let sends = 0;
  const provider = createNotificationAliyunDirectMailProvider(config, { createTransport() {
    return { async sendMail() { sends++; return { accepted: [delivery.to] }; } };
  } });
  const invalid = [
    { ...delivery, channel: "sms" },
    { ...delivery, to: "bad\r\n@example.invalid" },
    { ...delivery, title: "Injected\r\nBcc: victim@example.invalid" },
    { ...delivery, body: "bad\u0000body" },
    { ...delivery, actionPath: "//attacker.example/collect" },
    { ...delivery, actionPath: "/application.html#secret" },
  ];
  for (const message of invalid) {
    assert.deepEqual(await provider.deliver(message, {
      idempotencyKey: `notification-delivery:${delivery.id}`, signal: new AbortController().signal,
    }), { status: "unknown" });
  }
  assert.deepEqual(await provider.deliver(delivery, {
    idempotencyKey: "bad key", signal: new AbortController().signal,
  }), { status: "unknown" });
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await provider.deliver(delivery, {
    idempotencyKey: `notification-delivery:${delivery.id}`, signal: controller.signal,
  }), { status: "unknown" });
  assert.equal(sends, 0);
});

test("notification Aliyun provider rejects unsafe configuration without exposing secrets", () => {
  const invalid = [
    { region: "arbitrary.example.invalid" },
    { username: "other@example.invalid" },
    { password: "" },
    { publicAppUrl: "http://cuac.example.invalid" },
    { publicAppUrl: "https://cuac.example.invalid/path" },
  ];
  for (const patch of invalid) {
    assert.throws(() => createNotificationAliyunDirectMailProvider({ ...config, ...patch }), error => {
      assert.equal(`${error.message} ${JSON.stringify(error)}`.includes("PRIVATE_SMTP_PASSWORD"), false);
      return error.status === 503;
    });
  }
});
