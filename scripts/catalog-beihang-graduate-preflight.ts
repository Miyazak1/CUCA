import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const parsed = JSON.parse(await readFile("work/catalog-official/beihang-graduate-batch-01/parsed-graduate-routes.json", "utf8"));
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slugs = parsed.routes.map((route: any) => slugify([
  "beihang-university", route.degreeLevel, route.schoolEn, route.nameEn, route.teachingLanguage,
].join(" ")));
if (new Set(slugs).size !== slugs.length) throw new Error("Generated Beihang graduate program slugs are not unique.");

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:beihang-graduate-preflight" });
try {
  const school = await pool.query("select id,slug,name_en,name_zh,status,verification_status,last_verified_at from schools where slug=$1", ["beihang-university"]);
  const counts = await pool.query("select degree_level,count(*)::int routes from programs where school_id=(select id from schools where slug=$1) and status='active' group by degree_level order by degree_level", ["beihang-university"]);
  const slugConflicts = await pool.query("select slug,name_en,degree_level,teaching_language,status from programs where slug=any($1::text[]) order by slug", [slugs]);
  const semanticConflicts = await pool.query("select slug,name_en,name_zh,degree_level,teaching_language,status from programs where school_id=(select id from schools where slug=$1) and degree_level in ('Master','Doctoral') order by degree_level,name_en", ["beihang-university"]);
  console.log(JSON.stringify({ school: school.rows, activeCounts: counts.rows, candidateRouteCount: slugs.length, slugConflicts: slugConflicts.rows, semanticConflicts: semanticConflicts.rows }, null, 2));
} finally {
  await pool.end();
}
