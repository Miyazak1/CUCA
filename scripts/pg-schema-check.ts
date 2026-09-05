import { fileURLToPath } from "node:url";
import { checkMigrationSnapshots } from "./lib/pg-schema-snapshot.ts";

try {
  if (process.argv.length > 2) throw new Error("This read-only schema check accepts no arguments.");
  const result = await checkMigrationSnapshots(fileURLToPath(new URL("../drizzle/pg", import.meta.url)));
  console.log(`PostgreSQL snapshot check passed: ${result.migrations} migrations, ${result.snapshots} snapshots, ${result.tables} tables; latest ${result.latest}.`);
  console.log("No database connection or migration writes were performed. Run db:pg:rehearse for real-schema parity.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL snapshot check failed.");
  process.exitCode = 1;
}
