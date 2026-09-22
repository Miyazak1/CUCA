import assert from "node:assert/strict";
import test from "node:test";
import { GuardianConsentService } from "../../../src/server/auth/guardian-consent.ts";
import { createGuardianConsentHttpHandlers } from "../../../src/server/auth/guardian-consent-http.ts";

const now = new Date("2026-09-20T08:00:00.000Z");
const passwordHasher = { async hash(value) { return `test-hash:${value}`; }, async verifyForLogin() { throw new Error("unused"); } };

function fixture() {
  const calls = [];
  const repository = {
    async findIdentity() { return null; },
    async createPending(input) { calls.push(input); return { requestId: input.id, expiresAt: input.expiresAt }; },
    async accept(input) { calls.push(input); return { userId: "00000000-0000-4000-8000-000000000001", childEmail: "child@example.com" }; },
    async decline(input) { calls.push(input); return { declined: true }; },
  };
  return { calls, service: new GuardianConsentService(repository, { now, passwordHasher }) };
}

test("under-14 registration binds a different guardian email, relationship, 72-hour expiry and hashed credentials", async () => {
  const { calls, service } = fixture();
  const result = await service.request({ email: "Child@Example.com", password: "very strong password", displayName: "Child",
    guardianEmail: "Guardian@Example.com", guardianRelationship: "parent", locale: "zh-CN", uiLocale: "ms-MY", ip: "203.0.113.1", userAgent: "browser" });
  assert.equal(result.expiresAt.toISOString(), "2026-09-23T08:00:00.000Z");
  assert.equal(calls[0].emailNormalized, "child@example.com");
  assert.equal(calls[0].guardianEmailNormalized, "guardian@example.com");
  assert.equal(calls[0].guardianRelationship, "parent");
  assert.equal(calls[0].locale, "zh-CN");
  assert.equal(calls[0].uiLocale, "ms");
  assert.equal(calls[0].passwordHash, "test-hash:very strong password");
  assert.match(calls[0].consentTokenHash, /^sha256:[a-f0-9]{64}$/);
  assert.match(calls[0].guardianEmailSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /password|guardian@example|consentToken/i);
});

test("under-14 registration rejects self-approval and unsupported guardian claims", async () => {
  const { service } = fixture();
  const base = { email: "child@example.com", password: "very strong password", displayName: "Child",
    guardianEmail: "child@example.com", guardianRelationship: "parent", locale: "en" };
  await assert.rejects(service.request(base), /different/);
  await assert.rejects(service.request({ ...base, guardianEmail: "guardian@example.com", guardianRelationship: "sibling" }), /relationship/);
});

test("concurrent duplicate under-14 registration returns a stable conflict", async () => {
  const repository = {
    async findIdentity() { return null; },
    async createPending() { const error = new Error("duplicate"); error.code = "23505"; throw error; },
  };
  const service = new GuardianConsentService(repository, { now, passwordHasher });
  await assert.rejects(service.request({ email: "child@example.com", password: "very strong password",
    guardianEmail: "guardian@example.com", guardianRelationship: "parent", locale: "en" }),
  error => error?.status === 409 && /already exists/.test(error.message));
});

test("guardian action HTTP returns activation without a login cookie or token echo", async () => {
  const { service } = fixture();
  const handlers = createGuardianConsentHttpHandlers(service);
  const token = Buffer.alloc(32, 7).toString("base64url");
  const response = await handlers.accept(new Request("https://cuac.test/api/v1/auth/guardian-consent/accept", {
    method: "POST", body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000002", token }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await response.text();
  assert.match(body, /"activated":true/);
  assert.doesNotMatch(body, new RegExp(token));
});
