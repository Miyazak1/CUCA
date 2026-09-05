import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";
import { PostgresSchoolCatalogCorrectionRepository } from "../../../src/server/school-catalog-corrections/postgres-repository.ts";
import { SchoolCatalogCorrectionService } from "../../../src/server/school-catalog-corrections/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

export async function runSchoolCatalogCorrectionRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const createService = transaction => new SchoolCatalogCorrectionService(
    new PostgresSchoolCatalogCorrectionRepository(transaction), new PostgresAuditWriter(transaction));
  const api = Object.fromEntries(["listForSchool", "submit", "listForOps", "claim", "resolve"]
    .map(method => [method, transactionalMethod(client, createService, method)]));
  const school = await createSchool(pool);
  const staff = await createSchoolStaff(pool, school.id);
  const claimant = await createStaff(pool, "cuac_ops");
  const resolver = await createStaff(pool, "cuac_admin");
  const schoolContext = context(staff.userId, "school_staff", "school", "school_catalog_correction", "session", school.id);
  const claimantContext = context(claimant.userId, "cuac_ops", "ops", "catalog_correction_review", "session");
  const resolverSession = context(resolver.userId, "cuac_admin", "ops", "catalog_correction_review", "session");
  const resolverStepUp = context(resolver.userId, "cuac_admin", "ops", "catalog_correction_review", "step_up");

  await t.test("school correction applies only fixed current-generation fields and becomes unverified", async () => {
    const initial = await api.listForSchool(schoolContext);
    assert.equal(initial.school.id, school.id);
    assert.equal(initial.school.websiteUrl, "https://example.edu/old");
    const submitted = await api.submit(schoolContext, {
      sourceSchoolUpdatedAt: initial.school.updatedAt,
      changes: { websiteUrl: "https://example.edu/new", applicationFee: "CNY 500" },
      evidenceUrl: "https://example.edu/admissions/update", reasonCode: "official_website_changed",
    });
    assert.equal(submitted.status, "submitted");
    assert.equal(Object.hasOwn(submitted, "claimedByUserId"), false);
    assert.equal((await api.listForOps(claimantContext, { status: "submitted" })).items
      .some(item => item.id === submitted.id), true);
    const claimed = await api.claim(claimantContext, submitted.id, { expectedRevision: 1 });
    assert.equal(claimed.status, "claimed");
    await assert.rejects(api.resolve(resolverSession, submitted.id, {
      expectedRevision: 2, code: "applied_unverified", reference: "CASE:CATALOG-1",
    }), error => error.status === 403);
    const resolved = await api.resolve(resolverStepUp, submitted.id, {
      expectedRevision: 2, code: "applied_unverified", reference: "CASE:CATALOG-1",
    });
    assert.equal(resolved.status, "applied");
    assert.notEqual(resolved.claimedByUserId, resolved.resolvedByUserId);
    const current = (await pool.query(`select website_url,application_fee,verification_status,
      verified_by_user_id,last_verified_at,next_review_due_at,source_field_lineage_json,updated_at
      from schools where id = $1`, [school.id])).rows[0];
    assert.equal(current.website_url, "https://example.edu/new");
    assert.equal(current.application_fee, "CNY 500");
    assert.equal(current.verification_status, "unverified");
    assert.equal(current.verified_by_user_id, null);
    assert.equal(current.last_verified_at, null);
    assert.equal(current.next_review_due_at, null);
    assert.equal(current.updated_at.toISOString(), resolved.resultSchoolUpdatedAt.toISOString());
    assert.match(current.source_field_lineage_json.websiteUrl, new RegExp(`^school_catalog_correction:${submitted.id}:unverified$`));
    const audits = (await pool.query(`select action,metadata_json from audit_logs
      where resource_type = 'school_catalog_correction' and resource_id = $1 order by created_at,id`, [submitted.id])).rows;
    assert.deepEqual(audits.map(row => row.action), ["school.catalog_correction.submit",
      "ops.catalog_correction.claim", "ops.catalog_correction.resolve"]);
    assert.doesNotMatch(JSON.stringify(audits), /example\.edu|evidenceUrl|CNY 500|grantId/i);
  });

  await t.test("stale school generations, same-person resolution and audit faults stay fail-closed", async () => {
    const listed = await api.listForSchool(schoolContext);
    const submitted = await api.submit(schoolContext, {
      sourceSchoolUpdatedAt: listed.school.updatedAt, changes: { deadlineSummary: "Updated deadline" },
      evidenceUrl: "https://example.edu/admissions/deadline", reasonCode: "outdated_public_information",
    });
    const adminClaim = await api.claim(resolverStepUp, submitted.id, { expectedRevision: 1 });
    assert.equal(adminClaim.claimedByUserId, resolver.userId);
    await assert.rejects(api.resolve(resolverStepUp, submitted.id, {
      expectedRevision: 2, code: "rejected_unverifiable", reference: "CASE:SAME",
    }), error => error.status === 409);

    const rejected = await api.resolve(context((await createStaff(pool, "cuac_admin")).userId, "cuac_admin",
      "ops", "catalog_correction_review", "step_up"), submitted.id, {
      expectedRevision: 2, code: "rejected_unverifiable", reference: "CASE:REJECT",
    });
    assert.equal(rejected.status, "rejected");

    const next = await api.listForSchool(schoolContext);
    const stale = await api.submit(schoolContext, {
      sourceSchoolUpdatedAt: next.school.updatedAt, changes: { tuitionSummary: "Updated tuition" },
      evidenceUrl: "https://example.edu/admissions/tuition", reasonCode: "fee_information_changed",
    });
    await api.claim(claimantContext, stale.id, { expectedRevision: 1 });
    await pool.query("update schools set updated_at = clock_timestamp() where id = $1", [school.id]);
    await assert.rejects(api.resolve(resolverStepUp, stale.id, {
      expectedRevision: 2, code: "applied_unverified", reference: "CASE:STALE",
    }), error => error.status === 409);
    assert.equal((await pool.query("select tuition_summary from schools where id = $1", [school.id])).rows[0].tuition_summary, null);

    const fault = await createAuditFailureFixture(pool);
    try {
      await assert.rejects(fault.during("ops.catalog_correction.resolve", () => api.resolve(resolverStepUp, stale.id, {
        expectedRevision: 2, code: "rejected_unverifiable", reference: "CASE:ROLLBACK",
      })), error => error.code === "P0001");
      assert.deepEqual((await pool.query(`select status,revision,resolved_at from school_catalog_correction_requests
        where id = $1`, [stale.id])).rows[0], { status: "claimed", revision: 2, resolved_at: null });
    } finally { await fault.close(); }
  });
}

async function createSchool(pool) {
  const slug = `catalog-correction-${randomUUID()}`;
  return (await pool.query(`insert into schools
    (slug,name_en,status,verification_status,website_url,verified_by_user_id,last_verified_at,next_review_due_at)
    values ($1,'Correction University','active','unverified','https://example.edu/old',null,null,null)
    returning id`, [slug])).rows[0];
}

async function createSchoolStaff(pool, schoolId) {
  const email = `school-correction-${randomUUID()}@example.invalid`;
  const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,'school_staff')", [user.id]);
  await pool.query(`insert into school_staff_memberships (school_id,user_id,role,status)
    values ($1,$2,'school_admin','active')`, [schoolId, user.id]);
  return { userId: user.id };
}

async function createStaff(pool, role) {
  const email = `catalog-review-${randomUUID()}@example.invalid`;
  const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,$2)", [user.id, role]);
  const grant = await grantCuacStaffAccess(pool, user.id, role);
  return { userId: user.id, grantId: grant.grantId };
}

function context(actorUserId, activeRole, selectedSurface, purpose, authStrength, tenantSchoolId = null) {
  return createRequestContext({ actorUserId, activeRole, selectedSurface, purpose, authStrength, tenantSchoolId });
}
