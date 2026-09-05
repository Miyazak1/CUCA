import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext, SchoolCatalogCorrectionService } from "../../../src/server/index.ts";

const schoolId = "11111111-1111-4111-8111-111111111111";
const staffId = "22222222-2222-4222-8222-222222222222";
const opsId = "33333333-3333-4333-8333-333333333333";
const adminId = "44444444-4444-4444-8444-444444444444";
const correctionId = "55555555-5555-4555-8555-555555555555";
const sourceAt = new Date("2026-09-03T01:00:00.000Z");
const now = new Date("2026-09-03T02:00:00.000Z");

function schoolContext(overrides = {}) {
  return createRequestContext({ actorUserId: staffId, activeRole: "school_staff", selectedSurface: "school",
    tenantSchoolId: schoolId, purpose: "school_catalog_correction", authStrength: "session", ...overrides });
}
function opsContext(overrides = {}) {
  return createRequestContext({ actorUserId: opsId, activeRole: "cuac_ops", selectedSurface: "ops",
    purpose: "catalog_correction_review", authStrength: "session", ...overrides });
}
function correction(overrides = {}) {
  return { id: correctionId, schoolId, schoolNameZh: "示例大学", schoolNameEn: "Example University",
    sourceSchoolUpdatedAt: sourceAt, changes: { websiteUrl: "https://example.edu/new" },
    evidenceUrl: "https://example.edu/notice", reasonCode: "official_website_changed", revision: 1,
    status: "submitted", requestedMembershipRole: "school_admin", claimedByUserId: null,
    claimedByRole: null, claimedAt: null, resolvedByUserId: null, resolutionCode: null,
    resolutionReference: null, resolvedAt: null, resultSchoolUpdatedAt: null,
    createdAt: now, updatedAt: now, ...overrides };
}
function school() {
  return { id: schoolId, nameZh: "示例大学", nameEn: "Example University", updatedAt: "2026-09-03T01:00:00.000000Z",
    verificationStatus: "verified", websiteUrl: "https://example.edu/", admissionsUrl: null,
    applicationLevel: "Undergraduate", languageOfInstruction: "English", deadlineSummary: null,
    tuitionSummary: null, applicationFee: null };
}
function fixture(overrides = {}) {
  const calls = [], audits = [];
  const repository = {
    async listForSchool(input) { calls.push({ method: "school.list", input });
      return { authorized: true, value: { school: school(), items: [correction()] } }; },
    async submit(input) { calls.push({ method: "submit", input }); return { authorized: true, value: correction() }; },
    async listForOps(input) { calls.push({ method: "ops.list", input }); return { authorized: true, value: [correction()] }; },
    async claim(input) { calls.push({ method: "claim", input }); return { authorized: true,
      value: correction({ revision: 2, status: "claimed", claimedByUserId: opsId,
        claimedByRole: "cuac_ops", claimedAt: now }) }; },
    async resolve(input) { calls.push({ method: "resolve", input }); return { authorized: true,
      value: correction({ revision: 3, status: input.code === "applied_unverified" ? "applied" : "rejected",
        claimedByUserId: opsId, claimedByRole: "cuac_ops", claimedAt: now,
        resolvedByUserId: input.actorUserId, resolutionCode: input.code,
        resolutionReference: input.reference, resolvedAt: new Date(now.getTime() + 1000),
        resultSchoolUpdatedAt: input.code === "applied_unverified" ? new Date(now.getTime() + 1000) : sourceAt,
        updatedAt: new Date(now.getTime() + 1000) }) }; },
    ...overrides,
  };
  return { calls, audits, service: new SchoolCatalogCorrectionService(repository,
    { async record(event) { audits.push(event); } }) };
}

test("school correction uses exact real fields and hides CUAC actor identities", async () => {
  const { service, calls, audits } = fixture();
  const listed = await service.listForSchool(schoolContext());
  assert.equal(listed.school.updatedAt, "2026-09-03T01:00:00.000000Z");
  assert.equal(Object.hasOwn(listed.items[0], "claimedByUserId"), false);
  const submitted = await service.submit(schoolContext(), {
    sourceSchoolUpdatedAt: listed.school.updatedAt,
    changes: { websiteUrl: "https://example.edu/new", applicationFee: null },
    evidenceUrl: "https://example.edu/notice", reasonCode: "official_website_changed",
  });
  assert.equal(submitted.status, "submitted");
  assert.deepEqual(calls[1].input.changes, { websiteUrl: "https://example.edu/new", applicationFee: null });
  assert.deepEqual(audits[1].metadata.fieldNames, ["websiteUrl", "applicationFee"]);
  assert.doesNotMatch(JSON.stringify(audits[1]), /example\.edu|evidenceUrl|applicationFee":null/);
});

test("Ops claim and a different step-up admin may apply a correction as unverified", async () => {
  const { service, calls } = fixture();
  assert.equal((await service.claim(opsContext(), correctionId, { expectedRevision: 1 })).status, "claimed");
  const resolved = await service.resolve(opsContext({ actorUserId: adminId, activeRole: "cuac_admin",
    authStrength: "step_up" }), correctionId, {
    expectedRevision: 2, code: "applied_unverified", reference: "CASE:CATALOG-42",
  });
  assert.equal(resolved.status, "applied");
  assert.equal(resolved.resolutionCode, "applied_unverified");
  assert.deepEqual(calls.map(call => call.method), ["claim", "resolve"]);
});

test("correction service rejects forged contexts, unsupported fields and weak resolution", async () => {
  for (const context of [schoolContext({ selectedSurface: "student" }),
    schoolContext({ purpose: "school_review" }), schoolContext({ actorUserId: null })]) {
    const current = fixture();
    await assert.rejects(current.service.listForSchool(context), error => error.status === 403);
    assert.deepEqual(current.calls, []);
  }
  for (const input of [
    { sourceSchoolUpdatedAt: sourceAt.toISOString(), changes: {}, evidenceUrl: "https://example.edu/", reasonCode: "official_website_changed" },
    { sourceSchoolUpdatedAt: sourceAt.toISOString(), changes: { nameEn: "Forged" }, evidenceUrl: "https://example.edu/", reasonCode: "official_website_changed" },
    { sourceSchoolUpdatedAt: sourceAt.toISOString(), changes: { websiteUrl: "http://unsafe.test" }, evidenceUrl: "https://example.edu/", reasonCode: "official_website_changed" },
  ]) {
    const current = fixture();
    await assert.rejects(current.service.submit(schoolContext(), input), error => error.status === 400);
    assert.deepEqual(current.calls, []);
  }
  const weak = fixture();
  await assert.rejects(weak.service.resolve(opsContext({ actorUserId: adminId, activeRole: "cuac_admin" }),
    correctionId, { expectedRevision: 2, code: "rejected_unverifiable", reference: "CASE:1" }),
  error => error.status === 403);
  assert.deepEqual(weak.calls, []);
});

test("correction service fails closed on missing live authority and stale generations", async () => {
  const unauthorized = fixture({ async submit() { return { authorized: false }; } });
  await assert.rejects(unauthorized.service.submit(schoolContext(), {
    sourceSchoolUpdatedAt: sourceAt.toISOString(), changes: { websiteUrl: "https://example.edu/new" },
    evidenceUrl: "https://example.edu/notice", reasonCode: "official_website_changed",
  }), error => error.status === 403);
  const stale = fixture({ async claim() { return { authorized: true, value: null }; } });
  await assert.rejects(stale.service.claim(opsContext(), correctionId, { expectedRevision: 1 }),
    error => error.status === 409);
});
