import { inspectPostgresMigrationEnv } from "../db/migration-runtime.ts";

export type HealthStatus = {
  status: "ok" | "degraded";
  service: "cuac-backend";
  checkedAt: string;
  database: {
    provider: "postgresql";
    configured: boolean;
    reachable: boolean;
    urlVariable: "DATABASE_URL" | "POSTGRES_URL" | "PG_DATABASE_URL" | null;
    sslMode: string | null;
  };
  warnings: string[];
};

export type HealthStatusOptions = {
  env?: Record<string, string | undefined>;
  now?: Date;
  databaseProbe?: () => Promise<boolean>;
};

export async function createHealthStatus(options: HealthStatusOptions = {}): Promise<HealthStatus> {
  const check = inspectPostgresMigrationEnv(options.env);
  let reachable = false;
  if (check.configured && options.databaseProbe) {
    try { reachable = await options.databaseProbe() === true; }
    catch { /* Health responses must not expose driver errors or connection credentials. */ }
  }
  const warnings = check.warnings.filter((warning) => !warning.includes("Migration target environment"));
  if (check.configured && !reachable) warnings.push("PostgreSQL readiness probe did not succeed.");

  return {
    status: reachable ? "ok" : "degraded",
    service: "cuac-backend",
    checkedAt: (options.now ?? new Date()).toISOString(),
    database: {
      provider: "postgresql",
      configured: check.configured,
      reachable,
      urlVariable: check.databaseUrlVariable,
      sslMode: check.sslMode,
    },
    warnings,
  };
}
