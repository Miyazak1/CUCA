import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { applicationCommandDigests, parseApplicationIdempotencyKey } from "../../../src/server/student/application-commands.ts";
import { parseApplicationChoice, parseApplicationSet } from "../../../src/server/student/input.ts";
import { StudentCoreService } from "../../../src/server/student/service.ts";
import { createStudentHttpHandlers } from "../../../src/server/student/http.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresApplicationCommands } from "../../../src/server/student/postgres-application-commands.ts";

const ctx = createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student", purpose: "student_action" });
const key = randomUUID();

test("application keys are strict, bounded, case sensitive and not authority", () => {
  for (const value of [undefined, null, "", "a".repeat(15), "a".repeat(129), ` ${key}`, `${key} `, `${key},${key}`, "a".repeat(16) + "\n", 123, "\u5b66\u751f".repeat(16)]) {
    assert.throws(() => parseApplicationIdempotencyKey(value), error => error.status === 400);
  }
  for (const value of [key, "a".repeat(16), "a".repeat(128), "_ABC-0123456789xy"]) assert.equal(parseApplicationIdempotencyKey(value), value);
  const input = parseApplicationSet({ name: "A" });
  assert.notEqual(applicationCommandDigests("application_set.create", input, "a".repeat(16)).keyHash, applicationCommandDigests("application_set.create", input, "A".repeat(16)).keyHash);
});

test("v1 request digests use parsed meaning, including route set and normalized defaults", () => {
  const setA = applicationCommandDigests("application_set.create", parseApplicationSet({ name: "  Main ", userId: "ignored" }), key);
  const setB = applicationCommandDigests("application_set.create", parseApplicationSet({ targetIntake: null, name: "Main" }), key);
  assert.deepEqual(setA, setB);
  assert.match(setA.keyHash, /^[a-f0-9]{64}$/);
  const input = { applicationSetId: randomUUID(), schoolId: randomUUID() };
  const digest = value => applicationCommandDigests("application_choice.add", parseApplicationChoice(value), key);
  assert.deepEqual(digest(input), digest({ schoolId: input.schoolId.toUpperCase(), applicationSetId: input.applicationSetId, rankOrder: 0, studentNotes: null }));
  assert.notEqual(digest(input).requestHash, digest({ ...input, applicationSetId: randomUUID() }).requestHash);
  assert.notEqual(digest(input).requestHash, digest({ ...input, studentNotes: "private" }).requestHash);
});

test("keyed calls fail closed without receipt storage; wrong persona cannot reach it", async () => {
  let writes = 0;
  const service = new StudentCoreService({ async createApplicationSet() { writes++; return { id: randomUUID() }; } });
  await assert.rejects(service.createOwnApplicationSet(ctx, { name: "Main" }, { idempotencyKey: key }), error => error.status === 503);
  for (const context of [{ ...ctx, activeRole: "guest" }, { ...ctx, activeRole: "cuac_admin" }, { ...ctx, tenantSchoolId: randomUUID() }, { ...ctx, dataClassAllowlist: [] }]) {
    await assert.rejects(service.createOwnApplicationSet(context, { name: "Main" }, { idempotencyKey: key }), error => error.status === 403);
  }
  assert.equal(writes, 0);
});

test("application HTTP writes require valid keys before calling the service", async () => {
  let calls = 0;
  const auth = { async findActiveSessionByTokenHash() { return { ...ctx, userId: ctx.actorUserId, accountStatus: "active", revokedAt: null, expiresAt: new Date(Date.now() + 60000) }; } };
  const service = { async createOwnApplicationSet() { calls++; }, async addOwnApplicationChoice() { calls++; } };
  const handlers = createStudentHttpHandlers(service, auth);
  for (const value of [null, "", "short", `${key}, ${key}`, "x".repeat(129)]) {
    for (const method of ["createApplicationSet", "addApplicationChoice"]) {
      const headers = { cookie: "cuac_session=test-token" };
      if (value !== null) headers["idempotency-key"] = value;
      const body = method === "createApplicationSet" ? { name: "Main" } : { schoolId: randomUUID() };
      const response = await handlers[method](new Request("https://cuac.test/api", { method: "POST", headers, body: JSON.stringify(body) }), randomUUID());
      assert.equal(response.status, 400);
    }
  }
  assert.equal(calls, 0);
});

test("service passes only normalized input and actor-derived owner to the command executor", async () => {
  const calls = [];
  const executor = { async execute(context, operation, input, key, create) { calls.push({ context, operation, input, key }); return create(); } };
  const service = new StudentCoreService({ async createApplicationSet(userId, input) { return { id: randomUUID(), userId, ...input, status: "draft", choices: [] }; } }, null, executor);
  const result = await service.createOwnApplicationSet(ctx, { name: " Main ", userId: randomUUID() }, { idempotencyKey: key });
  assert.equal(result.userId, ctx.actorUserId);
  assert.deepEqual(calls[0].input, { name: "Main", targetIntake: null });
  assert.equal(calls[0].key, key);
  assert.equal(calls[0].operation, "application_set.create");
});

test("authorization snapshot and submit commands acquire the account write lock before any later scope lock", async () => {
  const statements = [];
  const client = { async query(sql) { statements.push(sql); return [{ id: randomUUID() }]; } };
  const commands = new PostgresApplicationCommands(client, { async record() {} });
  const create = async () => ({ id: randomUUID() });
  for (const operation of ["application_authorization.record", "application_material_snapshot.create", "application.submit"]) {
    await commands.execute(ctx, operation, {}, undefined, create, async () => null);
    assert.match(statements[0], /from users[\s\S]*for update$/);
    assert.match(statements[1], /from user_roles[\s\S]*for share$/);
    statements.length = 0;
  }
  await commands.execute(ctx, "application_set.create", {}, undefined, create, async () => null);
  assert.match(statements[0], /from users[\s\S]*for share$/);
});
