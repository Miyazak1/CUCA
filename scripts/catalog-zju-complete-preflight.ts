import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const parsed = JSON.parse(await readFile("work/catalog-official/zju-complete-batch-01/parsed-graduate-routes.json", "utf8"));
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const routeIdentity = (route: any) => [route.degree, route.teachingLanguage, route.schoolOrDepartment, route.nameEn].join("|");
const programSlug = (route: any) => {
  const verbose = slugify(["zhejiang-university", route.degree, route.schoolOrDepartment, route.nameEn, route.teachingLanguage].join(" "));
  return verbose.length <= 180 ? verbose : `${verbose.slice(0, 163).replace(/-+$/g, "")}-${createHash("sha256").update(routeIdentity(route)).digest("hex").slice(0, 16)}`;
};
const programSlugs = parsed.routes.map(programSlug);
if (new Set(programSlugs).size !== programSlugs.length) throw new Error("Generated ZJU graduate program slugs are not unique.");
const scholarshipSlugs = [
  "official-2026-zju-chinese-government-scholarship-bilateral-program",
  "official-2026-zju-chinese-government-scholarship-university-program",
  "official-2026-zju-zhejiang-government-graduate-scholarship",
  "official-2026-zju-ism-master-freshman-scholarship",
];

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:zju-complete-preflight" });
try {
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,last_verified_at from schools where slug=$1", ["zhejiang-university"]);
  const counts = await pool.query("select degree_level,count(*)::int routes from programs where school_id=(select id from schools where slug=$1) and status='active' group by degree_level order by degree_level", ["zhejiang-university"]);
  const programSlugConflicts = await pool.query("select slug,name_en,degree_level,teaching_language,status from programs where slug=any($1::text[]) order by slug", [programSlugs]);
  const graduatePrograms = await pool.query("select slug,name_en,name_zh,degree_level,teaching_language,status from programs where school_id=(select id from schools where slug=$1) and degree_level in ('Master','Doctoral') order by degree_level,name_en", ["zhejiang-university"]);
  const scholarshipSlugConflicts = await pool.query("select slug,title,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [scholarshipSlugs]);
  const existingScholarships = await pool.query("select slug,title,status,verification_status from scholarships where school_id=(select id from schools where slug=$1) order by slug", ["zhejiang-university"]);
  const relatedCounts = await pool.query("select (select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug=$1))::int intakes,(select count(*) from scholarships where school_id=(select id from schools where slug=$1) and status='active')::int active_scholarships", ["zhejiang-university"]);
  console.log(JSON.stringify({ school: school.rows, activeCounts: counts.rows, relatedCounts: relatedCounts.rows[0], candidateGraduateRouteCount: programSlugs.length, programSlugConflicts: programSlugConflicts.rows, existingGraduatePrograms: graduatePrograms.rows, scholarshipSlugConflicts: scholarshipSlugConflicts.rows, existingScholarships: existingScholarships.rows }, null, 2));
} finally {
  await pool.end();
}
