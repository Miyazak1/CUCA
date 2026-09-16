import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({
  databaseUrl: localDatabaseUrl(state),
  max: 1,
  applicationName: "cuac:dhu-preflight",
});

try {
  const school = await pool.query(
    `select id, slug, name_en, name_zh, status, verification_status, source_url
       from schools
      where slug = 'donghua-university'`,
  );
  if (school.rows.length !== 1) throw new Error("Donghua University school row not found.");
  const schoolId = school.rows[0].id;
  const programs = await pool.query(
    `select id, slug, name_en, name_zh, degree_level, teaching_language,
            tuition_amount, tuition_currency, status, verification_status, source_url
       from programs
      where school_id = $1
      order by status, degree_level, name_en, slug`,
    [schoolId],
  );
  const intakes = await pool.query(
    `select pi.id, p.slug as program_slug, pi.intake_term, pi.intake_year,
            pi.deadline_date, pi.status
       from program_intakes pi
       join programs p on p.id = pi.program_id
      where p.school_id = $1
      order by p.slug, pi.intake_year, pi.intake_term`,
    [schoolId],
  );
  const scholarships = await pool.query(
    `select id, slug, title, status, verification_status, source_url
       from scholarships
      where school_id = $1
      order by status, slug`,
    [schoolId],
  );
  console.log(JSON.stringify({ school: school.rows[0], programs: programs.rows, intakes: intakes.rows, scholarships: scholarships.rows }, null, 2));
} finally {
  await pool.end();
}
