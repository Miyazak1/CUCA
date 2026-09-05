import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { schoolTargetFixture, addSchoolTargetChoice, insertSchoolTarget } from "./school-application-target-rehearsal.mjs";

export async function runSchoolTargetHttpRehearsal(t, pool, { send, browser, register }) {
  async function teacher(schoolId) {
    const client = browser(), account = await register(client);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'school_staff')", [account.userId]);
    await pool.query("insert into school_staff_memberships (user_id, school_id, role, status) values ($1,$2,'admissions','active')", [account.userId, schoolId]);
    await pool.query("update auth_sessions set active_role = 'school_staff', selected_surface = 'school', tenant_school_id = $2 where id = $1", [account.sessionId, schoolId]);
    return { client, account };
  }
  async function fixture() {
    const student = browser(), account = await register(student), f = await schoolTargetFixture(pool, account.userId), records = [];
    await pool.query("update application_choices set removed_at = now() where id = $1", [f.choiceId]);
    for (const [programId, programIntakeId] of [[f.programIds[0], f.intakeIds[0]], [f.programIds[0], f.intakeIds[1]], [f.programIds[1], f.intakeIds[2]]]) {
      const choiceId = await addSchoolTargetChoice(pool, f, programId, programIntakeId);
      records.push({ id: await insertSchoolTarget(pool, f, { choiceId, programId, programIntakeId }), choiceId, programId, programIntakeId });
    }
    await pool.query("update school_applications set status = 'new', submitted_at = clock_timestamp() where id = any($1::uuid[])",
      [records.map(record => record.id)]);
    return { ...f, student, records, teacher: await teacher(f.schoolId) };
  }
  async function applications(f) {
    return (await pool.query("select to_jsonb(sa) as data from school_applications sa where student_user_id = $1 order by id", [f.userId])).rows;
  }

  await t.test("network school queue and detail distinguish exact program intakes without student draft or generated-key leakage", async () => {
    const f = await fixture(), before = await applications(f);
    const response = await f.teacher.client.send("/api/v1/school/applications");
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok(response.headers.get("x-request-id")); assert.equal(response.headers.get("set-cookie"), null);
    const queue = (await response.json()).data;
    assert.equal(queue.length, 3);
    for (const record of f.records) {
      const item = queue.find(row => row.id === record.id);
      assert.equal(item.programId, record.programId); assert.equal(item.programIntakeId, record.programIntakeId);
      assert.equal(item.status, "new");
      const result = await f.teacher.client.send(`/api/v1/school/applications/${record.id}`);
      assert.equal(result.status, 200);
      const detail = (await result.json()).data;
      assert.equal(detail.programIntakeId, record.programIntakeId);
      assert.deepEqual(detail.statusEvents, []);
      assert.doesNotMatch(JSON.stringify(detail), /targetKey|target_key|PRIVATE_TARGET_CHOICE_NOTE|applicationSetId|applicationChoiceId/);
    }
    assert.deepEqual(await applications(f), before);
    const audits = (await pool.query("select metadata_json from audit_logs where actor_user_id = $1", [f.teacher.account.userId])).rows;
    assert.ok(audits.length > 0); assert.doesNotMatch(JSON.stringify(audits), /target_key|targetKey|PRIVATE_TARGET/);
  });

  await t.test("network school target projections retain tenant membership and persona isolation despite forged selectors", async () => {
    const f = await fixture(), other = await schoolTargetFixture(pool), outsider = await teacher(other.schoolId);
    const path = `/api/v1/school/applications/${f.records[0].id}`, before = await applications(f);
    const headers = { "x-role": "school_staff", "x-tenant-school-id": f.schoolId, "x-user-id": f.teacher.account.userId };
    const studentResult = await f.student.send(path, { headers });
    assert.equal(studentResult.status, 403); assert.equal((await studentResult.text()).includes(f.records[0].programIntakeId), false);
    const outside = await outsider.client.send(path, { headers });
    const missing = await outsider.client.send(`/api/v1/school/applications/${randomUUID()}`, { headers });
    assert.equal(outside.status, 200); assert.equal(missing.status, 200);
    assert.deepEqual(await outside.json(), { data: null }); assert.deepEqual(await missing.json(), { data: null });
    assert.equal((await send(path)).status, 403);
    const queue = await outsider.client.send(`/api/v1/school/applications?schoolId=${f.schoolId}`);
    assert.equal(queue.status, 200); assert.deepEqual((await queue.json()).data, []);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      assert.ok([404, 405].includes((await f.teacher.client.send(path, { method, body: { programId: other.programIds[0], programIntakeId: other.intakeIds[0] } })).status));
    }
    assert.deepEqual(await applications(f), before);
  });

  await t.test("network school target reads preserve independent state and immediately deny suspended membership", async () => {
    const f = await fixture(), first = f.records[0], second = f.records[1];
    await pool.query("update school_applications set status = 'under_review' where id = $1", [first.id]);
    await pool.query("insert into school_application_status_events (school_application_id, from_status, to_status) values ($1,'new','under_review')", [first.id]);
    const firstData = (await (await f.teacher.client.send(`/api/v1/school/applications/${first.id}`)).json()).data;
    const secondData = (await (await f.teacher.client.send(`/api/v1/school/applications/${second.id}`)).json()).data;
    assert.equal(firstData.status, "under_review"); assert.equal(firstData.statusEvents.length, 1);
    assert.equal(secondData.status, "new"); assert.deepEqual(secondData.statusEvents, []);
    await assert.rejects(pool.query("update application_choices set program_intake_id = null where id = $1", [first.choiceId]), error => error.code === "23503");
    assert.equal((await (await f.teacher.client.send(`/api/v1/school/applications/${first.id}`)).json()).data.programIntakeId, first.programIntakeId);
    await pool.query("update school_staff_memberships set status = 'suspended' where user_id = $1 and school_id = $2", [f.teacher.account.userId, f.schoolId]);
    const before = await applications(f);
    for (const path of ["/api/v1/school/applications", `/api/v1/school/applications/${first.id}`]) {
      const response = await f.teacher.client.send(path); assert.equal(response.status, 403);
      assert.equal((await response.text()).includes(first.programIntakeId), false);
    }
    assert.deepEqual(await applications(f), before);
  });
}
