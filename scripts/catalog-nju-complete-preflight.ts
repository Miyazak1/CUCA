import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const parsed = JSON.parse(await readFile("work/catalog-official/nju-complete-batch-02/parsed-graduate-routes.json", "utf8"));
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programSlug = (route: any) => {
  const identity = [route.degree, route.code, route.teachingLanguage, route.schoolOrDepartment, route.nameEn].join("|");
  const verbose = slugify(["nanjing-university", route.degree, route.code, route.schoolOrDepartment, route.nameEn, route.teachingLanguage].join(" "));
  return verbose.length <= 180 ? verbose : `${verbose.slice(0, 163).replace(/-+$/g, "")}-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
};
const programSlugs = parsed.routes.map(programSlug);
if (new Set(programSlugs).size !== programSlugs.length) throw new Error("Generated NJU graduate slugs are not unique.");
const scholarshipSlugs = [
  "official-2026-nju-cgs-high-level-graduate-program",
  "official-2026-nju-cgs-excellence-program",
  "official-2026-nju-nanjing-government-scholarship",
];
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:nju-complete-preflight" });
try {
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,last_verified_at from schools where slug=$1", ["nanjing-university"]);
  const counts = await pool.query("select degree_level,count(*)::int routes from programs where school_id=(select id from schools where slug=$1) and status='active' group by degree_level order by degree_level", ["nanjing-university"]);
  const related = await pool.query("select (select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug=$1))::int intakes,(select count(*) from scholarships where school_id=(select id from schools where slug=$1) and status='active')::int active_scholarships", ["nanjing-university"]);
  const programConflicts = await pool.query("select slug,name_en,degree_level,teaching_language,status from programs where slug=any($1::text[]) order by slug", [programSlugs]);
  const graduatePrograms = await pool.query("select slug,name_en,name_zh,degree_level,teaching_language,status from programs where school_id=(select id from schools where slug=$1) and degree_level in ('Master','Doctoral') order by degree_level,name_en", ["nanjing-university"]);
  const scholarshipConflicts = await pool.query("select slug,title,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [scholarshipSlugs]);
  const existingScholarships = await pool.query("select slug,title,status,verification_status from scholarships where school_id=(select id from schools where slug=$1) order by slug", ["nanjing-university"]);
  console.log(JSON.stringify({ school: school.rows, activeCounts: counts.rows, relatedCounts: related.rows[0], candidateGraduateRouteCount: programSlugs.length, programSlugConflicts: programConflicts.rows, existingGraduatePrograms: graduatePrograms.rows, scholarshipSlugConflicts: scholarshipConflicts.rows, existingScholarships: existingScholarships.rows }, null, 2));
} finally {
  await pool.end();
}
