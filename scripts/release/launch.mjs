import { spawn } from "node:child_process";
import { verifyRelease } from "./migrate.mjs";

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || !["--verify-only", "--apply"].includes(args[0]) || !/^--manifest-sha256=[a-f0-9]{64}$/.test(args[1])) throw new Error("Invalid release arguments.");
  if (process.env.NODE_OPTIONS || process.env.NODE_PATH || process.env.PG_FORCE_NATIVE || process.env.PG_MIGRATIONS_FOLDER) throw new Error("Runtime override is not allowed.");
  const root = "/opt/cuac-release";
  await verifyRelease(root, args[1].slice("--manifest-sha256=".length));
  // The verifier belongs to the trusted image, not to the artifact being verified.
  const env = { NODE_ENV: "production", PATH: process.env.PATH };
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "PG_DATABASE_URL", "PGSSLMODE", "PG_SSL", "DATABASE_SSL",
    "CUAC_MIGRATION_TARGET_ENV", "CUAC_ALLOW_PRODUCTION_MIGRATION", "CUAC_MIGRATION_RUNBOOK_ACK"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  const child = spawn(process.execPath, [`${root}/run.mjs`, ...args], { cwd: root, env, stdio: "inherit" });
  const terminate = () => child.kill("SIGTERM");
  const interrupt = () => child.kill("SIGINT");
  process.once("SIGTERM", terminate);
  process.once("SIGINT", interrupt);
  try {
    const result = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    process.exitCode = result.code ?? (result.signal === "SIGTERM" ? 143 : 1);
  } finally {
    process.removeListener("SIGTERM", terminate);
    process.removeListener("SIGINT", interrupt);
  }
} catch {
  console.error("Trusted migration launcher rejected the artifact or runtime. Inspect the protected release record.");
  process.exitCode = 1;
}
