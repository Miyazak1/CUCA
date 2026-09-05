import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { CatalogService } from "../../../src/server/catalog/service.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { createCatalogHttpHandlers } from "../../../src/server/catalog/http.ts";
import { createCatalogRouteHandlers } from "../../../src/server/catalog/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

test("public intake service validates the program, policy and bounded pagination", async () => {
  const calls = [], id = randomUUID();
  const service = new CatalogService({ async listProgramIntakes(...args) { calls.push(args); return []; } });
  assert.deepEqual(await service.listProgramIntakes(createRequestContext(), id.toUpperCase(), { limit: 999, offset: -3 }), []);
  assert.deepEqual(calls, [[id, { limit: 100, offset: 0, query: undefined }]]);
  await assert.rejects(service.listProgramIntakes(createRequestContext(), "invalid"), e => e.status === 400);
  await assert.rejects(service.listProgramIntakes(createRequestContext({ dataClassAllowlist: [] }), id), e => e.status === 403);
  assert.equal(calls.length, 1);
});

test("public intake SQL exposes only available catalog fields with stable pagination", async () => {
  const calls = [], id = randomUUID();
  const row = { id: randomUUID(), programId: id, intakeTerm: "fall", intakeYear: 2027, openDate: null,
    deadlineDate: null, deadlineLabel: null, applicationRound: "Round 1", status: "open", secret: "must-not-return" };
  const repo = new PostgresCatalogRepository({ async query(sql, params) { calls.push({ sql, params }); return [row]; } });
  const result = await repo.listProgramIntakes(id, { limit: 7, offset: 2 });
  assert.equal(result[0].id, row.id);
  assert.equal("secret" in result[0], false);
  assert.deepEqual(calls[0].params, [id, 7, 2]);
  for (const re of [/pi.program_id = \$1/, /p.status = 'active'/, /s.status = 'active'/, /pi.status = 'open'/,
    /deadline_date > clock_timestamp\(\)/, /pi.id asc/, /limit \$2 offset \$3/]) assert.match(calls[0].sql, re);
  assert.doesNotMatch(calls[0].sql, /select \*|users|application_choices|payments|audit_logs/i);
});

test("intake HTTP uses the path program, allows guests and fails closed without PostgreSQL", async () => {
  const id = randomUUID();
  const service = new CatalogService({ async listProgramIntakes(programId, options) { return [{ programId, options }]; } });
  const request = new Request("https://cuac.test/intakes?programId=ignored&limit=3&offset=1");
  const response = await createCatalogHttpHandlers(service).listProgramIntakes(request, id);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, [{ programId: id, options: { limit: 3, offset: 1 } }]);
  assert.equal((await createCatalogHttpHandlers(service).listProgramIntakes(request, "bad")).status, 400);
  assert.equal((await createCatalogRouteHandlers().listProgramIntakes(request, id)).status, 503);
});
