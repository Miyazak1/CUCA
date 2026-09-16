import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { assertDisposableCatalogImportTarget } from "../src/server/catalog/import-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const seedPath = resolve(process.cwd(), process.argv[2] || "seeds/catalog.sample.json");
const raw = await readFile(seedPath, "utf8");
const bundle = JSON.parse(raw) as unknown;
const target = assertDisposableCatalogImportTarget(process.env);
const pool = createPostgresPool();

try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(tx => new CatalogSeedWriter(tx).writeBundle(bundle));
  console.log(JSON.stringify({ seedPath, target, ...result }, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
