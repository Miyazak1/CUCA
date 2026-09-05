import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { PostgresSchoolPortalRepository } from "../../../src/server/school-portal/postgres-repository.ts";

export async function schoolTargetFixture(pool, existingUserId) {
  const suffix = randomUUID();
  const user = existingUserId ? { id: existingUserId } : (await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`target-${suffix}@example.invalid`])).rows[0];
  const school = (await pool.query("insert into schools (slug, name_en, status) values ($1, 'Target school', 'active') returning id", [suffix])).rows[0];
  const programs = [];
  for (const name of ["first", "second"]) {
    programs.push((await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, $3, 'master', 'active') returning id", [school.id, `${suffix}-${name}`, name])).rows[0]);
  }
  const intakeIds = [];
  for (const [index, program] of [programs[0], programs[0], programs[1]].entries()) {
    intakeIds.push((await pool.query("insert into program_intakes (program_id, intake_term, intake_year, status, open_date, deadline_date) values ($1, 'fall', $2, 'open', now() - interval '1 day', now() + interval '1 day') returning id", [program.id, 2090 + index])).rows[0].id);
  }
  const supportsCuacId = (await pool.query("select to_regclass('public.application_reference_counters') is not null as supported")).rows[0].supported;
  const set = supportsCuacId ? (await pool.query(`with reference_clock as materialized (
      select extract(year from clock_timestamp() at time zone 'UTC')::integer as reference_year
    ), allocated as (
      insert into application_reference_counters (reference_year,last_issued_sequence)
      select reference_year,1 from reference_clock
      on conflict (reference_year) do update set last_issued_sequence = application_reference_counters.last_issued_sequence + 1
      returning reference_year,last_issued_sequence
    )
    insert into application_sets (user_id,name,cuac_reference_year,cuac_reference_sequence)
    select $1,'Target set',reference_year,last_issued_sequence from allocated returning id`, [user.id])).rows[0]
    : (await pool.query("insert into application_sets (user_id, name) values ($1, 'Target set') returning id", [user.id])).rows[0];
  const choice = (await pool.query("insert into application_choices (application_set_id, user_id, school_id, program_id) values ($1, $2, $3, $4) returning id", [set.id, user.id, school.id, programs[0].id])).rows[0];
  return { userId: user.id, schoolId: school.id, setId: set.id, choiceId: choice.id, programIds: programs.map(program => program.id), intakeIds };
}

export async function addSchoolTargetChoice(pool, f, programId, programIntakeId = null) {
  return (await pool.query("insert into application_choices (application_set_id, user_id, school_id, program_id, program_intake_id, student_notes) values ($1,$2,$3,$4,$5,'PRIVATE_TARGET_CHOICE_NOTE') returning id",
    [f.setId, f.userId, f.schoolId, programId, programIntakeId])).rows[0].id;
}

export async function insertSchoolTarget(pool, f, { choiceId = f.choiceId, programId = f.programIds[0], programIntakeId = null } = {}) {
  return (await pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id, program_intake_id) values ('cuac.program-application.v1',$1,$2,$3,$4,$5,$6) returning id",
    [f.setId, choiceId, f.userId, f.schoolId, programId, programIntakeId])).rows[0].id;
}

const targetViolation = error => error.code === "23503" && error.constraint === "school_applications_choice_target_fk";

async function waitForTargetLock(pool, waiterPid, blockerPid) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const row = (await pool.query("select $2::int = any(pg_blocking_pids($1)) as blocked", [waiterPid, blockerPid])).rows[0];
    if (row.blocked) return;
    await delay(20);
  }
  assert.fail("Target operation did not reach the actual foreign-key lock barrier");
}

export async function runSchoolApplicationTargetRehearsal(t, pool) {
  await t.test("school application rejects a different program of the same school even without a service", async () => {
    const f = await schoolTargetFixture(pool);
    await assert.rejects(pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id) values ('cuac.program-application.v1',$1,$2,$3,$4,$5)",
      [f.setId, f.choiceId, f.userId, f.schoolId, f.programIds[1]]), targetViolation);
  });

  await t.test("school target comparison includes null on either side instead of bypassing composite foreign keys", async () => {
    const f = await schoolTargetFixture(pool);
    await assert.rejects(insertSchoolTarget(pool, f, { programId: null }), targetViolation);
    const unbound = await addSchoolTargetChoice(pool, f, null);
    await assert.rejects(insertSchoolTarget(pool, f, { choiceId: unbound }), targetViolation);
    const id = await insertSchoolTarget(pool, f, { choiceId: unbound, programId: null });
    assert.deepEqual((await pool.query("select program_id, program_intake_id, target_key from school_applications where id = $1", [id])).rows,
      [{ program_id: null, program_intake_id: null, target_key: "/" }]);
    await assert.rejects(pool.query("update school_applications set program_id = $2 where id = $1", [id, f.programIds[0]]), targetViolation);
    await assert.rejects(pool.query("update application_choices set program_id = $2, program_intake_id = $3 where id = $1", [unbound, f.programIds[0], f.intakeIds[0]]), targetViolation);
  });

  await t.test("school target requires the exact intake including known versus missing and other-program intakes", async () => {
    const f = await schoolTargetFixture(pool);
    const choiceId = await addSchoolTargetChoice(pool, f, f.programIds[0], f.intakeIds[0]);
    for (const intake of [null, f.intakeIds[1], f.intakeIds[2]]) {
      await assert.rejects(insertSchoolTarget(pool, f, { choiceId, programIntakeId: intake }), targetViolation);
    }
    await assert.rejects(insertSchoolTarget(pool, f, { programIntakeId: f.intakeIds[0] }), targetViolation);
    const id = await insertSchoolTarget(pool, f, { choiceId, programIntakeId: f.intakeIds[0] });
    // Keep the null-target mutation from hitting the independent active-draft uniqueness rule first.
    await pool.query("update application_choices set removed_at = now() where id = $1", [f.choiceId]);
    for (const intake of [null, f.intakeIds[1]]) {
      await assert.rejects(pool.query("update school_applications set program_intake_id = $2 where id = $1", [id, intake]), targetViolation);
      await assert.rejects(pool.query("update application_choices set program_intake_id = $2 where id = $1", [choiceId, intake]), targetViolation);
    }
    await assert.rejects(pool.query("update school_applications set program_id = $2 where id = $1", [id, f.programIds[1]]), targetViolation);
    await assert.rejects(pool.query("update application_choices set program_id = $2, program_intake_id = $3 where id = $1", [choiceId, f.programIds[1], f.intakeIds[2]]), targetViolation);
  });

  await t.test("generated target keys cannot be directly supplied or edited to conceal different identities", async () => {
    const f = await schoolTargetFixture(pool);
    await assert.rejects(pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id, target_key) values ('cuac.program-application.v1',$1,$2,$3,$4,$5,$6)",
      [f.setId, f.choiceId, f.userId, f.schoolId, f.programIds[1], `${f.programIds[0]}/`]), error => error.code === "428C9");
    for (const [table, id] of [["application_choices", f.choiceId], ["school_applications", await insertSchoolTarget(pool, f)]]) {
      await assert.rejects(pool.query(`update ${table} set target_key = '/' where id = $1`, [id]), error => error.code === "428C9");
    }
    const columns = (await pool.query("select table_name, is_generated, is_nullable from information_schema.columns where table_schema = 'public' and column_name = 'target_key' order by table_name")).rows;
    assert.deepEqual(columns, [
      { table_name: "application_choices", is_generated: "ALWAYS", is_nullable: "NO" },
      { table_name: "application_fee_entitlements", is_generated: "ALWAYS", is_nullable: "NO" },
      { table_name: "application_material_selections", is_generated: "ALWAYS", is_nullable: "NO" },
      { table_name: "application_material_snapshots", is_generated: "ALWAYS", is_nullable: "NO" },
      { table_name: "application_submission_authorizations", is_generated: "ALWAYS", is_nullable: "NO" },
      { table_name: "invoice_lines", is_generated: "ALWAYS", is_nullable: "YES" },
      { table_name: "school_applications", is_generated: "ALWAYS", is_nullable: "NO" },
    ]);
  });

  await t.test("same-school programs and intakes have independent records states events and minimal school projections", async () => {
    const f = await schoolTargetFixture(pool), records = [];
    const statuses = ["under_review", "needs_review", "contacted"];
    for (const [index, [programId, programIntakeId]] of [[f.programIds[0], f.intakeIds[0]], [f.programIds[0], f.intakeIds[1]], [f.programIds[1], f.intakeIds[2]]].entries()) {
      const choiceId = await addSchoolTargetChoice(pool, f, programId, programIntakeId);
      records.push({
        id: await insertSchoolTarget(pool, f, { choiceId, programId, programIntakeId }),
        programId,
        programIntakeId,
        status: statuses[index],
      });
    }
    for (const record of records) {
      await pool.query("update school_applications set status = $2, submitted_at = now() where id = $1", [record.id, record.status]);
      await pool.query("insert into school_application_status_events (school_application_id, from_status, to_status) values ($1, 'pending_submission', $2)", [record.id, record.status]);
    }
    const repository = new PostgresSchoolPortalRepository(createTransactionalSqlClient(pool));
    const queue = await repository.listApplicationQueueBySchoolId(f.schoolId);
    assert.equal(queue.length, 3);
    for (const record of records) {
      const item = queue.find(row => row.id === record.id);
      assert.equal(item.programId, record.programId); assert.equal(item.programIntakeId, record.programIntakeId);
      assert.equal(item.status, record.status);
      const detail = await repository.getApplicationById(record.id, f.schoolId);
      assert.equal(detail.statusEvents.length, 1);
      assert.doesNotMatch(JSON.stringify(detail), /target_key|targetKey|PRIVATE_TARGET_CHOICE_NOTE|applicationSetId|applicationChoiceId/);
      assert.equal(await repository.getApplicationById(record.id, randomUUID()), null);
    }
    await assert.rejects(insertSchoolTarget(pool, f, { choiceId: (await pool.query("select application_choice_id from school_applications where id = $1", [records[0].id])).rows[0].application_choice_id,
      programId: records[0].programId, programIntakeId: records[0].programIntakeId }), error => error.code === "23505");
  });

  await t.test("project deletion preserves referenced targets while an unbound draft without school record retains prior null behavior", async () => {
    const f = await schoolTargetFixture(pool);
    await pool.query("delete from programs where id = $1", [f.programIds[0]]);
    assert.equal((await pool.query("select program_id from application_choices where id = $1", [f.choiceId])).rows[0].program_id, null);
    const linked = await schoolTargetFixture(pool), id = await insertSchoolTarget(pool, linked);
    await assert.rejects(pool.query("delete from programs where id = $1", [linked.programIds[0]]), error => error.code === "23503");
    await assert.rejects(pool.query("update school_applications set program_id = null where id = $1", [id]), targetViolation);
    assert.equal((await pool.query("select program_id from school_applications where id = $1", [id])).rows[0].program_id, linked.programIds[0]);
    const bound = await addSchoolTargetChoice(pool, linked, linked.programIds[1], linked.intakeIds[2]);
    await insertSchoolTarget(pool, linked, { choiceId: bound, programId: linked.programIds[1], programIntakeId: linked.intakeIds[2] });
    await assert.rejects(pool.query("delete from program_intakes where id = $1", [linked.intakeIds[2]]), error => error.code === "23503");
    await pool.query("delete from users where id = $1", [linked.userId]);
    assert.equal((await pool.query("select count(*)::int as count from school_applications where student_user_id = $1", [linked.userId])).rows[0].count, 0);
  });

  for (const first of ["application", "choice"]) for (const outcome of ["commit", "rollback"]) {
    await t.test(`target foreign-key concurrency: ${first} first and ${outcome} cannot leave a mismatched application`, async () => {
      const f = await schoolTargetFixture(pool), blocker = await pool.connect(), waiter = await pool.connect();
      let pending;
      try {
        const blockerPid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        const waiterPid = (await waiter.query("select pg_backend_pid() as pid")).rows[0].pid;
        const change = client => client.query("update application_choices set program_id = $2 where id = $1", [f.choiceId, f.programIds[1]]);
        await blocker.query("begin");
        if (first === "application") await insertSchoolTarget(blocker, f); else await change(blocker);
        pending = (first === "application" ? change(waiter) : insertSchoolTarget(waiter, f)).then(value => ({ value }), error => ({ error }));
        await waitForTargetLock(pool, waiterPid, blockerPid);
        await blocker.query(outcome);
        const result = await pending;
        if (outcome === "commit") assert.ok(targetViolation(result.error)); else assert.equal(result.error, undefined);
        assert.equal((await pool.query(`select count(*)::int as count from school_applications sa join application_choices c on c.id = sa.application_choice_id
          where sa.student_user_id = $1 and (sa.program_id is distinct from c.program_id or sa.program_intake_id is distinct from c.program_intake_id)`, [f.userId])).rows[0].count, 0);
        const applicationCount = first === "application" ? outcome === "commit" : outcome === "rollback";
        assert.equal((await pool.query("select count(*)::int as count from school_applications where student_user_id = $1", [f.userId])).rows[0].count, Number(applicationCount));
      } finally {
        await blocker.query("rollback");
        if (pending) await pending;
        blocker.release(); waiter.release();
      }
    });
  }
}
