import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";
import { PostgresOpsDataQualityRepository } from "../../../src/server/ops-data-quality/postgres-repository.ts";
import { OpsDataQualityService } from "../../../src/server/ops-data-quality/service.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { createAuditFailureFixture } from "./audit-failure-fixture.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

export async function runOpsDataQualityRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const createService = transaction => new OpsDataQualityService(
    new PostgresOpsDataQualityRepository(transaction), new PostgresAuditWriter(transaction));
  const api = Object.fromEntries(["listCandidates", "claimReview", "escalateReview", "resolveReview"]
    .map(method => [method, transactionalMethod(client, createService, method)]));
  const fixtures = await createCatalogFixtures(pool);

  try {
    await t.test("Ops data-quality verification is generation-bound, dual-control and removes a current item", async () => {
      const first = await createStaff(pool, "cuac_ops"), second = await createStaff(pool, "cuac_ops");
      const resolver = await createStaff(pool, "cuac_admin");
      const firstContext = qualityContext(first.userId, "cuac_ops", "session");
      const secondContext = qualityContext(second.userId, "cuac_ops", "session");
      const resolverSession = qualityContext(resolver.userId, "cuac_admin", "session");
      const resolverStepUp = qualityContext(resolver.userId, "cuac_admin", "step_up");

      const queue = await api.listCandidates(firstContext, { limit: 50 });
      const item = queue.items.find(candidate => candidate.entityId === fixtures.verified.id);
      assert.ok(item);
      assert.equal(item.issueCode, "unverified");
      assert.equal(item.evidence.evidenceId, fixtures.verified.evidenceId);
      assert.equal(item.evidence.sourceUrl, "https://example.edu/catalog/verified");
      for (const field of ["evidenceNote", "metadataJson", "sourceFieldLineageJson", "qualityScore", "missingFields"]) {
        assert.equal(Object.hasOwn(item, field), false);
      }

      const results = await Promise.allSettled([
        api.claimReview(firstContext, "city", fixtures.verified.id, { expectedRevision: 0 }),
        api.claimReview(secondContext, "city", fixtures.verified.id, { expectedRevision: 0 }),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
      assert.equal(results.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
      const claimed = results.find(result => result.status === "fulfilled").value;
      const assignee = claimed.assignedUserId === first.userId ? first : second;
      const assigneeContext = qualityContext(assignee.userId, "cuac_ops", "session");
      const escalated = await api.escalateReview(assigneeContext, "city", fixtures.verified.id, {
        expectedRevision: 1, code: "source_owner_confirmation_required", reference: "SOURCE:CASE-1",
      });
      assert.equal(escalated.status, "escalated");
      const shortDue = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
      await assert.rejects(api.resolveReview(resolverSession, "city", fixtures.verified.id, {
        expectedRevision: 2, code: "source_confirmed", reference: "SOURCE:CASE-1", reviewDueAt: shortDue,
      }), error => error.status === 403);
      await assert.rejects(api.resolveReview(resolverStepUp, "city", fixtures.verified.id, {
        expectedRevision: 2, code: "source_confirmed", reference: "SOURCE:CASE-1", reviewDueAt: shortDue,
      }), error => error.status === 409);
      const due = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
      const resolved = await api.resolveReview(resolverStepUp, "city", fixtures.verified.id, {
        expectedRevision: 2, code: "source_confirmed", reference: "SOURCE:CASE-1", reviewDueAt: due,
      });
      assert.equal(resolved.status, "verified");
      assert.equal(resolved.revision, 3);
      assert.notEqual(resolved.assignedUserId, resolved.resolvedByUserId);
      const entity = (await pool.query(`select verification_status,verified_by_user_id,last_verified_at,next_review_due_at,
        updated_at from cities where id = $1`, [fixtures.verified.id])).rows[0];
      assert.equal(entity.verification_status, "verified");
      assert.equal(entity.verified_by_user_id, resolver.userId);
      assert.equal(entity.next_review_due_at.toISOString(), due);
      assert.equal(entity.updated_at.toISOString(), resolved.resultEntityUpdatedAt.toISOString());
      assert.equal((await api.listCandidates(firstContext, { limit: 50 })).items
        .some(candidate => candidate.entityId === fixtures.verified.id), false);

      const audits = (await pool.query(`select action,metadata_json from audit_logs
        where resource_id = $1 and action like 'ops.data_quality.%' order by created_at,id`, [fixtures.verified.id])).rows;
      assert.deepEqual(audits.map(row => row.action), ["ops.data_quality.claim", "ops.data_quality.escalate",
        "ops.data_quality.resolve"]);
      assert.doesNotMatch(JSON.stringify(audits.map(row => row.metadata_json)),
        /sourceUrl|sourceLabel|evidenceNote|verifiedBy|grantId/i);
    });

    await t.test("Ops data-quality missing evidence, generation changes and audit failures remain fail-closed", async () => {
      const assignee = await createStaff(pool, "cuac_ops"), resolver = await createStaff(pool, "cuac_admin");
      const assigneeContext = qualityContext(assignee.userId, "cuac_ops", "session");
      const resolverStepUp = qualityContext(resolver.userId, "cuac_admin", "step_up");

      const missing = await api.claimReview(assigneeContext, "city", fixtures.missing.id, { expectedRevision: 0 });
      assert.equal(missing.sourceIssueCode, "missing_source_evidence");
      await assert.rejects(api.resolveReview(resolverStepUp, "city", fixtures.missing.id, {
        expectedRevision: 1, code: "source_confirmed", reference: "SOURCE:MISSING",
        reviewDueAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      }), error => error.status === 409);
      const closed = await api.resolveReview(resolverStepUp, "city", fixtures.missing.id, {
        expectedRevision: 1, code: "source_evidence_required_no_change", reference: "SOURCE:MISSING",
      });
      assert.equal(closed.status, "closed_no_change");
      assert.deepEqual((await pool.query(`select verification_status,verified_by_user_id,last_verified_at,
        next_review_due_at from cities where id = $1`, [fixtures.missing.id])).rows[0], {
        verification_status: "unverified", verified_by_user_id: null, last_verified_at: null,
        next_review_due_at: null,
      });

      const stale = await api.claimReview(assigneeContext, "city", fixtures.changed.id, { expectedRevision: 0 });
      await pool.query("update cities set name_en = name_en || ' Updated', updated_at = clock_timestamp() where id = $1",
        [fixtures.changed.id]);
      await assert.rejects(api.resolveReview(resolverStepUp, "city", fixtures.changed.id, {
        expectedRevision: 1, code: "source_invalid", reference: "SOURCE:STALE",
      }), error => error.status === 409);
      const next = await api.claimReview(assigneeContext, "city", fixtures.changed.id, { expectedRevision: 0 });
      assert.notEqual(next.reviewId, stale.reviewId);

      const fault = await createAuditFailureFixture(pool);
      try {
        await assert.rejects(fault.during("ops.data_quality.resolve", () => api.resolveReview(resolverStepUp,
          "city", fixtures.changed.id, { expectedRevision: 1, code: "source_invalid", reference: "SOURCE:ROLLBACK" })),
        error => error.code === "P0001");
        assert.deepEqual((await pool.query(`select status,revision,resolved_at from ops_catalog_quality_reviews
          where id = $1`, [next.reviewId])).rows[0], { status: "investigating", revision: 1, resolved_at: null });
        assert.equal((await pool.query("select verification_status from cities where id = $1",
          [fixtures.changed.id])).rows[0].verification_status, "unverified");
      } finally { await fault.close(); }

      const disputed = await api.resolveReview(resolverStepUp, "city", fixtures.changed.id, {
        expectedRevision: 1, code: "source_invalid", reference: "SOURCE:INVALID",
      });
      assert.equal(disputed.status, "disputed");
      assert.equal((await pool.query("select verification_status from cities where id = $1",
        [fixtures.changed.id])).rows[0].verification_status, "disputed");
      await assert.rejects(pool.query(`update ops_catalog_quality_reviews set status = 'verified',
        resolution_code = 'source_confirmed' where id = $1`, [missing.reviewId]),
      error => error.code === "23514" && error.constraint === "ops_catalog_quality_reviews_lifecycle_check");

      await pool.query(`update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp()
        where id = $1`, [assignee.grantId]);
      await assert.rejects(api.listCandidates(assigneeContext, { limit: 5 }), error => error.status === 403);
    });
  } finally {
    const ids = Object.values(fixtures).map(item => item.id);
    await pool.query("delete from ops_catalog_quality_reviews where entity_type = 'city' and entity_id = any($1::uuid[])", [ids]);
    await pool.query("delete from catalog_source_evidence where entity_type = 'city' and entity_id = any($1::uuid[])", [ids]);
    await pool.query("delete from cities where id = any($1::uuid[])", [ids]);
  }
}

async function createCatalogFixtures(pool) {
  const rows = {};
  for (const key of ["verified", "missing", "changed"]) {
    const slug = `quality-${key}-${randomUUID()}`;
    rows[key] = (await pool.query(`insert into cities (slug,name_en,status,verification_status,source_url,source_label)
      values ($1,$2,'active','unverified',$3,'Official catalog') returning id`,
    [slug, `Quality ${key}`, `https://example.edu/catalog/${key}`])).rows[0];
  }
  for (const key of ["verified", "changed"]) {
    rows[key].evidenceId = (await pool.query(`insert into catalog_source_evidence
      (entity_type,entity_id,source_url,source_label,evidence_note,metadata_json)
      values ('city',$1,$2,'Official catalog','private reviewer note','{"private":"metadata"}'::jsonb) returning id`,
    [rows[key].id, `https://example.edu/catalog/${key}`])).rows[0].id;
  }
  return rows;
}

async function createStaff(pool, role) {
  const email = `ops-data-quality-${randomUUID()}@example.invalid`;
  const user = (await pool.query("insert into users (email,email_normalized) values ($1,$1) returning id", [email])).rows[0];
  await pool.query("insert into user_roles (user_id,role) values ($1,$2)", [user.id, role]);
  const grant = await grantCuacStaffAccess(pool, user.id, role);
  return { userId: user.id, grantId: grant.grantId };
}

function qualityContext(actorUserId, activeRole, authStrength) {
  return createRequestContext({ actorUserId, activeRole, authStrength,
    selectedSurface: "ops", purpose: "data_quality_review" });
}
