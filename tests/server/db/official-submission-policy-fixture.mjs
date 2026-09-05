import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { PostgresOfficialSubmissionPolicyGovernance } from "../../../src/server/submission-policy/postgres-governance.ts";
import { getPublishedOfficialSubmissionPolicy } from "../../../src/server/submission-policy/postgres-reader.ts";
import { policyDocument } from "../submission-policy/fixture.mjs";

export async function officialSubmissionPolicyFixture(pool, options = {}) {
  const client = createTransactionalSqlClient(pool), suffix = randomUUID();
  const addStaff = async (role, label) => {
    const email = `${label}-${suffix}@example.invalid`;
    const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
    await pool.query("insert into user_roles (user_id,role) values ($1,$2)", [user.id, role]);
    return user.id;
  };
  const preparerId = await addStaff("cuac_ops", "policy-preparer");
  const reviewerId = await addStaff("cuac_admin", "policy-reviewer");
  const otherReviewerId = await addStaff("cuac_admin", "policy-other-reviewer");
  const school = options.schoolId ? { id: options.schoolId }
    : (await pool.query("insert into schools (slug,name_en,status) values ($1,'Policy School','active') returning id",
      [`policy-school-${suffix}`])).rows[0];
  const otherSchool = (await pool.query("insert into schools (slug,name_en,status) values ($1,'Other Policy School','active') returning id", [`other-policy-school-${suffix}`])).rows[0];
  const createTarget = async (owner, label) => {
    const program = (await pool.query(`insert into programs (school_id,slug,name_en,degree_level,status)
      values ($1,$2,$3,'master','active') returning id`, [owner.id, `${label}-${suffix}`, `${label} program`])).rows[0];
    const intake = (await pool.query(`insert into program_intakes (program_id,intake_term,intake_year,status,open_date,deadline_date)
      values ($1,'fall',2027,'open',clock_timestamp() - interval '1 day',clock_timestamp() + interval '180 days') returning id`, [program.id])).rows[0];
    return { programId: program.id, programIntakeId: intake.id };
  };
  const targets = (options.targets ?? [await createTarget(school, "policy-one"), await createTarget(school, "policy-two")])
    .map(target => ({ programId: target.programId, programIntakeId: target.programIntakeId }))
    .sort((a, b) => a.programIntakeId.localeCompare(b.programIntakeId));
  const otherTarget = await createTarget(otherSchool, "policy-other");
  const base = { selectedSurface: "ops", purpose: "catalog_management", tenantSchoolId: null };
  const preparer = createRequestContext({ ...base, actorUserId: preparerId, activeRole: "cuac_ops", authStrength: "session" });
  const reviewer = createRequestContext({ ...base, actorUserId: reviewerId, activeRole: "cuac_admin", authStrength: "step_up" });
  const otherReviewer = createRequestContext({ ...base, actorUserId: otherReviewerId, activeRole: "cuac_admin", authStrength: "step_up" });
  const service = new PostgresOfficialSubmissionPolicyGovernance(client);
  return {
    client, service, preparer, reviewer, otherReviewer, preparerId, reviewerId, otherReviewerId,
    schoolId: school.id, otherSchoolId: otherSchool.id, targets, otherTarget,
    policyKey: "international_graduate_2027", admissionRouteKey: "direct_university",
    getPublished(target = targets[0], route = "direct_university", at) {
      return getPublishedOfficialSubmissionPolicy(client, target.programId, target.programIntakeId, route, at);
    },
  };
}

export function policyPrepareInput(fixture, versionId = randomUUID(), document = policyDocument(fixture.admissionRouteKey), targets = fixture.targets) {
  return { versionId, document, targets };
}

export async function preparePolicy(fixture, versionId, document, targets) {
  return fixture.service.createDraft(fixture.preparer, fixture.schoolId, fixture.policyKey, fixture.admissionRouteKey,
    policyPrepareInput(fixture, versionId, document, targets));
}

export function policyApproveInput(version) {
  return {
    versionId: version.versionId,
    expectedDocumentSha256: version.documentSha256,
    expectedTargetSetSha256: version.targetSetSha256,
    effectiveFrom: null,
    reviewDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    sourceChecks: version.document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256, officialSourceConfirmed: true })),
    scopeConfirmed: true,
    routingConfirmed: true,
  };
}

export async function approvePolicy(fixture, versionId, document, targets) {
  const draft = await preparePolicy(fixture, versionId, document, targets);
  return fixture.service.approve(fixture.reviewer, fixture.schoolId, fixture.policyKey, fixture.admissionRouteKey, policyApproveInput(draft));
}

export function policyPublishInput(version, expectedRevision = 0) {
  const revision = typeof expectedRevision === "number"
    ? new Map(version.targets.map(target => [target.programIntakeId, expectedRevision]))
    : new Map(expectedRevision.map(value => [value.programIntakeId, value.expectedRevision ?? value.revision]));
  return {
    versionId: version.versionId,
    expectedDocumentSha256: version.documentSha256,
    expectedTargetSetSha256: version.targetSetSha256,
    expectedApprovalSha256: version.approvalSha256,
    expectedPublications: version.targets.map(target => ({ programIntakeId: target.programIntakeId, expectedRevision: revision.get(target.programIntakeId) ?? 0 })),
  };
}

export function policyWithdrawInput(version, publications, reason = "review_required") {
  return {
    versionId: version.versionId,
    expectedPublications: publications.map(publication => ({ programIntakeId: publication.programIntakeId, expectedRevision: publication.revision })),
    reason,
  };
}
