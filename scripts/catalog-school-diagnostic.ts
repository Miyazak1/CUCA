import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const schoolSlug = process.argv.find(arg => arg.startsWith("--school="))?.slice("--school=".length);
if (!schoolSlug) throw new Error("Use --school=<school-slug>.");
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-school-diagnostic" });
try {
  const school = (await pool.query(`select id, slug, name_en, name_zh, city, city_zh, city_slug, province, source_url, source_label, verification_status from schools where slug=$1`, [schoolSlug])).rows[0];
  if (!school) throw new Error(`Unknown school ${schoolSlug}.`);
  const programs = (await pool.query(`
    select p.slug, p.name_en, p.name_zh, p.degree_level, p.field_category, p.subject_area,
      p.teaching_language, p.source_url, p.source_label, p.verification_status, c.slug city_slug
    from programs p left join cities c on c.id=p.city_id
    where p.school_id=$1 and p.status='active'
    order by p.slug
  `, [school.id])).rows;
  const scholarships = (await pool.query(`select slug, title, source_url, source_label, verification_status from scholarships where school_id=$1 and status='active' order by slug`, [school.id])).rows;
  console.log(JSON.stringify({ school, programCount: programs.length, programs, scholarshipCount: scholarships.length, scholarships }, null, 2));
} finally {
  await pool.end();
}
