import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const summaryOnly = process.argv.includes("--summary");
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:scu-complete-preflight" });
try {
  const schoolSlug = "sichuan-university";
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,source_url,source_label,last_verified_at,city_id from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug in ('chengdu','chengdu-sichuan') or lower(name_en)='chengdu' or name_zh='成都' order by slug", []);
  const programs = await pool.query("select degree_level,count(*)::int routes,count(*) filter(where verification_status='verified')::int verified from programs where school_id=(select id from schools where slug=$1) and status='active' group by degree_level order by degree_level", [schoolSlug]);
  const programRows = await pool.query(`select id,slug,name_en,name_zh,degree_level,teaching_language,duration_years,status,verification_status,source_url
    from programs where school_id=(select id from schools where slug=$1) order by status,slug${summaryOnly ? " limit 1" : ""}`, [schoolSlug]);
  const programCount = await pool.query("select count(*)::int count from programs where school_id=(select id from schools where slug=$1) and status='active'", [schoolSlug]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug=$1)", [schoolSlug]);
  const scholarships = await pool.query("select id,slug,title,status,verification_status,source_url from scholarships where school_id=(select id from schools where slug=$1) order by status,slug", [schoolSlug]);
  console.log(JSON.stringify({
    school: school.rows,
    city: city.rows,
    programs: programs.rows,
    ...(summaryOnly ? { sampleProgram: programRows.rows[0] ?? null } : { programRows: programRows.rows }),
    programCount: programCount.rows[0]?.count,
    intakeCount: intakes.rows[0]?.count,
    scholarships: scholarships.rows,
  }, null, 2));
} finally {
  await pool.end();
}
