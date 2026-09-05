import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

async function eventually(check, timeout = 8000) {
  const until = performance.now() + timeout;
  while (performance.now() < until) { const result = await check(); if (result) return result; await delay(20); }
  assert.fail("Managed application did not reach the required lifecycle state.");
}

async function withServer(databaseUrl, timeoutMs, work) {
  const child = fork(new URL("./http-rehearsal-server.mjs", import.meta.url), [], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { NODE_ENV: "production", CUAC_ENV: "development", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      CUAC_PG_REHEARSAL_URL: databaseUrl, CUAC_SESSION_SECRET: randomBytes(32).toString("base64url"),
      CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "disabled", CUAC_AUTH_RATE_LIMIT_BACKEND: "disabled", CUAC_PAYMENT_MODE: "disabled", CUAC_FILE_UPLOAD_ENABLED: "false",
      CUAC_HTTP_SHUTDOWN_TIMEOUT_MS: String(timeoutMs), CUAC_LIFECYCLE_HOLD_EXIT: "1" },
  });
  const messages = []; let logs = "", ended = false;
  child.on("message", message => messages.push(message));
  child.stdout.on("data", chunk => { logs = (logs + chunk).slice(-8000); });
  child.stderr.on("data", chunk => { logs = (logs + chunk).slice(-8000); });
  const exited = new Promise(resolve => child.once("exit", (code, signal) => { ended = true; resolve({ code, signal }); }));
  const send = message => { if (child.connected) child.send(message, () => {}); };
  const message = type => eventually(() => messages.find(item => item.type === type), 20_000);
  try {
    const { origin } = await message("ready");
    assert.equal(new URL(origin).hostname, "127.0.0.1");
    await work({ child, origin, send, messages, message, exited, logs: () => logs });
  } finally {
    send({ type: "finish" }); send({ type: "stop" });
    const finished = await Promise.race([exited.then(() => true), delay(5000, false, { ref: false })]);
    if (!finished && !ended) { child.kill("SIGKILL"); await exited; }
  }
}

export async function runHttpLifecycleRehearsal(t, pool, databaseUrl) {
  const apiConnections = () => pool.query("select pid, wait_event_type from pg_stat_activity where datname = current_database() and application_name = 'cuac:api'");
  const waitForLock = () => eventually(async () => (await apiConnections()).rows.some(row => row.wait_event_type === "Lock"));
  async function assertClosed(server) {
    const { snapshot } = await server.message("closed");
    assert.deepEqual(snapshot, { phase: "closed", activeRequests: 0, resources: [] });
    assert.equal(server.child.exitCode, null, "Check database closure before allowing the process to exit.");
    await eventually(async () => (await apiConnections()).rowCount === 0);
    const stopped = server.messages.filter(event => event.event === "application.stopped");
    assert.equal(stopped.length, 1);
    assert.equal(stopped[0].outcome, "drained");
    assert.deepEqual(stopped[0].closedResources, ["postgres"]);
    server.send({ type: "finish" });
    assert.deepEqual(await server.exited, { code: 0, signal: null });
  }

  await t.test("managed built API closes its actual lazy-chunk database pool before process exit", () => withServer(databaseUrl, 5000, async server => {
    assert.equal((await fetch(server.origin + "/api/v1/health")).status, 200);
    assert.ok((await apiConnections()).rowCount > 0);
    server.send({ type: "stop" });
    await assertClosed(server);
  }));

  await t.test("managed signal dispatch drains an admitted database request and duplicate signals do not restart shutdown", () => withServer(databaseUrl, 8000, async server => {
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("lock table schools in access exclusive mode");
      pending = fetch(server.origin + "/api/v1/catalog/schools", { signal: AbortSignal.timeout(15000) }).then(async response => ({ status: response.status, body: await response.text() }));
      await waitForLock();
      server.send({ type: "signal", signal: "SIGTERM" });
      await eventually(() => server.messages.some(message => message.event === "application.draining"));
      server.send({ type: "signal", signal: "SIGINT" });
      server.send({ type: "snapshot" });
      assert.equal((await server.message("snapshot")).snapshot.activeRequests, 1);
      await assert.rejects(fetch(server.origin + "/api/v1/health", { signal: AbortSignal.timeout(1000) }));
      assert.equal(server.messages.some(message => message.event === "application.stopped"), false);
      await blocker.query("rollback");
      assert.equal((await pending).status, 200);
      await assertClosed(server);
      assert.equal(server.messages.filter(message => message.event === "application.draining").length, 1);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
  }));

  await t.test("managed drain still tracks database work after its HTTP client disconnects", () => withServer(databaseUrl, 8000, async server => {
    const blocker = await pool.connect(), controller = new AbortController(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("lock table schools in access exclusive mode");
      pending = fetch(server.origin + "/api/v1/catalog/schools", { signal: controller.signal }).catch(() => "disconnected");
      await waitForLock(); controller.abort(); assert.equal(await pending, "disconnected");
      server.send({ type: "stop" });
      await eventually(() => server.messages.some(message => message.event === "application.draining"));
      await delay(150);
      server.send({ type: "snapshot" });
      assert.equal((await server.message("snapshot")).snapshot.activeRequests, 1);
      assert.equal(server.messages.some(message => message.type === "closed"), false);
      assert.ok((await apiConnections()).rowCount > 0);
      await blocker.query("rollback"); await assertClosed(server);
    } finally { controller.abort(); await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
  }));

  await t.test("managed deadline exits nonzero and an uncommitted registration/audit transaction rolls back", () => withServer(databaseUrl, 1000, async server => {
    const email = `shutdown-${randomUUID()}@example.invalid`, password = "PRIVATE_SHUTDOWN_PASSWORD_2026";
    const before = (await pool.query("select count(*)::int as count from audit_logs")).rows[0].count;
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("lock table audit_logs in access exclusive mode");
      pending = fetch(server.origin + "/api/v1/auth/register", { method: "POST", signal: AbortSignal.timeout(15000),
        headers: { origin: server.origin, "content-type": "application/json" }, body: JSON.stringify({ email, password }),
      }).then(async response => ({ status: response.status, body: await response.text() }), () => "disconnected");
      await waitForLock(); const started = performance.now();
      server.send({ type: "signal", signal: "SIGTERM" });
      assert.deepEqual(await server.exited, { code: 1, signal: null });
      assert.ok(performance.now() - started < 5000);
      assert.equal(await pending, "disconnected");
      const stopped = server.messages.find(message => message.event === "application.stopped");
      assert.equal(stopped.outcome, "deadline"); assert.equal(stopped.activeRequests, 1);
      assert.deepEqual(stopped.closedResources, []);
      await blocker.query("rollback");
      await eventually(async () => (await apiConnections()).rowCount === 0);
      assert.equal((await pool.query("select count(*)::int as count from users where email_normalized = $1", [email])).rows[0].count, 0);
      assert.equal((await pool.query("select count(*)::int as count from audit_logs")).rows[0].count, before);
      assert.doesNotMatch(server.logs(), /PRIVATE_SHUTDOWN|shutdown-.*@example|postgresql:\/\//);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await Promise.allSettled([pending]); }
  }));
}
