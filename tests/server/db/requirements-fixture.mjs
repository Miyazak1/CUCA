import { randomUUID } from "node:crypto";
import { requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { requirementDocument, syntheticReview } from "../catalog/requirements-fixture.mjs";

// Synthetic SQL setup only; not an approved production publication workflow.
export async function requirementFixture(pool) {
  const key = randomUUID();
  const school = (await pool.query("insert into schools (slug, name_en, status) values ($1, 'Synthetic requirements school', 'active') returning id", [key])).rows[0];
  const program = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status, hsk_requirement, is_verified) values ($1, $2, 'Synthetic program', 'master', 'active', 'Legacy description is not a reviewed rule', true) returning id", [school.id, key])).rows[0];
  const intake = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1, 'fall', 2027) returning id", [program.id])).rows[0];
  const reviewer = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`requirements-${key}@example.invalid`])).rows[0];
  const preparer = (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`requirements-preparer-${key}@example.invalid`])).rows[0];
  return { schoolId: school.id, programId: program.id, intakeId: intake.id, reviewerId: reviewer.id, preparerId: preparer.id };
}

export async function syntheticRequirementVersion(pool, f, { version = 1, approved = true, document = requirementDocument() } = {}) {
  const now = (await pool.query("select date_trunc('milliseconds', clock_timestamp()) as now")).rows[0].now;
  const row = { versionId: randomUUID(), programIntakeId: f.intakeId, preparedByUserId: f.preparerId, approvedByUserId: f.reviewerId,
    reviewedAt: new Date(now.getTime() - 60_000), effectiveFrom: new Date(now.getTime() - 60_000), reviewDueAt: new Date(now.getTime() + 86_400_000) };
  return (await pool.query(`insert into program_requirement_versions
    (id, program_intake_id, version, content_json, content_sha256, review_status, approved_by_user_id, reviewed_at, effective_from, review_due_at, prepared_by_user_id, review_evidence_json)
    values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12::jsonb) returning id`,
    [row.versionId, f.intakeId, version, JSON.stringify(document), requirementDigest(document), approved ? "approved" : "draft",
      approved ? f.reviewerId : null, approved ? row.reviewedAt : null, approved ? row.effectiveFrom : null, approved ? row.reviewDueAt : null,
      f.preparerId, approved ? JSON.stringify(syntheticReview(row, document)) : null])).rows[0].id;
}

export async function syntheticPublication(pool, f, id, status = "active") {
  await pool.query(`insert into program_requirement_publications (program_intake_id, version_id, status) values ($1, $2, $3)
    on conflict (program_intake_id) do update set version_id = excluded.version_id, status = excluded.status,
      revision = program_requirement_publications.revision + 1, updated_at = clock_timestamp()`, [f.intakeId, id, status]);
}
