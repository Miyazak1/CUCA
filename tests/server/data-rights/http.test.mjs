import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SESSION_COOKIE_NAME } from "../../../src/server/auth/session.ts";
import { createDataRightsHttpHandlers } from "../../../src/server/data-rights/http.ts";
import { DataRightsService } from "../../../src/server/data-rights/service.ts";

const userId = "a1111111-a111-4111-8111-a11111111111";
const requestId = "b1111111-b111-4111-8111-b11111111111";
const activeStudentSession = (authStrength = "session") => ({
  userId,
  selectedSurface: "student",
  activeRole: "student",
  tenantSchoolId: null,
  authStrength,
  expiresAt: new Date("2026-10-20T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
});

function createHandlers(session = activeStudentSession()) {
  const calls = [];
  const row = (input, extra = {}) => ({
    id: input.requestId,
    requestType: input.requestType,
    correctionScope: input.correctionScope,
    preferredLocale: input.preferredLocale,
    status: "received",
    revision: 1,
    receivedAt: new Date("2026-09-20T00:00:00.000Z"),
    identityConfirmedAt: null,
    closedAt: null,
    updatedAt: new Date("2026-09-20T00:00:00.000Z"),
    ...extra,
  });
  const repository = {
    async listOwn(ownerUserId) { calls.push({ method: "listOwn", ownerUserId }); return { authorized: true, rows: [] }; },
    async createOwn(input) { calls.push({ method: "createOwn", input }); return { authorized: true, row: row(input) }; },
    async cancelOwn(input) { calls.push({ method: "cancelOwn", input }); return { authorized: true, row: row({
      requestId: input.requestId, requestType: "access", correctionScope: null, preferredLocale: "en",
    }, { status: "cancelled", revision: input.expectedRevision + 1, closedAt: new Date("2026-09-21T00:00:00.000Z") }) }; },
  };
  const authRepository = { async findActiveSessionByTokenHash() { return session; } };
  const service = new DataRightsService(repository, { async record(event) { calls.push({ method: "audit", event }); } });
  return { calls, handlers: createDataRightsHttpHandlers(service, authRepository) };
}

function request(path, body, cookie = true) {
  return new Request(`https://cuac.test${path}`, {
    method: "POST",
    headers: cookie ? { cookie: `${SESSION_COOKIE_NAME}=student-token`, "content-type": "application/json" } : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("data-rights HTTP creates an owner-bound request from the authenticated session", async () => {
  const { calls, handlers } = createHandlers();
  const response = await handlers.create(request("/api/v1/data-rights/requests", {
    requestId, requestType: "access", correctionScope: null, preferredLocale: "en",
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.requestId, requestId);
  const call = calls.find(item => item.method === "createOwn");
  assert.equal(call.input.userId, userId);
  assert.match(call.input.subjectReferenceHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(body).includes(userId), false);
});

test("data-rights HTTP rejects guest access and browser-supplied ownership", async () => {
  const guest = createHandlers(null);
  const guestResponse = await guest.handlers.create(request("/api/v1/data-rights/requests", {
    requestId, requestType: "access", correctionScope: null, preferredLocale: "en",
  }, false));
  assert.equal(guestResponse.status, 403);
  assert.equal(guest.calls.some(item => item.method === "createOwn"), false);

  const authenticated = createHandlers();
  const forgedResponse = await authenticated.handlers.create(request("/api/v1/data-rights/requests", {
    requestId, requestType: "access", correctionScope: null, preferredLocale: "en", userId: "attacker",
  }));
  assert.equal(forgedResponse.status, 400);
  assert.equal(authenticated.calls.some(item => item.method === "createOwn"), false);
});

test("data-rights HTTP preserves step-up enforcement for export and deletion", async () => {
  const ordinary = createHandlers();
  const denied = await ordinary.handlers.create(request("/api/v1/data-rights/requests", {
    requestId, requestType: "portable_export", correctionScope: null, preferredLocale: "zh-CN",
  }));
  assert.equal(denied.status, 403);

  const steppedUp = createHandlers(activeStudentSession("step_up"));
  const accepted = await steppedUp.handlers.create(request("/api/v1/data-rights/requests", {
    requestId, requestType: "account_deletion", correctionScope: null, preferredLocale: "zh-CN",
  }));
  assert.equal(accepted.status, 200);
});

test("data-rights app routes remain thin and contain no SQL or identity authority", async () => {
  const routes = [
    "../../../app/api/v1/data-rights/requests/route.ts",
    "../../../app/api/v1/data-rights/requests/[requestId]/cancel/route.ts",
  ];
  const sources = await Promise.all(routes.map(route => readFile(new URL(route, import.meta.url), "utf8")));
  for (const source of sources) {
    assert.match(source, /getDataRightsRouteHandlers/);
    assert.doesNotMatch(source, /select\s+|insert\s+|update\s+|userId|subjectReferenceHash/i);
  }
});
