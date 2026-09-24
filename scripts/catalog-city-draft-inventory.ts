import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const outputPath = resolve(root, process.argv[2] || "work/city-data/city-inventory.json");
const richDraftSlugs = new Set((await readdir(resolve(root, "seeds")))
  .map(name => name.match(/^catalog\.([a-z0-9-]+)-city-rich-batch-\d+\.draft\.json$/)?.[1])
  .filter((slug): slug is string => Boolean(slug)));
const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:city-draft-inventory" });

try {
  const { rows } = await pool.query<Record<string, unknown>>(`
    select c.slug, c.name_en as "nameEn", c.name_zh as "nameZh", c.province, c.region,
      c.status, c.verification_status as "verificationStatus",
      array_remove(array_agg(distinct nullif(s.region, '')), null) as "schoolRegions",
      array_remove(array_agg(distinct s.slug), null) as "schoolSlugs",
      count(distinct s.id) filter (where s.status = 'active')::int as "schoolCount",
      count(distinct p.id) filter (where p.status = 'active' and s.status = 'active')::int as "programCount",
      count(distinct p.id) filter (where p.status = 'active' and s.status = 'active'
        and lower(trim(p.teaching_language)) in ('english','english-taught','英文授课'))::int as "englishProgramCount",
      count(distinct pi.id) filter (where pi.status = 'open' and p.status = 'active' and s.status = 'active'
        and (pi.open_date is null or pi.open_date <= clock_timestamp())
        and (pi.deadline_date is null or pi.deadline_date > clock_timestamp())
        and (pi.open_date is null or pi.deadline_date is null or pi.open_date < pi.deadline_date))::int as "openIntakeCount",
      (select count(distinct sch.id)::int from scholarships sch
        left join programs sp on sp.id = sch.program_id and sp.status = 'active'
        left join schools ss on ss.id = coalesce(sch.school_id, sp.school_id) and ss.status = 'active'
        where sch.status = 'active' and sch.verification_status = 'verified'
          and coalesce(sp.city_id, ss.city_id) = c.id) as "scholarshipCount"
    from cities c
    left join schools s on s.city_id = c.id
    left join programs p on p.school_id = s.id and coalesce(p.city_id, s.city_id) = c.id
    left join program_intakes pi on pi.program_id = p.id
    where c.slug !~ '^local-'
    group by c.id
    order by count(distinct p.id) filter (where p.status = 'active' and s.status = 'active') desc,
      count(distinct s.id) filter (where s.status = 'active') desc, c.name_en asc
  `);
  const cities = rows.map((row, index) => {
    const missingIdentityFields = ["nameEn", "nameZh", "province", "region"].filter(field => !row[field]);
    return {
      ...row,
      dataPriority: index < 10 ? "priority" : "backlog",
      identityCompleteness: missingIdentityFields.length === 0 ? "complete" : "incomplete",
      missingIdentityFields,
      richDataState: richDraftSlugs.has(String(row.slug)) ? "draft_available" : "not_started",
      publicationReady: false,
    };
  });
  const inventory = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "local catalog relations; unpublished city records included for production planning only",
    cityCount: rows.length,
    summary: {
      priorityCities: cities.filter(city => city.dataPriority === "priority").length,
      identityComplete: cities.filter(city => city.identityCompleteness === "complete").length,
      identityIncomplete: cities.filter(city => city.identityCompleteness === "incomplete").length,
      richDraftAvailable: cities.filter(city => city.richDataState === "draft_available").length,
      publicationReady: 0,
    },
    cities,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, cityCount: rows.length, summary: inventory.summary, priorityCities: rows.slice(0, 10).map(row => row.slug) }, null, 2));
} finally {
  await pool.end();
}
