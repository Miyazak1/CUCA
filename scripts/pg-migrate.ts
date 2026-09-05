import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { checkMigrationSnapshots } from "./lib/pg-schema-snapshot.ts";
import {
  createPostgresMigrationConfig,
  inspectPostgresMigrationEnv,
  runPostgresMigrations,
} from "../src/server/db/migration-runtime.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = process.env.PG_MIGRATIONS_FOLDER || resolve(scriptDir, "../drizzle/pg");
const check = inspectPostgresMigrationEnv();

console.log(JSON.stringify(check, null, 2));

if (check.blockers.length > 0) {
  console.error(`PostgreSQL migration blocked: ${check.blockers.join(" ")}`);
  process.exitCode = 1;
} else {
  const config = createPostgresMigrationConfig(migrationsFolder);

  try {
    await checkMigrationSnapshots(migrationsFolder);
    const result = await runPostgresMigrations(config);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
