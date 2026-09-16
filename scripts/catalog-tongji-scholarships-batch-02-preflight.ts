import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const slugs = ["official-2026-tongji-cgs-high-level-graduate-program", "official-2026-tongji-shanghai-government-scholarship", "official-2026-tongji-international-student-excellence-scholarship"];
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:tongji-scholarship-preflight" });
try {
  const school = await pool.query("select id,slug,name_en,status,verification_status from schools where slug=$1", ["tongji-university"]);
  const programs = await pool.query("select degree_level,count(*)::int routes from programs where school_id=(select id from schools where slug=$1) and status='active' group by degree_level order by degree_level", ["tongji-university"]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug=$1)", ["tongji-university"]);
  const conflicts = await pool.query("select slug,title,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [slugs]);
  const scholarships = await pool.query("select slug,title,status,verification_status from scholarships where school_id=(select id from schools where slug=$1) order by slug", ["tongji-university"]);
  console.log(JSON.stringify({ school: school.rows, programs: programs.rows, intakeCount: intakes.rows[0]?.count, candidateScholarshipCount: slugs.length, conflicts: conflicts.rows, existingScholarships: scholarships.rows }, null, 2));
} finally { await pool.end(); }
