import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { AuthCredentialsService, hashPassword } from "../../../src/server/auth/credentials.ts";
import { createAuthCredentialsHttpHandlers } from "../../../src/server/auth/credentials-http.ts";
import { createAuthHttpHandlers } from "../../../src/server/auth/http.ts";
import { PostgresAuthSessionRepository } from "../../../src/server/auth/postgres-repository.ts";
import { hashSessionToken, resolveRequestContextFromRequest } from "../../../src/server/auth/session.ts";
import { PostgresStudentCoreRepository } from "../../../src/server/student/postgres-repository.ts";
import { StudentCoreService } from "../../../src/server/student/service.ts";
import { createStudentHttpHandlers } from "../../../src/server/student/http.ts";
import { PostgresSchoolPortalRepository } from "../../../src/server/school-portal/postgres-repository.ts";
import { SchoolPortalService } from "../../../src/server/school-portal/service.ts";
import { createSchoolPortalHttpHandlers } from "../../../src/server/school-portal/http.ts";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

const password = "Synthetic-only-password-826!";
function request(path, token, body) {
  return new Request(`https://cuac.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(token ? { cookie: `cuac_session=${token}` } : {}), "content-type": "application/json", "idempotency-key": randomUUID() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function runIdentityIsolationRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const auth = new PostgresAuthSessionRepository(client);
  const credentials = new AuthCredentialsService(auth);
  const authHttp = createAuthCredentialsHttpHandlers(credentials, { secureCookies: true });
  const students = new PostgresStudentCoreRepository(client);
  const schools = new PostgresSchoolPortalRepository(client);
  const audit = new PostgresAuditWriter(client);
  const studentHttp = createStudentHttpHandlers(new StudentCoreService(students, audit), auth);
  const schoolHttp = createSchoolPortalHttpHandlers(new SchoolPortalService(schools, audit), auth, auth);

  async function createStudent() {
    const email = `student-${randomUUID()}@example.invalid`;
    return { ...await credentials.registerStudent({ email, password }), email };
  }

  async function fixture() {
    const a = await createStudent();
    const b = await createStudent();
    const schoolIds = [];
    const programIds = [];
    const teachers = [];
    for (const label of ["A", "B"]) {
      const { rows: [school] } = await pool.query("insert into schools (slug, name_en, status) values ($1, $2, 'active') returning id", [randomUUID(), `School ${label}`]);
      schoolIds.push(school.id);
      const { rows: [program] } = await pool.query("insert into programs (slug, school_id, name_en, degree_level, status) values ($1, $2, 'Program', 'bachelor', 'active') returning id", [randomUUID(), school.id]);
      programIds.push(program.id);
      const { rows: [user] } = await pool.query("insert into users (email, email_normalized) values ($1, $1) returning id", [`teacher-${randomUUID()}@example.invalid`]);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'school_staff')", [user.id]);
      await pool.query("insert into school_staff_memberships (school_id, user_id, role, status) values ($1, $2, 'admissions', 'active')", [school.id, user.id]);
      const token = randomUUID();
      await pool.query("insert into auth_sessions (user_id, session_token_hash, selected_surface, active_role, tenant_school_id, expires_at) values ($1, $2, 'school', 'school_staff', $3, now() + interval '1 hour')", [user.id, hashSessionToken(token), school.id]);
      teachers.push({ userId: user.id, token });
    }
    const setA = await students.createApplicationSet(a.userId, { name: "A private set" });
    const setB = await students.createApplicationSet(b.userId, { name: "B private set" });
    const applications = [];
    const choices = [];
    for (const [owner, set, schoolIndex] of [[a, setA, 0], [a, setA, 1], [b, setB, 1]]) {
      const choice = await students.addApplicationChoice(owner.userId, { applicationSetId: set.id, schoolId: schoolIds[schoolIndex], programId: programIds[schoolIndex], studentNotes: "PRIVATE_CHOICE_MARKER" });
      choices.push(choice);
      const { rows: [application] } = await pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id, program_id, status, school_visible_profile_json) values ('cuac.program-application.v1', $1, $2, $3, $4, $5, 'submitted', $6::jsonb) returning id", [set.id, choice.id, owner.userId, schoolIds[schoolIndex], programIds[schoolIndex], JSON.stringify({ displayName: "Approved projection" })]);
      await pool.query("insert into school_application_status_events (school_application_id, to_status, reason) values ($1, 'submitted', 'Approved status event')", [application.id]);
      applications.push(application);
    }
    return { a, b, schoolIds, programIds, teachers, setA, setB, applications, choices };
  }

  await t.test("real registration/login/logout stores hashes and revokes only the selected session", async () => {
    const email = `register-${randomUUID()}@example.invalid`;
    const response = await authHttp.registerStudent(request("/api/v1/auth/register", null, { email, password, role: "cuac_admin", schoolId: randomUUID() }));
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.data.activeRole, "student");
    assert.match(response.headers.get("set-cookie"), /HttpOnly.*SameSite=Lax.*Secure/);
    assert.doesNotMatch(JSON.stringify(body), /sessionToken|passwordHash|scrypt\$/);
    const identity = await auth.findPasswordIdentityByEmailNormalized(email);
    assert.match(identity.passwordHash, /^scrypt\$/);
    const roles = await pool.query("select role from user_roles where user_id = $1", [body.data.userId]);
    assert.deepEqual(roles.rows, [{ role: "student" }]);
    const token = response.headers.get("set-cookie").split(";")[0].split("=")[1];
    assert.equal((await auth.findActiveSessionByTokenHash(hashSessionToken(token), new Date())).userId, body.data.userId);
    const wrong = await authHttp.createSession(request("/api/v1/auth/sessions", null, { email, password: "Not-the-correct-password" }));
    assert.equal(wrong.status, 403);
    const other = await credentials.createStudentSession({ email, password });
    assert.equal((await authHttp.logout(request("/api/v1/auth/logout", token, {}))).status, 200);
    assert.equal(await auth.findActiveSessionByTokenHash(hashSessionToken(token), new Date()), null);
    assert.equal((await auth.findActiveSessionByTokenHash(hashSessionToken(other.sessionToken), new Date())).userId, body.data.userId);
  });

  await t.test("password sign-in selects school and CUAC surfaces only from current database authority", async () => {
    const staff = await createStudent();
    const { rows: [school] } = await pool.query(
      "insert into schools (slug, name_en, status) values ($1, 'Surface School', 'active') returning id",
      [randomUUID()],
    );
    const { rows: [otherSchool] } = await pool.query(
      "insert into schools (slug, name_en, status) values ($1, 'Other Surface School', 'active') returning id",
      [randomUUID()],
    );
    await pool.query("insert into user_roles (user_id, role) values ($1, 'school_staff')", [staff.userId]);
    await pool.query(
      "insert into school_staff_memberships (school_id, user_id, role, status) values ($1, $2, 'admissions', 'active')",
      [school.id, staff.userId],
    );
    const schoolLogin = await authHttp.createSession(request("/api/v1/auth/sessions", null, {
      email: staff.email, password, selectedSurface: "school_staff", schoolId: school.id,
    }));
    assert.equal(schoolLogin.status, 200);
    const schoolBody = await schoolLogin.json();
    assert.deepEqual({ activeRole: schoolBody.data.activeRole, selectedSurface: schoolBody.data.selectedSurface,
      tenantSchoolId: schoolBody.data.tenantSchoolId },
    { activeRole: "school_staff", selectedSurface: "school", tenantSchoolId: school.id });
    const schoolToken = schoolLogin.headers.get("set-cookie").split(";")[0].split("=")[1];
    assert.equal((await resolveRequestContextFromRequest(request("/api/v1/me", schoolToken), auth, {
      schoolTenantMembershipRepository: auth,
    })).tenantSchoolId, school.id);
    assert.equal((await authHttp.createSession(request("/api/v1/auth/sessions", null, {
      email: staff.email, password, selectedSurface: "school_staff", schoolId: otherSchool.id,
    }))).status, 403);

    const ops = await createStudent();
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [ops.userId]);
    const { grantId } = await grantCuacStaffAccess(pool, ops.userId, "cuac_ops");
    const opsLogin = await authHttp.createSession(request("/api/v1/auth/sessions", null, {
      email: ops.email, password, selectedSurface: "cuac_internal",
    }));
    assert.equal(opsLogin.status, 200);
    const opsBody = await opsLogin.json();
    assert.deepEqual({ activeRole: opsBody.data.activeRole, selectedSurface: opsBody.data.selectedSurface,
      tenantSchoolId: opsBody.data.tenantSchoolId },
    { activeRole: "cuac_ops", selectedSurface: "ops", tenantSchoolId: null });
    await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = now() where id = $1", [grantId]);
    assert.equal((await authHttp.createSession(request("/api/v1/auth/sessions", null, {
      email: ops.email, password, selectedSurface: "cuac_internal",
    }))).status, 403);
  });

  await t.test("failure while creating password identity leaves no orphan account or role", async () => {
    const existing = await createStudent();
    const orphanEmail = `orphan-${randomUUID()}@example.invalid`;
    await pool.query("update auth_identities set provider_subject = $1 where user_id = $2", [orphanEmail, existing.userId]);
    await assert.rejects(auth.createStudentAccount({ email: orphanEmail, emailNormalized: orphanEmail, displayName: null, passwordHash: await hashPassword(password), now: new Date() }), (error) => error.code === "23505");
    const orphan = await pool.query("select id from users where email_normalized = $1", [orphanEmail]);
    assert.deepEqual(orphan.rows, []);
  });

  await t.test("role revocation invalidates old sessions for student and CUAC roles", async () => {
    const student = await createStudent();
    for (const role of ["student", "school_staff", "cuac_ops", "cuac_admin"]) {
      await pool.query("insert into user_roles (user_id, role) values ($1, $2) on conflict (user_id, role) where revoked_at is null do nothing", [student.userId, role]);
      if (role === "cuac_ops" || role === "cuac_admin") await grantCuacStaffAccess(pool, student.userId, role);
      const token = randomUUID();
      await pool.query("insert into auth_sessions (user_id, session_token_hash, selected_surface, active_role, expires_at) values ($1, $2, $3, $4, now() + interval '1 hour')", [student.userId, hashSessionToken(token), role === "student" ? "student" : role === "school_staff" ? "school" : "ops", role]);
      assert.equal((await resolveRequestContextFromRequest(request("/api/v1/me", token), auth)).activeRole, role);
      await pool.query("update user_roles set revoked_at = now() where user_id = $1 and role = $2", [student.userId, role]);
      assert.equal((await resolveRequestContextFromRequest(request("/api/v1/me", token), auth)).activeRole, "guest");
    }
    await assert.rejects(credentials.createStudentSession({ email: student.email, password }), (error) => error.status === 403);
  });

  await t.test("student HTTP reads/writes stay with the session owner despite forged authority fields", async () => {
    const f = await fixture();
    await students.upsertProfile(f.b.userId, { displayName: "B_PRIVATE_PROFILE_MARKER" });
    const response = await studentHttp.updateProfile(request(`/api/v1/student/profile?userId=${f.b.userId}`, f.a.sessionToken, { userId: f.b.userId, role: "cuac_admin", displayName: "A own profile", preferences: { subjectAreas: ["natural_sciences"] } }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.userId, f.a.userId);
    assert.equal((await students.getProfileByUserId(f.b.userId)).displayName, "B_PRIVATE_PROFILE_MARKER");
    const sets = await studentHttp.listApplicationSets(request(`/api/v1/student/application-sets?userId=${f.b.userId}`, f.a.sessionToken));
    assert.deepEqual((await sets.json()).data.map((set) => set.id), [f.setA.id]);
    const deniedRead = await studentHttp.getApplicationSet(request("/api/v1/student/application-sets", f.a.sessionToken), f.setB.id);
    assert.equal(deniedRead.status, 200);
    assert.equal((await deniedRead.json()).data, null);
    const deniedWrite = await studentHttp.addApplicationChoice(request("/api/v1/student/application-sets", f.a.sessionToken, { userId: f.b.userId, schoolId: f.schoolIds[0] }), f.setB.id);
    assert.equal(deniedWrite.status, 403);
    const saved = await studentHttp.saveItem(request("/api/v1/student/saved-items", f.a.sessionToken, { userId: f.b.userId, entityType: "school", entityId: f.schoolIds[0], notes: "PRIVATE_SAVED_MARKER" }));
    assert.equal((await saved.json()).data.userId, f.a.userId);
    assert.deepEqual(await students.listSavedItemsByUserId(f.b.userId), []);
    const logs = await pool.query("select metadata_json from audit_logs where actor_user_id = $1", [f.a.userId]);
    assert.ok(logs.rows.length >= 2);
    assert.doesNotMatch(JSON.stringify(logs.rows), /A own profile|B_PRIVATE_PROFILE_MARKER|PRIVATE_SAVED_MARKER|science/);
  });

  await t.test("repository owner scope prevents direct-ID reads and writes across students", async () => {
    const f = await fixture();
    assert.equal(await students.getApplicationSetById(f.setB.id, f.a.userId), null);
    assert.equal((await students.getApplicationSetById(f.setA.id, f.a.userId)).choices.length, 2);
    await assert.rejects(students.addApplicationChoice(f.a.userId, { applicationSetId: f.setB.id, schoolId: f.schoolIds[0] }), (error) => error.status === 403);
  });

  await t.test("school HTTP queue/detail use verified tenant and expose only approved projections", async () => {
    const f = await fixture();
    const me = await createAuthHttpHandlers(auth, auth).getMe(request("/api/v1/me", f.teachers[0].token));
    assert.equal((await me.json()).data.tenantSchoolId, f.schoolIds[0]);
    await students.upsertProfile(f.a.userId, { displayName: "RAW_STUDENT_PROFILE_MARKER" });
    const list = await schoolHttp.listApplications(request(`/api/v1/school/applications?schoolId=${f.schoolIds[1]}`, f.teachers[0].token));
    assert.equal(list.status, 200);
    const body = await list.json();
    assert.deepEqual(body.data.map((app) => app.id), [f.applications[0].id]);
    assert.doesNotMatch(JSON.stringify(body), /RAW_STUDENT_PROFILE_MARKER|PRIVATE_CHOICE_MARKER/);
    const own = await schoolHttp.getApplication(request("/api/v1/school/applications", f.teachers[0].token), f.applications[0].id);
    assert.equal((await own.json()).data.statusEvents.length, 1);
    const other = await schoolHttp.getApplication(request(`/api/v1/school/applications?schoolId=${f.schoolIds[1]}`, f.teachers[0].token), f.applications[1].id);
    assert.equal(other.status, 200);
    assert.equal((await other.json()).data, null);
    assert.equal(await schools.getApplicationById(f.applications[1].id, f.schoolIds[0]), null);
    const bQueue = await schoolHttp.listApplications(request("/api/v1/school/applications", f.teachers[1].token));
    assert.equal((await bQueue.json()).data.length, 2);
    const logs = await pool.query("select metadata_json from audit_logs where actor_user_id = $1", [f.teachers[0].userId]);
    assert.ok(logs.rows.length >= 2);
    assert.doesNotMatch(JSON.stringify(logs.rows), /Approved projection|RAW_STUDENT_PROFILE_MARKER|PRIVATE_CHOICE_MARKER/);
  });

  await t.test("missing membership enforcement, revoked membership and inactive school fail closed", async () => {
    const f = await fixture();
    const schoolRequest = () => request("/api/v1/school/applications", f.teachers[0].token);
    const unconfigured = createSchoolPortalHttpHandlers(new SchoolPortalService(schools), auth);
    assert.equal((await unconfigured.listApplications(schoolRequest())).status, 403);
    await pool.query("update school_staff_memberships set status = 'suspended' where user_id = $1", [f.teachers[0].userId]);
    assert.equal((await schoolHttp.listApplications(schoolRequest())).status, 403);
    await pool.query("update school_staff_memberships set status = 'active' where user_id = $1", [f.teachers[0].userId]);
    await pool.query("update schools set status = 'inactive' where id = $1", [f.schoolIds[0]]);
    assert.equal((await schoolHttp.listApplications(schoolRequest())).status, 403);
    assert.equal((await schoolHttp.listApplications(request("/api/v1/school/applications", f.a.sessionToken))).status, 403);
    assert.equal((await studentHttp.getProfile(schoolRequest())).status, 403);
    assert.equal((await studentHttp.getProfile(request("/api/v1/student/profile"))).status, 403);
  });

  await t.test("database rejects mismatched application ownership and school routing even without services", async () => {
    const f = await fixture();
    await assert.rejects(pool.query("insert into application_choices (application_set_id, user_id, school_id) values ($1, $2, $3)", [f.setB.id, f.a.userId, f.schoolIds[0]]), (error) => error.code === "23503" && error.constraint === "application_choices_set_owner_fk");
    const extra = await students.addApplicationChoice(f.a.userId, { applicationSetId: f.setA.id, schoolId: f.schoolIds[0] });
    await assert.rejects(pool.query("insert into school_applications (application_record_format, application_set_id, application_choice_id, student_user_id, school_id) values ('cuac.program-application.v1', $1, $2, $3, $4)", [f.setA.id, extra.id, f.a.userId, f.schoolIds[1]]), (error) => error.code === "23503" && error.constraint === "school_applications_choice_scope_fk");
    const emptySet = await students.createApplicationSet(f.b.userId, { name: "Empty set" });
    await assert.rejects(pool.query("insert into application_choices (application_set_id, user_id, school_id, program_id) values ($1, $2, $3, $4)", [emptySet.id, f.b.userId, f.schoolIds[0], f.programIds[1]]), (error) => error.code === "23503" && error.constraint === "application_choices_program_school_fk");
  });

  await t.test("school application target protection rejects project deletion while retaining owner deletion isolation", async () => {
    const f = await fixture();
    await assert.rejects(pool.query("delete from programs where id = $1", [f.programIds[0]]), error => error.code === "23503");
    assert.equal((await students.getApplicationSetById(f.setA.id, f.a.userId)).choices.find((choice) => choice.id === f.choices[0].id).programId, f.programIds[0]);
    assert.equal((await schools.getApplicationById(f.applications[0].id, f.schoolIds[0])).programId, f.programIds[0]);
    await pool.query("delete from users where id = $1", [f.a.userId]);
    assert.equal((await pool.query("select count(*)::int as total from school_applications where student_user_id = $1", [f.a.userId])).rows[0].total, 0);
    assert.equal((await schools.listApplicationQueueBySchoolId(f.schoolIds[1])).length, 1);
  });

  await t.test("expired sessions and disabled accounts cannot read private student profiles", async () => {
    const student = await createStudent();
    await students.upsertProfile(student.userId, { displayName: "DISABLED_PRIVATE_MARKER" });
    await pool.query("update auth_sessions set expires_at = now() - interval '1 second' where user_id = $1", [student.userId]);
    assert.equal((await studentHttp.getProfile(request("/api/v1/student/profile", student.sessionToken))).status, 403);
    const fresh = await credentials.createStudentSession({ email: student.email, password });
    await pool.query("update users set account_status = 'disabled' where id = $1", [student.userId]);
    const response = await studentHttp.getProfile(request("/api/v1/student/profile", fresh.sessionToken));
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), /DISABLED_PRIVATE_MARKER/);
    await assert.rejects(credentials.createStudentSession({ email: student.email, password }), (error) => error.status === 403);
  });
}
