import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { capturePublicDataReader } from "./migration-data-fixture.mjs";
import { materialPreviewFixture } from "./application-material-preview-fixture.mjs";

export async function runApplicationMaterialPreviewHttpRehearsal(t, pool, { send, browser, register }) {
  await t.test("network material preview returns exact chosen contents only to the owner without persistence cookies or public caching", async () => {
    const student = browser(), account = await register(student), f = await materialPreviewFixture(pool, account.userId);
    f.input.selection.applicantFields = ["fullName"]; const snapshot = await capturePublicDataReader(pool), before = await snapshot();
    const response = await student.send(f.materialPath, { method: "POST", body: f.input }); assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok(response.headers.get("x-request-id")); assert.equal(response.headers.get("set-cookie"), null);
    const result = (await response.json()).data;
    assert.equal(result.mode, "self_review"); assert.equal(result.canSubmit, false); assert.equal(result.persisted, false); assert.equal(result.consentRecorded, false);
    assert.equal(result.content.choiceId, f.choice.id); assert.equal(result.content.programIntakeId, f.catalog.intakeId);
    assert.deepEqual(result.content.materials.applicant, { fullName: "PRIVATE_APPLICANT_NAME" });
    assert.equal(result.content.materials.assessments[0].components[0].value, "7.50");
    assert.doesNotMatch(JSON.stringify(result), /private-applicant|citizenshipCountry|PRIVATE_CHOICE_NOTE|IGNORED_LEGACY|userId|schoolVisibleProfile/);
    const repeated = await student.send(f.materialPath, { method: "POST", body: f.input }); assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).data.contentSha256, result.contentSha256); assert.deepEqual(await snapshot(), before);
  });

  await t.test("network material preview blocks guests foreign students foreign records and nonstudent personas despite forged headers", async () => {
    const student = browser(), other = browser(), account = await register(student); await register(other);
    const f = await materialPreviewFixture(pool, account.userId), snapshot = await capturePublicDataReader(pool), before = await snapshot();
    for (const request of [() => send(f.materialPath, { method: "POST", body: f.input, headers: { "x-user-id": f.userId, "x-role": "student" } }),
      () => other.send(f.materialPath, { method: "POST", body: f.input, headers: { "x-user-id": f.userId, "x-role": "student" } }),
      () => student.send(f.materialPath.replace(f.set.id, randomUUID()), { method: "POST", body: f.input }),
      () => student.send(f.materialPath, { method: "POST", body: { ...f.input, selection: { ...f.input.selection, educationRecordIds: [randomUUID()] } } }),
    ]) { const response = await request(); assert.equal(response.status, 403); assert.doesNotMatch(await response.text(), /PRIVATE_|@example/); }
    assert.deepEqual(await snapshot(), before);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_admin')", [f.userId]);
    await pool.query("update auth_sessions set active_role = 'cuac_admin', selected_surface = 'ops' where user_id = $1", [f.userId]);
    assert.equal((await student.send(f.materialPath, { method: "POST", body: f.input, headers: { "x-role": "student" } })).status, 403);
  });

  await t.test("network material preview enforces nested inputs request bounds origins paths and its sole POST method", async () => {
    const student = browser(), account = await register(student), f = await materialPreviewFixture(pool, account.userId);
    const snapshot = await capturePublicDataReader(pool), before = await snapshot();
    for (const body of [{ ...f.input, confirmed: true }, { ...f.input, content: { fullName: "CLIENT_RAW_NAME" } },
      { ...f.input, expectedVersions: { ...f.input.expectedVersions, schoolId: f.catalog.schoolId } },
      { ...f.input, selection: { ...f.input.selection, applicantFields: ["passportNumber"] } },
      { ...f.input, selection: { ...f.input.selection, assessmentRecordIds: [f.input.selection.assessmentRecordIds[0], f.input.selection.assessmentRecordIds[0]] } },
      { ...f.input, selection: { applicantFields: [] } }]) assert.equal((await student.send(f.materialPath, { method: "POST", body })).status, 400);
    for (const query of ["?schoolId=x", "?confirmed=true", "?locale=en"]) assert.equal((await student.send(f.materialPath + query, { method: "POST", body: f.input })).status, 400);
    for (const headers of [{ origin: "https://foreign.invalid" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "same-site" }]) {
      assert.equal((await student.send(f.materialPath, { method: "POST", body: f.input, headers })).status, 403);
    }
    assert.equal((await student.send(f.materialPath, { method: "POST", rawBody: "[]" })).status, 400);
    assert.equal((await student.send(f.materialPath, { method: "POST", rawBody: "{" })).status, 400);
    assert.equal((await student.send(f.materialPath, { method: "POST", rawBody: JSON.stringify({ oversized: "x".repeat(200000) }) })).status, 413);
    assert.equal((await student.send(f.materialPath, { method: "POST", body: f.input, headers: { "content-type": "text/plain" } })).status, 415);
    assert.equal((await student.send(f.materialPath.replace(f.choice.id, "invalid"), { method: "POST", body: f.input })).status, 400);
    for (const method of ["GET", "PATCH", "PUT", "DELETE"]) assert.ok([404, 405].includes((await student.send(f.materialPath, { method })).status));
    assert.deepEqual(await snapshot(), before);
  });

  await t.test("network material preview rejects stale versions and revoked roles without silently refreshing expectations", async () => {
    const student = browser(), account = await register(student), f = await materialPreviewFixture(pool, account.userId);
    const before = (await (await student.send(f.materialPath, { method: "POST", body: f.input })).json()).data;
    assert.equal((await student.send("/api/v1/student/applicant-profile", { method: "PATCH", body: { expectedRevision: 1, fullName: "CHANGED_PRIVATE_NAME" } })).status, 200);
    const stale = await student.send(f.materialPath, { method: "POST", body: f.input }); assert.equal(stale.status, 409); assert.doesNotMatch(await stale.text(), /CHANGED_PRIVATE_NAME/);
    const input = await f.request(), fresh = await student.send(f.materialPath, { method: "POST", body: input }); assert.equal(fresh.status, 200);
    const result = (await fresh.json()).data; assert.notEqual(result.contentSha256, before.contentSha256); assert.equal(result.content.materials.applicant.fullName, "CHANGED_PRIVATE_NAME");
    await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.userId]);
    const snapshot = await capturePublicDataReader(pool), unchanged = await snapshot();
    const revoked = await student.send(f.materialPath, { method: "POST", body: input }); assert.equal(revoked.status, 403); assert.equal(revoked.headers.get("set-cookie"), null);
    assert.deepEqual(await snapshot(), unchanged);
  });

  await t.test("network material preview redacts corrupt selected contents and never emits partial data or repair writes", async () => {
    const student = browser(), account = await register(student), f = await materialPreviewFixture(pool, account.userId);
    await pool.query("update student_education_records set institution_name = $2 where id = $1", [f.input.selection.educationRecordIds[0], "PRIVATE\nCORRUPTION"]);
    const snapshot = await capturePublicDataReader(pool), before = await snapshot();
    const response = await student.send(f.materialPath, { method: "POST", body: f.input }); assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /PRIVATE|Chosen|components|select |student_education|postgres|@example/i);
    assert.deepEqual(await snapshot(), before);
  });
}
