import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresAuditWriter } from "../../../src/server/audit/postgres-writer.ts";
import { createOpsApplicationSupportHttpHandlers } from "../../../src/server/ops-support/http.ts";
import { PostgresOpsApplicationSupportRepository } from "../../../src/server/ops-support/postgres-repository.ts";
import { OpsApplicationSupportService } from "../../../src/server/ops-support/service.ts";
import { PostgresAuthSessionRepository } from "../../../src/server/auth/postgres-repository.ts";
import { hashSessionToken } from "../../../src/server/auth/session.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { transactionalMethod } from "../../../src/server/db/transactional-method.ts";
import { PostgresStudentCoreRepository } from "../../../src/server/student/postgres-repository.ts";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";

export async function runOpsApplicationSupportRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool);
  const auth = new PostgresAuthSessionRepository(client);
  const create = (transaction) => new OpsApplicationSupportService(
    new PostgresOpsApplicationSupportRepository(transaction), new PostgresAuditWriter(transaction),
  );
  const servicesFor = sqlClient => ({
    openApplicationSupportSession: transactionalMethod(sqlClient, create, "openApplicationSupportSession"),
    getApplicationBySupportSession: transactionalMethod(sqlClient, create, "getApplicationBySupportSession"),
    closeApplicationSupportSession: transactionalMethod(sqlClient, create, "closeApplicationSupportSession"),
  });
  const service = servicesFor(client);
  const http = createOpsApplicationSupportHttpHandlers(service, auth);
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  async function waitForBlockedBy(blockerPid, queryPattern) {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const rows = (await pool.query(`select pid from pg_stat_activity where datname = current_database()
        and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))
        and query like $2`, [blockerPid, queryPattern])).rows;
      if (rows.length) return rows[0].pid;
      await delay(10);
    }
    assert.fail("Ops grant revocation did not reach the real database lock barrier.");
  }

  await t.test("Ops support session is grant-bound application-scoped minimal and explicitly closeable", async () => {
    const opsEmail = `ops-support-${randomUUID()}@example.invalid`;
    const studentEmail = `ops-support-student-${randomUUID()}@example.invalid`;
    const { rows: [ops] } = await pool.query(
      "insert into users (email, email_normalized) values ($1, $1) returning id", [opsEmail],
    );
    const { rows: [student] } = await pool.query(
      "insert into users (email, email_normalized, display_name) values ($1, $1, 'OPS_PRIVATE_STUDENT_MARKER') returning id",
      [studentEmail],
    );
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops'), ($2, 'student')", [ops.id, student.id]);
    const { grantId } = await grantCuacStaffAccess(pool, ops.id, "cuac_ops");
    const token = randomUUID();
    await pool.query(
      `insert into auth_sessions (user_id, session_token_hash, selected_surface, active_role, expires_at)
       values ($1, $2, 'ops', 'cuac_ops', now() + interval '1 hour')`,
      [ops.id, hashSessionToken(token)],
    );
    const applicationSet = await new PostgresStudentCoreRepository(client)
      .createApplicationSet(student.id, { name: "OPS_PRIVATE_APPLICATION_MARKER" });
    const request = (path, body, method = "POST") => new Request(`https://cuac.test${path}`, {
      method,
      headers: { cookie: `cuac_session=${token}`, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const openedResponse = await http.openSupportSession(request("/api/v1/ops/support-sessions", {
      cuacId: applicationSet.cuacId, reasonCode: "student_inquiry",
    }));
    assert.equal(openedResponse.status, 200, await openedResponse.clone().text());
    const opened = (await openedResponse.json()).data;
    assert.equal(opened.cuacId, applicationSet.cuacId);
    assert.equal(opened.reasonCode, "student_inquiry");
    assert.ok(new Date(opened.expiresAt).getTime() - new Date(opened.createdAt).getTime() <= 15 * 60 * 1000);
    const send = () => http.lookupApplication(request(
      "/api/v1/ops/application-lookups", { supportSessionId: opened.supportSessionId },
    ));
    const response = await send();
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json();
    assert.equal(body.data.cuacId, applicationSet.cuacId);
    assert.equal(body.data.applicationSet.status, "draft");
    assert.deepEqual(body.data.programApplications, []);
    assert.doesNotMatch(JSON.stringify(body), /OPS_PRIVATE|studentUserId|email|profile|material|payment/i);

    const audits = (await pool.query(
      `select action, actor_user_id, resource_id, metadata_json
       from audit_logs where actor_user_id = $1 and action like 'ops.application_support%' order by created_at`,
      [ops.id],
    )).rows;
    assert.deepEqual(audits.map(row => row.action), ["ops.application_support_session.open", "ops.application_support.lookup"]);
    assert.equal(audits[1].resource_id, applicationSet.cuacId);
    assert.deepEqual(audits[1].metadata_json, { programApplicationCount: 0, reasonCode: "student_inquiry" });

    const stored = (await pool.query(
      `select actor_user_id, staff_access_grant_id, active_role, application_set_id, cuac_id, reason_code, closed_at
       from ops_support_access_sessions where id = $1`, [opened.supportSessionId],
    )).rows[0];
    assert.deepEqual(stored, { actor_user_id: ops.id, staff_access_grant_id: grantId, active_role: "cuac_ops",
      application_set_id: applicationSet.id, cuac_id: applicationSet.cuacId, reason_code: "student_inquiry", closed_at: null });

    const closed = await http.closeSupportSession(request(
      `/api/v1/ops/support-sessions/${opened.supportSessionId}`, undefined, "DELETE",
    ), opened.supportSessionId);
    assert.equal(closed.status, 200, await closed.clone().text());
    assert.equal((await closed.json()).data.closed, true);
    assert.equal((await send()).status, 403);

    const reopened = (await (await http.openSupportSession(request("/api/v1/ops/support-sessions", {
      cuacId: applicationSet.cuacId, reasonCode: "incident_response",
    }))).json()).data;
    const auditReached = deferred(), releaseAudit = deferred();
    let lookupPid;
    const gatedClient = { ...client, transaction: work => client.transaction(async tx => {
      lookupPid = (await tx.query("select pg_backend_pid() as pid", []))[0].pid;
      return work({ ...tx, query: async (sql, params) => {
        const rows = await tx.query(sql, params);
        if (/insert into audit_logs/i.test(sql)) { auditReached.resolve(); await releaseAudit.promise; }
        return rows;
      } });
    }) };
    const gatedHttp = createOpsApplicationSupportHttpHandlers(servicesFor(gatedClient), auth);
    let pendingLookup, revocation;
    try {
      pendingLookup = gatedHttp.lookupApplication(request(
        "/api/v1/ops/application-lookups", { supportSessionId: reopened.supportSessionId },
      ));
      await Promise.race([auditReached.promise, pendingLookup.then(() => assert.fail("Lookup did not reach its audit insert."))]);
      revocation = pool.query(
        "update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
        [grantId],
      );
      await waitForBlockedBy(lookupPid, "update cuac_staff_access_grants%");
      releaseAudit.resolve();
      assert.equal((await pendingLookup).status, 200);
      await revocation;
    } finally {
      releaseAudit.resolve();
      if (pendingLookup || revocation) await Promise.allSettled([pendingLookup, revocation].filter(Boolean));
    }
    assert.equal((await http.lookupApplication(request(
      "/api/v1/ops/application-lookups", { supportSessionId: reopened.supportSessionId },
    ))).status, 403);
  });

  await t.test("support session constraints reject mismatched scope and excessive lifetime", async () => {
    const value = (await pool.query(
      `select actor_user_id, staff_access_grant_id, active_role, application_set_id, cuac_id, reason_code
       from ops_support_access_sessions limit 1`,
    )).rows[0];
    assert.ok(value);
    await assert.rejects(pool.query(
      `insert into ops_support_access_sessions
        (actor_user_id, staff_access_grant_id, active_role, application_set_id, cuac_id, reason_code, expires_at)
       values ($1,$2,$3,$4,$5,$6,now() + interval '16 minutes')`,
      [value.actor_user_id, value.staff_access_grant_id, value.active_role, value.application_set_id, value.cuac_id, value.reason_code],
    ), error => error.code === "23514");
    await assert.rejects(pool.query(
      `insert into ops_support_access_sessions
        (actor_user_id, staff_access_grant_id, active_role, application_set_id, cuac_id, reason_code, expires_at)
       values ($1,$2,$3,$4,'CUAC-2026-999999',$5,now() + interval '5 minutes')`,
      [value.actor_user_id, value.staff_access_grant_id, value.active_role, value.application_set_id, value.reason_code],
    ), error => error.code === "23503");
  });

  await t.test("database rejects incomplete or duplicate active CUAC staff authority", async () => {
    const email = `ops-grant-constraint-${randomUUID()}@example.invalid`;
    const { rows: [user] } = await pool.query(
      "insert into users (email, email_normalized) values ($1, $1) returning id", [email],
    );
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_admin')", [user.id]);
    const active = await grantCuacStaffAccess(pool, user.id, "cuac_admin");
    await assert.rejects(grantCuacStaffAccess(pool, user.id, "cuac_admin"), error => error.code === "23505");
    await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = now() where id = $1", [active.grantId]);
    await assert.rejects(pool.query(
      `insert into cuac_staff_access_grants
        (user_id, email, email_normalized, requested_role, status, approved_by_user_id, approved_at, expires_at)
       values ($1, $2, $2, 'cuac_admin', 'approved', $1, now(), now() + interval '1 day')`,
      [user.id, email],
    ), error => error.code === "23514");
  });
}
