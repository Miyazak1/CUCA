import pg from "pg";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { assertSafePostgresConnectionString, createTransactionalSqlClient, getDatabaseUrl, type PostgresRuntimeConfig } from "./postgres-client.ts";
import { assertMigrationPlan, runCheckedMigrationPlan, type CheckedMigrationResult } from "./migration-guard.ts";

export const POSTGRES_MIGRATION_RUNBOOK_PATH = "../CUAC_POSTGRES_MIGRATION_RUNBOOK.md";

export type PostgresMigrationEnvCheck = {
  configured: boolean;
  databaseUrlVariable: "DATABASE_URL" | "POSTGRES_URL" | "PG_DATABASE_URL" | null;
  sslMode: string | null;
  targetEnvironment: PostgresMigrationTargetEnvironment;
  productionMigrationAllowed: boolean;
  runbookAcknowledged: boolean;
  runbookPath: string;
  blockers: string[];
  warnings: string[];
};

export type PostgresMigrationTargetEnvironment = "development" | "staging" | "production" | "unknown";

export type PostgresMigrationConfig = PostgresRuntimeConfig & {
  migrationsFolder: string;
  targetEnvironment: PostgresMigrationTargetEnvironment;
  productionMigrationAllowed: boolean;
  runbookAcknowledged: boolean;
};

export type PostgresMigrationResult = CheckedMigrationResult & {
  migrationsFolder: string;
  databaseUrlVariable: PostgresMigrationEnvCheck["databaseUrlVariable"];
  targetEnvironment: PostgresMigrationTargetEnvironment;
};

export function inspectPostgresMigrationEnv(env: Record<string, string | undefined> = process.env): PostgresMigrationEnvCheck {
  const databaseUrlVariable = getDatabaseUrlVariable(env);
  const sslMode = env.PGSSLMODE || env.PG_SSL || env.DATABASE_SSL || null;
  const targetEnvironment = resolveMigrationTargetEnvironment(env);
  const productionMigrationAllowed = normalizeBool(env.CUAC_ALLOW_PRODUCTION_MIGRATION);
  const runbookAcknowledged = normalizeBool(env.CUAC_MIGRATION_RUNBOOK_ACK);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!databaseUrlVariable) {
    warnings.push("PostgreSQL URL is not configured. Set DATABASE_URL, POSTGRES_URL, or PG_DATABASE_URL before migrating.");
  }

  if (targetEnvironment === "unknown") {
    warnings.push("Migration target environment is unknown. Set CUAC_MIGRATION_TARGET_ENV to development, staging, or production.");
  }

  if ((targetEnvironment === "staging" || targetEnvironment === "production")
    && sslMode?.trim().toLowerCase() !== "verify-full") {
    blockers.push("Staging/production migrations require PGSSLMODE=verify-full.");
  }

  if (targetEnvironment === "production" && !productionMigrationAllowed) {
    blockers.push("Production migrations require CUAC_ALLOW_PRODUCTION_MIGRATION=true.");
  }

  if (targetEnvironment === "production" && !runbookAcknowledged) {
    blockers.push(`Production migrations require CUAC_MIGRATION_RUNBOOK_ACK=true after reviewing ${POSTGRES_MIGRATION_RUNBOOK_PATH}.`);
  }

  return {
    configured: Boolean(databaseUrlVariable),
    databaseUrlVariable,
    sslMode,
    targetEnvironment,
    productionMigrationAllowed,
    runbookAcknowledged,
    runbookPath: POSTGRES_MIGRATION_RUNBOOK_PATH,
    blockers,
    warnings,
  };
}

export function resolvePostgresSsl(env: Record<string, string | undefined> = process.env): PostgresRuntimeConfig["ssl"] {
  const mode = (env.PGSSLMODE || env.PG_SSL || env.DATABASE_SSL)?.trim().toLowerCase();

  if (!mode || mode === "disable" || mode === "false") {
    return undefined;
  }

  if (mode === "verify-full") {
    return true;
  }

  if (["prefer", "require", "verify-ca", "no-verify"].includes(mode)) {
    return { rejectUnauthorized: false };
  }

  throw new Error("Unsupported PostgreSQL SSL mode.");
}

export function createPostgresMigrationConfig(
  migrationsFolder: string,
  env: Record<string, string | undefined> = process.env,
): PostgresMigrationConfig {
  const check = inspectPostgresMigrationEnv(env);

  return {
    databaseUrl: getDatabaseUrl(env),
    ssl: resolvePostgresSsl(env),
    migrationsFolder,
    targetEnvironment: check.targetEnvironment,
    productionMigrationAllowed: check.productionMigrationAllowed,
    runbookAcknowledged: check.runbookAcknowledged,
  };
}

export async function runPostgresMigrations(config: PostgresMigrationConfig): Promise<PostgresMigrationResult> {
  assertPostgresMigrationSafety(config);
  const migrations = readMigrationFiles({ migrationsFolder: config.migrationsFolder });
  return runPostgresMigrationPlan(config, migrations);
}

export async function runPostgresMigrationPlan(config: PostgresMigrationConfig, migrations: readonly MigrationMeta[]): Promise<PostgresMigrationResult> {
  assertPostgresMigrationSafety(config);
  assertMigrationPlan(migrations);
  const databaseUrl = config.databaseUrl ?? getDatabaseUrl();
  if (!databaseUrl) throw new Error("PostgreSQL DATABASE_URL is not configured.");
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl: config.ssl, max: 1,
    connectionTimeoutMillis: 10_000, application_name: "cuac:migration" });
  let connectionFailure: Error | undefined;
  const rememberConnectionFailure = (error: Error) => { connectionFailure ??= error; };
  pool.on("error", rememberConnectionFailure);
  // pg emits transport errors for checked-out clients independently of query rejection.
  pool.on("connect", connection => connection.on("error", rememberConnectionFailure));
  let result: CheckedMigrationResult;

  try {
    result = await runCheckedMigrationPlan(createTransactionalSqlClient(pool), migrations);
  } finally {
    await pool.end();
  }
  if (connectionFailure) throw new Error("Migration connection failed; verify the committed ledger before retrying.", { cause: connectionFailure });
  return {
    ...result,
    migrationsFolder: config.migrationsFolder,
    databaseUrlVariable: getDatabaseUrlVariable(process.env),
    targetEnvironment: config.targetEnvironment,
  };
}

export function assertPostgresMigrationSafety(config: PostgresMigrationConfig): void {
  if (config.databaseUrl) assertSafePostgresConnectionString(config.databaseUrl);

  if (config.targetEnvironment === "production" && !config.productionMigrationAllowed) {
    throw new Error("Refusing production migration without CUAC_ALLOW_PRODUCTION_MIGRATION=true.");
  }

  if (config.targetEnvironment === "production" && !config.runbookAcknowledged) {
    throw new Error("Refusing production migration without CUAC_MIGRATION_RUNBOOK_ACK=true.");
  }

  if (
    (config.targetEnvironment === "staging" || config.targetEnvironment === "production") &&
    config.databaseUrl &&
    /localhost|127\.0\.0\.1/i.test(config.databaseUrl)
  ) {
    throw new Error("Refusing staging/production migration against a localhost PostgreSQL URL.");
  }

  if ((config.targetEnvironment === "staging" || config.targetEnvironment === "production") && config.ssl !== true) {
    throw new Error("Refusing staging/production migration without verified PostgreSQL TLS.");
  }
}

function getDatabaseUrlVariable(env: Record<string, string | undefined>): PostgresMigrationEnvCheck["databaseUrlVariable"] {
  if (env.DATABASE_URL) {
    return "DATABASE_URL";
  }

  if (env.POSTGRES_URL) {
    return "POSTGRES_URL";
  }

  if (env.PG_DATABASE_URL) {
    return "PG_DATABASE_URL";
  }

  return null;
}

function resolveMigrationTargetEnvironment(env: Record<string, string | undefined>): PostgresMigrationTargetEnvironment {
  const value = (env.CUAC_MIGRATION_TARGET_ENV ?? env.CUAC_ENV ?? env.DEPLOY_ENV ?? env.NODE_ENV ?? "").trim().toLowerCase();

  if (value === "development" || value === "dev" || value === "test") {
    return "development";
  }

  if (value === "staging" || value === "stage") {
    return "staging";
  }

  if (value === "production" || value === "prod") {
    return "production";
  }

  return "unknown";
}

function normalizeBool(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}
