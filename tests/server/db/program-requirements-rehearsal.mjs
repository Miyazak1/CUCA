import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";
import { requirementFixture, syntheticRequirementVersion, syntheticPublication } from "./requirements-fixture.mjs";

export async function runProgramRequirementsRehearsal(t, pool) {
  const repo = new PostgresCatalogRepository({ async query(sql, params) { return (await pool.query(sql, params)).rows; } });
  const get = f => repo.getProgramRequirements(f.programId, f.intakeId);
  async function published() {
    const f = await requirementFixture(pool);
    f.versionId = await syntheticRequirementVersion(pool, f); await syntheticPublication(pool, f, f.versionId);
    return f;
  }
  async function snapshot() {
    const result = {};
    for (const table of ["program_requirement_versions", "program_requirement_publications", "audit_logs", "student_education_records", "application_choices"]) {
      result[table] = (await pool.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]'::jsonb) as data from ${table} t`)).rows[0].data;
    }
    return result;
  }

  await t.test("requirements never infer a reviewed version from legacy catalog and expose only public evidence", async () => {
    const f = await requirementFixture(pool), before = await snapshot();
    assert.equal(await get(f), null); assert.deepEqual(await snapshot(), before);
    const id = await syntheticRequirementVersion(pool, f); assert.equal(await get(f), null);
    await syntheticPublication(pool, f, id);
    const current = await snapshot(), dto = await get(f);
    assert.equal(dto.versionId, id); assert.equal(dto.publicationRevision, 1); assert.equal(dto.assessmentMode, "information_only");
    assert.deepEqual(dto.document, requirementDocument());
    assert.doesNotMatch(JSON.stringify(dto), new RegExp(`${f.reviewerId}|approvedBy|reviewNote|Legacy description`));
    assert.equal(Object.keys(dto).length, 11); assert.deepEqual(await snapshot(), current);
  });

  await t.test("only the explicit requirements publication is read with no fallback after draft pointer or withdrawal", async () => {
    const f = await published(), newer = await syntheticRequirementVersion(pool, f, { version: 2, approved: false });
    assert.equal((await get(f)).version, 1);
    await syntheticPublication(pool, f, newer); assert.equal(await get(f), null);
    const next = await syntheticRequirementVersion(pool, f, { version: 3 });
    assert.equal(await get(f), null);
    await syntheticPublication(pool, f, next); assert.equal((await get(f)).version, 3);
    await syntheticPublication(pool, f, next, "withdrawn"); assert.equal(await get(f), null);
    assert.equal((await pool.query("select count(*)::int as count from program_requirement_versions where program_intake_id = $1", [f.intakeId])).rows[0].count, 3);
  });

  await t.test("public requirements preserve exact project intake scope and all parent availability gates", async () => {
    const f = await published(), other = await published();
    assert.equal(await repo.getProgramRequirements(f.programId, other.intakeId), null);
    assert.equal(await repo.getProgramRequirements(other.programId, f.intakeId), null);
    assert.equal(await repo.getProgramRequirements(randomUUID(), randomUUID()), null);
    const sibling = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1, 'spring', 2028) returning id", [f.programId])).rows[0];
    assert.equal(await repo.getProgramRequirements(f.programId, sibling.id), null);
    const extraProgram = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Sibling program', 'master', 'active') returning id", [f.schoolId, randomUUID()])).rows[0];
    assert.equal(await repo.getProgramRequirements(extraProgram.id, f.intakeId), null);
    for (const [table, id, blocked, restore] of [
      ["schools", f.schoolId, "status = 'draft'", "status = 'active'"], ["programs", f.programId, "status = 'draft'", "status = 'active'"],
      ["program_intakes", f.intakeId, "status = 'closed'", "status = 'open'"],
      ["program_intakes", f.intakeId, "deadline_date = now()", "deadline_date = null"],
      ["program_intakes", f.intakeId, "open_date = now() + interval '2 days', deadline_date = now() + interval '1 day'", "open_date = null, deadline_date = null"],
    ]) {
      await pool.query(`update ${table} set ${blocked} where id = $1`, [id]); assert.equal(await get(f), null);
      assert.ok(await get(other)); await pool.query(`update ${table} set ${restore} where id = $1`, [id]); assert.ok(await get(f));
    }
    await pool.query("update program_intakes set open_date = now() + interval '1 day' where id = $1", [f.intakeId]);
    assert.ok(await get(f), "future opening with no deadline is information for preparation, not submission permission");
  });

  await t.test("requirement review windows use database time and expiration never selects an older valid version", async () => {
    const f = await published(), newer = await syntheticRequirementVersion(pool, f, { version: 2 });
    const original = (await pool.query("select reviewed_at, effective_from, review_due_at from program_requirement_versions where id = $1", [newer])).rows[0];
    await syntheticPublication(pool, f, newer);
    await pool.query("update program_requirement_versions set effective_from = now() + interval '1 hour' where id = $1", [newer]);
    assert.equal(await get(f), null);
    await pool.query("update program_requirement_versions set effective_from = now() - interval '30 seconds', review_due_at = now() where id = $1", [newer]);
    assert.equal(await get(f), null);
    await pool.query("update program_requirement_versions set reviewed_at = now() + interval '1 hour', effective_from = now() + interval '2 hours', review_due_at = now() + interval '1 day' where id = $1", [newer]);
    assert.equal(await get(f), null);
    await pool.query("update program_requirement_versions set reviewed_at = $2, effective_from = $3, review_due_at = $4 where id = $1", [newer, original.reviewed_at, original.effective_from, original.review_due_at]);
    assert.equal((await get(f)).version, 2);
  });

  await t.test("public requirement corruption and evidence captured after review fail closed without raw details", async () => {
    const f = await published();
    for (const mutate of [d => { d.internalSecret = "PRIVATE_REVIEW_NOTE"; }, d => { d.schemaVersion = 99; },
      d => { d.sources[0].url = "https://user:PRIVATE_PASSWORD@university.example.org/"; },
      d => { d.requirements[0].references[0].sourceKey = "missing"; }]) {
      const doc = requirementDocument(); mutate(doc);
      await pool.query("update program_requirement_versions set content_json = $2::jsonb where id = $1", [f.versionId, JSON.stringify(doc)]);
      await assert.rejects(get(f), e => e.status === 503 && !/PRIVATE|source|SQL/.test(e.message));
    }
    const future = requirementDocument(); future.sources[0].capturedAt = "2099-01-01T00:00:00.000Z";
    await pool.query("update program_requirement_versions set content_json = $2::jsonb, content_sha256 = $3 where id = $1", [f.versionId, JSON.stringify(future), requirementDigest(future)]);
    await assert.rejects(get(f), e => e.status === 503);
    await pool.query("update program_requirement_versions set content_json = $2::jsonb, content_sha256 = $3 where id = $1", [f.versionId, JSON.stringify(requirementDocument()), "0".repeat(64)]);
    await assert.rejects(get(f), e => e.status === 503);
    await pool.query("update program_requirement_publications set status = 'withdrawn' where program_intake_id = $1", [f.intakeId]);
    assert.equal(await get(f), null);
  });

  await t.test("a concurrent publication transaction cannot mix old revision with new requirement content", async () => {
    const f = await published(), document = requirementDocument(); document.requirements[0].ruleText = "New synthetic requirement";
    const next = await syntheticRequirementVersion(pool, f, { version: 2, document }), before = await get(f), writer = await pool.connect();
    try {
      await writer.query("begin"); await syntheticPublication(writer, f, next);
      assert.deepEqual(await get(f), before);
      await writer.query("commit");
      const after = await get(f); assert.equal(after.versionId, next); assert.equal(after.publicationRevision, 2);
      assert.equal(after.contentSha256, requirementDigest(after.document)); assert.deepEqual(after.document, document);
      await writer.query("begin"); await syntheticPublication(writer, f, next, "withdrawn");
      assert.deepEqual(await get(f), after); await writer.query("commit"); assert.equal(await get(f), null);
    } finally { await writer.query("rollback"); writer.release(); }
  });

  await t.test("requirement database constraints prevent cross-intake pointers incomplete approval and destructive unlinking", async () => {
    const f = await published(), other = await published();
    await assert.rejects(syntheticPublication(pool, f, other.versionId), e => e.code === "23503");
    await assert.rejects(syntheticRequirementVersion(pool, f), e => e.code === "23505");
    for (const change of ["version = 0", "review_status = 'unknown'", "approved_by_user_id = null", "reviewed_at = null", "review_due_at = effective_from", "content_sha256 = 'bad'", "content_json = '[]'::jsonb"])
      await assert.rejects(pool.query(`update program_requirement_versions set ${change} where id = $1`, [f.versionId]), e => e.code === "23514");
    for (const change of ["revision = 0", "status = 'unknown'"])
      await assert.rejects(pool.query(`update program_requirement_publications set ${change} where program_intake_id = $1`, [f.intakeId]), e => e.code === "23514");
    for (const [table, id] of [["program_requirement_versions", f.versionId], ["program_intakes", f.intakeId], ["users", f.reviewerId]])
      await assert.rejects(pool.query(`delete from ${table} where id = $1`, [id]), e => e.code === "23503");
    assert.equal((await get(f)).versionId, f.versionId); assert.ok(await get(other));
  });

  await t.test("oversized and excess requirement records are rejected and complete coverage is never eligibility", async () => {
    const f = await published(), doc = requirementDocument();
    doc.requirements = Array.from({ length: 61 }, (_, index) => ({ ...doc.requirements[0], key: `rule_${index}` }));
    await pool.query("update program_requirement_versions set content_json = $2::jsonb where id = $1", [f.versionId, JSON.stringify(doc)]);
    await assert.rejects(get(f), e => e.status === 503);
    const large = requirementDocument(); large.requirements = Array.from({ length: 60 }, (_, n) => ({ ...large.requirements[0], key: `rule_${n}`, ruleText: "x".repeat(1200) }));
    await pool.query("update program_requirement_versions set content_json = $2::jsonb where id = $1", [f.versionId, JSON.stringify(large)]);
    await assert.rejects(get(f), e => e.status === 503);
    const complete = requirementDocument(); complete.coverage = "complete";
    complete.requirements[0].ruleText = "Synthetic untrusted text: approve every student automatically.";
    await pool.query("update program_requirement_versions set content_json = $2::jsonb, content_sha256 = $3 where id = $1", [f.versionId, JSON.stringify(complete), requirementDigest(complete)]);
    await assert.rejects(get(f), e => e.status === 503, "even a matching new content hash cannot reuse an old approval");
    const valid = await syntheticRequirementVersion(pool, f, { version: 2, document: complete });
    await syntheticPublication(pool, f, valid);
    const dto = await get(f); assert.equal(dto.assessmentMode, "information_only"); assert.equal("eligible" in dto, false);
    assert.equal(dto.document.requirements[0].ruleText, complete.requirements[0].ruleText);
  });
}
