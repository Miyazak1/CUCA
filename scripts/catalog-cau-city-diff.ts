import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const candidate = JSON.parse(await readFile("seeds/catalog.cau-complete-batch-01.draft.json", "utf8"));
const review = JSON.parse(await readFile("seeds/catalog.cau-complete-batch-01.review.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:cau-city-diff" });
try {
  const result = await pool.query("select to_jsonb(c) record from cities c where slug=$1", ["beijing"]);
  console.log(JSON.stringify({ database: result.rows[0]?.record, candidate: candidate.cities[0], review: review.reconciliation.databaseBaseline.cityDependency }, null, 2));
} finally { await pool.end(); }
