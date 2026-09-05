import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { createPostgresAgentMemoryManagementService } from "../../../src/server/agent/memory-runtime.ts";
import { GUEST_AGENT_CANDIDATE_CAPACITY } from "../../../src/server/agent/candidate-policy.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { runEducationHttpRehearsal } from "./education-http-rehearsal.mjs";
import { runAssessmentHttpRehearsal } from "./assessment-http-rehearsal.mjs";
import { runProgramRequirementsHttpRehearsal } from "./program-requirements-http-rehearsal.mjs";
import { runNoticesHttpRehearsal } from "./notices-http-rehearsal.mjs";
import { runNotificationsHttpRehearsal } from "./notifications-http-rehearsal.mjs";
import { runApplicationPreflightHttpRehearsal } from "./application-preflight-http-rehearsal.mjs";
import { runMaterialSelectionHttpRehearsal } from "./material-selection-http-rehearsal.mjs";
import { runApplicationMaterialPreviewHttpRehearsal } from "./application-material-preview-http-rehearsal.mjs";
import { runApplicationSubmissionAuthorizationHttpRehearsal } from "./application-submission-authorization-http-rehearsal.mjs";
import { runApplicationMaterialSnapshotHttpRehearsal } from "./application-material-snapshot-http-rehearsal.mjs";
import { runApplicationSubmissionHttpRehearsal } from "./application-submission-http-rehearsal.mjs";
import { MATERIAL_SNAPSHOT_TEST_KEY_ID, MATERIAL_SNAPSHOT_TEST_KEYRING_JSON } from "./application-material-snapshot-fixture.mjs";
import { runSchoolTargetHttpRehearsal } from "./school-application-target-http-rehearsal.mjs";
import { runAgentMemoryControlsHttpRehearsal } from "./agent-memory-controls-http-rehearsal.mjs";
import { grantCuacStaffAccess } from "./cuac-staff-access-fixture.mjs";
import { requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";
import { checkoutFixture, ingestAndProcess, providerEvent } from "./payment-provider-reconciliation-rehearsal.mjs";
import { PostgresOfficialSubmissionOutbox } from "../../../src/server/submission-delivery/postgres-outbox.ts";
import { applicationAtomicSubmissionFixture,
  clearApplicationAtomicSubmissions } from "./application-atomic-submission-fixture.mjs";

const password = "Synthetic-network-password-826";
const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
function legacyPasswordHash(value) {
  const salt = randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }).toString("base64url")}`;
}

export async function runHttpNetworkRehearsal(t, pool, databaseUrl) {
  const child = fork(new URL("./http-rehearsal-server.mjs", import.meta.url), [], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { NODE_ENV: "production", CUAC_ENV: "development", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      CUAC_PG_REHEARSAL_URL: databaseUrl, CUAC_SESSION_SECRET: randomBytes(32).toString("base64url"),
      CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID: MATERIAL_SNAPSHOT_TEST_KEY_ID,
      CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON: MATERIAL_SNAPSHOT_TEST_KEYRING_JSON,
      CUAC_AGENT_ENABLED: "true", CUAC_AGENT_TOOL_GATEWAY_MODE: "registry_only",
      CUAC_AGENT_SANDBOX_MODE: "enforced", CUAC_AGENT_DIRECT_DB_ACCESS: "false",
      CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "disabled", CUAC_AUTH_RATE_LIMIT_BACKEND: "disabled", CUAC_PAYMENT_MODE: "disabled", CUAC_FILE_UPLOAD_ENABLED: "false" },
  });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
  child.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-4000); });
  const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
  let startupTimer;
  const ready = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => reject(new Error(`Rehearsal server exited: ${logs}`)));
    child.once("message", (message) => message?.type === "ready" ? resolve(message.origin) : reject(new Error("Invalid server handshake.")));
    startupTimer = setTimeout(() => reject(new Error(`Rehearsal server startup timed out: ${logs}`)), 20_000);
  });
  try {
    const origin = await ready;
    clearTimeout(startupTimer);
    assert.equal(new URL(origin).hostname, "127.0.0.1");
    t.diagnostic("Network API rehearsal: built production server on a disposable loopback port.");
    async function send(path, { method = "GET", body, cookie = "", headers = {}, rawBody } = {}) {
      const applicationKey = method === "POST" && /^\/api\/v1\/student\/application-sets(?:\/[^/]+\/choices)?$/.test(path) ? { "idempotency-key": randomUUID() } : {};
      const writeHeaders = method === "GET" ? {} : { origin, "sec-fetch-site": "same-origin", ...(method === "DELETE" ? {} : { "content-type": "application/json" }) };
      const requestBody = method === "GET" || (method === "DELETE" && body === undefined && rawBody === undefined)
        ? undefined : rawBody ?? JSON.stringify(body ?? {});
      const response = await fetch(origin + path, { method, redirect: "manual", signal: AbortSignal.timeout(10_000),
        headers: { ...writeHeaders, ...applicationKey, cookie, ...headers }, body: requestBody });
      const responseBody = await response.arrayBuffer();
      return new Response(responseBody.byteLength ? responseBody : null,
        { status: response.status, statusText: response.statusText, headers: response.headers });
    }
    function browser() {
      const cookies = new Map();
      return {
        cookies,
        async send(path, options = {}) {
          const response = await send(path, { ...options, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") });
          for (const header of response.headers.getSetCookie()) {
            const pair = header.split(";")[0];
            const split = pair.indexOf("=");
            const key = pair.slice(0, split), value = pair.slice(split + 1);
            if (/Max-Age=0/.test(header)) cookies.delete(key); else cookies.set(key, value);
          }
          return response;
        },
      };
    }
    async function register(client) {
      const email = `network-${randomUUID()}@example.invalid`;
      const response = await client.send("/api/v1/auth/register", { method: "POST", body: { email, password, role: "cuac_admin" } });
      assert.equal(response.status, 201, await response.clone().text());
      const data = (await response.json()).data;
      assert.equal(data.activeRole, "student");
      assert.equal(JSON.stringify(data).includes(client.cookies.get("cuac_session")), false);
      return { ...data, email };
    }
    const a = browser(), b = browser();
    let userA, userB;

    async function authCounts() {
      return (await pool.query(`select
        (select count(*)::int from users) as users,
        (select count(*)::int from auth_identities) as identities,
        (select count(*)::int from auth_sessions) as sessions,
        (select count(*)::int from auth_sessions where revoked_at is not null) as revoked_sessions,
        (select count(*)::int from user_roles) as roles,
        (select count(*)::int from email_verification_challenges) as verifications,
        (select count(*)::int from password_reset_challenges) as resets,
        (select count(*)::int from school_staff_invites) as invites,
        (select count(*)::int from sign_in_continuations) as continuations,
        (select count(*)::int from audit_logs) as audits`)).rows[0];
    }

    await t.test("network health and catalog routes run with safe response headers", async () => {
      for (const path of ["/api/v1/health", "/api/v1/catalog/schools", "/api/v1/me"]) {
        const response = await send(path);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.ok(response.headers.get("x-request-id"));
        if (path === "/api/v1/health") assert.equal((await response.json()).database.reachable, true);
      }
    });

    async function waitForBlockedApiQueries(count) {
      let observed = 0;
      for (let attempt = 0; attempt < 500; attempt += 1) {
        const { rows } = await pool.query("select pid from pg_stat_activity where datname = current_database() and application_name = 'cuac:api' and state = 'active' and wait_event_type = 'Lock'");
        observed = rows.length;
        if (observed >= count) return rows;
        await delay(20);
      }
      assert.fail(`API requests did not reach the database lock barrier: expected at least ${count}, observed ${observed}.`);
    }

    await t.test("network API survives terminated idle database connections and verifies recovery", async () => {
      const { rows } = await pool.query("select pid from pg_stat_activity where datname = current_database() and application_name = 'cuac:api' and state = 'idle'");
      assert.ok(rows.length > 0);
      for (const { pid } of rows) await pool.query("select pg_terminate_backend($1)", [pid]);
      await delay(100);
      const response = await send("/api/v1/health");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).database.reachable, true);
      assert.equal(child.exitCode, null);
      const replacement = await pool.query("select pid from pg_stat_activity where datname = current_database() and application_name = 'cuac:api'");
      assert.ok(replacement.rows.length > 0);
      assert.ok(replacement.rows.every(row => !rows.some(old => old.pid === row.pid)));
    });

    await t.test("network active query loss returns a redacted failure without automatic replay", async () => {
      const blocker = await pool.connect();
      let pending;
      try {
        await blocker.query("begin");
        await blocker.query("lock table schools in access exclusive mode");
        pending = send("/api/v1/catalog/schools");
        const [{ pid }] = await waitForBlockedApiQueries(1);
        await pool.query("select pg_terminate_backend($1)", [pid]);
        const response = await pending;
        assert.equal(response.status, 500);
        const body = await response.text();
        assert.match(body, /INTERNAL_ERROR/);
        assert.doesNotMatch(body, /postgres|cuac_rehearsal|select|terminat|password/i);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(child.exitCode, null);
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (pending) await Promise.allSettled([pending]);
      }
      assert.equal((await send("/api/v1/catalog/schools")).status, 200);
    });

    await t.test("network readiness becomes 503 when the shared pool is saturated then recovers", async () => {
      const blocker = await pool.connect();
      let requests = [];
      try {
        await blocker.query("begin");
        await blocker.query("lock table schools in access exclusive mode");
        requests = Array.from({ length: 8 }, () => send("/api/v1/catalog/schools"));
        const settled = Promise.allSettled(requests);
        await waitForBlockedApiQueries(8);
        const response = await send("/api/v1/health");
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(body.database.configured, true);
        assert.equal(body.database.reachable, false);
        assert.doesNotMatch(JSON.stringify(body), /cuac_rehearsal|timeout exceeded|select/i);
        assert.equal(child.exitCode, null);
        await blocker.query("rollback");
        for (const result of await settled) {
          assert.equal(result.status, "fulfilled");
          assert.equal(result.value.status, 200);
        }
      } finally {
        await blocker.query("rollback");
        blocker.release();
        await Promise.allSettled(requests);
      }
      const response = await send("/api/v1/health");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).database.reachable, true);
    });

    await t.test("network boundary rejects cross-site and malformed writes before account insertion", async () => {
      const before = (await pool.query("select count(*)::int as count from users")).rows[0].count;
      const cases = [
        [{ headers: { origin: "https://evil.invalid", "x-forwarded-host": new URL(origin).host } }, 403],
        [{ headers: { origin: "null" } }, 403],
        [{ headers: { "content-type": "text/plain" } }, 415],
        [{ rawBody: "{" }, 400], [{ rawBody: "null" }, 400],
        [{ body: { padding: "x".repeat(70_000) } }, 413],
      ];
      for (const [options, status] of cases) {
        const response = await send("/api/v1/auth/register", { method: "POST", ...options });
        assert.equal(response.status, status, await response.clone().text());
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
      assert.equal((await pool.query("select count(*)::int as count from users")).rows[0].count, before);
      assert.equal((await send("/api/v1/student/application-sets/not-a-uuid")).status, 400);
      const preflight = await send("/api/v1/auth/register", { method: "OPTIONS", headers: { origin: "https://evil.invalid", "access-control-request-method": "POST" } });
      assert.equal(preflight.headers.get("access-control-allow-origin"), null);
    });

    await t.test("network registration rejects malformed domain inputs without creating identities or sessions", async () => {
      const before = await authCounts();
      const base = { email: `input-${randomUUID()}@example.invalid`, password };
      for (const body of [{ ...base, email: {} }, { ...base, email: "x".repeat(321) }, { ...base, email: "a..b@example.invalid" }, { ...base, password: {} }, { ...base, password: "legacy08" }, { ...base, password: "x".repeat(1025) }, { ...base, password: "\u{1f600}".repeat(257) }, { ...base, displayName: [] }, { ...base, displayName: "x".repeat(121) }, { ...base, ip: "forged" }, { ...base, PRIVATE_AUTH_MARKER: "NEVER_STORE_AUTH_INPUT" }]) {
        const response = await send("/api/v1/auth/register", { method: "POST", body });
        assert.equal(response.status, 400, await response.clone().text());
        assert.equal(response.headers.get("set-cookie"), null);
        assert.doesNotMatch(await response.text(), /PRIVATE_AUTH_MARKER|NEVER_STORE_AUTH_INPUT/);
      }
      assert.deepEqual(await authCounts(), before);
      const longPassword = " " + "\u{1f600}".repeat(255) + "abc";
      assert.equal(Buffer.byteLength(longPassword), 1024);
      const client = browser();
      const response = await client.send("/api/v1/auth/register", { method: "POST", body: { ...base, password: longPassword, displayName: "x".repeat(120), role: "cuac_admin" } });
      assert.equal(response.status, 201, await response.clone().text());
      const account = (await response.json()).data;
      const stored = (await pool.query("select display_name from users where id = $1", [account.userId])).rows[0];
      assert.equal(stored.display_name.length, 120);
      assert.deepEqual((await pool.query("select role from user_roles where user_id = $1", [account.userId])).rows, [{ role: "student" }]);
      assert.equal((await client.send("/api/v1/auth/sessions", { method: "POST", body: { email: base.email, password: longPassword.trim() } })).status, 403);
      assert.equal((await client.send("/api/v1/auth/sessions", { method: "POST", body: { email: base.email, password: longPassword } })).status, 200);
    });

    await t.test("network guest initialization and registration preserve signed browser binding", async () => {
      const before = (await pool.query("select count(*)::int as count from users")).rows[0].count;
      for (const client of [a, b]) {
        client.cookies.set("cuac_guest", "untrusted-guest-id");
        const response = await client.send("/api/v1/auth/guest-session", { method: "POST" });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { data: { status: "ready" } });
        assert.match(client.cookies.get("cuac_guest"), /^v1\./);
        const setCookie = response.headers.getSetCookie()[0];
        assert.match(setCookie, /HttpOnly/);
        assert.match(setCookie, /SameSite=Lax/);
        assert.doesNotMatch(setCookie, /Expires|Max-Age|Domain=/);
        const preserved = client.cookies.get("cuac_guest");
        const repeat = await client.send("/api/v1/auth/guest-session", { method: "POST" });
        assert.equal(repeat.status, 200);
        assert.equal(repeat.headers.getSetCookie().length, 0);
        assert.equal(client.cookies.get("cuac_guest"), preserved);
      }
      const oldGuest = a.cookies.get("cuac_guest");
      assert.equal((await a.send("/api/v1/auth/guest-session", { method: "POST", body: { rotate: "yes" } })).status, 400);
      assert.equal(a.cookies.get("cuac_guest"), oldGuest);
      assert.equal((await a.send("/api/v1/auth/guest-session", { method: "POST", body: { rotate: true } })).status, 200);
      assert.notEqual(a.cookies.get("cuac_guest"), oldGuest);
      assert.equal((await pool.query("select count(*)::int as count from users")).rows[0].count, before);
      const guestA = a.cookies.get("cuac_guest");
      userA = await register(a); userB = await register(b);
      assert.equal(a.cookies.get("cuac_guest"), guestA);
      const me = await a.send("/api/v1/me");
      assert.equal((await me.json()).data.actorUserId, userA.userId);
    });

    await t.test("network legacy login upgrades storage without exposing credential data", async () => {
      const client = browser();
      const account = await register(client);
      await pool.query("update auth_identities set password_hash = $2 where user_id = $1 and provider = 'password'", [account.userId, legacyPasswordHash(password)]);
      const response = await client.send("/api/v1/auth/sessions", { method: "POST", body: { email: account.email, password } });
      assert.equal(response.status, 200, await response.clone().text());
      const requestId = response.headers.get("x-request-id");
      const body = await response.text();
      assert.doesNotMatch(body, /password|scrypt\$|credentialUpgrade/i);
      assert.equal(JSON.parse(body).data.userId, account.userId);
      const stored = (await pool.query("select password_hash from auth_identities where user_id = $1 and provider = 'password'", [account.userId])).rows[0].password_hash;
      assert.match(stored, /^scrypt\$v2\$32768\$8\$3\$/);
      assert.deepEqual((await pool.query("select metadata_json from audit_logs where request_id = $1", [requestId])).rows[0].metadata_json, { selectedSurface: "student", credentialUpgrade: "scrypt_v2" });
      const current = await client.send("/api/v1/auth/sessions", { method: "POST", body: { email: account.email, password } });
      assert.equal(current.status, 200, await current.clone().text());
      assert.deepEqual((await pool.query("select metadata_json from audit_logs where request_id = $1", [current.headers.get("x-request-id")])).rows[0].metadata_json, { selectedSurface: "student" });
    });

    await t.test("network password login derives school and CUAC sessions from current database authority", async () => {
      const schoolClient = browser(), opsClient = browser();
      const schoolAccount = await register(schoolClient), opsAccount = await register(opsClient);
      const school = (await pool.query("select id from schools where status = 'active' order by id limit 1")).rows[0];
      await pool.query("insert into user_roles (user_id, role) values ($1, 'school_staff')", [schoolAccount.userId]);
      await pool.query(
        "insert into school_staff_memberships (school_id, user_id, role, status) values ($1, $2, 'admissions', 'active')",
        [school.id, schoolAccount.userId],
      );
      const schoolLogin = await schoolClient.send("/api/v1/auth/sessions", { method: "POST", body: {
        email: schoolAccount.email, password, selectedSurface: "school_staff", schoolId: school.id,
      } });
      assert.equal(schoolLogin.status, 200, await schoolLogin.clone().text());
      const schoolSession = (await schoolLogin.json()).data;
      assert.deepEqual(Object.keys(schoolSession).sort(), ["activeRole", "expiresAt", "selectedSurface", "sessionId", "tenantSchoolId", "userId"]);
      assert.equal(schoolSession.userId, schoolAccount.userId);
      assert.equal(schoolSession.activeRole, "school_staff");
      assert.equal(schoolSession.selectedSurface, "school");
      assert.equal(schoolSession.tenantSchoolId, school.id);
      assert.match(schoolSession.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.ok(Number.isFinite(Date.parse(schoolSession.expiresAt)));
      assert.equal((await schoolClient.send("/api/v1/auth/sessions", { method: "POST", body: {
        email: schoolAccount.email, password, selectedSurface: "school_staff", schoolId: randomUUID(),
      } })).status, 403);

      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [opsAccount.userId]);
      const { grantId } = await grantCuacStaffAccess(pool, opsAccount.userId, "cuac_ops");
      const opsLogin = await opsClient.send("/api/v1/auth/sessions", { method: "POST", body: {
        email: opsAccount.email, password, selectedSurface: "cuac_internal",
      } });
      assert.equal(opsLogin.status, 200, await opsLogin.clone().text());
      const opsSession = (await opsLogin.json()).data;
      assert.deepEqual(Object.keys(opsSession).sort(), ["activeRole", "expiresAt", "selectedSurface", "sessionId", "tenantSchoolId", "userId"]);
      assert.equal(opsSession.userId, opsAccount.userId);
      assert.equal(opsSession.activeRole, "cuac_ops");
      assert.equal(opsSession.selectedSurface, "ops");
      assert.equal(opsSession.tenantSchoolId, null);
      assert.match(opsSession.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      assert.ok(Number.isFinite(Date.parse(opsSession.expiresAt)));
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1", [grantId]);
      assert.equal((await opsClient.send("/api/v1/auth/sessions", { method: "POST", body: {
        email: opsAccount.email, password, selectedSurface: "cuac_internal",
      } })).status, 403);
    });

    await t.test("network credential audit failures return no cookies and roll back registration, login and logout", async () => {
      const fault = await createAuditFailureFixture(pool);
      const client = browser(), email = `atomic-network-${randomUUID()}@example.invalid`;
      try {
        for (const [action, path, body, success] of [
          ["auth.register", "/api/v1/auth/register", { email, password }, 201],
          ["auth.login", "/api/v1/auth/sessions", { email, password }, 200],
          ["auth.logout", "/api/v1/auth/logout", {}, 200],
        ]) {
          const before = await snapshotAuditedBusinessTables(pool), cookies = [...client.cookies];
          const response = await fault.during(action, () => client.send(path, { method: "POST", body }));
          assert.equal(response.status, 500, await response.clone().text());
          assert.equal(response.headers.getSetCookie().length, 0);
          assert.equal(response.headers.get("cache-control"), "no-store");
          assert.doesNotMatch(await response.text(), /Synthetic audit|P0001|insert into|password_hash/);
          assert.deepEqual([...client.cookies], cookies);
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
          const retry = await client.send(path, { method: "POST", body });
          assert.equal(retry.status, success, await retry.clone().text());
          const logs = (await pool.query("select * from audit_logs where request_id = $1 and action = $2", [retry.headers.get("x-request-id"), action])).rows;
          assert.equal(logs.length, 1);
          assert.equal(logs[0].active_role, "student");
          assert.equal(JSON.stringify(logs).includes(password), false);
        }
        assert.equal(client.cookies.size, 0);
      } finally { await fault.close(); }
    });

    await t.test("network student and Auth mutations cannot outlive a failed audit insert", async () => {
      const fault = await createAuditFailureFixture(pool);
      async function check(action, client, path, body = {}) {
        const before = await snapshotAuditedBusinessTables(pool);
        const response = await fault.during(action, () => client.send(path, { method: action === "student.profile.update" ? "PATCH" : "POST", body }));
        assert.equal(response.status, 500, await response.clone().text());
        assert.equal(response.headers.getSetCookie().length, 0);
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before, action);
        const retry = await client.send(path, { method: action === "student.profile.update" ? "PATCH" : "POST", body });
        assert.equal(retry.status, 200, await retry.clone().text());
        assert.equal((await pool.query("select count(*)::int as n from audit_logs where request_id = $1 and action = $2", [retry.headers.get("x-request-id"), action])).rows[0].n, 1);
        return (await retry.json()).data;
      }
      try {
        const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
        await check("student.profile.update", a, "/api/v1/student/profile", { displayName: "Atomic HTTP profile" });
        await check("student.saved_item.save", a, "/api/v1/student/saved-items", { entityType: "school", entityId: schoolId });
        const set = await check("student.application_set.create", a, "/api/v1/student/application-sets", { name: "Atomic HTTP set" });
        await check("student.application_choice.add", a, `/api/v1/student/application-sets/${set.id}/choices`, { schoolId });

        const resetClient = browser(), resetUser = await register(resetClient);
        const verified = await check("auth.email_verification.request", resetClient, "/api/v1/auth/email-verification");
        const verificationToken = randomBytes(32).toString("base64url");
        await pool.query("update email_verification_challenges set verification_token_hash = $2 where id = $1", [verified.challengeId, digest(verificationToken)]);
        await check("auth.email_verification.verify", resetClient, `/api/v1/auth/email-verification/${verified.challengeId}/verify`, { verificationToken });
        await check("auth.password_reset.request", resetClient, "/api/v1/auth/password-reset", { email: resetUser.email });
        const resetToken = randomBytes(32).toString("base64url");
        const reset = (await pool.query("update password_reset_challenges set reset_token_hash = $2 where user_id = $1 returning id", [resetUser.userId, digest(resetToken)])).rows[0];
        await check("auth.password_reset.consume", resetClient, `/api/v1/auth/password-reset/${reset.id}/reset`, { resetToken, newPassword: "Atomic network reset password" });

        const ops = browser(), teacher = browser();
        const opsUser = await register(ops), teacherUser = await register(teacher);
        await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [opsUser.userId]);
        await grantCuacStaffAccess(pool, opsUser.userId, "cuac_ops");
        await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1", [opsUser.sessionId]);
        const invite = await check("auth.school_staff_invite.create", ops, "/api/v1/auth/school-invites", { schoolId, email: teacherUser.email, role: "viewer" });
        const inviteToken = randomBytes(32).toString("base64url");
        await pool.query("update school_staff_invites set token_hash = $2 where id = $1", [invite.inviteId, digest(inviteToken)]);
        await check("auth.school_staff_invite.accept", teacher, `/api/v1/auth/school-invites/${invite.inviteId}/accept`, { inviteToken });
        const pending = (await (await ops.send("/api/v1/auth/school-invites", { method: "POST", body: { schoolId, email: `atomic-revoke-${randomUUID()}@example.invalid`, role: "viewer" } })).json()).data;
        await check("auth.school_staff_invite.revoke", ops, `/api/v1/auth/school-invites/${pending.inviteId}/revoke`);

        const guest = browser();
        await guest.send("/api/v1/auth/guest-session", { method: "POST" });
        const continuation = await check("auth.sign_in_continuation.create", guest, "/api/v1/auth/sign-in-continuations", { actionKey: "application.add_choice", targetRoute: "/application.html#add-choice" });
        await register(guest);
        await check("auth.sign_in_continuation.consume", guest, `/api/v1/auth/sign-in-continuations/${continuation.continuationId}/consume`, { continuationToken: continuation.continuationToken });
      } finally { await fault.close(); }
    });

    await t.test("network Auth commands reject unknown fields and unsafe navigation without side effects", async () => {
      const guest = browser();
      await guest.send("/api/v1/auth/guest-session", { method: "POST" });
      const guestCookie = guest.cookies.get("cuac_guest");
      const before = await authCounts();
      const cases = [
        [a, "/api/v1/auth/sessions", { email: {}, password }],
        [a, "/api/v1/auth/logout", { sessionToken: "other-token" }],
        [a, "/api/v1/auth/email-verification", { email: userB.email }],
        [a, "/api/v1/auth/password-reset", { email: [] }],
        [a, "/api/v1/auth/password-reset", { email: userA.email, resetToken: "forged" }],
        [guest, "/api/v1/auth/guest-session", { rotate: true, expiresAt: "2099-01-01" }],
      ];
      for (const [client, path, body] of cases) {
        const response = await client.send(path, { method: "POST", body });
        assert.equal(response.status, 400, await response.clone().text());
        assert.equal(response.headers.get("set-cookie"), null);
      }
      const base = { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" };
      for (const body of [{ ...base, actionKey: "payment.refund" }, { ...base, targetRoute: "/private/path" }, { ...base, requiredRole: "cuac_admin" }, { ...base, deviceFingerprint: [] }, { ...base, payloadPreview: { programId: "legacy-slug" } }]) {
        assert.equal((await guest.send("/api/v1/auth/sign-in-continuations", { method: "POST", body })).status, 400);
      }
      assert.equal(guest.cookies.get("cuac_guest"), guestCookie);
      assert.deepEqual(await authCounts(), before);
      assert.equal((await (await a.send("/api/v1/me")).json()).data.actorUserId, userA.userId);
    });

    await t.test("network school invite commands enforce input grammar and derive grants from stored invitation", async () => {
      const ops = browser(), teacher = browser();
      const opsAccount = await register(ops), teacherAccount = await register(teacher);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [opsAccount.userId]);
      await grantCuacStaffAccess(pool, opsAccount.userId, "cuac_ops");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1", [opsAccount.sessionId]);
      const school = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0];
      const base = { schoolId: school.id, email: teacherAccount.email, role: "viewer" };
      const before = await authCounts();
      for (const body of [{ ...base, schoolId: "bad-id" }, { ...base, email: {} }, { ...base, role: {} }, { ...base, inviteToken: "forged" }]) {
        const response = await ops.send("/api/v1/auth/school-invites", { method: "POST", body });
        assert.equal(response.status, 400, await response.clone().text());
      }
      assert.equal((await teacher.send("/api/v1/auth/school-invites", { method: "POST", body: { ...base, activeRole: "cuac_ops", userId: opsAccount.userId } })).status, 403);
      assert.deepEqual(await authCounts(), before);
      const response = await ops.send("/api/v1/auth/school-invites", { method: "POST", body: { ...base, invitedByUserId: teacherAccount.userId } });
      assert.equal(response.status, 200, await response.clone().text());
      const invite = (await response.json()).data;
      assert.equal(invite.deliveryStatus, "deferred");
      assert.equal(invite.inviteToken, undefined);
      // A synthetic proof replaces delivery; no real email provider is enabled.
      const inviteToken = randomBytes(32).toString("base64url");
      await pool.query("update school_staff_invites set token_hash = $2 where id = $1", [invite.inviteId, digest(inviteToken)]);
      const snapshot = (await pool.query("select * from school_staff_invites where id = $1", [invite.inviteId])).rows;
      const path = `/api/v1/auth/school-invites/${invite.inviteId}`;
      assert.equal((await teacher.send(`${path}/accept`, { method: "POST", body: { inviteToken: {} } })).status, 400);
      assert.equal((await ops.send(`${path}/revoke`, { method: "POST", body: { revoked: true } })).status, 400);
      assert.equal((await b.send(`${path}/accept`, { method: "POST", body: { inviteToken } })).status, 403);
      assert.deepEqual((await pool.query("select * from school_staff_invites where id = $1", [invite.inviteId])).rows, snapshot);
      const accept = await teacher.send(`${path}/accept`, { method: "POST", body: { inviteToken, role: "cuac_admin", schoolId: randomUUID(), userId: opsAccount.userId } });
      assert.equal(accept.status, 200, await accept.clone().text());
      const grant = (await accept.json()).data;
      assert.equal(grant.userId, teacherAccount.userId);
      assert.equal(grant.role, "viewer");
      assert.equal(grant.schoolId, school.id);
      assert.equal((await pool.query("select count(*)::int as n from user_roles where user_id = $1 and role in ('cuac_ops', 'cuac_admin')", [teacherAccount.userId])).rows[0].n, 0);
      assert.equal((await teacher.send(`${path}/accept`, { method: "POST", body: { inviteToken } })).status, 400);
      const pending = (await (await ops.send("/api/v1/auth/school-invites", { method: "POST", body: { ...base, email: `revoke-${randomUUID()}@example.invalid` } })).json()).data;
      const revoke = await ops.send(`/api/v1/auth/school-invites/${pending.inviteId}/revoke`, { method: "POST", body: { revokedByUserId: teacherAccount.userId } });
      assert.equal(revoke.status, 200, await revoke.clone().text());
      assert.equal((await pool.query("select status from school_staff_invites where id = $1", [pending.inviteId])).rows[0].status, "revoked");
    });

    await t.test("network Ops support opens uses and closes a scoped session then fails closed after grant revocation", async () => {
      const ops = browser(), student = browser();
      const opsAccount = await register(ops);
      await register(student);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [opsAccount.userId]);
      const { grantId } = await grantCuacStaffAccess(pool, opsAccount.userId, "cuac_ops");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1", [opsAccount.sessionId]);
      const create = await student.send("/api/v1/student/application-sets", { method: "POST", body: { name: "OPS_NETWORK_PRIVATE_MARKER" } });
      assert.equal(create.status, 200, await create.clone().text());
      const applicationSet = (await create.json()).data;
      const openPath = "/api/v1/ops/support-sessions";
      const openedResponse = await ops.send(openPath, { method: "POST", body: {
        cuacId: applicationSet.cuacId, reasonCode: "student_inquiry",
      } });
      assert.equal(openedResponse.status, 200, await openedResponse.clone().text());
      const opened = (await openedResponse.json()).data;
      const path = "/api/v1/ops/application-lookups";
      const input = { supportSessionId: opened.supportSessionId };
      const response = await ops.send(path, { method: "POST", body: input });
      assert.equal(response.status, 200, await response.clone().text());
      const body = await response.json();
      assert.equal(body.data.cuacId, applicationSet.cuacId);
      assert.doesNotMatch(JSON.stringify(body), /OPS_NETWORK_PRIVATE|studentUserId|email|profile|material|payment/i);
      assert.equal((await ops.send(`${path}?userId=${opsAccount.userId}`, { method: "POST", body: input })).status, 400);
      const closed = await ops.send(`${openPath}/${opened.supportSessionId}`, { method: "DELETE" });
      assert.equal(closed.status, 200, await closed.clone().text());
      assert.equal((await ops.send(path, { method: "POST", body: input })).status, 403);
      const reopened = (await (await ops.send(openPath, { method: "POST", body: {
        cuacId: applicationSet.cuacId, reasonCode: "incident_response",
      } })).json()).data;
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = now() where id = $1", [grantId]);
      assert.equal((await ops.send(path, { method: "POST", body: { supportSessionId: reopened.supportSessionId } })).status, 403);
    });

    await t.test("network Ops monitoring returns a fixed private queue summary and follows live grant revocation", async () => {
      const ops = browser(), student = browser();
      const opsAccount = await register(ops);
      await register(student);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops')", [opsAccount.userId]);
      const { grantId } = await grantCuacStaffAccess(pool, opsAccount.userId, "cuac_ops");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1", [opsAccount.sessionId]);
      const path = "/api/v1/ops/operations/summary";
      const fault = await createAuditFailureFixture(pool);
      try {
        const failed = await fault.during("ops.operations_summary.read", () => ops.send(path));
        assert.equal(failed.status, 500, await failed.clone().text());
        assert.doesNotMatch(await failed.text(), /auth_email_delivery|payment_reconciliation|Synthetic audit|insert into/i);
      } finally { await fault.close(); }
      const response = await ops.send(path);
      assert.equal(response.status, 200, await response.clone().text());
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      const body = await response.json();
      assert.equal(body.data.schemaVersion, 1);
      assert.deepEqual(body.data.queues.map(queue => queue.queueKey), [
        "auth_email_delivery", "notification_delivery", "student_file_processing",
        "official_submission_delivery", "payment_reconciliation",
      ]);
      assert.doesNotMatch(JSON.stringify(body), /userId|email_normalized|filename|objectKey|invoiceId|paymentId|applicationId/i);
      assert.equal((await ops.send(`${path}?metric=payment_reconciliation`)).status, 400);
      assert.equal((await student.send(path)).status, 403);
      assert.equal((await pool.query(
        "select count(*)::integer as total from audit_logs where request_id = $1 and action = 'ops.operations_summary.read'",
        [response.headers.get("x-request-id")],
      )).rows[0].total, 1);
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1", [grantId]);
      assert.equal((await ops.send(path)).status, 403);
    });

    await t.test("network Ops catalog requirements enforce two-person review, admin step-up and route-bound scope", async () => {
      const preparer = browser(), reviewer = browser();
      const preparerAccount = await register(preparer), reviewerAccount = await register(reviewer);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops'), ($2, 'cuac_admin')",
        [preparerAccount.userId, reviewerAccount.userId]);
      const preparerGrant = await grantCuacStaffAccess(pool, preparerAccount.userId, "cuac_ops");
      await grantCuacStaffAccess(pool, reviewerAccount.userId, "cuac_admin");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1",
        [preparerAccount.sessionId]);
      await pool.query("update auth_sessions set active_role = 'cuac_admin', selected_surface = 'ops' where id = $1",
        [reviewerAccount.sessionId]);

      const key = randomUUID();
      const school = (await pool.query("insert into schools (slug,name_en,status) values ($1,'Network governance school','active') returning id", [key])).rows[0];
      const program = (await pool.query(`insert into programs (school_id,slug,name_en,degree_level,status,is_verified)
        values ($1,$2,'Network governance program','master','active',true) returning id`, [school.id, key])).rows[0];
      const intake = (await pool.query("insert into program_intakes (program_id,intake_term,intake_year) values ($1,'fall',2027) returning id",
        [program.id])).rows[0];
      const base = `/api/v1/ops/catalog/programs/${program.id}/intakes/${intake.id}/requirements`;
      const document = requirementDocument(), versionId = randomUUID();
      const createdResponse = await preparer.send(base, { method: "POST", body: { versionId, document } });
      assert.equal(createdResponse.status, 201, await createdResponse.clone().text());
      const draft = (await createdResponse.json()).data;
      assert.equal(draft.versionId, versionId);
      assert.equal(draft.governanceStatus, "draft");
      const list = (await (await preparer.send(`${base}?limit=5`)).json()).data;
      assert.equal(list.items[0].versionId, versionId);
      assert.equal((await preparer.send(`${base}/${versionId}`)).status, 200);

      const approval = {
        expectedContentSha256: requirementDigest(document), effectiveFrom: null,
        reviewDueAt: new Date(Date.now() + 86_400_000).toISOString(),
        sourceChecks: document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256,
          officialSourceConfirmed: true })), scopeConfirmed: true, publicContentConfirmed: true,
      };
      const approvalPath = `${base}/${versionId}/approval`;
      assert.equal((await reviewer.send(approvalPath, { method: "POST", body: approval })).status, 403);
      const elevated = await reviewer.send("/api/v1/auth/step-up", { method: "POST", body: { password } });
      assert.equal(elevated.status, 200, await elevated.clone().text());
      const approvedResponse = await reviewer.send(approvalPath, { method: "POST", body: approval });
      assert.equal(approvedResponse.status, 200, await approvedResponse.clone().text());
      const approved = (await approvedResponse.json()).data;
      assert.equal(approved.governanceStatus, "approved");
      assert.equal(approved.review.preparedByUserId, preparerAccount.userId);
      assert.equal(approved.review.reviewedByUserId, reviewerAccount.userId);

      const publicationPath = `${base}/${versionId}/publication`;
      const publicationResponse = await reviewer.send(publicationPath, { method: "PUT", body: {
        expectedContentSha256: approved.contentSha256, expectedApprovalSha256: approved.approvalSha256,
        expectedPublicationRevision: 0,
      } });
      assert.equal(publicationResponse.status, 200, await publicationResponse.clone().text());
      assert.equal((await publicationResponse.json()).data.status, "active");
      const publicResponse = await send(`/api/v1/catalog/programs/${program.id}/intakes/${intake.id}/requirements`);
      assert.equal(publicResponse.status, 200, await publicResponse.clone().text());
      assert.equal((await publicResponse.json()).data.versionId, versionId);

      assert.equal((await reviewer.send(`${base}/${versionId}/withdrawal`, { method: "POST", body: {
        expectedVersionId: versionId, expectedPublicationRevision: 1, reason: "review_required",
      } })).status, 400, "version identity is accepted only from the route");
      const withdrawn = await reviewer.send(`${base}/${versionId}/withdrawal`, { method: "POST", body: {
        expectedPublicationRevision: 1, reason: "review_required",
      } });
      assert.equal(withdrawn.status, 200, await withdrawn.clone().text());
      assert.deepEqual(
        await (await send(`/api/v1/catalog/programs/${program.id}/intakes/${intake.id}/requirements`)).json(),
        { data: null },
      );
      const actions = (await pool.query(`select action,active_role from audit_logs where resource_id = $1
        and action like 'catalog.requirements.%' order by created_at,id`, [versionId])).rows;
      assert.deepEqual(actions, [
        { action: "catalog.requirements.prepare", active_role: "cuac_ops" },
        { action: "catalog.requirements.approve", active_role: "cuac_admin" },
        { action: "catalog.requirements.publish", active_role: "cuac_admin" },
        { action: "catalog.requirements.withdraw", active_role: "cuac_admin" },
      ]);
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
        [preparerGrant.grantId]);
      assert.equal((await preparer.send(base)).status, 403);
    });

    await t.test("network Ops billing review uses dual control and never changes quarantined payment facts", async () => {
      const assignee = browser(), resolver = browser();
      const assigneeAccount = await register(assignee), resolverAccount = await register(resolver);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops'), ($2, 'cuac_admin')",
        [assigneeAccount.userId, resolverAccount.userId]);
      const assigneeGrant = await grantCuacStaffAccess(pool, assigneeAccount.userId, "cuac_ops");
      await grantCuacStaffAccess(pool, resolverAccount.userId, "cuac_admin");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1",
        [assigneeAccount.sessionId]);
      await pool.query("update auth_sessions set active_role = 'cuac_admin', selected_surface = 'ops' where id = $1",
        [resolverAccount.sessionId]);

      const checkout = await checkoutFixture(pool);
      const providerEventValue = providerEvent(checkout, "payment.succeeded", { amountMinor: 80001 });
      assert.equal((await ingestAndProcess(checkout.events, providerEventValue)).state, "quarantined");
      const event = (await pool.query("select id from payment_provider_events where provider_event_id = $1",
        [providerEventValue.eventId])).rows[0];
      async function paymentFacts() {
        return {
          payment: (await pool.query("select status,provider_payment_id,paid_at,canceled_at,refunded_at from payments where id = $1",
            [checkout.paymentId])).rows[0],
          invoice: (await pool.query("select status,finalized_at,voided_at from invoices where id = $1",
            [checkout.invoiceId])).rows[0],
          providerEvent: (await pool.query("select state,outcome,quarantine_reason,processed_at from payment_provider_events where id = $1",
            [event.id])).rows[0],
          entitlements: (await pool.query("select count(*)::int as total from application_fee_entitlements where payment_id = $1",
            [checkout.paymentId])).rows[0].total,
        };
      }
      const before = await paymentFacts();
      const base = "/api/v1/ops/billing/provider-events";
      const queueResponse = await assignee.send(`${base}?limit=10`);
      assert.equal(queueResponse.status, 200, await queueResponse.clone().text());
      const queue = (await queueResponse.json()).data;
      const item = queue.items.find(candidate => candidate.eventId === event.id);
      assert.ok(item);
      assert.equal(item.review, null);
      assert.equal(item.quarantineReason, "payment_scope_mismatch");
      assert.equal(item.payloadSha256, undefined);
      assert.equal(item.providerPaymentId, undefined);
      assert.equal(item.providerCheckoutSessionId, undefined);

      const claimPath = `${base}/${event.id}/review-claim`;
      assert.equal((await assignee.send(claimPath, { method: "POST", body: {
        expectedRevision: 0, paymentStatus: "succeeded",
      } })).status, 400);
      const claimedResponse = await assignee.send(claimPath, { method: "POST", body: { expectedRevision: 0 } });
      assert.equal(claimedResponse.status, 200, await claimedResponse.clone().text());
      const claimed = (await claimedResponse.json()).data;
      assert.equal(claimed.status, "investigating");
      assert.equal(claimed.revision, 1);

      const reference = `PROVIDER:${randomUUID()}`;
      const escalationPath = `${base}/${event.id}/review-escalation`;
      const escalatedResponse = await assignee.send(escalationPath, { method: "POST", body: {
        expectedRevision: 1, code: "provider_investigation_required", reference,
      } });
      assert.equal(escalatedResponse.status, 200, await escalatedResponse.clone().text());
      assert.equal((await escalatedResponse.json()).data.status, "escalated");

      const resolutionPath = `${base}/${event.id}/review-resolution`;
      const resolution = { expectedRevision: 2, code: "provider_confirmed_no_change", reference };
      assert.equal((await resolver.send(resolutionPath, { method: "POST", body: resolution })).status, 403);
      const elevated = await resolver.send("/api/v1/auth/step-up", { method: "POST", body: { password } });
      assert.equal(elevated.status, 200, await elevated.clone().text());
      const resolvedResponse = await resolver.send(resolutionPath, { method: "POST", body: resolution });
      assert.equal(resolvedResponse.status, 200, await resolvedResponse.clone().text());
      const resolved = (await resolvedResponse.json()).data;
      assert.equal(resolved.status, "resolved_no_change");
      assert.equal(resolved.revision, 3);
      assert.equal(resolved.resolvedByUserId, resolverAccount.userId);
      assert.notEqual(resolved.assignedUserId, resolved.resolvedByUserId);
      assert.deepEqual(await paymentFacts(), before);

      const audits = (await pool.query(`select action,active_role,metadata_json from audit_logs
        where resource_id = $1 and action like 'ops.billing_review.%' order by created_at,id`, [event.id])).rows;
      assert.deepEqual(audits.map(audit => ({ action: audit.action, activeRole: audit.active_role })), [
        { action: "ops.billing_review.claim", activeRole: "cuac_ops" },
        { action: "ops.billing_review.escalate", activeRole: "cuac_ops" },
        { action: "ops.billing_review.resolve_no_change", activeRole: "cuac_admin" },
      ]);
      assert.doesNotMatch(JSON.stringify(audits), new RegExp(`${providerEventValue.providerPaymentId}|${checkout.providerSessionId}`, "i"));
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
        [assigneeGrant.grantId]);
      assert.equal((await assignee.send(base)).status, 403);
    });

    await t.test("network Ops routing review exposes a minimal queue and requires step-up dual-control retry", async current => {
      current.after(async () => {
        await pool.query("delete from ops_submission_delivery_reviews");
        await clearApplicationAtomicSubmissions(pool);
      });
      const assignee = browser(), resolver = browser();
      const assigneeAccount = await register(assignee), resolverAccount = await register(resolver);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops'), ($2, 'cuac_admin')",
        [assigneeAccount.userId, resolverAccount.userId]);
      const assigneeGrant = await grantCuacStaffAccess(pool, assigneeAccount.userId, "cuac_ops");
      await grantCuacStaffAccess(pool, resolverAccount.userId, "cuac_admin");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1",
        [assigneeAccount.sessionId]);
      await pool.query("update auth_sessions set active_role = 'cuac_admin', selected_surface = 'ops' where id = $1",
        [resolverAccount.sessionId]);

      const submission = await applicationAtomicSubmissionFixture(pool, { formMode: "multi_program_form" });
      await submission.submit();
      const delivery = new PostgresOfficialSubmissionOutbox(submission.client, submission.cipher);
      const lease = await delivery.claim();
      const job = await delivery.prepare(lease, "cuac_handoff_gateway_v1");
      await pool.query("update official_submission_outbox set attempt_count = 5 where id = $1 and status = 'sending'",
        [lease.id]);
      assert.equal(await delivery.finish(lease, { status: "not_accepted", providerName: "cuac_handoff_gateway_v1",
        payloadSha256: job.payloadSha256 }), true);
      const source = (await pool.query(`select id,group_id,provider_name,payload_sha256
        from official_submission_outbox where id = $1`, [lease.id])).rows[0];

      const base = "/api/v1/ops/routing/submissions";
      const queueResponse = await assignee.send(`${base}?limit=10`);
      assert.equal(queueResponse.status, 200, await queueResponse.clone().text());
      const item = (await queueResponse.json()).data.items.find(candidate => candidate.outboxId === source.id);
      assert.ok(item);
      assert.equal(item.review, null);
      assert.equal(item.retryEligible, true);
      for (const field of ["providerName", "payloadSha256", "providerReceiptId", "studentUserId", "cuacId"]) {
        assert.equal(Object.hasOwn(item, field), false);
      }

      const claimPath = `${base}/${source.id}/review-claim`;
      assert.equal((await assignee.send(claimPath, { method: "POST", body: {
        expectedRevision: 0, providerName: "forged",
      } })).status, 400);
      const claimedResponse = await assignee.send(claimPath, { method: "POST", body: { expectedRevision: 0 } });
      assert.equal(claimedResponse.status, 200, await claimedResponse.clone().text());
      assert.equal((await claimedResponse.json()).data.status, "investigating");

      const retryPath = `${base}/${source.id}/review-retry`;
      const retry = { expectedRevision: 1, code: "provider_not_accepted_retry_approved",
        reference: `DELIVERY:${randomUUID()}` };
      assert.equal((await resolver.send(retryPath, { method: "POST", body: retry })).status, 403);
      const elevated = await resolver.send("/api/v1/auth/step-up", { method: "POST", body: { password } });
      assert.equal(elevated.status, 200, await elevated.clone().text());
      const retriedResponse = await resolver.send(retryPath, { method: "POST", body: retry });
      assert.equal(retriedResponse.status, 200, await retriedResponse.clone().text());
      assert.equal((await retriedResponse.json()).data.status, "retry_approved");

      assert.deepEqual((await pool.query(`select o.status,o.outcome,o.last_error_code,o.attempt_count,
        o.provider_name,o.payload_sha256,o.quarantined_at,g.transport_status
        from official_submission_outbox o join official_submission_groups g on g.id = o.group_id
        where o.id = $1`, [source.id])).rows[0], {
        status: "pending", outcome: "not_accepted", last_error_code: "OPS_RETRY_APPROVED", attempt_count: 0,
        provider_name: source.provider_name, payload_sha256: source.payload_sha256,
        quarantined_at: null, transport_status: "pending",
      });
      const audits = (await pool.query(`select action,metadata_json from audit_logs where resource_id = $1
        and action like 'ops.routing_review.%' order by created_at,id`, [source.id])).rows;
      assert.deepEqual(audits.slice(-2).map(row => row.action),
        ["ops.routing_review.claim", "ops.routing_review.retry_approved"]);
      assert.doesNotMatch(JSON.stringify(audits.slice(-2).map(row => row.metadata_json)),
        /payloadSha256|providerName|providerReceipt|schoolId|groupId|student|cuacId/i);
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
        [assigneeGrant.grantId]);
      assert.equal((await assignee.send(base)).status, 403);
    });

    await t.test("network Ops data-quality review verifies exact catalog evidence with dual control", async current => {
      const slug = `network-quality-${randomUUID()}`;
      const city = (await pool.query(`insert into cities
        (slug,name_en,status,verification_status,source_url,source_label)
        values ($1,'Network Quality City','active','unverified','https://example.edu/network-quality','Official source')
        returning id`, [slug])).rows[0];
      const evidence = (await pool.query(`insert into catalog_source_evidence
        (entity_type,entity_id,source_url,source_label,evidence_note,metadata_json)
        values ('city',$1,'https://example.edu/network-quality','Official source','private note',
          '{"private":"metadata"}'::jsonb) returning id`, [city.id])).rows[0];
      current.after(async () => {
        await pool.query("delete from ops_catalog_quality_reviews where entity_type = 'city' and entity_id = $1", [city.id]);
        await pool.query("delete from catalog_source_evidence where id = $1", [evidence.id]);
        await pool.query("delete from cities where id = $1", [city.id]);
      });

      const assignee = browser(), resolver = browser();
      const assigneeAccount = await register(assignee), resolverAccount = await register(resolver);
      await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_ops'), ($2, 'cuac_admin')",
        [assigneeAccount.userId, resolverAccount.userId]);
      const assigneeGrant = await grantCuacStaffAccess(pool, assigneeAccount.userId, "cuac_ops");
      await grantCuacStaffAccess(pool, resolverAccount.userId, "cuac_admin");
      await pool.query("update auth_sessions set active_role = 'cuac_ops', selected_surface = 'ops' where id = $1",
        [assigneeAccount.sessionId]);
      await pool.query("update auth_sessions set active_role = 'cuac_admin', selected_surface = 'ops' where id = $1",
        [resolverAccount.sessionId]);

      const base = "/api/v1/ops/data-quality/catalog";
      assert.equal((await assignee.send(`${base}?cursorType=city`)).status, 400);
      const queueResponse = await assignee.send(`${base}?limit=50`);
      assert.equal(queueResponse.status, 200, await queueResponse.clone().text());
      const item = (await queueResponse.json()).data.items.find(candidate => candidate.entityId === city.id);
      assert.ok(item);
      assert.equal(item.entityType, "city");
      assert.equal(item.issueCode, "unverified");
      assert.equal(item.evidence.evidenceId, evidence.id);
      for (const field of ["evidenceNote", "metadataJson", "sourceFieldLineageJson", "qualityScore", "missingFields"]) {
        assert.equal(Object.hasOwn(item, field), false);
      }

      const claimPath = `${base}/city/${city.id}/review-claim`;
      assert.equal((await assignee.send(claimPath, { method: "POST", body: {
        expectedRevision: 0, verificationStatus: "verified",
      } })).status, 400);
      const claimedResponse = await assignee.send(claimPath, { method: "POST", body: { expectedRevision: 0 } });
      assert.equal(claimedResponse.status, 200, await claimedResponse.clone().text());
      const claimed = (await claimedResponse.json()).data;
      assert.equal(claimed.status, "investigating");
      assert.equal(claimed.sourceEvidenceId, evidence.id);

      const resolutionPath = `${base}/city/${city.id}/review-resolution`;
      const resolution = { expectedRevision: 1, code: "source_confirmed", reference: `SOURCE:${randomUUID()}`,
        reviewDueAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() };
      assert.equal((await resolver.send(resolutionPath, { method: "POST", body: resolution })).status, 403);
      const elevated = await resolver.send("/api/v1/auth/step-up", { method: "POST", body: { password } });
      assert.equal(elevated.status, 200, await elevated.clone().text());
      const resolvedResponse = await resolver.send(resolutionPath, { method: "POST", body: resolution });
      assert.equal(resolvedResponse.status, 200, await resolvedResponse.clone().text());
      const resolved = (await resolvedResponse.json()).data;
      assert.equal(resolved.status, "verified");
      assert.equal(resolved.resolvedByUserId, resolverAccount.userId);
      assert.notEqual(resolved.assignedUserId, resolved.resolvedByUserId);
      assert.deepEqual((await pool.query(`select verification_status,verified_by_user_id from cities where id = $1`,
        [city.id])).rows[0], { verification_status: "verified", verified_by_user_id: resolverAccount.userId });
      assert.equal((await assignee.send(`${base}?limit=50`).then(response => response.json())).data.items
        .some(candidate => candidate.entityId === city.id), false);

      const audits = (await pool.query(`select action,metadata_json from audit_logs where resource_id = $1
        and action like 'ops.data_quality.%' order by created_at,id`, [city.id])).rows;
      assert.deepEqual(audits.map(row => row.action), ["ops.data_quality.claim", "ops.data_quality.resolve"]);
      assert.doesNotMatch(JSON.stringify(audits.map(row => row.metadata_json)), /sourceUrl|sourceLabel|evidenceNote|grantId/i);
      await pool.query("update cuac_staff_access_grants set status = 'revoked', revoked_at = clock_timestamp() where id = $1",
        [assigneeGrant.grantId]);
      assert.equal((await assignee.send(base)).status, 403);
    });

    await t.test("network student profile and dynamic application routes remain owner-scoped", async () => {
      assert.equal((await a.send("/api/v1/student/profile", { method: "PATCH", body: { displayName: "Synthetic A", userId: userB.userId } })).status, 200);
      const other = await b.send("/api/v1/student/profile");
      assert.equal((await other.json()).data, null);
      const created = await a.send("/api/v1/student/application-sets", { method: "POST", body: { name: "Network Test" } });
      assert.equal(created.status, 200, await created.clone().text());
      const id = (await created.json()).data.id;
      const own = await a.send(`/api/v1/student/application-sets/${id}`);
      assert.equal(own.status, 200, await own.clone().text());
      assert.equal((await own.json()).data.id, id);
      assert.deepEqual(await (await b.send(`/api/v1/student/application-sets/${id}`)).json(), { data: null });
      const school = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0];
      assert.equal((await b.send(`/api/v1/student/application-sets/${id}/choices`, { method: "POST", body: { schoolId: school.id } })).status, 403);
      assert.equal((await a.send(`/api/v1/student/application-sets/${id}/choices`, { method: "POST", body: { schoolId: school.id } })).status, 200);
    });

    await t.test("network application commands require keys, isolate accounts and recover across a fresh login", async () => {
      const c = browser(), account = await register(c), path = "/api/v1/student/application-sets";
      const cookie = [...c.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      const before = await snapshotAuditedBusinessTables(pool);
      const missing = await fetch(origin + path, { method: "POST", headers: { origin, cookie, "content-type": "application/json" }, body: JSON.stringify({ name: "Key required" }), signal: AbortSignal.timeout(10_000) });
      assert.equal(missing.status, 400);
      for (const invalid of ["", "short", "x".repeat(129), `${randomUUID()},${randomUUID()}`]) {
        const response = await c.send(path, { method: "POST", body: { name: "Key required" }, headers: { "idempotency-key": invalid } });
        assert.equal(response.status, 400);
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const headers = { "idempotency-key": randomUUID() }, body = { name: "Network keyed" };
      const responses = await Promise.all([c.send(path, { method: "POST", headers, body }), c.send(path, { method: "POST", headers, body })]);
      const data = await Promise.all(responses.map(async response => { assert.equal(response.status, 200, await response.clone().text()); return (await response.json()).data; }));
      assert.equal(data[0].id, data[1].id);
      assert.notEqual(responses[0].headers.get("x-request-id"), responses[1].headers.get("x-request-id"));
      assert.equal((await c.send(path, { method: "POST", headers, body: { name: "Different" } })).status, 409);
      const other = await b.send(path, { method: "POST", headers, body });
      assert.equal(other.status, 200);
      assert.notEqual((await other.json()).data.id, data[0].id);
      const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
      const choicePath = `${path}/${data[0].id}/choices`, choiceHeaders = { "idempotency-key": randomUUID() };
      assert.equal((await c.send(choicePath, { method: "POST", headers: { "idempotency-key": "" }, body: { schoolId } })).status, 400);
      const choice1 = await c.send(choicePath, { method: "POST", headers: choiceHeaders, body: { schoolId } });
      const choice2 = await c.send(choicePath, { method: "POST", headers: choiceHeaders, body: { rankOrder: 0, schoolId, applicationSetId: randomUUID() } });
      assert.equal(choice1.status, 200); assert.equal(choice2.status, 200);
      assert.equal((await choice1.json()).data.id, (await choice2.json()).data.id);
      assert.equal((await b.send(choicePath, { method: "POST", headers: choiceHeaders, body: { schoolId } })).status, 403);
      await pool.query("update auth_sessions set revoked_at = now() where user_id = $1", [account.userId]);
      assert.equal((await c.send(path, { method: "POST", headers, body })).status, 403);
      assert.equal((await c.send("/api/v1/auth/sessions", { method: "POST", body: { email: account.email, password } })).status, 200);
      assert.equal((await (await c.send(path, { method: "POST", headers, body })).json()).data.id, data[0].id);
      assert.equal((await pool.query("select count(*)::int as n from application_sets where user_id = $1", [account.userId])).rows[0].n, 1);
      assert.equal((await pool.query("select count(*)::int as n from application_choices where user_id = $1", [account.userId])).rows[0].n, 1);
    });

    await t.test("real HTTP connection loss after upstream commit replays set and choice without duplicate writes", async () => {
      const c = browser(), account = await register(c);
      const cookie = [...c.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      let setId;
      for (const operation of ["set", "choice"]) {
        const path = operation === "set" ? "/api/v1/student/application-sets" : `/api/v1/student/application-sets/${setId}/choices`;
        const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
        const body = operation === "set" ? { name: "Lost HTTP response" } : { schoolId };
        const headers = { "idempotency-key": randomUUID() };
        let upstreamStatus, upstreamRequests = 0, forwarding;
        const proxy = createServer((request, response) => {
          request.resume();
          forwarding = (async () => {
            upstreamRequests++;
            const upstream = await send(path, { method: "POST", cookie, headers, body });
            upstreamStatus = upstream.status;
            await upstream.arrayBuffer();
            // The built API completed COMMIT, but no response reaches this client.
            response.destroy();
          })().catch(error => { response.destroy(); throw error; });
          forwarding.catch(() => {});
        });
        try {
          await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(0, "127.0.0.1", resolve); });
          await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}/drop`, { method: "POST", body: "synthetic", signal: AbortSignal.timeout(10_000) }), /fetch failed/);
          await forwarding;
          assert.equal(upstreamStatus, 200); assert.equal(upstreamRequests, 1);
          const recovered = await c.send(path, { method: "POST", headers, body });
          assert.equal(recovered.status, 200, await recovered.clone().text());
          const data = (await recovered.json()).data;
          if (operation === "set") setId = data.id;
          const table = operation === "set" ? "application_sets" : "application_choices";
          assert.deepEqual((await pool.query(`select id from ${table} where user_id = $1`, [account.userId])).rows, [{ id: data.id }]);
          const action = operation === "set" ? "student.application_set.create" : "student.application_choice.add";
          assert.equal((await pool.query("select count(*)::int as n from audit_logs where actor_user_id = $1 and action = $2", [account.userId, action])).rows[0].n, 1);
        } finally {
          proxy.closeAllConnections();
          await new Promise(resolve => proxy.close(resolve));
          await forwarding;
        }
      }
    });

    await t.test("network profile patches preserve omitted fields and reject invalid domain writes", async () => {
      const path = "/api/v1/student/profile";
      const prefs = { subjectAreas: ["computer_science"], fundingIntent: "scholarship_possible" };
      assert.equal((await a.send(path, { method: "PATCH", body: { displayName: "Original", citizenshipCountry: "CN", targetDegreeLevel: "master", preferences: prefs } })).status, 200);
      assert.equal((await a.send(path, { method: "PATCH", body: { displayName: "Updated" } })).status, 200);
      const data = (await (await a.send(path)).json()).data;
      assert.equal(data.citizenshipCountry, "CN");
      assert.equal(data.targetDegreeLevel, "master");
      assert.deepEqual(data.preferences, prefs);
      const patches = await Promise.all([
        a.send(path, { method: "PATCH", body: { displayName: "Concurrent Name" } }),
        a.send(path, { method: "PATCH", body: { targetIntake: "2027-fall" } }),
      ]);
      assert.deepEqual(patches.map(r => r.status), [200, 200]);
      const current = (await (await a.send(path)).json()).data;
      assert.equal(current.displayName, "Concurrent Name");
      assert.equal(current.targetIntake, "2027-fall");
      const snapshot = (await pool.query("select * from student_profiles where user_id = $1", [userA.userId])).rows;
      for (const body of [{ displayName: {} }, { targetDegreeLevel: "invalid" }, { citizenshipCountry: "invalid" }, { preferences: { secret: "NEVER_STORE_DOMAIN_INPUT" } }, { preferences: { intakeYear: "2027" } }, {}]) {
        const invalid = await a.send(path, { method: "PATCH", body });
        assert.equal(invalid.status, 400, await invalid.clone().text());
      }
      assert.deepEqual((await pool.query("select * from student_profiles where user_id = $1", [userA.userId])).rows, snapshot);
      assert.equal((await a.send("/api/v1/student/application-sets", { method: "POST", body: { name: "", status: "submitted" } })).status, 400);
      assert.equal((await a.send("/api/v1/student/saved-items", { method: "POST", body: { entityType: "payment", entityId: randomUUID() } })).status, 400);
      assert.equal((await a.send(path, { method: "PATCH", body: { displayName: null, preferences: {} } })).status, 200);
      const cleared = (await (await a.send(path)).json()).data;
      assert.equal(cleared.displayName, null);
      assert.deepEqual(cleared.preferences, {});
      assert.equal(cleared.citizenshipCountry, "CN");
      assert.equal((await (await b.send(path)).json()).data, null);
    });

    await t.test("network saved items and choices reject unavailable or mismatched catalog references", async () => {
      const schoolA = (await pool.query("insert into schools (slug, name_en, status) values ($1, 'Input A', 'active') returning id", [`input-a-${randomUUID()}`])).rows[0].id;
      const schoolB = (await pool.query("insert into schools (slug, name_en, status) values ($1, 'Input B', 'active') returning id", [`input-b-${randomUUID()}`])).rows[0].id;
      const program = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Input Program', 'master', 'active') returning id", [schoolA, `input-program-${randomUUID()}`])).rows[0].id;
      async function scholarship(schoolId, programId, status) {
        return (await pool.query("insert into scholarships (slug, title, school_id, program_id, status) values ($1, 'Input Scholarship', $2, $3, $4) returning id", [`input-scholarship-${randomUUID()}`, schoolId, programId, status])).rows[0].id;
      }
      const global = await scholarship(null, null, "active"), scoped = await scholarship(schoolA, program, "active");
      const foreign = await scholarship(schoolB, null, "active"), draft = await scholarship(null, null, "draft");
      const set = (await (await a.send("/api/v1/student/application-sets", { method: "POST", body: { name: "Input Validation" } })).json()).data;
      const path = `/api/v1/student/application-sets/${set.id}/choices`;
      for (const body of [{ schoolId: schoolA, rankOrder: -1 }, { schoolId: schoolA, rankOrder: "1" }, { schoolId: schoolA, programId: "malformed" }]) {
        assert.equal((await a.send(path, { method: "POST", body })).status, 400);
      }
      for (const scholarshipId of [foreign, draft, randomUUID()]) {
        assert.equal((await a.send(path, { method: "POST", body: { schoolId: schoolA, programId: program, scholarshipId } })).status, 403);
      }
      assert.equal((await a.send(path, { method: "POST", body: { schoolId: schoolA, scholarshipId: scoped } })).status, 403);
      assert.equal((await pool.query("select count(*)::int as count from application_choices where application_set_id = $1", [set.id])).rows[0].count, 0);
      assert.equal((await a.send(path, { method: "POST", body: { schoolId: schoolA, scholarshipId: global } })).status, 200);
      assert.equal((await a.send(path, { method: "POST", body: { schoolId: schoolA, programId: program, scholarshipId: scoped } })).status, 200);
      const duplicate = await a.send(path, { method: "POST", body: { schoolId: schoolA, programId: program, scholarshipId: scoped } });
      assert.equal(duplicate.status, 409, await duplicate.clone().text());
      assert.equal((await duplicate.json()).error.code, "CONFLICT");
      assert.equal((await pool.query("select count(*)::int as count from application_choices where application_set_id = $1", [set.id])).rows[0].count, 2);
      for (const entityId of [draft, randomUUID()]) assert.equal((await a.send("/api/v1/student/saved-items", { method: "POST", body: { entityType: "scholarship", entityId } })).status, 403);
      const saved = await a.send("/api/v1/student/saved-items", { method: "POST", body: { entityType: "scholarship", entityId: scoped } });
      assert.equal(saved.status, 200, await saved.clone().text());
    });

    await t.test("network Agent persistence honors account opt-out and clear cutoffs enforced by backend controls", async () => {
      const client = browser();
      await client.send("/api/v1/auth/guest-session", { method: "POST" });
      const proposalPath = "/api/v1/agent/context/candidates", carryPath = "/api/v1/agent/context/carry-forward";
      const input = { candidateType: "study_goal", structured: { degreeLevel: "master" } };
      const proposal = await client.send(proposalPath, { method: "POST", body: input });
      assert.equal(proposal.status, 200);
      const candidate = (await proposal.json()).data;
      const account = await register(client);
      const context = createRequestContext({ actorUserId: account.userId, activeRole: "student", selectedSurface: "student", purpose: "student_action" });
      const management = createPostgresAgentMemoryManagementService(createTransactionalSqlClient(pool));
      await management.setEnabled(context, { enabled: false, expectedRevision: 0 });
      assert.equal((await client.send(proposalPath, { method: "POST", body: input })).status, 403);
      assert.equal((await client.send(carryPath, { method: "POST", body: { candidateId: candidate.id, confirmed: true } })).status, 403);
      assert.deepEqual((await management.list(context)).items, []);
      await management.setEnabled(context, { enabled: true, expectedRevision: 1 });
      assert.equal((await client.send(carryPath, { method: "POST", body: { candidateId: candidate.id, confirmed: true } })).status, 400);
      assert.equal((await client.send(proposalPath, { method: "POST", body: input })).status, 200);
      assert.equal((await pool.query("select count(*)::int as n from agent_memory_entries where user_id = $1", [account.userId])).rows[0].n, 0);
    });

    await t.test("network Agent candidate capacity is browser-scoped and returns a redacted 429", async () => {
      const client = browser(), other = browser();
      await client.send("/api/v1/auth/guest-session", { method: "POST" });
      await other.send("/api/v1/auth/guest-session", { method: "POST" });
      const path = "/api/v1/agent/context/candidates";
      const input = { candidateType: "study_goal", structured: { degreeLevel: "master" } };
      const candidates = [];
      for (let i = 0; i < GUEST_AGENT_CANDIDATE_CAPACITY; i += 1) {
        const response = await client.send(path, { method: "POST", body: input });
        assert.equal(response.status, 200, await response.clone().text());
        candidates.push((await response.json()).data);
      }
      const denied = await client.send(path, { method: "POST", body: input });
      assert.equal(denied.status, 429);
      assert.equal((await denied.clone().json()).error.code, "TOO_MANY_REQUESTS");
      assert.doesNotMatch(await denied.text(), /Degree: master|study_goal|structured|anonymous_session_hash/i);
      const audit = (await pool.query("select allowed, metadata_json from audit_logs where request_id = $1", [denied.headers.get("x-request-id")])).rows;
      assert.deepEqual(audit, [{ allowed: false, metadata_json: { deniedCode: "TOO_MANY_REQUESTS" } }]);
      assert.equal((await other.send(path, { method: "POST", body: input })).status, 200);
      await pool.query("update agent_context_candidates set expires_at = clock_timestamp() - interval '1 second' where id = $1", [candidates[0].id]);
      assert.equal((await client.send(path, { method: "POST", body: input })).status, 200);
    });

    await t.test("network Agent success audit failures roll back candidates, consumption and memory", async () => {
      const faults = await createAuditFailureFixture(pool);
      const client = browser();
      await client.send("/api/v1/auth/guest-session", { method: "POST" });
      const input = { candidateType: "study_goal", structured: { degreeLevel: "master" } };
      async function rollbackThenRetry(path, body, action) {
        const before = await snapshotAuditedBusinessTables(pool);
        const cookies = [...client.cookies];
        await faults.during(action, async () => {
          const response = await client.send(path, { method: "POST", body });
          assert.equal(response.status, 500);
          assert.equal(response.headers.get("set-cookie"), null);
          assert.doesNotMatch(await response.text(), /P0001|Synthetic|insert into|agent_context_candidates|token_hash/i);
          assert.deepEqual([...client.cookies], cookies);
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        });
        const response = await client.send(path, { method: "POST", body });
        assert.equal(response.status, 200, await response.clone().text());
        const data = (await response.json()).data;
        const audits = (await pool.query("select resource_id, allowed from audit_logs where action = $1 and request_id = $2", [action, response.headers.get("x-request-id")])).rows;
        assert.deepEqual(audits, [{ resource_id: data.id, allowed: true }]);
        return data;
      }
      try {
        const path = "/api/v1/agent/context/candidates";
        const guestCandidate = await rollbackThenRetry(path, input, "agent.context_candidate.create");
        await register(client);
        await rollbackThenRetry(path, input, "agent.context_candidate.create");
        await rollbackThenRetry("/api/v1/agent/context/carry-forward", { candidateId: guestCandidate.id, confirmed: true }, "agent.memory.carry_forward");
        const denial = await client.send(path, { method: "POST", body: { ...input, summary: "PRIVATE_AGENT_DENIAL_MARKER" } });
        assert.equal(denial.status, 400);
        const audits = (await pool.query("select allowed, metadata_json from audit_logs where request_id = $1", [denial.headers.get("x-request-id")])).rows;
        assert.deepEqual(audits, [{ allowed: false, metadata_json: { deniedCode: "BAD_REQUEST" } }]);
      } finally { await faults.close(); }
    });

    await t.test("network Agent concurrent confirmation consumes once and rotated guest identity cannot inherit", async () => {
      const client = browser();
      await client.send("/api/v1/auth/guest-session", { method: "POST" });
      async function propose() {
        const response = await client.send("/api/v1/agent/context/candidates", { method: "POST", body: { candidateType: "study_goal", structured: { degreeLevel: "master" } } });
        assert.equal(response.status, 200);
        return (await response.json()).data;
      }
      const candidate = await propose(), rotated = await propose();
      const account = await register(client);
      const path = "/api/v1/agent/context/carry-forward";
      const request = () => client.send(path, { method: "POST", body: { candidateId: candidate.id, confirmed: true } });
      const blocker = await pool.connect();
      let settled;
      try {
        await blocker.query("begin");
        await blocker.query("select id from agent_context_candidates where id = $1 for update", [candidate.id]);
        settled = Promise.allSettled([request(), request()]);
        let waiting = 0;
        for (let attempt = 0; attempt < 200; attempt += 1) {
          waiting = (await pool.query("select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and (query like '%agent_context_candidates%' or query like '%from users%') and state = 'active'")).rows[0].n;
          if (waiting >= 2) break;
          await delay(10);
        }
        assert.ok(waiting >= 2, "Both network requests reached the database lock barrier.");
        await blocker.query("commit");
        const results = await settled;
        assert.ok(results.every((r) => r.status === "fulfilled"));
        assert.deepEqual(results.map((r) => r.value.status).sort(), [200, 400]);
        const memories = (await pool.query("select id, user_id from agent_memory_entries where source_candidate_id = $1", [candidate.id])).rows;
        assert.equal(memories.length, 1);
        assert.equal(memories[0].user_id, account.userId);
        const loser = results.find((r) => r.value.status === 400).value;
        assert.doesNotMatch(await loser.text(), new RegExp(`${memories[0].id}|${account.userId}`));
      } finally {
        await blocker.query("rollback");
        blocker.release();
        if (settled) await settled;
      }
      const oldBinding = client.cookies.get("cuac_guest");
      assert.equal((await client.send("/api/v1/auth/guest-session", { method: "POST", body: { rotate: true } })).status, 200);
      assert.notEqual(client.cookies.get("cuac_guest"), oldBinding);
      const before = await snapshotAuditedBusinessTables(pool);
      assert.equal((await client.send(path, { method: "POST", body: { candidateId: rotated.id, confirmed: true } })).status, 400);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    });

    await t.test("network Agent candidate persistence uses server-derived content and rejects unsafe inheritance", async () => {
      const client = browser();
      await client.send("/api/v1/auth/guest-session", { method: "POST" });
      const path = "/api/v1/agent/context/candidates";
      const marker = "PRIVATE_CONTEXT_MARKER_NEVER_STORE";
      const input = { candidateType: "study_goal", structured: { subjectAreas: ["computer_science"], teachingLanguage: "english" } };
      const before = (await pool.query("select count(*)::int as count from agent_context_candidates")).rows[0].count;
      for (const body of [{ ...input, summary: marker, dataClass: "low_sensitive_preference" }, { ...input, structured: { passport: marker } }, { ...input, structured: { subjectAreas: [marker] } }, { ...input, expiresAt: "2099-01-01" }]) {
        assert.equal((await client.send(path, { method: "POST", body })).status, 400);
      }
      assert.equal((await pool.query("select count(*)::int as count from agent_context_candidates")).rows[0].count, before);
      const created = await client.send(path, { method: "POST", body: input });
      assert.equal(created.status, 200, await created.clone().text());
      const candidate = (await created.json()).data;
      assert.equal(candidate.anonymousSessionHash, undefined);
      assert.equal(candidate.userId, undefined);
      assert.equal(candidate.summary, "Subjects: computer_science; Language: english");
      const stored = (await pool.query("select * from agent_context_candidates where id = $1", [candidate.id])).rows[0];
      assert.equal(stored.data_class, "low_sensitive_preference");
      assert.match(stored.anonymous_session_hash, /^sha256:/);
      assert.ok(stored.expires_at.getTime() - stored.created_at.getTime() <= 24 * 60 * 60 * 1000);
      const legacy = (await (await client.send(path, { method: "POST", body: input })).json()).data;
      const account = await register(client);
      const carryPath = "/api/v1/agent/context/carry-forward";
      assert.equal((await client.send(carryPath, { method: "POST", body: { candidateId: candidate.id } })).status, 400);
      assert.equal((await b.send(carryPath, { method: "POST", body: { candidateId: candidate.id, confirmed: true } })).status, 400);
      await pool.query("update agent_context_candidates set summary = $2 where id = $1", [candidate.id, marker]);
      const carry = await client.send(carryPath, { method: "POST", body: { candidateId: candidate.id, confirmed: true } });
      assert.equal(carry.status, 200, await carry.clone().text());
      assert.doesNotMatch(await carry.text(), /PRIVATE_CONTEXT_MARKER_NEVER_STORE/);
      assert.equal((await client.send(carryPath, { method: "POST", body: { candidateId: candidate.id, confirmed: true } })).status, 400);
      const memory = (await pool.query("select * from agent_memory_entries where source_candidate_id = $1", [candidate.id])).rows[0];
      assert.equal(memory.user_id, account.userId);
      assert.equal(memory.summary, candidate.summary);
      assert.deepEqual(memory.structured_json, input.structured);
      await pool.query("update agent_context_candidates set structured_json = $2::jsonb where id = $1", [legacy.id, JSON.stringify({ passport: marker })]);
      assert.equal((await client.send(carryPath, { method: "POST", body: { candidateId: legacy.id, confirmed: true } })).status, 400);
      assert.equal((await pool.query("select count(*)::int as count from agent_memory_entries where source_candidate_id = $1", [legacy.id])).rows[0].count, 0);
      assert.equal((await pool.query("select count(*)::int as count from student_profiles where user_id = $1", [account.userId])).rows[0].count, 0);
      assert.equal((await pool.query("select count(*)::int as count from application_sets where user_id = $1", [account.userId])).rows[0].count, 0);
      assert.doesNotMatch(JSON.stringify((await pool.query("select metadata_json from audit_logs where action like 'agent.%'")).rows), /PRIVATE_CONTEXT_MARKER_NEVER_STORE/);
    });

    await t.test("network guest-to-login continuation returns a preview once without creating an application", async () => {
      const client = browser();
      await client.send("/api/v1/auth/guest-session", { method: "POST" });
      const response = await client.send("/api/v1/auth/sign-in-continuations", { method: "POST", body: { targetRoute: "/application.html#add-choice", actionKey: "application.add_choice" } });
      assert.equal(response.status, 200, await response.clone().text());
      const continuation = (await response.json()).data;
      const account = await register(client);
      const path = `/api/v1/auth/sign-in-continuations/${continuation.continuationId}/consume`;
      const options = { method: "POST", body: { continuationToken: continuation.continuationToken } };
      assert.equal((await b.send(path, options)).status, 403);
      assert.equal((await client.send(path, options)).status, 200);
      assert.equal((await client.send(path, options)).status, 400);
      assert.equal((await pool.query("select count(*)::int as count from application_sets where user_id = $1", [account.userId])).rows[0].count, 0);
      const stored = (await pool.query("select guest_session_id from sign_in_continuations where id = $1", [continuation.continuationId])).rows[0];
      assert.match(stored.guest_session_id, /^sha256:/);
      assert.notEqual(stored.guest_session_id, client.cookies.get("cuac_guest"));
    });

    await t.test("network frozen applications reject new choices but preserve original-key recovery and owner isolation", async () => {
      const student = browser();
      await register(student);
      const created = await student.send("/api/v1/student/application-sets", { method: "POST", body: { name: "Frozen network set" } });
      assert.equal(created.status, 200);
      const set = (await created.json()).data;
      const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
      const path = `/api/v1/student/application-sets/${set.id}/choices`, body = { schoolId }, originalKey = randomUUID();
      const first = await student.send(path, { method: "POST", body, headers: { "idempotency-key": originalKey } });
      assert.equal(first.status, 200);
      const choice = (await first.json()).data;
      for (const [status, locked, submitted] of [["submitted", false, false], ["draft", true, false], ["draft", false, true]]) {
        await pool.query(`update application_sets set status = $2, locked_at = case when $3 then now() end,
          submitted_at = case when $4 then now() end where id = $1`, [set.id, status, locked, submitted]);
        const replay = await student.send(path, { method: "POST", body, headers: { "idempotency-key": originalKey } });
        assert.equal(replay.status, 200); assert.equal((await replay.json()).data.id, choice.id);
        const before = await snapshotAuditedBusinessTables(pool);
        const denied = await student.send(path, { method: "POST", body });
        assert.equal(denied.status, 409); assert.equal(denied.headers.get("cache-control"), "no-store");
        assert.equal((await denied.json()).error.code, "CONFLICT");
        assert.equal((await student.send(path, { method: "POST", body: { ...body, status: "draft" } })).status, 400);
        assert.equal((await a.send(path, { method: "POST", body })).status, 403);
        assert.equal((await a.send(`/api/v1/student/application-sets/${randomUUID()}/choices`, { method: "POST", body })).status, 403);
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      }
      assert.equal((await pool.query("select count(*)::int as n from application_choices where application_set_id = $1", [set.id])).rows[0].n, 1);
    });

    await t.test("network choice rechecks a freeze committed after its owner preflight", async () => {
      const student = browser();
      await register(student);
      const created = await student.send("/api/v1/student/application-sets", { method: "POST", body: { name: "Concurrent freeze" } });
      assert.equal(created.status, 200);
      const set = (await created.json()).data;
      const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
      const freezer = await pool.connect(); let pending;
      try {
        await freezer.query("begin");
        await freezer.query("update application_sets set locked_at = clock_timestamp() where id = $1", [set.id]);
        pending = student.send(`/api/v1/student/application-sets/${set.id}/choices`, { method: "POST", body: { schoolId } });
        await waitForBlockedApiQueries(1);
        await freezer.query("commit");
        const response = await pending;
        assert.equal(response.status, 409); assert.equal((await response.json()).error.code, "CONFLICT");
        assert.equal((await pool.query("select count(*)::int as n from application_choices where application_set_id = $1", [set.id])).rows[0].n, 0);
        const writes = (await pool.query("select operation from student_application_command_receipts where user_id = $1", [set.userId])).rows;
        assert.deepEqual(writes, [{ operation: "application_set.create" }]);
      } finally { await freezer.query("rollback"); freezer.release(); if (pending) await Promise.allSettled([pending]); }
    });

    async function removalFixture() {
      const student = browser(); await register(student);
      const created = await student.send("/api/v1/student/application-sets", { method: "POST", body: { name: "Removal network fixture" } });
      assert.equal(created.status, 200);
      const set = (await created.json()).data;
      const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
      const programId = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Network removal', 'master', 'active') returning id", [schoolId, `remove-network-${randomUUID()}`])).rows[0].id;
      const path = `/api/v1/student/application-sets/${set.id}/choices`, body = { schoolId, programId, studentNotes: "private-network-removal" }, originalKey = randomUUID();
      const added = await student.send(path, { method: "POST", body, headers: { "idempotency-key": originalKey } });
      assert.equal(added.status, 200);
      const choice = (await added.json()).data;
      return { student, set, choice, path, target: `${path}/${choice.id}`, body, originalKey };
    }

    await t.test("network DELETE removes only its target and retries cannot affect a replacement", async () => {
      const f = await removalFixture(), expected = { data: { id: f.choice.id, applicationSetId: f.set.id, status: "removed" } };
      const other = await f.student.send(f.path, { method: "POST", body: { schoolId: f.body.schoolId } });
      assert.equal(other.status, 200);
      const otherId = (await other.json()).data.id;
      const response = await f.student.send(f.target, { method: "DELETE" });
      assert.equal(response.status, 200, await response.clone().text());
      assert.deepEqual(await response.json(), expected);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      const detail = await f.student.send(`/api/v1/student/application-sets/${f.set.id}`);
      assert.deepEqual((await detail.json()).data.choices.map(c => c.id), [otherId]);
      const replacement = await f.student.send(f.path, { method: "POST", body: f.body });
      assert.equal(replacement.status, 200);
      const replacementId = (await replacement.json()).data.id;
      assert.notEqual(replacementId, f.choice.id);
      const before = await snapshotAuditedBusinessTables(pool);
      const again = await f.student.send(f.target, { method: "DELETE" });
      assert.equal(again.status, 200); assert.deepEqual(await again.json(), expected);
      assert.equal((await f.student.send(f.path, { method: "POST", body: f.body, headers: { "idempotency-key": f.originalKey } })).status, 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      assert.equal((await pool.query("select removed_at from application_choices where id = $1", [replacementId])).rows[0].removed_at, null);
      await pool.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
      assert.equal((await f.student.send(f.target, { method: "DELETE" })).status, 200);
      assert.equal((await f.student.send(`${f.path}/${replacementId}`, { method: "DELETE" })).status, 409);
      const counts = (await pool.query(`select
        (select count(*)::int from application_choice_status_events where application_choice_id = $1::uuid) as events,
        (select count(*)::int from audit_logs where resource_id = $1::text and action = 'student.application_choice.remove') as audits`, [f.choice.id])).rows[0];
      assert.deepEqual(counts, { events: 1, audits: 1 });
    });

    await t.test("network DELETE rejects nonempty bodies, bad origin, invalid IDs and foreign owners before writing", async () => {
      const f = await removalFixture(), before = await snapshotAuditedBusinessTables(pool);
      for (const rawBody of ["{}", " ", '{"userId":"attacker","status":"draft"}']) {
        assert.equal((await f.student.send(f.target, { method: "DELETE", rawBody })).status, 400);
      }
      for (const headers of [{ origin: "" }, { origin: "https://other.invalid" }, { "sec-fetch-site": "same-site" }]) {
        assert.equal((await f.student.send(f.target, { method: "DELETE", headers })).status, 403);
      }
      assert.equal((await f.student.send(f.target, { method: "DELETE", headers: { "content-encoding": "gzip" } })).status, 415);
      assert.equal((await f.student.send(`${f.path}/bad-id`, { method: "DELETE" })).status, 400);
      assert.equal((await f.student.send(`/api/v1/student/application-sets/bad-id/choices/${f.choice.id}`, { method: "DELETE" })).status, 400);
      assert.equal((await send(f.target, { method: "DELETE" })).status, 403);
      const foreign = await a.send(f.target, { method: "DELETE" });
      const missing = await f.student.send(`${f.path}/${randomUUID()}`, { method: "DELETE" });
      assert.equal(foreign.status, 403); assert.equal(missing.status, 403);
      assert.equal((await foreign.json()).error.message, (await missing.json()).error.message);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    });

    await t.test("network DELETE rechecks parent freeze after a real lock wait", async () => {
      const f = await removalFixture(), freezer = await pool.connect(); let pending;
      const before = (await pool.query("select to_jsonb(c) as data from application_choices c where id = $1", [f.choice.id])).rows;
      try {
        await freezer.query("begin");
        await freezer.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
        pending = f.student.send(f.target, { method: "DELETE" });
        await waitForBlockedApiQueries(1);
        await freezer.query("commit");
        const response = await pending;
        assert.equal(response.status, 409);
        assert.deepEqual((await pool.query("select to_jsonb(c) as data from application_choices c where id = $1", [f.choice.id])).rows, before);
        assert.equal((await pool.query("select count(*)::int as n from application_choice_status_events where application_choice_id = $1", [f.choice.id])).rows[0].n, 0);
      } finally { await freezer.query("rollback"); freezer.release(); if (pending) await Promise.allSettled([pending]); }
    });

    await t.test("network DELETE audit failure leaves the draft intact and explicit retry succeeds once", async () => {
      const f = await removalFixture(), faults = await createAuditFailureFixture(pool);
      try {
        await faults.during("student.application_choice.remove", async () => {
          const before = await snapshotAuditedBusinessTables(pool);
          const response = await f.student.send(f.target, { method: "DELETE" });
          assert.equal(response.status, 500);
          assert.doesNotMatch(await response.text(), /Synthetic|private-network-removal|postgres|P0001/);
          assert.equal(response.headers.get("cache-control"), "no-store");
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        });
        assert.equal((await f.student.send(f.target, { method: "DELETE" })).status, 200);
        const after = await snapshotAuditedBusinessTables(pool);
        assert.equal((await f.student.send(f.target, { method: "DELETE" })).status, 200);
        assert.deepEqual(await snapshotAuditedBusinessTables(pool), after);
      } finally { await faults.close(); }
    });

    async function editableFixture() {
      const f = await removalFixture();
      assert.equal((await f.student.send(f.path, { method: "POST", body: { schoolId: f.body.schoolId } })).status, 200);
      const setPath = `/api/v1/student/application-sets/${f.set.id}`;
      const read = async () => {
        const res = await f.student.send(setPath); assert.equal(res.status, 200); return (await res.json()).data;
      };
      return { ...f, set: await read(), read, orderPath: `${setPath}/choice-order` };
    }

    await t.test("network draft PATCH and order expose revisions, preserve other choices and no-op without duplicate audit", async () => {
      const f = await editableFixture(); assert.equal(f.set.revision, 3);
      const edit = await f.student.send(f.target, { method: "PATCH", body: { expectedRevision: f.set.revision, studentNotes: "Edited network note" } });
      assert.equal(edit.status, 200, await edit.clone().text());
      assert.equal(edit.headers.get("cache-control"), "no-store");
      let current = (await edit.json()).data;
      assert.equal(current.revision, 4);
      assert.equal(current.choices.find(c => c.id === f.choice.id).studentNotes, "Edited network note");
      assert.deepEqual(current.choices.find(c => c.id !== f.choice.id), f.set.choices.find(c => c.id !== f.choice.id));
      const sortedIds = current.choices.map(c => c.id).reverse();
      const sorted = await f.student.send(f.orderPath, { method: "PUT", body: { expectedRevision: current.revision, choiceIds: sortedIds } });
      assert.equal(sorted.status, 200, await sorted.clone().text());
      current = (await sorted.json()).data;
      assert.equal(current.revision, 5);
      assert.deepEqual(current.choices.map(c => c.id), sortedIds);
      assert.deepEqual(current.choices.map(c => c.rankOrder), [0, 1]);
      const before = await snapshotAuditedBusinessTables(pool);
      assert.equal((await f.student.send(f.orderPath, { method: "PUT", body: { expectedRevision: current.revision, choiceIds: sortedIds } })).status, 200);
      assert.equal((await f.student.send(f.target, { method: "PATCH", body: { expectedRevision: current.revision, studentNotes: "Edited network note" } })).status, 200);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const cleared = await f.student.send(f.target, { method: "PATCH", body: { expectedRevision: current.revision, studentNotes: null } });
      assert.equal(cleared.status, 200);
      assert.equal((await cleared.json()).data.choices.find(c => c.id === f.choice.id).studentNotes, null);
    });

    await t.test("network draft edit/order reject malformed input, foreign scope, stale versions and frozen sets", async () => {
      const f = await editableFixture(), revision = f.set.revision;
      let before = await snapshotAuditedBusinessTables(pool);
      for (const body of [{ studentNotes: "x" }, { expectedRevision: "3", studentNotes: "x" }, { expectedRevision: revision, studentNotes: "x", programId: randomUUID() },
        { expectedRevision: revision, studentNotes: "x", userId: randomUUID() }]) assert.equal((await f.student.send(f.target, { method: "PATCH", body })).status, 400);
      for (const body of [{ choiceIds: [] }, { expectedRevision: revision, choiceIds: [f.choice.id, f.choice.id] }]) {
        assert.equal((await f.student.send(f.orderPath, { method: "PUT", body })).status, 400);
      }
      assert.equal((await f.student.send(f.orderPath, { method: "PUT", body: { expectedRevision: revision, choiceIds: [f.choice.id] } })).status, 409);
      assert.equal((await f.student.send(f.target, { method: "PATCH", body: { expectedRevision: revision, scholarshipId: randomUUID() } })).status, 403);
      for (const [path, method, body] of [[f.target, "PATCH", { expectedRevision: revision, studentNotes: "x" }], [f.orderPath, "PUT", { expectedRevision: revision, choiceIds: f.set.choices.map(c => c.id) }]]) {
        assert.equal((await a.send(path, { method, body })).status, 403);
        assert.equal((await send(path, { method, body })).status, 403);
        assert.equal((await f.student.send(path, { method, body, headers: { origin: "https://foreign.invalid" } })).status, 403);
        assert.equal((await f.student.send(path, { method, body: { ...body, expectedRevision: revision - 1 } })).status, 409);
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await pool.query("update application_sets set locked_at = now() where id = $1", [f.set.id]);
      before = await snapshotAuditedBusinessTables(pool);
      assert.equal((await f.student.send(f.target, { method: "PATCH", body: { expectedRevision: revision, studentNotes: null } })).status, 409);
      assert.equal((await f.student.send(f.orderPath, { method: "PUT", body: { expectedRevision: revision, choiceIds: f.set.choices.map(c => c.id).reverse() } })).status, 409);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    });

    await t.test("two real network draft mutations with one revision cannot both succeed", async () => {
      const f = await editableFixture(), blocker = await pool.connect(); let edit, order;
      try {
        await blocker.query("begin");
        await blocker.query("select id from application_sets where id = $1 for update", [f.set.id]);
        edit = f.student.send(f.target, { method: "PATCH", body: { expectedRevision: f.set.revision, studentNotes: "Concurrent note" } });
        order = f.student.send(f.orderPath, { method: "PUT", body: { expectedRevision: f.set.revision, choiceIds: f.set.choices.map(c => c.id).reverse() } });
        await waitForBlockedApiQueries(2); await blocker.query("commit");
        const responses = await Promise.all([edit, order]);
        assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
        const winner = (await responses.find(r => r.status === 200).json()).data;
        assert.equal(winner.revision, f.set.revision + 1);
        assert.deepEqual(await f.read(), winner);
      } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled([edit, order]); }
    });

    await t.test("network draft edit/order audit failures roll back revisions and allow explicit retry", async () => {
      const faults = await createAuditFailureFixture(pool);
      try {
        for (const operation of ["edit", "order"]) {
          const f = await editableFixture();
          const path = operation === "edit" ? f.target : f.orderPath, method = operation === "edit" ? "PATCH" : "PUT";
          const body = operation === "edit" ? { expectedRevision: f.set.revision, studentNotes: "Audit test note" }
            : { expectedRevision: f.set.revision, choiceIds: f.set.choices.map(c => c.id).reverse() };
          await faults.during(operation === "edit" ? "student.application_choice.update" : "student.application_choices.reorder", async () => {
            const before = await snapshotAuditedBusinessTables(pool);
            const response = await f.student.send(path, { method, body }); assert.equal(response.status, 500);
            assert.doesNotMatch(await response.text(), /Synthetic|Audit test note|postgres|P0001/);
            assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
          });
          const success = await f.student.send(path, { method, body }); assert.equal(success.status, 200);
          assert.equal((await success.json()).data.revision, f.set.revision + 1);
          const beforeRetry = await snapshotAuditedBusinessTables(pool);
          assert.equal((await f.student.send(path, { method, body })).status, 409);
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), beforeRetry);
        }
      } finally { await faults.close(); }
    });

    async function intakeFixture() {
      const student = browser(); await register(student);
      const created = await student.send("/api/v1/student/application-sets", { method: "POST", body: { name: "Intake network fixture" } });
      assert.equal(created.status, 200);
      const set = (await created.json()).data;
      const schoolId = (await pool.query("select id from schools where status = 'active' limit 1")).rows[0].id;
      const programId = (await pool.query("insert into programs (school_id, slug, name_en, degree_level, status) values ($1, $2, 'Network intakes', 'master', 'active') returning id", [schoolId, `intake-network-${randomUUID()}`])).rows[0].id;
      const intakes = (await pool.query("insert into program_intakes (program_id, intake_term, intake_year) values ($1, 'fall', 2090), ($1, 'spring', 2091) returning id", [programId])).rows;
      return { student, set, intakes, path: `/api/v1/student/application-sets/${set.id}/choices`,
        publicPath: `/api/v1/catalog/programs/${programId}/intakes`, body: { schoolId, programId, programIntakeId: intakes[0].id } };
    }

    await t.test("network public intake discovery and draft binding retain exact targets and replay semantics", async () => {
      const f = await intakeFixture();
      const publicResponse = await send(`${f.publicPath}?limit=1&offset=1`);
      assert.equal(publicResponse.status, 200); assert.equal(publicResponse.headers.get("cache-control"), "no-store");
      const publicData = (await publicResponse.json()).data;
      assert.deepEqual(publicData.map(i => i.id), [f.intakes[1].id]);
      assert.equal(publicData[0].programId, f.body.programId);
      const originalKey = randomUUID();
      const first = await f.student.send(f.path, { method: "POST", body: f.body, headers: { "idempotency-key": originalKey } });
      assert.equal(first.status, 200, await first.clone().text());
      const choice = (await first.json()).data;
      assert.equal(choice.programIntakeId, f.intakes[0].id);
      const replay = await f.student.send(f.path, { method: "POST", body: { ...f.body, programIntakeId: f.intakes[0].id.toUpperCase() }, headers: { "idempotency-key": originalKey } });
      assert.equal(replay.status, 200); assert.equal((await replay.json()).data.id, choice.id);
      for (const programIntakeId of [null, f.intakes[1].id]) {
        assert.equal((await f.student.send(f.path, { method: "POST", body: { ...f.body, programIntakeId }, headers: { "idempotency-key": originalKey } })).status, 409);
        assert.equal((await f.student.send(f.path, { method: "POST", body: { ...f.body, programIntakeId } })).status, 200);
      }
      assert.equal((await f.student.send(f.path, { method: "POST", body: f.body })).status, 409);
      const detail = (await (await f.student.send(`/api/v1/student/application-sets/${f.set.id}`)).json()).data;
      assert.equal(detail.choices.length, 3); assert.equal(detail.revision, 4);
      assert.equal((await f.student.send(`${f.path}/${choice.id}`, { method: "PATCH", body: { expectedRevision: detail.revision, programIntakeId: f.intakes[1].id } })).status, 400);
    });

    await t.test("network intake input, scope, visibility and current availability fail without writes", async () => {
      const f = await intakeFixture(), other = await intakeFixture();
      const before = await snapshotAuditedBusinessTables(pool);
      for (const body of [{ ...f.body, programId: null }, { ...f.body, programIntakeId: {} }, { ...f.body, programIntakeId: "invalid" }]) {
        assert.equal((await f.student.send(f.path, { method: "POST", body })).status, 400);
      }
      for (const programIntakeId of [other.intakes[0].id, randomUUID()]) {
        assert.equal((await f.student.send(f.path, { method: "POST", body: { ...f.body, programIntakeId } })).status, 403);
      }
      assert.equal((await a.send(f.path, { method: "POST", body: f.body })).status, 403);
      assert.equal((await send(f.path, { method: "POST", body: f.body })).status, 403);
      assert.equal((await f.student.send(f.path, { method: "POST", body: f.body, headers: { origin: "https://other.invalid" } })).status, 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      assert.equal((await send("/api/v1/catalog/programs/not-a-uuid/intakes")).status, 400);
      assert.deepEqual((await (await send(`/api/v1/catalog/programs/${randomUUID()}/intakes`)).json()).data, []);
      await pool.query("update program_intakes set status = 'closed' where id = $1", [f.intakes[0].id]);
      const unavailable = await snapshotAuditedBusinessTables(pool);
      assert.equal((await f.student.send(f.path, { method: "POST", body: f.body })).status, 403);
      assert.deepEqual((await (await send(f.publicPath)).json()).data.map(i => i.id), [f.intakes[1].id]);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), unavailable);
    });

    await t.test("network concurrent intake draft creations preserve distinct cycles and reject a duplicated target", async () => {
      for (const same of [true, false]) {
        const f = await intakeFixture(), blocker = await pool.connect(); let requests = [];
        try {
          await blocker.query("begin");
          await blocker.query("select id from application_sets where id = $1 for update", [f.set.id]);
          requests = [f.student.send(f.path, { method: "POST", body: f.body }),
            f.student.send(f.path, { method: "POST", body: { ...f.body, programIntakeId: same ? f.intakes[0].id : f.intakes[1].id } })];
          await waitForBlockedApiQueries(2);
          await blocker.query("commit");
          const results = await Promise.all(requests);
          assert.deepEqual(results.map(r => r.status).sort(), same ? [200, 409] : [200, 200]);
          const detail = (await (await f.student.send(`/api/v1/student/application-sets/${f.set.id}`)).json()).data;
          assert.equal(detail.choices.length, same ? 1 : 2); assert.equal(detail.revision, same ? 2 : 3);
        } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(requests); }
      }
    });

    await t.test("network intake-bound audit failures roll back and a later closure rejects a waiting create", async () => {
      const f = await intakeFixture(), faults = await createAuditFailureFixture(pool), commandKey = randomUUID();
      try {
        await faults.during("student.application_choice.add", async () => {
          const before = await snapshotAuditedBusinessTables(pool);
          const response = await f.student.send(f.path, { method: "POST", body: f.body, headers: { "idempotency-key": commandKey } });
          assert.equal(response.status, 500);
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
        });
        assert.equal((await f.student.send(f.path, { method: "POST", body: f.body, headers: { "idempotency-key": commandKey } })).status, 200);
      } finally { await faults.close(); }
      const blocker = await pool.connect(); let pending;
      try {
        await blocker.query("begin");
        await blocker.query("update program_intakes set status = 'closed' where id = $1", [f.intakes[1].id]);
        pending = f.student.send(f.path, { method: "POST", body: { ...f.body, programIntakeId: f.intakes[1].id } });
        await waitForBlockedApiQueries(1); await blocker.query("commit");
        assert.equal((await pending).status, 403);
        const detail = (await (await f.student.send(`/api/v1/student/application-sets/${f.set.id}`)).json()).data;
        assert.equal(detail.choices.length, 1); assert.equal(detail.revision, 2);
      } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
    });

    const applicantPath = "/api/v1/student/applicant-profile";
    async function applicantFixture() { const student = browser(); const user = await register(student); return { student, user }; }

    await t.test("network applicant profile is explicit, private, versioned and independent of nickname and login contact", async () => {
      const f = await applicantFixture(), other = await applicantFixture();
      assert.equal((await (await f.student.send(applicantPath)).json()).data, null);
      const saved = await f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 0, fullName: "Applicant private name", contactEmail: "Applicant@Example.invalid", citizenshipCountry: "CN" } });
      assert.equal(saved.status, 200, await saved.clone().text()); assert.equal(saved.headers.get("cache-control"), "no-store");
      const first = (await saved.json()).data;
      assert.equal(first.userId, f.user.userId); assert.equal(first.revision, 1);
      assert.deepEqual(Object.keys(first).sort(), ["id", "userId", "revision", "fullName", "contactEmail", "citizenshipCountry"].sort());
      assert.deepEqual((await (await f.student.send(applicantPath + "?userId=" + other.user.userId)).json()).data, first);
      assert.equal((await (await other.student.send(applicantPath)).json()).data, null);
      const changed = await f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 1, fullName: null } });
      assert.equal(changed.status, 200); const second = (await changed.json()).data;
      assert.equal(second.revision, 2); assert.equal(second.fullName, null); assert.equal(second.contactEmail, first.contactEmail);
      assert.equal((await f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 1, fullName: null } })).status, 409);
      assert.equal((await (await f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 2, fullName: null } })).json()).data.revision, 2);
      assert.equal((await pool.query("select email from users where id = $1", [f.user.userId])).rows[0].email, f.user.email);
      assert.doesNotMatch(JSON.stringify((await pool.query("select * from audit_logs where actor_user_id = $1", [f.user.userId])).rows), /Applicant private name|Applicant@Example.invalid/);
    });

    await t.test("network applicant boundary rejects guest, cross-site and forged sensitive fields without writes", async () => {
      const f = await applicantFixture(), before = await snapshotAuditedBusinessTables(pool);
      assert.equal((await send(applicantPath)).status, 403);
      assert.equal((await send(applicantPath, { method: "PATCH", body: { expectedRevision: 0, fullName: "Guest" } })).status, 403);
      assert.equal((await f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 0, fullName: "Name" }, headers: { origin: "https://other.invalid" } })).status, 403);
      for (const extra of [{ userId: randomUUID() }, { tenantSchoolId: randomUUID() }, { role: "cuac_admin" }, { verified: true }, { consent: true }, { fullName: {} }, { fullName: "\ud800" }, { contactEmail: "bad" }, { citizenshipCountry: "cn" }, { expectedRevision: "0" }]) {
        const response = await f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 0, fullName: "Name", ...extra } });
        assert.equal(response.status, 400, await response.clone().text());
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    });

    await t.test("network simultaneous initial saves and later same-version edits each keep one applicant winner", async () => {
      const f = await applicantFixture();
      for (const revision of [0, 1]) {
        const blocker = await pool.connect(); let requests = [];
        try {
          await blocker.query("begin");
          if (revision === 0) await blocker.query("select id from users where id = $1 for update", [f.user.userId]);
          else await blocker.query("select id from student_applicant_profiles where user_id = $1 for update", [f.user.userId]);
          requests = ["One", "Two"].map(fullName => f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: revision, fullName: fullName + revision } }));
          await waitForBlockedApiQueries(2); await blocker.query("commit");
          assert.deepEqual((await Promise.all(requests)).map(r => r.status).sort(), [200, 409]);
          assert.equal((await (await f.student.send(applicantPath)).json()).data.revision, revision + 1);
        } finally { await blocker.query("rollback"); blocker.release(); await Promise.allSettled(requests); }
      }
    });

    await t.test("network applicant audit failure rolls back and a committed role revocation rejects a waiting edit", async () => {
      const f = await applicantFixture(), fault = await createAuditFailureFixture(pool);
      try {
        for (const expectedRevision of [0, 1]) {
          const before = await snapshotAuditedBusinessTables(pool);
          const body = { expectedRevision, fullName: "Secret applicant value" };
          await fault.during("student.applicant_profile.update", async () => {
            const response = await f.student.send(applicantPath, { method: "PATCH", body });
            assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /Secret applicant value|insert into|student_applicant_profiles|Synthetic/);
          });
          assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
          assert.equal((await f.student.send(applicantPath, { method: "PATCH", body: { ...body, fullName: `Saved ${expectedRevision}` } })).status, 200);
        }
      } finally { await fault.close(); }
      const blocker = await pool.connect(); let pending;
      try {
        await blocker.query("begin");
        await blocker.query("update user_roles set revoked_at = now() where user_id = $1 and role = 'student'", [f.user.userId]);
        pending = f.student.send(applicantPath, { method: "PATCH", body: { expectedRevision: 2, fullName: "Denied" } });
        await waitForBlockedApiQueries(1); await blocker.query("commit");
        assert.equal((await pending).status, 403);
        assert.equal((await f.student.send(applicantPath)).status, 403);
        assert.equal((await pool.query("select revision from student_applicant_profiles where user_id = $1", [f.user.userId])).rows[0].revision, 2);
      } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
    });

    await runEducationHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries });
    await runAssessmentHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries });
    await runProgramRequirementsHttpRehearsal(t, pool, { send, browser, register });
    await runNoticesHttpRehearsal(t, pool, { send, browser, register });
    await runNotificationsHttpRehearsal(t, pool, { send, browser, register });
    await runApplicationPreflightHttpRehearsal(t, pool, { send, browser, register });
    await runApplicationMaterialPreviewHttpRehearsal(t, pool, { send, browser, register });
    await runMaterialSelectionHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries });
    await runApplicationSubmissionAuthorizationHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries });
    await runApplicationMaterialSnapshotHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries });
    await runApplicationSubmissionHttpRehearsal(t, pool, { send, browser, register });
    await runSchoolTargetHttpRehearsal(t, pool, { send, browser, register });
    await runAgentMemoryControlsHttpRehearsal(t, pool, { send, browser, register, waitForBlockedApiQueries });

    await t.test("network verification and reset routes validate tokens and invalidate prior login", async () => {
      const verificationToken = randomBytes(32).toString("base64url");
      const verification = (await pool.query("insert into email_verification_challenges (user_id, email_normalized, verification_token_hash, expires_at) values ($1, $2, $3, now() + interval '5 minutes') returning id", [userA.userId, userA.email, digest(verificationToken)])).rows[0];
      for (const token of [{}, verificationToken + "=", ` ${verificationToken}`, randomBytes(32).toString("base64url")]) {
        assert.equal((await send(`/api/v1/auth/email-verification/${verification.id}/verify`, { method: "POST", body: { verificationToken: token } })).status, 400);
      }
      assert.equal((await pool.query("select status from email_verification_challenges where id = $1", [verification.id])).rows[0].status, "pending");
      assert.equal((await send(`/api/v1/auth/email-verification/${verification.id}/verify`, { method: "POST", body: { verificationToken } })).status, 200);
      const present = await send("/api/v1/auth/password-reset", { method: "POST", body: { email: userA.email } });
      const missing = await send("/api/v1/auth/password-reset", { method: "POST", body: { email: `missing-${randomUUID()}@example.invalid` } });
      assert.deepEqual(await present.json(), await missing.json());
      const resetToken = randomBytes(32).toString("base64url");
      const challenge = (await pool.query("insert into password_reset_challenges (user_id, email_normalized, reset_token_hash, expires_at) values ($1, $2, $3, now() + interval '5 minutes') returning id", [userA.userId, userA.email, digest(resetToken)])).rows[0];
      const newPassword = "  Synthetic network new password  ";
      const proofSnapshot = (await pool.query("select password_hash from auth_identities where user_id = $1", [userA.userId])).rows;
      for (const body of [{ resetToken, newPassword: "short" }, { resetToken, newPassword: "x".repeat(1025) }, { resetToken: {}, newPassword }, { resetToken: randomBytes(32).toString("base64url"), newPassword }, { resetToken, newPassword, passwordHash: "forged" }]) {
        assert.equal((await send(`/api/v1/auth/password-reset/${challenge.id}/reset`, { method: "POST", body })).status, 400);
      }
      assert.equal((await pool.query("select status from password_reset_challenges where id = $1", [challenge.id])).rows[0].status, "pending");
      assert.deepEqual((await pool.query("select password_hash from auth_identities where user_id = $1", [userA.userId])).rows, proofSnapshot);
      assert.equal((await (await a.send("/api/v1/me")).json()).data.actorUserId, userA.userId);
      const reset = await send(`/api/v1/auth/password-reset/${challenge.id}/reset`, { method: "POST", body: { resetToken, newPassword } });
      assert.equal(reset.status, 200, await reset.clone().text());
      assert.equal((await (await a.send("/api/v1/me")).json()).data.activeRole, "guest");
      assert.equal((await a.send("/api/v1/auth/sessions", { method: "POST", body: { email: userA.email, password } })).status, 403);
      assert.equal((await a.send("/api/v1/auth/sessions", { method: "POST", body: { email: userA.email, password: newPassword } })).status, 200);
    });

    await t.test("network logout clears both cookies and malformed cookie input does not crash me", async () => {
      const oldSession = b.cookies.get("cuac_session");
      const response = await b.send("/api/v1/auth/logout", { method: "POST" });
      assert.equal(response.status, 200);
      assert.equal(response.headers.getSetCookie().length, 2);
      assert.equal(b.cookies.size, 0);
      const replay = await send("/api/v1/me", { cookie: `cuac_session=${oldSession}; unrelated=%` });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).data.activeRole, "guest");
    });
  } finally {
    clearTimeout(startupTimer);
    if (child.connected) child.send({ type: "stop" });
    const ended = await Promise.race([exited.then(() => true), delay(5000, undefined, { ref: false }).then(() => false)]);
    if (!ended) { child.kill(); await exited; }
    t.diagnostic("Owned HTTP rehearsal server stopped.");
  }
}
