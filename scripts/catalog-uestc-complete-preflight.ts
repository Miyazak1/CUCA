import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:uestc-complete-preflight" });
try {
  const names = ["University of Electronic Science and Technology of China", "电子科技大学"];
  const schools = await pool.query(`select id,slug,name_en,name_zh,status,verification_status,source_url,city_id
    from schools where lower(name_en)=lower($1) or name_zh=$2 or slug like '%electronic-science%technology%' or slug='uestc' order by status,slug`, names);
  const schoolIds = schools.rows.map((row) => row.id);
  const programs = schoolIds.length ? await pool.query(`select id,slug,name_en,name_zh,degree_level,teaching_language,status,verification_status,source_url
    from programs where school_id=any($1::uuid[]) order by status,slug`, [schoolIds]) : { rows: [] };
  const scholarships = schoolIds.length ? await pool.query(`select id,slug,title,status,verification_status,source_url
    from scholarships where school_id=any($1::uuid[]) order by status,slug`, [schoolIds]) : { rows: [] };
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug in ('chengdu','chengdu-sichuan') or lower(name_en)='chengdu' or name_zh='成都' order by slug");
  console.log(JSON.stringify({ schools: schools.rows, programCount: programs.rows.length, programs: programs.rows, scholarshipCount: scholarships.rows.length, scholarships: scholarships.rows, city: city.rows }, null, 2));
} finally {
  await pool.end();
}
