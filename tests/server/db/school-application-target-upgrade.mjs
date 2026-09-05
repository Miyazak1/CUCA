import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runPostgresMigrationPlan } from "../../../src/server/db/migration-runtime.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createPostgresStudentService } from "../../../src/server/student/runtime/routes.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { capturePublicDataReader } from "./migration-data-fixture.mjs";
import { readPublicSchemaCatalog } from "./pg-schema-catalog.mjs";
import { schoolTargetFixture, addSchoolTargetChoice } from "./school-application-target-rehearsal.mjs";
import { insertHistoricalApplicationChoice } from "./historical-application-choice-fixture.mjs";

export async function runSchoolTargetUpgradeRehearsal(t, { withDatabase, folder, plan, run }) {
  async function previous(pool, env) {
    await runPostgresMigrationPlan({ databaseUrl: env.DATABASE_URL, migrationsFolder: folder, targetEnvironment: "development", productionMigrationAllowed: false, runbookAcknowledged: false }, plan.slice(0, 20));
    return schoolTargetFixture(pool);
  }
  async function legacyApplication(pool, f, choiceId, programId) {
    return (await pool.query("insert into school_applications (application_set_id, application_choice_id, student_user_id, school_id, program_id, school_visible_profile_json) values ($1,$2,$3,$4,$5,'{\"preserve\":true}') returning id",
      [f.setId, choiceId, f.userId, f.schoolId, programId])).rows[0].id;
  }

  await t.test("target upgrade preserves every prior field and receipt and copies only the already bound choice intake", () => withDatabase(async (pool, env) => {
    const f = await previous(pool, env), expected = [];
    expected.push({ id: await legacyApplication(pool, f, f.choiceId, f.programIds[0]), programId: f.programIds[0], intakeId: null });
    for (const [programId, intakeId] of [[null, null], [f.programIds[0], f.intakeIds[0]], [f.programIds[0], f.intakeIds[1]], [f.programIds[1], f.intakeIds[2]]]) {
      const choiceId = await addSchoolTargetChoice(pool, f, programId, intakeId);
      expected.push({ id: await legacyApplication(pool, f, choiceId, programId), programId, intakeId });
    }
    await pool.query("insert into user_roles (user_id, role) values ($1, 'student')", [f.userId]);
    const context = createRequestContext({ actorUserId: f.userId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
    const student = createPostgresStudentService(createTransactionalSqlClient(pool));
    const key = randomUUID(), input = { name: "Preserve target-upgrade receipt" };
    const set = await student.createOwnApplicationSet(context, input, { idempotencyKey: key });
    const choiceKey = randomUUID(), choiceInput = { applicationSetId: set.id, schoolId: f.schoolId, programId: f.programIds[0], programIntakeId: f.intakeIds[0] };
    const choice = await insertHistoricalApplicationChoice(pool, context, choiceInput, choiceKey);
    const snapshot = await capturePublicDataReader(pool), before = await snapshot();
    const applied = JSON.parse((await run("--apply", env)).stdout);
    assert.equal(applied.appliedBefore, 20); assert.equal(applied.appliedNow, plan.length - 20);
    assert.deepEqual(await snapshot(), before);
    for (const item of expected) {
      assert.deepEqual((await pool.query("select program_id, program_intake_id, target_key from school_applications where id = $1", [item.id])).rows,
        [{ program_id: item.programId, program_intake_id: item.intakeId, target_key: `${item.programId ?? ""}/${item.intakeId ?? ""}` }]);
    }
    assert.equal((await pool.query("select count(*)::int as count from application_choices where target_key is distinct from coalesce(program_id::text, '') || '/' || coalesce(program_intake_id::text, '')")).rows[0].count, 0);
    const ledger = (await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows;
    assert.equal(JSON.parse((await run("--apply", env)).stdout).appliedNow, 0);
    assert.deepEqual((await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows, ledger);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await student.createOwnApplicationSet(context, input, { idempotencyKey: key })).id, set.id);
    assert.equal((await student.addOwnApplicationChoice(context, choiceInput, { idempotencyKey: choiceKey })).id, choice.id);
    assert.equal((await pool.query("select count(*)::int as count from school_applications")).rows[0].count, expected.length);
  }));

  for (const mismatch of ["other-program", "missing-school-program", "missing-choice-program"]) {
    await t.test(`target upgrade rejects ${mismatch} without changing prior data schema or ledger`, () => withDatabase(async (pool, env) => {
      const f = await previous(pool, env);
      const choiceId = mismatch === "missing-choice-program" ? await addSchoolTargetChoice(pool, f, null) : f.choiceId;
      const programId = mismatch === "other-program" ? f.programIds[1] : mismatch === "missing-school-program" ? null : f.programIds[0];
      await legacyApplication(pool, f, choiceId, programId);
      const snapshot = await capturePublicDataReader(pool), before = await snapshot(), schema = await readPublicSchemaCatalog(pool);
      const ledger = (await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows;
      await assert.rejects(run("--apply", env), error => {
        assert.equal(error.code, 1);
        assert.doesNotMatch(error.stdout + error.stderr, /postgresql:\/\/|cuac_release_|select |update |PRIVATE_|reconciliation|target_key/i);
        assert.equal((error.stdout + error.stderr).includes(f.userId), false);
        return true;
      });
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(await readPublicSchemaCatalog(pool), schema);
      assert.deepEqual((await pool.query("select * from drizzle.__drizzle_migrations order by id")).rows, ledger);
    }));
  }
}
