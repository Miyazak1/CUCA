import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../drizzle.pg.config.ts";
import { generatePgMigrationArtifacts } from "./lib/pg-migration-generation.ts";

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !/^--name=[a-z0-9_]{1,64}$/.test(args[0]))) throw new Error("Use db:pg:generate with an optional --name=lowercase_migration_name.");
  if (config.dialect !== "postgresql" || typeof config.out !== "string") throw new Error("PostgreSQL generation config is invalid.");
  const project = fileURLToPath(new URL("../", import.meta.url));
  const result = await generatePgMigrationArtifacts(project, resolve(project, "drizzle.pg.config.ts"), resolve(project, config.out), args[0]?.slice(7));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.cursorAdvanced) console.log("New migration cursor advanced above its predecessor. Historical journal entries were not changed.");
  console.log(result.created ? "Migration generated, not applied. Review SQL and run schema/real-PostgreSQL gates before deployment." : "Existing migrations and snapshots were unchanged.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "PostgreSQL migration generation failed.");
  process.exitCode = 1;
}
