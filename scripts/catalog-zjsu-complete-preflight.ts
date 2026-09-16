import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const extracted = JSON.parse(await readFile(resolve(root, "work/catalog-official/zjsu-complete-batch-01/programs.extracted.json"), "utf8"));
const schoolSlug = "zhejiang-gongshang-university";
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:zjsu-complete-preflight" });

try {
  const schoolResult = await pool.query("select id,slug,name_en,name_zh,status,verification_status,source_url from schools where slug=$1", [schoolSlug]);
  if (schoolResult.rows.length !== 1) throw new Error(`Expected one ZJSU school, found ${schoolResult.rows.length}.`);
  const school = schoolResult.rows[0];
  const [programs, intakes, scholarships] = await Promise.all([
    pool.query("select id,slug,name_en,degree_level,teaching_language,status,verification_status,source_url from programs where school_id=$1 order by slug", [school.id]),
    pool.query("select pi.id,p.slug program_slug,pi.intake_term,pi.intake_year,pi.status from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1 order by p.slug,pi.intake_year,pi.intake_term", [school.id]),
    pool.query("select id,slug,title,type,status,verification_status,source_url from scholarships where school_id=$1 order by slug", [school.id]),
  ]);
  console.log(JSON.stringify({
    school,
    databaseCounts: { programs: programs.rows.length, intakes: intakes.rows.length, scholarships: scholarships.rows.length },
    programs: programs.rows,
    intakes: intakes.rows,
    scholarships: scholarships.rows,
    extractedCounts: extracted.counts,
  }, null, 2));
} finally {
  await pool.end();
}
