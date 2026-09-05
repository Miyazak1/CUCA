import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHttpHandlers, createHealthStatus } from "../../../src/server/index.ts";

test("health status reports a successful PostgreSQL probe without exposing secrets", async () => {
  const status = await createHealthStatus({
    env: {
      DATABASE_URL: "postgres://user:secret-password@example.aliyun.com/cuac",
      PGSSLMODE: "require",
    },
    now: new Date("2026-08-28T00:00:00.000Z"),
    databaseProbe: async () => true,
  });

  assert.deepEqual(status, {
    status: "ok",
    service: "cuac-backend",
    checkedAt: "2026-08-28T00:00:00.000Z",
    database: {
      provider: "postgresql",
      configured: true,
      reachable: true,
      urlVariable: "DATABASE_URL",
      sslMode: "require",
    },
    warnings: [],
  });
  assert.doesNotMatch(JSON.stringify(status), /secret-password|example\.aliyun\.com|postgres:\/\/user/);
});

test("health status is degraded before PostgreSQL URL is configured", async () => {
  let probes = 0;
  const status = await createHealthStatus({
    env: {},
    databaseProbe: async () => { probes += 1; return true; },
    now: new Date("2026-08-28T00:00:00.000Z"),
  });

  assert.equal(status.status, "degraded");
  assert.equal(status.database.configured, false);
  assert.equal(probes, 0);
  assert.match(status.warnings[0], /PostgreSQL URL is not configured/);
});

test("health HTTP handler returns 503 for missing PostgreSQL configuration", async () => {
  const response = await createHealthHttpHandlers({ env: {}, now: new Date("2026-08-28T00:00:00.000Z") }).getHealth();
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.status, "degraded");
  assert.equal(body.database.configured, false);
});

test("health HTTP handler returns 200 only after PostgreSQL probe success", async () => {
  const response = await createHealthHttpHandlers({
    env: { POSTGRES_URL: "postgres://user:password@example.aliyun.com/cuac" },
    now: new Date("2026-08-28T00:00:00.000Z"),
    databaseProbe: async () => true,
  }).getHealth();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.database.urlVariable, "POSTGRES_URL");
  assert.doesNotMatch(JSON.stringify(body), /password|example\.aliyun\.com/);
});

test("configured health stays degraded for missing, false or throwing probes and redacts errors", async () => {
  for (const databaseProbe of [undefined, async () => false, async () => { throw new Error("postgres://user:PRIVATE_PASSWORD@PRIVATE_HOST/cuac"); }]) {
    const response = await createHealthHttpHandlers({ env: { DATABASE_URL: "postgres://PRIVATE_HOST/cuac" }, databaseProbe }).getHealth();
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.database.configured, true);
    assert.equal(body.database.reachable, false);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_PASSWORD|PRIVATE_HOST/);
  }
});
