import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { evaluatePolicy } from "../../../src/server/policy/policy.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import {
  approvedOfficialSubmissionPolicyReview,
  officialSubmissionPolicyApprovalDigest,
  officialSubmissionPolicyDocumentDigest,
  officialSubmissionPolicyTargetSetDigest,
  parseOfficialSubmissionPolicyDocument,
  parseOfficialSubmissionPolicyReview,
  parseOfficialSubmissionPolicyTargets,
} from "../../../src/server/submission-policy/official-submission-policy.ts";
import { PostgresOfficialSubmissionPolicyGovernance } from "../../../src/server/submission-policy/postgres-governance.ts";
import { getPublishedOfficialSubmissionPolicy } from "../../../src/server/submission-policy/postgres-reader.ts";
import { policyDocument, syntheticPolicyReview } from "./fixture.mjs";

const context = (overrides = {}) => createRequestContext({ actorUserId: randomUUID(), activeRole: "cuac_admin", selectedSurface: "ops",
  purpose: "catalog_management", authStrength: "step_up", ...overrides });
const unavailableClient = new Proxy({}, { get() { throw new Error("Database accessed before validation"); } });

function reviewed() {
  const document = policyDocument(), targets = [{ programId: randomUUID(), programIntakeId: randomUUID() }];
  const row = {
    versionId: randomUUID(), schoolId: randomUUID(), policyKey: "international_graduate_2026", admissionRouteKey: document.admissionRouteKey,
    documentSha256: officialSubmissionPolicyDocumentDigest(document), targetSetSha256: "b".repeat(64), preparedByUserId: randomUUID(),
    approvedByUserId: randomUUID(), reviewedAt: new Date("2026-02-01T00:00:00.000Z"), effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
    reviewDueAt: new Date("2027-02-01T00:00:00.000Z"), reviewEvidence: null,
  };
  row.reviewEvidence = syntheticPolicyReview(row, document);
  return { document, targets, row };
}

test("official submission policy document is strict canonical and route bound", () => {
  const document = policyDocument(), parsed = parseOfficialSubmissionPolicyDocument(document, "direct_university");
  assert.deepEqual(parsed, document);
  assert.equal(officialSubmissionPolicyDocumentDigest(Object.fromEntries(Object.entries(document).reverse())), officialSubmissionPolicyDocumentDigest(document));
  for (const mutate of [
    value => { value.admissionRouteKey = "csc"; },
    value => { value.maxProgramChoices = 0; },
    value => { value.maxProgramChoices = 21; },
    value => { value.formMode = "school_application"; },
    value => { value.orderingMode = "implicit"; },
    value => { value.externalChannelType = "agent"; },
    value => { value.sources = []; },
    value => { value.sources[0].url = "http://admissions.example.edu"; },
    value => { value.sources[0].url = "https://admissions.example.edu/policy?token=secret"; },
    value => { value.sources[0].capturedAt = "2026-01-01"; },
    value => { value.sources[0].studentData = {}; },
    value => { value.debug = true; },
  ]) {
    const changed = structuredClone(document); mutate(changed);
    assert.throws(() => parseOfficialSubmissionPolicyDocument(changed, "direct_university"), error => error.status === 400);
  }
});

test("target digest is order independent and binds school route program and intake", () => {
  const schoolId = randomUUID(), route = "direct_university";
  const targets = [{ programId: randomUUID(), programIntakeId: randomUUID() }, { programId: randomUUID(), programIntakeId: randomUUID() }];
  const digest = officialSubmissionPolicyTargetSetDigest(schoolId, route, targets);
  assert.equal(officialSubmissionPolicyTargetSetDigest(schoolId, route, [...targets].reverse()), digest);
  assert.notEqual(officialSubmissionPolicyTargetSetDigest(randomUUID(), route, targets), digest);
  assert.notEqual(officialSubmissionPolicyTargetSetDigest(schoolId, "csc", targets), digest);
  assert.notEqual(officialSubmissionPolicyTargetSetDigest(schoolId, route, [{ ...targets[0], programId: randomUUID() }, targets[1]]), digest);
  assert.throws(() => parseOfficialSubmissionPolicyTargets([targets[0], { ...targets[0] }]), error => error.status === 400);
  assert.throws(() => parseOfficialSubmissionPolicyTargets([]), error => error.status === 400);
});

test("review evidence binds exact policy scope targets identities dates and official sources", () => {
  const { row, document } = reviewed(), review = approvedOfficialSubmissionPolicyReview(row, document);
  row.reviewEvidence = Object.fromEntries(Object.entries(row.reviewEvidence).reverse());
  assert.equal(officialSubmissionPolicyApprovalDigest(approvedOfficialSubmissionPolicyReview(row, document)), officialSubmissionPolicyApprovalDigest(review));
  for (const change of [{ versionId: randomUUID() }, { schoolId: randomUUID() }, { policyKey: "another_policy" },
    { admissionRouteKey: "csc" }, { documentSha256: "f".repeat(64) }, { targetSetSha256: "e".repeat(64) },
    { preparedByUserId: randomUUID() }, { approvedByUserId: randomUUID() }, { effectiveFrom: new Date("2026-03-01T00:00:00.000Z") }]) {
    assert.throws(() => approvedOfficialSubmissionPolicyReview({ ...row, ...change }, document), error => error.status === 400);
  }
});

test("policy review rejects self approval stale sources missing attestations and extra fields", () => {
  const { row, document } = reviewed();
  for (const mutate of [value => { value.scopeConfirmed = false; }, value => { value.routingConfirmed = "true"; },
    value => { value.sourceChecks = []; }, value => { value.sourceChecks[0].contentSha256 = "c".repeat(64); },
    value => { value.sourceChecks[0].officialSourceConfirmed = false; }, value => { value.privateNotes = "no"; },
    value => { value.schemaVersion = 2; }, value => { value.reviewDueAt = value.effectiveFrom; }]) {
    const evidence = structuredClone(row.reviewEvidence); mutate(evidence);
    assert.throws(() => approvedOfficialSubmissionPolicyReview({ ...row, reviewEvidence: evidence }, document), error => error.status === 400);
  }
  const self = { ...row, approvedByUserId: row.preparedByUserId }; self.reviewEvidence = syntheticPolicyReview(self, document);
  assert.throws(() => approvedOfficialSubmissionPolicyReview(self, document), /identity, route or time/);
  const binding = structuredClone(row.reviewEvidence);
  assert.throws(() => parseOfficialSubmissionPolicyReview({ ...binding, reviewedByUserId: randomUUID() }, binding, document), error => error.status === 400);
});

test("submission policy governance requires internal ops context and step-up for privileged commands", () => {
  const resource = { type: "catalog", dataClasses: ["internal_catalog_metadata"] };
  const actions = ["catalog.read_submission_policy_review", "catalog.prepare_submission_policy", "catalog.approve_submission_policy",
    "catalog.publish_submission_policy", "catalog.withdraw_submission_policy"];
  for (const role of ["guest", "student", "school_staff", "cuac_ops", "cuac_admin"]) {
    for (const action of actions) {
      const expected = role === "cuac_admin" || (role === "cuac_ops" && actions.indexOf(action) < 2);
      assert.equal(evaluatePolicy(context({ activeRole: role }), action, resource).allowed, expected, `${role}: ${action}`);
    }
  }
  assert.equal(evaluatePolicy(context({ authStrength: "session" }), "catalog.prepare_submission_policy", resource).allowed, true);
  for (const action of actions.slice(2)) assert.equal(evaluatePolicy(context({ authStrength: "session" }), action, resource).allowed, false);
  for (const override of [{ actorUserId: null }, { purpose: "agent_tool" }, { selectedSurface: "student" }, { tenantSchoolId: randomUUID() },
    { authStrength: "guest" }, { dataClassAllowlist: ["public_catalog"] }]) {
    assert.equal(evaluatePolicy(context(override), "catalog.prepare_submission_policy", resource).allowed, false);
  }
});

test("all policy governance methods deny invalid authority before database access", async () => {
  const service = new PostgresOfficialSubmissionPolicyGovernance(unavailableClient), school = randomUUID(), version = randomUUID();
  for (const override of [{ actorUserId: null }, { activeRole: "student" }, { activeRole: "school_staff" }, { purpose: "agent_tool" },
    { tenantSchoolId: randomUUID() }, { selectedSurface: "public" }, { authStrength: "guest" }, { dataClassAllowlist: [] }]) {
    for (const method of ["getVersion", "listVersions", "createDraft", "approve", "publish", "withdraw"]) {
      await assert.rejects(service[method](context(override), school, "international_graduate_2026", "direct_university", version), error => error.status === 403);
    }
  }
});

test("policy commands reject malformed scope and forged command fields before database access", async () => {
  const service = new PostgresOfficialSubmissionPolicyGovernance(unavailableClient), c = context(), school = randomUUID(), id = randomUUID();
  const document = policyDocument(), programId = randomUUID(), programIntakeId = randomUUID();
  const targets = [{ programId, programIntakeId }], documentSha256 = officialSubmissionPolicyDocumentDigest(document);
  const targetSetSha256 = officialSubmissionPolicyTargetSetDigest(school, document.admissionRouteKey, targets);
  const sourceChecks = document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256, officialSourceConfirmed: true }));
  const approval = { versionId: id, expectedDocumentSha256: documentSha256, expectedTargetSetSha256: targetSetSha256, effectiveFrom: null,
    reviewDueAt: "2027-01-01T00:00:00.000Z", sourceChecks, scopeConfirmed: true, routingConfirmed: true };
  const publication = { versionId: id, expectedDocumentSha256: documentSha256, expectedTargetSetSha256: targetSetSha256,
    expectedApprovalSha256: "d".repeat(64), expectedPublications: [{ programIntakeId, expectedRevision: 0 }] };
  for (const [method, input] of [["createDraft", { versionId: id, document, targets, approved: true }],
    ["createDraft", { versionId: id, document: { ...document, admissionRouteKey: "csc" }, targets }],
    ["approve", { ...approval, reviewerId: c.actorUserId }], ["approve", { ...approval, scopeConfirmed: false }],
    ["publish", { ...publication, expectedPublications: [{ programIntakeId, expectedRevision: "0" }] }],
    ["publish", { ...publication, expectedApprovalSha256: null }],
    ["withdraw", { versionId: id, expectedPublications: [{ programIntakeId, expectedRevision: 0 }], reason: "review_required" }],
    ["withdraw", { versionId: id, expectedPublications: [{ programIntakeId, expectedRevision: 1 }], reason: "free text" }],
    ["listVersions", { limit: 51 }]]) {
    await assert.rejects(service[method](c, school, "international_graduate_2026", "direct_university", input), error => error.status === 400);
  }
  for (const method of ["getVersion", "listVersions", "createDraft", "approve", "publish", "withdraw"]) {
    await assert.rejects(service[method](c, "bad", "international_graduate_2026", "direct_university", {}), error => error.status === 400);
    await assert.rejects(service[method](c, school, "Bad key", "direct_university", {}), error => error.status === 400);
  }
  await assert.rejects(getPublishedOfficialSubmissionPolicy(unavailableClient, programId, programIntakeId, "Bad route"), error => error.status === 503);
  await assert.rejects(getPublishedOfficialSubmissionPolicy(unavailableClient, programId, programIntakeId, "direct_university", new Date("bad")), error => error.status === 503);
});

test("policy governance and reader are not registered as HTTP or Agent capabilities", async () => {
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) await inspect(url);
      else if (/\.(ts|mjs)$/.test(entry.name)) assert.doesNotMatch(await readFile(url, "utf8"), /PostgresOfficialSubmissionPolicyGovernance|postgres-governance\.ts|postgres-reader\.ts/);
    }
  }
  await inspect(new URL("../../../app/api/", import.meta.url));
  await inspect(new URL("../../../src/server/agent/", import.meta.url));
});
