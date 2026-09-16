import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:changan-complete-preflight" });

try {
  const schools = await pool.query(`select id,slug,name_en,name_zh,status,verification_status,source_url,city_id
    from schools where slug='chang-an-university'
      or lower(name_en)=lower('Chang''an University')
      or name_zh='长安大学' order by slug`);
  const schoolIds = schools.rows.map((row) => row.id);
  const programs = schoolIds.length ? await pool.query(`select id,slug,name_en,name_zh,degree_level,teaching_language,tuition_text,status,verification_status,source_url
    from programs where school_id=any($1::uuid[]) order by slug`, [schoolIds]) : { rows: [] };
  const scholarships = schoolIds.length ? await pool.query(`select id,slug,title,status,verification_status,source_url
    from scholarships where school_id=any($1::uuid[]) order by slug`, [schoolIds]) : { rows: [] };
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url from cities where slug='xian'");
  console.log(JSON.stringify({ schools: schools.rows, programCount: programs.rows.length, programs: programs.rows, scholarshipCount: scholarships.rows.length, scholarships: scholarships.rows, city: city.rows }, null, 2));
} finally {
  await pool.end();
}
