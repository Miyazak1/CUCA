import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Usage: npx tsx scripts/catalog-school-preflight.ts <school-slug>");
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:school-preflight" });
try {
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,source_url,source_label,last_verified_at from schools where slug=$1", [slug]);
  const schoolId = school.rows[0]?.id;
  const programs = schoolId ? await pool.query("select id,slug,name_en,degree_level,teaching_language,status,verification_status,source_url from programs where school_id=$1 order by status,slug", [schoolId]) : { rows: [] };
  const intakes = schoolId ? await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [schoolId]) : { rows: [{ count: 0 }] };
  const scholarships = schoolId ? await pool.query("select id,slug,title,status,verification_status,source_url,last_verified_at,jsonb_array_length(benefit_items) benefit_count,jsonb_array_length(eligibility_items) eligibility_count,jsonb_array_length(application_materials) material_count,jsonb_array_length(application_steps) step_count,jsonb_array_length(action_links) action_link_count from scholarships where school_id=$1 order by status,slug", [schoolId]) : { rows: [] };
  console.log(JSON.stringify({ school: school.rows, programs: programs.rows, intakeCount: intakes.rows[0]?.count ?? 0, scholarships: scholarships.rows }, null, 2));
} finally { await pool.end(); }
