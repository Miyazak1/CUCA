import assert from "node:assert/strict";
import test from "node:test";
import {
  ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS,
  createAliyunDirectMailSmtpProvider,
} from "../../../src/server/auth/aliyun-directmail-smtp.ts";

const config = {
  region: "cn-hangzhou",
  username: "no-reply@example.invalid",
  password: "PRIVATE_SMTP_PASSWORD",
  from: "no-reply@example.invalid",
  publicAppUrl: "https://cuac.example.invalid",
  verificationPath: "/auth/verify-email",
  passwordResetPath: "/auth/reset-password",
};

function message(overrides = {}) {
  return {
    messageType: "auth.email_verification",
    to: "student@example.invalid",
    from: config.from,
    subject: "Verify your CUAC email",
    templateData: {
      challengeId: "challenge-1",
      userId: "user-1",
      expiresAt: "2030-01-01T00:00:00.000Z",
      actionUrl: "https://cuac.example.invalid/auth/verify-email#challenge=challenge-1&token=PRIVATE_TOKEN",
    },
    ...overrides,
  };
}

function fixture(sendMail = async input => ({ accepted: [input.to], rejected: [] }), inputConfig = config) {
  let options;
  const calls = [];
  const provider = createAliyunDirectMailSmtpProvider(inputConfig, {
    createTransport(value) {
      options = value;
      return { async sendMail(input) { calls.push(input); return sendMail(input); } };
    },
  });
  return { provider, calls, get options() { return options; } };
}

test("Aliyun SMTP transport uses only fixed regional TLS endpoints and bounded timeouts", () => {
  for (const [region, host] of Object.entries(ALIYUN_DIRECT_MAIL_SMTP_ENDPOINTS)) {
    const f = fixture(undefined, { ...config, region });
    assert.deepEqual(f.options, {
      host,
      port: 465,
      secure: true,
      auth: { user: config.username, pass: config.password },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
      dnsTimeout: 5_000,
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true, servername: host },
      logger: false,
      debug: false,
      transactionLog: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
});

test("Aliyun SMTP configuration rejects arbitrary hosts senders and unsafe credentials before transport creation", () => {
  let created = 0;
  const dependencies = { createTransport() { created++; throw new Error("must not run"); } };
  const invalid = [
    { region: "moon-1" },
    { username: "other@example.invalid" },
    { username: `no-reply${String.fromCharCode(10)}@example.invalid`, from: `no-reply${String.fromCharCode(10)}@example.invalid` },
    { password: "" },
    { password: "x".repeat(513) },
    { password: `secret${String.fromCharCode(13)}value` },
  ];
  for (const patch of invalid) {
    assert.throws(() => createAliyunDirectMailSmtpProvider({ ...config, ...patch }, dependencies), error => {
      assert.equal(error.status, 503);
      assert.equal(JSON.stringify(error).includes(config.password), false);
      return true;
    });
  }
  assert.equal(created, 0);
});

test("Aliyun SMTP provider builds a fixed message without injectable delivery fields", async () => {
  const f = fixture();
  assert.deepEqual(await f.provider.deliver(message(), { idempotencyKey: "auth-email:job-1", signal: new AbortController().signal }), { status: "accepted" });
  assert.equal(f.calls.length, 1);
  const outgoing = f.calls[0];
  assert.deepEqual(Object.keys(outgoing).sort(), ["attachDataUrls", "disableFileAccess", "disableUrlAccess", "from", "html", "messageId", "subject", "text", "to", "xMailer"]);
  assert.equal(outgoing.from, config.from);
  assert.equal(outgoing.to, "student@example.invalid");
  assert.equal(outgoing.subject, "Verify your CUAC email");
  assert.match(outgoing.messageId, /^<cuac-auth-[a-f0-9]{64}@example\.invalid>$/);
  assert.equal(outgoing.messageId.includes("job-1"), false);
  assert.equal(outgoing.text.includes("PRIVATE_TOKEN"), true);
  assert.equal(outgoing.html.includes("PRIVATE_TOKEN"), true);
  assert.equal(JSON.stringify(outgoing).includes(config.password), false);
});

test("Aliyun SMTP provider maps exact accepted rejected and ambiguous recipient outcomes", async () => {
  const signal = new AbortController().signal;
  for (const [result, expected] of [
    [{ accepted: ["student@example.invalid"], rejected: [] }, "accepted"],
    [{ accepted: [], rejected: [{ address: "student@example.invalid" }] }, "not_accepted"],
    [{ accepted: ["other@example.invalid"], rejected: [] }, "unknown"],
    [{}, "unknown"],
  ]) {
    const f = fixture(async () => result);
    assert.deepEqual(await f.provider.deliver(message(), { idempotencyKey: "auth-email:job-2", signal }), { status: expected });
  }

  const rejected = fixture(async () => { throw Object.assign(new Error("rejected"), { rejected: ["student@example.invalid"] }); });
  assert.deepEqual(await rejected.provider.deliver(message(), { idempotencyKey: "auth-email:job-3", signal }), { status: "not_accepted" });
  const failed = fixture(async () => { throw new Error("PRIVATE_TOKEN PRIVATE_SMTP_PASSWORD"); });
  assert.deepEqual(await failed.provider.deliver(message(), { idempotencyKey: "auth-email:job-4", signal }), { status: "unknown" });
});

test("Aliyun SMTP provider rejects aborted malformed or cross-origin messages without sending", async () => {
  const f = fixture();
  const aborted = new AbortController();
  aborted.abort();
  assert.deepEqual(await f.provider.deliver(message(), { idempotencyKey: "auth-email:job-5", signal: aborted.signal }), { status: "unknown" });

  const invalidMessages = [
    message({ from: "other@example.invalid" }),
    message({ subject: "Injected subject" }),
    message({ to: "student@example.invalid\r\nBcc: other@example.invalid" }),
    message({ templateData: { ...message().templateData, actionUrl: "https://evil.example.invalid/auth/verify-email#challenge=challenge-1&token=PRIVATE_TOKEN" } }),
    message({ templateData: { ...message().templateData, actionUrl: "https://cuac.example.invalid/auth/verify-email?next=evil#challenge=challenge-1&token=PRIVATE_TOKEN" } }),
    message({ templateData: { ...message().templateData, actionUrl: "https://cuac.example.invalid/api/auth/verify-email#challenge=challenge-1&token=PRIVATE_TOKEN" } }),
    message({ templateData: { ...message().templateData, actionUrl: "https://cuac.example.invalid/auth/verify-email#challenge=other&token=PRIVATE_TOKEN" } }),
  ];
  for (const invalid of invalidMessages) {
    assert.deepEqual(await f.provider.deliver(invalid, { idempotencyKey: "auth-email:job-6", signal: new AbortController().signal }), { status: "unknown" });
  }
  assert.deepEqual(await f.provider.deliver(message(), { idempotencyKey: "bad key with spaces", signal: new AbortController().signal }), { status: "unknown" });
  assert.equal(f.calls.length, 0);
});

test("Aliyun SMTP HTML escapes action URL attributes and expiry text", async () => {
  const f = fixture();
  await f.provider.deliver(message({
    templateData: {
      ...message().templateData,
      actionUrl: "https://cuac.example.invalid/auth/verify-email#challenge=challenge-1&token=%22PRIVATE_TOKEN%22",
    },
  }), { idempotencyKey: "auth-email:job-7", signal: new AbortController().signal });
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].html, /challenge=challenge-1&amp;token=%22PRIVATE_TOKEN%22/);
  assert.equal(f.calls[0].html.includes('href="https://cuac.example.invalid/auth/verify-email#challenge=challenge-1&token='), false);
});
