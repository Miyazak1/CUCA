import assert from "node:assert/strict";
import test from "node:test";
import { issueGuestSession, verifyGuestSession, guestSessionCookie, GUEST_SESSION_TTL_MS } from "../../../src/server/auth/guest-session.ts";
import { initializeGuestSession } from "../../../src/server/auth/guest-session-http.ts";
import { parseCookieHeader, resolveRequestContextFromRequest } from "../../../src/server/auth/session.ts";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";

const env = { CUAC_ENV: "production", CUAC_SESSION_SECRET: "synthetic-test-only-key-with-at-least-32-characters", CUAC_PUBLIC_APP_URL: "https://cuac.test" };
const now = new Date("2026-08-31T00:00:00Z");

test("guest tokens are signed, time-limited and resolved only to a one-way identifier", () => {
  const issued = issueGuestSession(now, env);
  assert.equal(verifyGuestSession(issued.token, now, env), issued.guestSessionId);
  assert.match(issued.guestSessionId, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(issueGuestSession(now, env).token, issued.token);
  for (const token of ["guest-1", issued.token + "x", issued.token.replace("v1.", "v2."), undefined]) assert.equal(verifyGuestSession(token, now, env), null);
  assert.equal(verifyGuestSession(issued.token, new Date(now.getTime() + GUEST_SESSION_TTL_MS), env), null);
  assert.equal(verifyGuestSession(issued.token, new Date(now.getTime() - 120_000), env), null);
  assert.equal(verifyGuestSession(issued.token, now, { ...env, CUAC_SESSION_SECRET: "other-synthetic-test-key-with-32-characters" }), null);
  assert.throws(() => issueGuestSession(now, { CUAC_ENV: "production" }), (e) => e.status === 503);
  assert.throws(() => issueGuestSession(now, { ...env, CUAC_SESSION_SECRET: "short" }), (e) => e.status === 503);
});

test("guest cookie is browser-session-only and protected by HttpOnly, Secure and SameSite", () => {
  const cookie = guestSessionCookie(issueGuestSession(now, env).token, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Expires|Max-Age|Domain=/);
});

test("guest initialization retains a valid binding and rotates explicitly without exposing tokens in JSON", async () => {
  const route = secureApiRoute("POST", (request) => initializeGuestSession(request, env), { env });
  const request = (cookie = "", body = {}) => new Request("https://cuac.test/api/v1/auth/guest-session", { method: "POST", headers: { origin: "https://cuac.test", "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  const first = await route(request());
  const cookie = first.headers.get("set-cookie").split(";")[0];
  assert.deepEqual(await first.json(), { data: { status: "ready" } });
  assert.equal(first.headers.get("cache-control"), "no-store");
  const second = await route(request(cookie));
  assert.equal(second.headers.get("set-cookie"), null);
  const rotated = await route(request(cookie, { rotate: true }));
  assert.notEqual(rotated.headers.get("set-cookie").split(";")[0], cookie);
  assert.equal((await route(request(cookie, { rotate: "yes" }))).status, 400);
});

test("cookie parser ignores malformed unrelated cookies and fails closed on duplicate authority cookies", () => {
  assert.deepEqual(parseCookieHeader("analytics=%; cuac_session=valid"), { cuac_session: "valid" });
  assert.deepEqual(parseCookieHeader("cuac_session=a; cuac_session=b; cuac_guest=a; cuac_guest=b"), {});
  assert.deepEqual(parseCookieHeader("cuac_session=%; cuac_guest=%"), {});
  assert.deepEqual(parseCookieHeader("cuac_session=valid; cuac_session=%"), {});
});

test("untrusted raw guest identifiers never become a request-context binding", async () => {
  const context = await resolveRequestContextFromRequest(new Request("https://cuac.test/api", { headers: { cookie: "cuac_guest=attacker-chosen" } }), { async findActiveSessionByTokenHash() { assert.fail("no account lookup required"); } });
  assert.equal(context.guestSessionId, null);
  assert.equal(context.activeRole, "guest");
});
