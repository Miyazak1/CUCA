import assert from "node:assert/strict";
import test from "node:test";
import { createStaffMfaHttpHandlers } from "../../../src/server/auth/staff-mfa-http.ts";

const challengeToken = Buffer.alloc(32, 5).toString("base64url");

test("MFA enrollment response is no-store and returns only authenticator enrollment material", async () => {
  const calls = [];
  const handlers = createStaffMfaHttpHandlers({
    async startEnrollment(input) {
      calls.push(input);
      return { enrollmentRequired: true, factorId: "factor-1", secret: "A".repeat(32),
        otpauthUri: "otpauth://totp/CUAC%3Astaff%40example.edu?secret=" + "A".repeat(32),
        expiresAt: new Date("2026-09-16T00:05:00.000Z") };
    },
  });
  const response = await handlers.startEnrollment(new Request("https://cuac.test/api/v1/auth/mfa/enrollment", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken }),
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [{ challengeToken }]);
  const body = await response.json();
  assert.equal(body.data.secret, "A".repeat(32));
  assert.equal(JSON.stringify(body).includes("ciphertext"), false);
});

test("successful MFA completion issues the normal secure session cookie and shows recovery codes only when enrolled", async () => {
  const handlers = createStaffMfaHttpHandlers({
    async completeLogin() {
      return { userId: "staff-1", sessionId: "session-1", sessionToken: Buffer.alloc(32, 6).toString("base64url"),
        expiresAt: new Date(Date.now() + 60_000), selectedSurface: "ops", activeRole: "cuac_admin",
        tenantSchoolId: null, recoveryCodes: ["AAAA-BBBB-CCCC-DDDD"] };
    },
  }, { secureCookies: true });
  const response = await handlers.completeLogin(new Request("https://cuac.test/api/v1/auth/mfa/complete", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken, code: "123456" }),
  }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /Secure/);
  const body = await response.json();
  assert.deepEqual(body.data.recoveryCodes, ["AAAA-BBBB-CCCC-DDDD"]);
  assert.equal(JSON.stringify(body).includes("sessionToken"), false);
});

test("failed MFA completion is a stable forbidden response without a cookie", async () => {
  const handlers = createStaffMfaHttpHandlers({
    async completeLogin() { return { mfaVerificationFailed: true }; },
  });
  const response = await handlers.completeLogin(new Request("https://cuac.test/api/v1/auth/mfa/complete", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeToken, code: "000000" }),
  }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal((await response.json()).error.code, "FORBIDDEN");
});
