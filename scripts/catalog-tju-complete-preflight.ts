import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({
  databaseUrl: localDatabaseUrl(state),
  max: 1,
  applicationName: "cuac:tju-complete-preflight",
});

try {
  const schoolSlug = "tianjin-university";
  const school = await pool.query(
    "select id,slug,name_en,name_zh,status,verification_status,source_url,source_label,last_verified_at from schools where slug=$1",
    [schoolSlug],
  );
  const city = await pool.query(
    "select id,slug,name_en,name_zh,status,verification_status,source_url from cities where slug=$1",
    ["tianjin"],
  );
  const programs = await pool.query(
    "select degree_level,count(*)::int routes,count(*) filter(where verification_status='verified')::int verified from programs where school_id=(select id from schools where slug=$1) and status='active' group by degree_level order by degree_level",
    [schoolSlug],
  );
  const programRows = await pool.query(
    "select slug,name_en,degree_level,teaching_language,status,verification_status,source_url from programs where school_id=(select id from schools where slug=$1) and status='active' order by slug",
    [schoolSlug],
  );
  const intakes = await pool.query(
    "select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug=$1)",
    [schoolSlug],
  );
  const scholarships = await pool.query(
    "select id,slug,title,status,verification_status,source_url from scholarships where school_id=(select id from schools where slug=$1) order by slug",
    [schoolSlug],
  );
  console.log(
    JSON.stringify(
      {
        school: school.rows,
        city: city.rows,
        programs: programs.rows,
        programRows: programRows.rows,
        intakeCount: intakes.rows[0]?.count,
        scholarships: scholarships.rows,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
