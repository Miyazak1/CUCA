import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:sustech-complete-preflight" });
try {
  const schools = await pool.query(`select id,slug,name_en,name_zh,status,verification_status,source_url,city_id
    from schools where lower(name_en) like '%southern university of science and technology%'
      or name_zh in ('南方科技大学','南科大') or slug like '%southern-university-of-science%'
    order by status,slug`);
  const schoolIds = schools.rows.map((row) => row.id);
  const programs = schoolIds.length ? await pool.query(`select id,slug,name_en,name_zh,degree_level,teaching_language,status,verification_status,source_url
    from programs where school_id=any($1::uuid[]) order by status,slug`, [schoolIds]) : { rows: [] };
  const scholarships = schoolIds.length ? await pool.query(`select id,slug,title,status,verification_status,source_url
    from scholarships where school_id=any($1::uuid[]) order by status,slug`, [schoolIds]) : { rows: [] };
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_field_lineage_json from cities where slug like 'shenzhen%' or lower(name_en)='shenzhen' or name_zh='深圳' order by slug");
  console.log(JSON.stringify({ schools: schools.rows, programCount: programs.rows.length, programs: programs.rows, scholarshipCount: scholarships.rows.length, scholarships: scholarships.rows, city: city.rows }, null, 2));
} finally {
  await pool.end();
}
