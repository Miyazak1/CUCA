import { fileURLToPath } from "node:url";
import { buildMigrationRelease } from "./lib/pg-release.ts";

try {
  if (process.argv.length !== 2) throw new Error("The release builder takes no database or output overrides.");
  const result = await buildMigrationRelease(fileURLToPath(new URL("../", import.meta.url)));
  console.log(JSON.stringify(result, null, 2));
  console.log("Release built locally. Record the manifest digest outside the artifact; this does not approve deployment.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration release build failed.");
  process.exitCode = 1;
}
