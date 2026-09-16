import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const databaseUrl = `postgres://${encodeURIComponent(state.databaseUser)}:${encodeURIComponent(state.databasePassword)}@127.0.0.1:${state.postgresPort}/${encodeURIComponent(state.databaseName)}`;
const pool = createPostgresPool({ databaseUrl, max: 1, applicationName: "cuac:seu-city-inspect" });
const citySlug = process.argv[2] ?? "nanjing";
try {
  const result = await pool.query("select slug,name_en,name_zh,region,province,status,source_url,source_label,source_field_lineage_json from cities where slug=$1", [citySlug]);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await pool.end();
}
