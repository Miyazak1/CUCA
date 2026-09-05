import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { EmailTokenCipher, EmailTokenEnvelopeError } from "../../../src/server/auth/email-token-envelope.ts";
import { processOneAuthEmail } from "../../../src/server/auth/email-outbox-worker.ts";
import { validateAuthEmailDeliveryConfig } from "../../../src/server/auth/email-delivery.ts";

const config = { from: "no-reply@example.invalid", publicAppUrl: "https://cuac.example.invalid", verificationPath: "/auth/verify-email", passwordResetPath: "/auth/reset-password" };
const binding = () => ({ id: randomUUID(), userId: randomUUID(), challengeId: randomUUID(), messageType: "auth.email_verification", expiresAt: new Date(Date.now() + 60000) });
const key = randomBytes(32), cipher = () => new EmailTokenCipher({ activeKeyId: "key-a", keys: new Map([["key-a", key]]) });
const invalid = reason => error => error instanceof EmailTokenEnvelopeError && error.reason === reason && !error.message.includes(key.toString("hex"));

test("email envelope authenticates fixed-size credentials with unique nonce and no plaintext", () => {
  const c = cipher(), b = binding(), token = randomBytes(32).toString("base64url");
  const one = c.seal(b, token), two = c.seal(b, token);
  assert.notEqual(one.nonce, two.nonce); assert.notEqual(one.ciphertext, two.ciphertext);
  assert.equal(c.open(b, one), token); assert.equal(c.open(b, two), token);
  assert.equal(JSON.stringify(one).includes(token), false);
  assert.equal(Buffer.from(one.tag, "base64url").length, 16);
});

test("email envelope rejects tampering across identities purposes expiry and authenticated ciphertext", () => {
  const c = cipher(), b = binding(), envelope = c.seal(b, randomBytes(32).toString("base64url"));
  for (const patch of [{ id: randomUUID() }, { userId: randomUUID() }, { challengeId: randomUUID() }, { messageType: "auth.password_reset" }, { expiresAt: new Date(b.expiresAt.getTime() + 1) }]) {
    assert.throws(() => c.open({ ...b, ...patch }, envelope), invalid("invalid_envelope"));
  }
  for (const name of ["nonce", "tag", "ciphertext"]) {
    const bytes = Buffer.from(envelope[name], "base64url"); bytes[0] ^= 1;
    assert.throws(() => c.open(b, { ...envelope, [name]: bytes.toString("base64url") }), invalid("invalid_envelope"));
  }
  for (const value of [null, [], {}, { ...envelope, version: 2 }, { ...envelope, extra: "unsafe" }, { ...envelope, tag: "a".repeat(2000) }, { ...envelope, nonce: envelope.nonce + "=" }]) assert.throws(() => c.open(b, value), invalid("invalid_envelope"));
});

test("email keys are validated rotated and retained explicitly without missing-key plaintext fallback", () => {
  const c = cipher(), b = binding(), token = randomBytes(32).toString("base64url"), envelope = c.seal(b, token);
  const next = randomBytes(32), rotated = new EmailTokenCipher({ activeKeyId: "key-b", keys: new Map([["key-a", key], ["key-b", next]]) });
  assert.equal(rotated.open(b, envelope), token); assert.equal(rotated.seal(b, token).keyId, "key-b");
  assert.throws(() => new EmailTokenCipher({ activeKeyId: "key-b", keys: new Map([["key-b", next]]) }).open(b, envelope), invalid("key_unavailable"));
  assert.throws(() => c.open(b, { ...envelope, keyId: "key-b" }), invalid("key_unavailable"));
  for (const size of [0, 16, 31, 33]) assert.throws(() => new EmailTokenCipher({ activeKeyId: "bad", keys: new Map([["bad", randomBytes(size)]]) }), invalid("key_unavailable"));
  assert.throws(() => c.seal(b, "not-a-generated-token"), invalid("invalid_envelope"));
});

test("email action configuration forbids arbitrary origins redirects and API links", () => {
  assert.deepEqual(validateAuthEmailDeliveryConfig(config), config);
  for (const publicAppUrl of ["http://cuac.example.invalid", "https://@cuac.example.invalid", `https://cuac${String.fromCharCode(0)}.example.invalid`, "https://user:pass@cuac.example.invalid", "https://cuac.example.invalid/path", "https://cuac.example.invalid?next=evil", "https://cuac.example.invalid#token", "https://cuac.example.invalid\\@evil.invalid"]) {
    assert.throws(() => validateAuthEmailDeliveryConfig({ ...config, publicAppUrl }), /HTTPS/);
  }
  for (const verificationPath of [undefined, "//evil.invalid", "/api/v1/auth/verify", "/auth/../api", "/auth?redirect=evil", "/auth#token", "/auth/%2f%2fevil"]) assert.throws(() => validateAuthEmailDeliveryConfig({ ...config, verificationPath }), /action page/);
});

test("email worker never invokes provider before prepared transaction resolves and excludes token from server request URL", async () => {
  const job = { ...binding(), emailNormalized: "synthetic@example.invalid", token: randomBytes(32).toString("base64url") }, lease = { id: job.id, userId: job.userId, leaseId: randomUUID() };
  const order = [];
  const outbox = { async claim() { order.push("claim"); return lease; }, async prepare() { order.push("prepare-committed"); return job; }, async finish(value, result) { assert.deepEqual(value, lease); order.push(result); return true; } };
  const result = await processOneAuthEmail(outbox, { async deliver(message, options) {
    assert.deepEqual(order, ["claim", "prepare-committed"]); order.push("provider");
    const url = new URL(message.templateData.actionUrl); assert.equal(url.search, ""); assert.equal(url.pathname, config.verificationPath);
    assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), job.token);
    assert.equal(options.idempotencyKey, `auth-email:${job.id}`); assert.equal(options.signal.aborted, false);
    return { status: "accepted" };
  } }, config);
  assert.deepEqual(order, ["claim", "prepare-committed", "provider", "accepted"]); assert.deepEqual(result, { status: "accepted" });
});

test("email worker stops on ambiguous prepare and treats raw provider failures or malformed results as unknown", async () => {
  let sent = 0, completed;
  const outbox = { async claim() { return {}; }, async prepare() { throw new Error("uncertain commit"); }, async finish(_lease, status) { completed = status; return true; } };
  const provider = { async deliver() { sent++; throw new Error("PRIVATE_EMAIL_TOKEN"); } };
  await assert.rejects(processOneAuthEmail(outbox, provider, config), /uncertain commit/); assert.equal(sent, 0);
  outbox.prepare = async () => ({ ...binding(), emailNormalized: "synthetic@example.invalid", token: "synthetic" });
  assert.deepEqual(await processOneAuthEmail(outbox, provider, config), { status: "unknown" }); assert.equal(completed, "unknown");
  provider.deliver = async () => ({ status: "invented" });
  assert.deepEqual(await processOneAuthEmail(outbox, provider, config), { status: "unknown" });
  outbox.finish = async () => false;
  assert.deepEqual(await processOneAuthEmail(outbox, provider, config), { status: "unconfirmed" });
});

test("email worker bounds a hung provider and records unknown instead of automatically retrying", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal, calls = 0, recorded;
  const ready = Promise.withResolvers();
  const work = processOneAuthEmail({ async claim() { return {}; }, async prepare() { return { ...binding(), emailNormalized: "synthetic@example.invalid", token: "synthetic" }; }, async finish(_lease, status) { recorded = status; return true; } }, {
    deliver(_message, options) { calls++; signal = options.signal; ready.resolve(); return new Promise(() => {}); },
  }, config);
  await ready.promise; t.mock.timers.tick(10_000);
  assert.deepEqual(await work, { status: "unknown" }); assert.equal(signal.aborted, true); assert.equal(calls, 1); assert.equal(recorded, "unknown");
});
