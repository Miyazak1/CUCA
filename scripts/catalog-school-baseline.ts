import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const schoolSlug = process.argv[2];
if (!schoolSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(schoolSlug)) {
  throw new Error("Usage: npm exec tsx -- scripts/catalog-school-baseline.ts <school-slug>");
}

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:school-baseline" });
try {
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,source_url from schools where slug=$1", [schoolSlug]);
  if (school.rows.length !== 1) throw new Error(`School not found: ${schoolSlug}`);
  const schoolId = school.rows[0].id;
  const [programs, intakes, scholarships] = await Promise.all([
    pool.query("select id,slug,name_en,degree_level,status,verification_status,source_url from programs where school_id=$1 order by status,degree_level,name_en,slug", [schoolId]),
    pool.query("select pi.id,p.slug program_slug,pi.intake_year,pi.status,pi.deadline_date from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1 order by p.slug,pi.intake_year", [schoolId]),
    pool.query("select id,slug,title,name_zh,type,type_label,funding_level,deadline_date,status,verification_status,source_url from scholarships where school_id=$1 order by status,title,slug", [schoolId]),
  ]);
  console.log(JSON.stringify({ school: school.rows[0], programs: programs.rows, programIntakes: intakes.rows, scholarships: scholarships.rows }, null, 2));
} finally {
  await pool.end();
}
