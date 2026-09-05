import { inspectPostgresMigrationEnv } from "../src/server/db/migration-runtime.ts";

const check = inspectPostgresMigrationEnv();

console.log(JSON.stringify(check, null, 2));

if (!check.configured) {
  console.log("PostgreSQL is not configured yet. This is acceptable for local frontend/demo work, but production migration cannot run.");
}
