import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:sdu-preflight" });
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", ["shandong-university", "Shandong University", "山东大学"]);
  const cities = await pool.query("select id,slug,name_en,name_zh,region,province,status from cities where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", ["jinan", "Jinan", "济南"]);
  console.log(JSON.stringify({ schools: schools.rows, cities: cities.rows }, null, 2));
} finally {
  await pool.end();
}
