import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  LOCAL_POSTGRES_CONTAINER,
  LOCAL_POSTGRES_VOLUME,
  assertLocalDatabaseTarget,
  assertLocalDevelopmentState,
  assertLoopbackPostgresBinding,
  createLocalDevelopmentState,
  isHealthyLocalApplicationStatus,
  localDatabaseUrl,
  localRuntimeEnvironment,
  localSyntheticAccounts,
  parseLocalDevelopmentCommand,
  postgresDockerRunArgs,
  resolveLocalPort,
} from "../../../scripts/lib/local-development.ts";

const imageId = `sha256:${"a".repeat(64)}`;
const uuids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];
const state = createLocalDevelopmentState({
  postgresImageId: imageId,
  now: new Date("2026-09-01T00:00:00.000Z"),
  bytes: () => Buffer.alloc(32, 7),
  uuid: () => uuids.shift(),
});

test("local runtime state is generated with pinned resources and no committed credential defaults", () => {
  assertLocalDevelopmentState(state);
  assert.equal(state.postgresContainer, LOCAL_POSTGRES_CONTAINER);
  assert.equal(state.postgresVolume, LOCAL_POSTGRES_VOLUME);
  assert.match(state.databasePassword, /^[A-Za-z0-9_-]{43}$/);
  assert.match(state.studentEmail, /^student\+[0-9a-f]{8}@local\.cuac\.invalid$/);
  const accounts = localSyntheticAccounts(state);
  assert.match(accounts.school.email, /^school\+[0-9a-f]{8}@local\.cuac\.invalid$/);
  assert.match(accounts.ops.email, /^ops\+[0-9a-f]{8}@local\.cuac\.invalid$/);
  assert.match(accounts.admin.email, /^admin\+[0-9a-f]{8}@local\.cuac\.invalid$/);
  assert.equal(accounts.school.password, state.studentPassword);
  assert.equal(accounts.admin.password, state.studentPassword);
  assert.throws(() => assertLocalDevelopmentState({ ...state, owner: "foreign" }), /identity/);
  assert.throws(() => assertLocalDevelopmentState({ ...state, extra: true }), /shape/);
  assert.throws(() => assertLocalDevelopmentState({ ...state, postgresPort: "55432" }), /ports/);
});

test("local runtime accepts only exact loopback database identity and port bounds", () => {
  const url = localDatabaseUrl(state);
  assert.match(url, /^postgresql:\/\/cuac_local:[^@]+@127\.0\.0\.1:55432\/cuac_local$/);
  assert.doesNotThrow(() => assertLocalDatabaseTarget(url, state));
  assert.throws(() => assertLocalDatabaseTarget(url.replace("127.0.0.1", "database.example"), state), /refuses/);
  assert.equal(resolveLocalPort("3100", 3000, "port"), 3100);
  assert.throws(() => resolveLocalPort("80", 3000, "port"), /between/);
  assert.throws(() => resolveLocalPort("3.5", 3000, "port"), /integer/);
});

test("local PostgreSQL container binds loopback, pins the image, and keeps the password out of argv", () => {
  const args = postgresDockerRunArgs(state);
  assert.ok(args.includes("127.0.0.1:55432:5432"));
  assert.ok(args.includes(imageId));
  assert.ok(args.includes(`type=volume,source=${LOCAL_POSTGRES_VOLUME},target=/var/lib/postgresql/data`));
  assert.ok(args.includes("POSTGRES_PASSWORD"));
  assert.doesNotMatch(args.join(" "), new RegExp(state.databasePassword));
  assert.doesNotThrow(() => assertLoopbackPostgresBinding("127.0.0.1:55432", state));
  assert.throws(() => assertLoopbackPostgresBinding("0.0.0.0:55432", state), /loopback/);
});

test("local application environment keeps external effects closed", () => {
  const env = localRuntimeEnvironment(state, {
    CUAC_PAYMENT_MODE: "live",
    CUAC_PAYMENT_PROVIDER: "foreign",
    CUAC_PAYMENT_GATEWAY_ENDPOINT: "https://foreign.example/checkout",
    CUAC_PAYMENT_GATEWAY_HMAC_SECRET: "secret",
    CUAC_PAYMENT_WEBHOOK_SECRET: "secret",
    POSTGRES_URL: "postgresql://remote",
    CUAC_ALLOW_PRODUCTION_MIGRATION: "true",
  });
  assert.equal(env.CUAC_ENV, "development");
  assert.equal(env.CUAC_MIGRATION_TARGET_ENV, "development");
  assert.equal(env.CUAC_PAYMENT_MODE, "disabled");
  assert.equal(env.CUAC_PAYMENT_PROVIDER, undefined);
  assert.equal(env.CUAC_PAYMENT_GATEWAY_ENDPOINT, undefined);
  assert.equal(env.CUAC_PAYMENT_GATEWAY_HMAC_SECRET, undefined);
  assert.equal(env.CUAC_PAYMENT_WEBHOOK_SECRET, undefined);
  assert.equal(env.CUAC_AGENT_DIRECT_DB_ACCESS, "false");
  assert.equal(env.CUAC_FILE_UPLOAD_ENABLED, "false");
  assert.equal(env.CUAC_AUTH_RATE_LIMIT_BACKEND, "postgres");
  assert.equal(env.CUAC_AGENT_ENABLED, "false");
  assert.equal(env.CUAC_AGENT_TOOL_GATEWAY_MODE, "disabled");
  assert.equal(env.CUAC_AGENT_SANDBOX_MODE, "disabled");
  assert.equal(env.CUAC_LOCAL_SCHOOL_EMAIL, localSyntheticAccounts(state).school.email);
  assert.equal(env.CUAC_LOCAL_OPS_EMAIL, localSyntheticAccounts(state).ops.email);
  assert.equal(env.CUAC_LOCAL_ADMIN_EMAIL, localSyntheticAccounts(state).admin.email);
  assert.equal(env.CUAC_LOCAL_ADMIN_PASSWORD, state.studentPassword);
  assert.equal(env.POSTGRES_URL, undefined);
  assert.equal(env.CUAC_ALLOW_PRODUCTION_MIGRATION, undefined);
  assert.equal(env.DATABASE_URL, localDatabaseUrl(state));
});

test("local status accepts only the CUAC health contract with a reachable database", () => {
  assert.equal(isHealthyLocalApplicationStatus({ status: "ok", service: "cuac-backend", database: { reachable: true } }), true);
  assert.equal(isHealthyLocalApplicationStatus({ status: "ok", service: "foreign-backend", database: { reachable: true } }), false);
  assert.equal(isHealthyLocalApplicationStatus({ status: "ok", service: "cuac-backend", database: { reachable: false } }), false);
  assert.equal(isHealthyLocalApplicationStatus({ status: "ok", service: "cuac-backend" }), false);
});

test("local command grammar and repository wiring remain explicit", async () => {
  for (const command of ["up", "dev", "status", "stop", "credentials"]) {
    assert.equal(parseLocalDevelopmentCommand([command]), command);
  }
  assert.throws(() => parseLocalDevelopmentCommand([]), /one local development command/);
  assert.throws(() => parseLocalDevelopmentCommand(["reset"]), /one local development command/);
  assert.throws(() => parseLocalDevelopmentCommand(["up", "--force"]), /one local development command/);

  const projectDir = fileURLToPath(new URL("../../../", import.meta.url));
  const workspaceDir = fileURLToPath(new URL("../../../../", import.meta.url));
  const packageJson = JSON.parse(await readFile(`${projectDir}/package.json`, "utf8"));
  const gitignore = await readFile(`${projectDir}/.gitignore`, "utf8");
  const seed = await readFile(`${projectDir}/scripts/local-seed.ts`, "utf8");
  const localDevelopment = await readFile(`${projectDir}/scripts/local-development.ts`, "utf8");
  const localSmoke = await readFile(`${projectDir}/scripts/local-smoke.ts`, "utf8");
  const viteConfig = await readFile(`${projectDir}/vite.config.ts`, "utf8");
  const windowsLauncher = await readFile(`${projectDir}/start-cuac-local.bat`, "utf8");
  const windowsAccountsLauncher = await readFile(`${projectDir}/show-cuac-local-accounts.bat`, "utf8");
  const workspaceLauncher = await readFile(`${workspaceDir}/start-cuac-local.bat`, "utf8");
  const workspaceAccountsLauncher = await readFile(`${workspaceDir}/show-cuac-local-accounts.bat`, "utf8");
  const localRunbook = await readFile(`${workspaceDir}/CUAC_LOCAL_DEVELOPMENT_RUNBOOK.md`, "utf8");
  assert.equal(packageJson.scripts["dev:local"], "node scripts/local-development.ts dev");
  assert.equal(packageJson.scripts["local:up"], "node scripts/local-development.ts up");
  assert.match(gitignore, /^\/\.cuac-local\/$/m);
  assert.match(seed, /CUAC_LOCAL_RUNTIME/);
  assert.match(seed, /hostname !== "127\.0\.0\.1"/);
  assert.match(seed, /school_staff_memberships/);
  assert.match(seed, /cuac_staff_access_grants/);
  assert.match(seed, /CUAC_LOCAL_ADMIN_EMAIL/);
  assert.match(seed, /'cuac_admin', 'approved'/);
  assert.match(seed, /school_applications/);
  assert.match(seed, /c\.program_intake_id, 'new', clock_timestamp\(\), clock_timestamp\(\)/);
  assert.match(seed, /status in \('submitted', 'under_review'\)/);
  assert.doesNotMatch(seed, /c\.program_intake_id, 'submitted'/);
  assert.match(seed, /PostgresOfficialSubmissionPolicyGovernance/);
  assert.match(seed, /admissionRouteKey: "direct_university"/);
  assert.match(seed, /updateOwnApplicationChoice/);
  assert.doesNotMatch(seed, /delete from|drop table|truncate/i);
  assert.match(localDevelopment, /Application port .* belongs to another service/);
  assert.match(localDevelopment, /CUAC_LOCAL_APP_PORT .* already in use by another service/);
  assert.match(localDevelopment, /CUAC_LOCAL_PG_PORT .* already in use by another service/);
  assert.match(localDevelopment, /Configured local ports do not match the existing owned CUAC runtime state/);
  assert.match(localDevelopment, /Removed a stale CUAC Vinext development lock; no process was terminated/);
  assert.match(localDevelopment, /recordSuccessfulSeed\(state\)/);
  assert.match(localDevelopment, /await assertSuccessfulSeed\(state\)/);
  assert.match(localDevelopment, /installationId: state\.installationId/);
  assert.match(windowsLauncher, /CUAC_LOCAL_APP_PORT=52118/);
  assert.match(windowsLauncher, /CUAC_LOCAL_PG_PORT=62251/);
  assert.match(windowsAccountsLauncher, /npm run local:credentials/);
  assert.doesNotMatch(windowsAccountsLauncher, /studentPassword|databasePassword|SESSION_SECRET/);
  assert.match(localSmoke, /\/api\/v1\/student\/saved-items/);
  assert.match(localSmoke, /\/api\/v1\/school\/catalog-corrections/);
  assert.match(localSmoke, /\/api\/v1\/ops\/catalog-corrections\/\$\{catalogCorrection\.id\}\/claim/);
  assert.match(localSmoke, /\/api\/v1\/auth\/step-up/);
  assert.match(localSmoke, /rejected_unverifiable/);
  assert.match(localSmoke, /submitted_claimed_admin_rejected/);
  assert.match(localSmoke, /catalogItem/);
  assert.match(localSmoke, /method: "DELETE"/);
  assert.match(localSmoke, /savedItemLifecycle = "created_projected_updated_removed"/);
  assert.match(localSmoke, /savedAfterRemove/);
  assert.doesNotMatch(localSmoke, /localStorage|sessionStorage|cuacApplicationDemoState/);
  assert.match(viteConfig, /process\.env\.CUAC_LOCAL_RUNTIME === "1"/);
  assert.match(viteConfig, /isCuacLocalRuntime\s*\? \[\]/);
  assert.match(windowsLauncher, /set "CUAC_LOCAL_APP_PORT=52118"/);
  assert.match(windowsLauncher, /set "CUAC_LOCAL_PG_PORT=62251"/);
  assert.match(windowsLauncher, /call npm run dev:local/);
  assert.match(windowsLauncher, /docker version/);
  assert.match(windowsLauncher, /--check/);
  assert.doesNotMatch(windowsLauncher, /(?:call|start)\s+npm install|docker pull|local:stop|taskkill|Stop-Process/i);
  assert.match(workspaceLauncher, /call "%~dp0frontend\\start-cuac-local\.bat" %\*/);
  assert.match(workspaceAccountsLauncher, /call "%~dp0frontend\\show-cuac-local-accounts\.bat" %\*/);
  for (const wrapper of [workspaceLauncher, workspaceAccountsLauncher]) {
    assert.doesNotMatch(wrapper, /52118|53855|62251|password|secret|token|POSTGRES_URL|DATABASE_URL/i);
    assert.doesNotMatch(wrapper, /npm install|docker pull|local:stop|taskkill|Stop-Process/i);
  }
  assert.match(localRunbook, /Windows launcher pins port `62251`/);
  assert.match(localRunbook, /Windows launcher pins port `52118`/);
  assert.match(localRunbook, /fails visibly instead of changing ports or connecting to a different database/);
  assert.match(localRunbook, /`\.cuac-local\/seeded\.json` proves that migrations and the idempotent seed completed/);
});
