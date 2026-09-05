import assert from "node:assert/strict";
import test from "node:test";
import { AgentMemoryManagementService } from "../../../src/server/agent/memory-management.ts";
import { AgentContextService } from "../../../src/server/agent/context.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createMemoryManagementHttpHandler, getMemoryManagementHttpHandler } from "../../../src/server/agent/memory-management-http.ts";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";
import { PostgresAgentContextRepository } from "../../../src/server/agent/postgres-context-repository.ts";
import { PostgresAgentMemoryManagementRepository } from "../../../src/server/agent/postgres-memory-management-repository.ts";

const id = "a1111111-a111-4111-8111-a11111111111";
const context = createRequestContext({ actorUserId: id, activeRole: "student", selectedSurface: "student", purpose: "student_action" });

test("disabled Agent memory runtime fails closed without session or database access", async () => {
  const handler = getMemoryManagementHttpHandler({ CUAC_AGENT_ENABLED: "false" });
  const response = await handler(new Request("https://cuac.test/api/v1/agent/memories"), "list");
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
  assert.equal((await getMemoryManagementHttpHandler({ CUAC_AGENT_ENABLED: "invalid" })(
    new Request("https://cuac.test/api/v1/agent/memories"), "list")).status, 503);
});
function fixture(rows = [], enabled = true, revision = 0) {
  const calls = [], audits = [];
  const repository = {
    async lockPolicy(userId) { calls.push(["lock", userId]); return { enabled, revision }; },
    async countStored(userId) { calls.push(["count", userId]); return rows.length; },
    async list(...args) { calls.push(["list", ...args]); return rows; },
    async clearOne(...args) { calls.push(["clear", ...args]); return true; },
    async reset(...args) { calls.push(["reset", ...args]); revision += 1; enabled = args[2] ?? enabled; return { enabled, revision, clearedCount: 1, clearedCandidateCount: 2 }; },
  };
  return { calls, audits, service: new AgentMemoryManagementService(repository, { async record(event) { audits.push(event); } }) };
}

test("memory management rejects non-student personas and malformed commands before access", async () => {
  const { service, calls } = fixture();
  for (const changes of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "school_staff" }, { activeRole: "cuac_admin" }, { tenantSchoolId: id }, { dataClassAllowlist: [] }, { purpose: "agent_tool" }, { selectedSurface: "public" }, { selectedSurface: "ops" }, { authStrength: "guest" }]) {
    const ctx = { ...context, ...changes };
    for (const work of [() => service.list(ctx), () => service.clearOne(ctx, id), () => service.clearAll(ctx), () => service.setEnabled(ctx, { enabled: false })]) {
      await assert.rejects(work(), (e) => e.status === 403);
    }
  }
  for (const body of [null, [], { limit: "20" }, { limit: 101 }, { offset: 0 }, { cursor: "bad" }, { cursor: null }, { userId: id }, { privateMarker: "NEVER_LOG" }]) await assert.rejects(service.list(context, body), (e) => e.status === 400);
  for (const body of [{ enabled: "false" }, { enabled: null }, { enabled: false, resetAt: "2099-01-01" }]) await assert.rejects(service.setEnabled(context, body), (e) => e.status === 400);
  for (const expectedRevision of [undefined, null, "0", -1, 0.5, 2_147_483_648]) {
    await assert.rejects(service.clearAll(context, { expectedRevision }), e => e.status === 400);
    await assert.rejects(service.setEnabled(context, { enabled: false, expectedRevision }), e => e.status === 400);
  }
  await assert.rejects(service.clearOne(context, "bad-id"), (e) => e.status === 400);
  assert.deepEqual(calls, []);
});

test("memory management requires the student's explicit control purpose rather than Agent tool authority", async () => {
  const { service, calls } = fixture();
  const agent = { ...context, selectedSurface: "student", purpose: "agent_tool" };
  await assert.rejects(service.list(agent), e => e.status === 403);
  assert.deepEqual(calls, []);
});

test("memory listing regenerates bounded projections and skips unsafe legacy structured content", async () => {
  const date = new Date("2026-08-31");
  const valid = { id, memoryType: "study_goal", structured: { degreeLevel: "master" }, createdAt: date, expiresAt: null, summary: "PRIVATE_MARKER", userId: id };
  const bad = { ...valid, structured: { passport: "PRIVATE_MARKER" } };
  const { service, calls, audits } = fixture([valid, bad, valid]);
  const result = await service.list(context, { limit: 2 });
  assert.equal(result.items.length, 1);
  assert.equal(result.nextCursor, bad.id);
  assert.equal(result.storedCount, 3);
  assert.equal(result.capacity, 100);
  assert.equal(result.items[0].summary, "Degree: master");
  assert.equal(result.items[0].userId, undefined);
  assert.deepEqual(calls, [["lock", id], ["count", id], ["list", id, 3, null]]);
  assert.doesNotMatch(JSON.stringify({ result, audits }), /PRIVATE_MARKER|passport/);
  assert.deepEqual(audits[0].metadata, { count: 1 });
});

test("disabled memory is not loaded even if legacy records still exist", async () => {
  const { service, calls } = fixture([{ id }], false);
  assert.deepEqual(await service.list(context), { enabled: false, revision: 0, storedCount: 1, capacity: 100, items: [], nextCursor: null });
  assert.deepEqual(calls, [["lock", id], ["count", id]]);
});

test("memory clearing and preferences use the authenticated account and omit content from audit", async () => {
  const { service, calls, audits } = fixture();
  assert.deepEqual(await service.clearOne(context, id), { cleared: true });
  assert.deepEqual(await service.clearAll(context, { expectedRevision: 0 }), { enabled: true, revision: 1, clearedCount: 1, clearedCandidateCount: 2 });
  assert.deepEqual(await service.setEnabled(context, { enabled: false, expectedRevision: 1 }), { enabled: false, revision: 2 });
  assert.deepEqual(calls.filter((c) => c[0] === "reset"), [["reset", id, 0], ["reset", id, 1, false]]);
  assert.deepEqual(audits.map((a) => a.action), ["agent.memory.clear", "agent.memory.clear_all", "agent.memory.preference.update"]);
  assert.doesNotMatch(JSON.stringify(audits), /attacker/);
});

test("already-selected preference does not reset memory or create a false change audit", async () => {
  const { service, calls, audits } = fixture();
  assert.deepEqual(await service.setEnabled(context, { enabled: true, expectedRevision: 0 }), { enabled: true, revision: 0 });
  assert.deepEqual(calls, [["lock", id]]);
  assert.deepEqual(audits, []);
});

test("stale clear and toggle requests fail before reset, including already-selected values", async () => {
  const { service, calls, audits } = fixture([], false, 2);
  for (const work of [() => service.clearAll(context, { expectedRevision: 1 }),
    () => service.setEnabled(context, { enabled: true, expectedRevision: 1 }),
    () => service.setEnabled(context, { enabled: false, expectedRevision: 1 })]) await assert.rejects(work(), e => e.status === 409);
  assert.ok(calls.every(([name]) => name === "lock"));
  assert.deepEqual(audits, []);
});

test("reset revision exhaustion fails closed but current no-op is still readable", async () => {
  const { service, calls } = fixture([], true, 2_147_483_647);
  await assert.rejects(service.clearAll(context, { expectedRevision: 2_147_483_647 }), e => e.status === 503);
  await assert.rejects(service.setEnabled(context, { enabled: false, expectedRevision: 2_147_483_647 }), e => e.status === 503);
  assert.deepEqual(await service.setEnabled(context, { enabled: true, expectedRevision: 2_147_483_647 }), { enabled: true, revision: 2_147_483_647 });
  assert.ok(calls.every(([name]) => name === "lock"));
});

test("unsafe-only pages still advance the cursor using the last scanned row", async () => {
  const bad = { id, memoryType: "study_goal", structured: { passport: "PRIVATE" }, createdAt: new Date(), expiresAt: null };
  const last = { ...bad, id: "b1111111-b111-4111-8111-b11111111111" };
  const { service, calls } = fixture([bad, last]);
  const result = await service.list(context, { limit: 1, cursor: id.toUpperCase() });
  assert.deepEqual(result.items, []);
  assert.equal(result.nextCursor, id);
  assert.deepEqual(calls.at(-1), ["list", id, 2, id]);
});

test("context proposals and confirmations cannot bypass a disabled persistence policy", async () => {
  const marker = new Error("disabled");
  const calls = [];
  const service = new AgentContextService({ async assertMemoryAllowed() { calls.push("policy"); throw marker; } });
  for (const work of [() => service.proposeCandidate(context, { candidateType: "study_goal", structured: { degreeLevel: "master" } }),
    () => service.acceptCandidateAsMemory(context, id),
    () => service.carryForwardGuestCandidateToStudentMemory({ ...context, guestSessionId: "binding" }, id)]) {
    await assert.rejects(work(), (e) => e === marker);
  }
  assert.deepEqual(calls, ["policy", "policy", "policy"]);
});

test("memory HTTP derives student action authority from the session and validates queries and private headers", async () => {
  let captured;
  const auth = { async findActiveSessionByTokenHash() { return { userId: id, selectedSurface: "student", activeRole: "student", tenantSchoolId: null,
    authStrength: "session", expiresAt: new Date(Date.now() + 86400000), revokedAt: null, accountStatus: "active" }; } };
  const handler = createMemoryManagementHttpHandler({ async list(ctx, query) { captured = { ctx, query }; return { items: [] }; } }, auth);
  const route = secureApiRoute("GET", request => handler(request, "list"));
  const request = (query = "", headers = {}) => new Request(`https://cuac.test/api/v1/agent/memories${query}`, { headers: {
    cookie: "cuac_session=synthetic", "x-user-id": "attacker", "x-role": "cuac_admin", "x-purpose": "agent_tool", ...headers } });
  const response = await route(request("?limit=20&cursor=" + id));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(captured.ctx.actorUserId, id); assert.equal(captured.ctx.purpose, "student_action");
  assert.deepEqual(captured.query, { limit: 20, cursor: id });
  for (const query of ["?userId=x", "?limit=1&limit=2", "?offset=0", "?limit=0x20", "?limit=", "?cursor=x&cursor=y"]) {
    assert.equal((await route(request(query))).status, 400);
  }
  for (const site of ["cross-site", "same-site", "invented"]) assert.equal((await route(request("", { "sec-fetch-site": site }))).status, 403);
  assert.equal((await createMemoryManagementHttpHandler()(request(), "list")).status, 403);
  assert.equal((await createMemoryManagementHttpHandler(undefined, auth)(request(), "list")).status, 503);
  const broken = createMemoryManagementHttpHandler({ async list() { throw new Error("PRIVATE_STORAGE_VALUE"); } }, auth);
  const failed = await broken(request(), "list"); assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /PRIVATE_STORAGE/);
});

test("memory repository refuses an over-cap confirmation and a non-student namespace before insertion", async () => {
  const calls = [];
  const repository = new PostgresAgentContextRepository({ async query(sql) { calls.push(sql); return [{ count: 100 }]; } });
  const input = { userId: id, activeRole: "student", contextScope: "student_account", tenantSchoolId: null, memoryNamespace: `user:${id}:student` };
  await assert.rejects(repository.createMemoryEntry(input), e => e.status === 409);
  await assert.rejects(repository.createMemoryEntry({ ...input, memoryNamespace: "ops:foreign:audit" }), e => e.status === 403);
  assert.equal(calls.length, 1); assert.doesNotMatch(calls[0], /insert into/);
});

test("expired-memory sweep is bounded to low-sensitive student rows and scrubs linked candidate payloads", async () => {
  const calls = [];
  const memoryIds = [id, "b1111111-b111-4111-8111-b11111111111"];
  const repository = new PostgresAgentMemoryManagementRepository({ async query(sql, params) {
    calls.push({ sql, params });
    return calls.length === 1 ? memoryIds.map(value => ({ id: value })) : [{ id: "c1111111-c111-4111-8111-c11111111111" }];
  } });
  const result = await repository.sweepExpiredStudentMemories(2);
  assert.deepEqual(result, { clearedMemoryCount: 2, clearedCandidateCount: 1 });
  assert.match(calls[0].sql, /for update skip locked/);
  assert.match(calls[0].sql, /context_scope = 'student_account'/);
  assert.match(calls[0].sql, /data_class = 'low_sensitive_preference'/);
  assert.match(calls[0].sql, /source = 'retention_expired'/);
  assert.doesNotMatch(calls[0].sql, /school_tenant|ops_audit|payments|student_profiles/);
  assert.deepEqual(calls[0].params, [2]);
  assert.match(calls[1].sql, /m\.id = any\(\$1::uuid\[\]\)/);
  assert.match(calls[1].sql, /c\.user_id = m\.user_id/);
  assert.deepEqual(calls[1].params, [memoryIds]);
});
