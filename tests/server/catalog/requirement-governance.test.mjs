import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PostgresRequirementGovernance } from "../../../src/server/catalog/postgres-requirement-governance.ts";
import { approvedRequirementReview, parseRequirementReview, parseRequirementSourceChecks, requirementReviewDigest } from "../../../src/server/catalog/requirement-review.ts";
import { requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { evaluatePolicy } from "../../../src/server/policy/policy.ts";
import { requirementDocument, syntheticReview } from "./requirements-fixture.mjs";

const context = () => createRequestContext({ actorUserId: randomUUID(), activeRole: "cuac_admin", selectedSurface: "ops",
  purpose: "catalog_management", authStrength: "step_up" });
const unavailableClient = new Proxy({}, { get() { throw new Error("Database accessed before validation"); } });
function reviewed() {
  const document = requirementDocument(), row = { versionId: randomUUID(), programIntakeId: randomUUID(), contentSha256: requirementDigest(document),
    preparedByUserId: randomUUID(), approvedByUserId: randomUUID(), reviewedAt: new Date("2026-01-01T00:00:00Z"),
    effectiveFrom: new Date("2026-01-01T00:00:00Z"), reviewDueAt: new Date("2027-01-01T00:00:00Z") };
  row.reviewEvidence = syntheticReview(row, document);
  return { row, document };
}

test("requirement review evidence binds exact content scope identities times and source checks", () => {
  const { row, document } = reviewed(), review = approvedRequirementReview(row, document);
  row.reviewEvidence = Object.fromEntries(Object.entries(row.reviewEvidence).reverse());
  assert.equal(requirementReviewDigest(approvedRequirementReview(row, document)), requirementReviewDigest(review));
  for (const change of [{ versionId: randomUUID() }, { programIntakeId: randomUUID() }, { preparedByUserId: randomUUID() },
    { approvedByUserId: randomUUID() }, { contentSha256: "f".repeat(64) }, { effectiveFrom: new Date("2026-02-01T00:00:00Z") }]) {
    assert.throws(() => approvedRequirementReview({ ...row, ...change }, document), e => e.status === 400);
  }
});

test("requirement review rejects self approval malformed or missing attestations and extra fields", () => {
  const { row, document } = reviewed();
  for (const mutate of [r => { r.scopeConfirmed = false; }, r => { r.publicContentConfirmed = "true"; }, r => { r.studentData = {}; },
    r => { r.sourceChecks = []; }, r => { r.sourceChecks[0].contentSha256 = "b".repeat(64); }, r => { r.sourceChecks[0].officialSourceConfirmed = false; },
    r => { r.sourceChecks.push({ ...r.sourceChecks[0] }); }, r => { r.reviewDueAt = r.effectiveFrom; }, r => { r.schemaVersion = 2; }]) {
    const evidence = structuredClone(row.reviewEvidence); mutate(evidence);
    assert.throws(() => approvedRequirementReview({ ...row, reviewEvidence: evidence }, document), e => e.status === 400);
  }
  const self = { ...row, approvedByUserId: row.preparedByUserId }; self.reviewEvidence = syntheticReview(self, document);
  assert.throws(() => approvedRequirementReview(self, document), /identity or time/);
  assert.throws(() => approvedRequirementReview({ ...row, preparedByUserId: null }, document), /Managed review/);
  assert.throws(() => parseRequirementSourceChecks(Array.from({ length: 13 }, () => ({}))), e => e.status === 400);
});

test("review source ordering is canonical and source attestations do not become public content", () => {
  const { row, document } = reviewed(); document.sources.push({ ...document.sources[0], key: "second", contentSha256: "b".repeat(64) });
  row.contentSha256 = requirementDigest(document); row.reviewEvidence = syntheticReview(row, document); row.reviewEvidence.sourceChecks.reverse();
  const review = approvedRequirementReview(row, document);
  assert.deepEqual(review.sourceChecks.map(c => c.sourceKey), ["official_notice", "second"]);
  assert.equal(document.sources[0].officialSourceConfirmed, undefined);
  assert.throws(() => parseRequirementReview({ ...review, reviewedByUserId: randomUUID() }, review, document), e => e.status === 400);
});

test("catalog governance policy distinguishes preparing withdrawing and administrative review publication", () => {
  const resource = { type: "catalog", dataClasses: ["internal_catalog_metadata"] };
  for (const role of ["guest", "student", "school_staff", "cuac_ops", "cuac_admin"]) {
    const c = { ...context(), activeRole: role };
    for (const action of ["catalog.read_requirements_review", "catalog.prepare_requirements", "catalog.approve_requirements", "catalog.publish_requirements", "catalog.withdraw_requirements"]) {
      const expected = role === "cuac_admin" || (role === "cuac_ops" && ["catalog.read_requirements_review", "catalog.prepare_requirements"].includes(action));
      assert.equal(evaluatePolicy(c, action, resource).allowed, expected, `${role}: ${action}`);
    }
  }
  for (const action of ["catalog.approve_requirements", "catalog.publish_requirements", "catalog.withdraw_requirements"]) {
    assert.equal(evaluatePolicy({ ...context(), authStrength: "session" }, action, resource).allowed, false, action);
  }
  for (const override of [{ actorUserId: null }, { purpose: "agent_tool" }, { purpose: "ops_support" }, { selectedSurface: "student" },
    { tenantSchoolId: randomUUID() }, { authStrength: "guest" }, { authStrength: null }, { authStrength: "unknown" }, { dataClassAllowlist: ["public_catalog"] }]) {
    assert.equal(evaluatePolicy({ ...context(), ...override }, "catalog.prepare_requirements", resource).allowed, false);
  }
});

test("all internal governance operations deny nonhuman or invalid authority before inspecting the database", async () => {
  const service = new PostgresRequirementGovernance(unavailableClient), p = randomUUID(), i = randomUUID();
  for (const override of [{ actorUserId: null }, { activeRole: "student" }, { activeRole: "school_staff" }, { purpose: "agent_tool" },
    { tenantSchoolId: randomUUID() }, { selectedSurface: "public" }, { authStrength: "guest" }, { authStrength: null }, { dataClassAllowlist: [] }]) {
    for (const method of ["getVersion", "listVersions", "createDraft", "approve", "publish", "withdraw"]) {
      await assert.rejects(service[method]({ ...context(), ...override }, p, i, {}), e => e.status === 403);
    }
  }
});

test("governance commands reject forged fields invalid scope and malformed versions before database access", async () => {
  const service = new PostgresRequirementGovernance(unavailableClient), c = context(), p = randomUUID(), i = randomUUID(), id = randomUUID();
  const document = requirementDocument(), hash = requirementDigest(document);
  const approval = { versionId: id, expectedContentSha256: hash, effectiveFrom: null, reviewDueAt: "2027-01-01T00:00:00.000Z",
    sourceChecks: document.sources.map(s => ({ sourceKey: s.key, contentSha256: s.contentSha256, officialSourceConfirmed: true })), scopeConfirmed: true, publicContentConfirmed: true };
  const publication = { versionId: id, expectedContentSha256: hash, expectedApprovalSha256: hash, expectedPublicationRevision: 0 };
  for (const [method, input] of [["createDraft", { versionId: id, document, approved: true }], ["createDraft", { versionId: "bad", document }],
    ["approve", { ...approval, reviewedByUserId: c.actorUserId }], ["approve", { ...approval, effectiveFrom: "2026-02-30" }],
    ["approve", { ...approval, publicContentConfirmed: false }], ["approve", { ...approval, sourceChecks: [{}] }],
    ["publish", { ...publication, expectedPublicationRevision: "0" }], ["publish", { ...publication, expectedApprovalSha256: null }],
    ["withdraw", { expectedVersionId: id, expectedPublicationRevision: 0, reason: "review_required" }],
    ["withdraw", { expectedVersionId: id, expectedPublicationRevision: 1, reason: "arbitrary private text" }],
    ["listVersions", { limit: 51 }], ["listVersions", { beforeVersion: 0 }]]) {
    await assert.rejects(service[method](c, p, i, input), e => e.status === 400);
  }
  for (const method of ["getVersion", "listVersions", "createDraft", "approve", "publish", "withdraw"]) {
    await assert.rejects(service[method](c, "bad", i, {}), e => e.status === 400);
    await assert.rejects(service[method](c, p, "bad", {}), e => e.status === 400);
  }
});

test("requirement governance is not registered as an Agent runtime tool", async () => {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) await inspect(url);
      else if (/\.(ts|mjs)$/.test(entry.name)) assert.doesNotMatch(await readFile(url, "utf8"), /PostgresRequirementGovernance|postgres-requirement-governance/);
    }
  }
  await inspect(new URL("../../../src/server/agent/", import.meta.url));
});
