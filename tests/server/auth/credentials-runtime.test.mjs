import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAuthCredentialsRouteHandlers } from "../../../src/server/index.ts";

test("auth credentials runtime fails closed without PostgreSQL credentials repository", async () => {
  const response = await createAuthCredentialsRouteHandlers().registerStudent(
    new Request("https://cuac.test/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "student@example.com", password: "strong-password" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
});

test("auth credentials runtime logout is idempotent without a cookie and fails closed with one", async () => {
  const handlers = createAuthCredentialsRouteHandlers();
  const noCookieResponse = await handlers.logout(new Request("https://cuac.test/api/v1/auth/logout", { method: "POST" }));
  const noCookieBody = await noCookieResponse.json();

  assert.equal(noCookieResponse.status, 200);
  assert.deepEqual(noCookieBody, { data: { revoked: false } });

  const cookieResponse = await handlers.logout(
    new Request("https://cuac.test/api/v1/auth/logout", {
      method: "POST",
      headers: { cookie: "cuac_session=raw-session-token" },
    }),
  );
  const cookieBody = await cookieResponse.json();

  assert.equal(cookieResponse.status, 503);
  assert.equal(cookieBody.error.code, "SERVICE_UNAVAILABLE");
});

test("auth credentials runtime step-up fails closed without PostgreSQL", async () => {
  const token = Buffer.alloc(32, 1).toString("base64url");
  const response = await createAuthCredentialsRouteHandlers().stepUpSession(
    new Request("https://cuac.test/api/v1/auth/step-up", { method: "POST",
      headers: { cookie: `cuac_session=${token}` }, body: JSON.stringify({ password: "strong-password" }) }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
});

test("auth credentials runtime route composition stays PostgreSQL-backed and does not use demo data", async () => {
  const source = await readFile(new URL("../../../src/server/auth/runtime/routes.ts", import.meta.url), "utf8");

  assert.match(source, /PostgresAuthSessionRepository/);
  assert.match(source, /AuthCredentialsService/);
  assert.doesNotMatch(source, /cuac-data|public\/|design-lab|select\s+\*|demo/i);
});
