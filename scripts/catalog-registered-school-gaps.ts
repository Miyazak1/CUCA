import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const registry = JSON.parse(await readFile("catalog-sources/official-sources.json", "utf8"));
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const registered = [...new Set(registry.sources.map((row: any) => row.schoolSlug).filter(Boolean))].sort() as string[];
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:registered-school-gaps" });
try {
  const schools = await pool.query<any>("select slug,verification_status,status from schools where slug=any($1::text[]) order by slug", [registered]);
  const unregistered = await pool.query<any>(
    `select s.id,s.slug,s.name_en,s.name_zh,s.verification_status,s.status,
            count(distinct p.id) filter(where p.status='active')::int active_programs,
            count(distinct p.id) filter(where p.status='active' and p.verification_status='verified')::int verified_programs,
            count(distinct sc.id) filter(where sc.status='active')::int active_scholarships,
            count(distinct sc.id) filter(where sc.status='active' and sc.verification_status='verified')::int verified_scholarships
       from schools s
       left join programs p on p.school_id=s.id
       left join scholarships sc on sc.school_id=s.id
      where s.status='active' and not(s.slug=any($1::text[]))
      group by s.id
      order by s.verification_status desc,active_programs desc,s.slug`,
    [registered],
  );
  const bySlug = new Map(schools.rows.map((row: any) => [row.slug, row]));
  const sourceCounts = new Map<string, { total: number; roles: Record<string, number> }>();
  for (const row of registry.sources) {
    if (!row.schoolSlug) continue;
    const value = sourceCounts.get(row.schoolSlug) ?? { total: 0, roles: {} };
    value.total += 1;
    value.roles[row.sourceRole] = (value.roles[row.sourceRole] ?? 0) + 1;
    sourceCounts.set(row.schoolSlug, value);
  }
  console.log(JSON.stringify({ registeredSchoolCount: registered.length, databaseMatchCount: schools.rows.length, missing: registered.filter((slug) => !bySlug.has(slug)).map((slug) => ({ slug, ...sourceCounts.get(slug) })), unverified: registered.filter((slug) => bySlug.get(slug)?.verification_status !== "verified").map((slug) => ({ slug, database: bySlug.get(slug) ?? null, ...sourceCounts.get(slug) })), unregisteredActiveSchoolCount: unregistered.rows.length, unregisteredActiveSchools: unregistered.rows }, null, 2));
} finally { await pool.end(); }
