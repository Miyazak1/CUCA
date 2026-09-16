import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const args = process.argv.slice(2);
const unknownOptions = args.filter(arg => arg.startsWith("--")
  && !arg.startsWith("--confirm=") && !arg.startsWith("--review="));
if (unknownOptions.length) throw new Error(`Unknown options: ${unknownOptions.join(", ")}`);
const seedPath = resolve(process.cwd(), args.find(arg => !arg.startsWith("--")) || "seeds/catalog.official-five.local.json");
const confirmation = args.find(arg => arg.startsWith("--confirm="))?.slice("--confirm=".length);
const reviewReference = args.find(arg => arg.startsWith("--review="))?.slice("--review=".length);
const statePath = resolve(process.cwd(), ".cuac-local/runtime.json");

const bundle = JSON.parse(await readFile(seedPath, "utf8")) as unknown;
const state = JSON.parse(await readFile(statePath, "utf8")) as unknown;
const report = createCatalogMigrationValidationReport(bundle);
if (!report.ok) throw new Error(`Catalog bundle failed validation: ${report.errors.join(" ")}`);
const target = assertLocalCatalogPublishTarget(state, bundle, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:catalog-local-publish" });

try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>(
      "select current_database() as database_name, current_user as database_user",
      [],
    );
    if (identity[0]?.database_name !== target.publicTarget.databaseName
      || identity[0]?.database_user !== target.publicTarget.databaseUser) {
      throw new Error("Connected PostgreSQL identity does not match the CUAC local runtime.");
    }
    const written = await new CatalogSeedWriter(tx).writeBundle(bundle);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    return written;
  });
  console.log(JSON.stringify({
    seedPath,
    target: target.publicTarget,
    reviewReference,
    bundleSha256: report.bundleSha256,
    operationPlanSha256: report.operationPlanSha256,
    ...result,
  }, null, 2));
} finally {
  await pool.end();
}
