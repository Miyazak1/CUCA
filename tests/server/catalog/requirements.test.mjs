import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parseRequirementDocument, requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { CatalogService } from "../../../src/server/catalog/service.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { createCatalogRouteHandlers } from "../../../src/server/catalog/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { requirementDocument, syntheticReview } from "./requirements-fixture.mjs";

test("requirement documents preserve conditional text and evidence while canonicalizing object order", () => {
  const input = requirementDocument(), parsed = parseRequirementDocument(input);
  assert.deepEqual(parsed, input);
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  reordered.requirements = input.requirements.map(item => Object.fromEntries(Object.entries(item).reverse()));
  assert.equal(requirementDigest(reordered), requirementDigest(input));
  assert.equal(parsed.requirements[0].level, "conditional");
  assert.equal(parsed.requirements[0].evidenceType, "school_review");
  assert.equal(parsed.coverage, "partial");
  input.requirements[0].ruleText = "Different reviewed requirement";
  assert.notEqual(requirementDigest(input), requirementDigest(parsed));
});

test("requirements reject unknown fields, unsupported formats and malformed typed data", () => {
  for (const mutate of [d => { d.studentId = randomUUID(); }, d => { d.approved = true; }, d => { d.schemaVersion = "1"; },
    d => { d.schemaVersion = 2; }, d => { d.coverage = "eligible"; }, d => { d.language = null; },
    d => { d.requirements[0].metadata = {}; }, d => { d.requirements[0].stage = "always"; },
    d => { d.requirements[0].ruleText = {}; }, d => { d.requirements[0].appliesTo = " "; },
    d => { d.sources[0].capturedAt = "2026-02-31T00:00:00.000Z"; }, d => { d.sources[0].contentSha256 = "ABC"; }]) {
    const d = requirementDocument(); mutate(d); assert.throws(() => parseRequirementDocument(d), e => e.status === 400);
  }
});

test("every requirement references included unique sources and citation URLs never contain authority", () => {
  for (const mutate of [d => { d.sources.push({ ...d.sources[0] }); }, d => { d.requirements.push({ ...d.requirements[0] }); },
    d => { d.requirements[0].references[0].sourceKey = "missing"; }, d => { d.requirements[0].references.push({ ...d.requirements[0].references[0] }); },
    d => { d.requirements[0].references = []; }, d => { d.sources[0].key = "../source"; }]) {
    const d = requirementDocument(); mutate(d); assert.throws(() => parseRequirementDocument(d), e => e.status === 400);
  }
  for (const url of ["javascript:alert(1)", "http://university.example.org/", "https://user:pass@university.example.org/", "https://127.0.0.1/",
    "https://[::1]/", "https://localhost/", "https://school.internal/", "https://school.example.org:8443/", "https://school.example.org/?access_token=secret"]) {
    const d = requirementDocument(); d.sources[0].url = url; assert.throws(() => parseRequirementDocument(d), e => e.status === 400);
  }
});

test("requirements apply bounded collections, valid Unicode and a UTF-8 byte ceiling", () => {
  for (const text of ["Bad\ntext", "Bad\ttext", "\ud800", "x".repeat(2001)]) {
    const d = requirementDocument(); d.requirements[0].ruleText = text; assert.throws(() => parseRequirementDocument(d), e => e.status === 400);
  }
  const d = requirementDocument(); d.requirements[0].ruleText = "\u5b66\u4f4d";
  assert.equal(parseRequirementDocument(d).requirements[0].ruleText, "\u5b66\u4f4d");
  d.requirements = Array.from({ length: 61 }, (_, n) => ({ ...d.requirements[0], key: `rule_${n}` }));
  assert.throws(() => parseRequirementDocument(d), e => e.status === 400);
  d.requirements = Array.from({ length: 60 }, (_, n) => ({ ...d.requirements[0], key: `rule_${n}`, ruleText: "\u5b66".repeat(1500) }));
  assert.throws(() => parseRequirementDocument(d), /too large/);
});

test("requirement service checks public policy and both UUIDs before repository use", async () => {
  const calls = [], p = randomUUID(), i = randomUUID();
  const service = new CatalogService({ async getProgramRequirements(...args) { calls.push(args); return null; } });
  assert.equal(await service.getProgramRequirements(createRequestContext(), p.toUpperCase(), i), null);
  assert.deepEqual(calls, [[p, i]]);
  await assert.rejects(service.getProgramRequirements(createRequestContext(), "invalid", i), e => e.status === 400);
  await assert.rejects(service.getProgramRequirements(createRequestContext(), p, "invalid"), e => e.status === 400);
  const guarded = new CatalogService(new Proxy({}, { get() { throw new Error("Repository accessed before policy"); } }));
  await assert.rejects(guarded.getProgramRequirements(createRequestContext({ dataClassAllowlist: [] }), p, i), e => e.status === 403);
  assert.equal(calls.length, 1);
});

test("requirements read one explicit publication snapshot, whitelist its DTO and fail closed on corruption", async () => {
  const calls = [], content = requirementDocument();
  let row = { programId: randomUUID(), programIntakeId: randomUUID(), publicationRevision: 3, versionId: randomUUID(), version: 2,
    content, contentSha256: requirementDigest(content), reviewedAt: new Date("2026-01-01T00:00:00Z"),
    effectiveFrom: new Date("2026-01-02T00:00:00Z"), reviewDueAt: new Date("2027-01-01T00:00:00Z"), preparedByUserId: randomUUID(), approvedByUserId: randomUUID(), reviewNote: "PRIVATE_NOTE" };
  row.reviewEvidence = syntheticReview(row, content);
  const repo = new PostgresCatalogRepository({ async query(sql, params) { calls.push({ sql, params }); return row ? [row] : []; } });
  const result = await repo.getProgramRequirements(row.programId, row.programIntakeId);
  assert.equal(result.assessmentMode, "information_only"); assert.equal(result.version, 2);
  assert.equal(Object.keys(result).length, 11); assert.doesNotMatch(JSON.stringify(result), new RegExp(`${row.preparedByUserId}|${row.approvedByUserId}|PRIVATE_NOTE|reviewEvidence`));
  assert.deepEqual(calls[0].params, [row.programId, row.programIntakeId]);
  for (const re of [/pub.version_id/, /v.program_intake_id = pi.id/, /p.id = \$1 and pi.id = \$2/,
    /pub.status = 'active'/, /review_status = 'approved'/, /review_due_at > statement_timestamp\(\)/]) assert.match(calls[0].sql, re);
  assert.doesNotMatch(calls[0].sql, /select \*|join users|student_profiles|payments|audit_logs|order by|limit/i);
  row = { ...row, contentSha256: "b".repeat(64) };
  await assert.rejects(repo.getProgramRequirements(row.programId, row.programIntakeId), e => e.status === 503 && !e.message.includes("PRIVATE"));
  row = null; assert.equal(await repo.getProgramRequirements(randomUUID(), randomUUID()), null);
});

test("requirements HTTP is guest-readable, path-bound and unavailable without PostgreSQL", async () => {
  const p = randomUUID(), i = randomUUID(), calls = [];
  const handlers = createCatalogRouteHandlers({ async getProgramRequirements(...args) { calls.push(args); return null; } });
  const request = new Request(`https://cuac.test/?programId=${randomUUID()}&version=999`);
  const result = await handlers.getProgramRequirements(request, p, i);
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { data: null }); assert.deepEqual(calls, [[p, i]]);
  assert.equal((await handlers.getProgramRequirements(request, p, "invalid")).status, 400);
  assert.equal((await createCatalogRouteHandlers().getProgramRequirements(request, p, i)).status, 503);
});
