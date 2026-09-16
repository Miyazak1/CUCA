import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:top300-progress" });
try {
  const result = await pool.query(`
    select s.id,s.slug,s.name_en,s.name_zh,s.ranking,s.verification_status,s.source_url,
      count(distinct p.id) filter (where p.status='active')::int program_count,
      count(distinct p.id) filter (where p.status='active' and p.verification_status='verified')::int verified_program_count,
      count(distinct sc.id) filter (where sc.status='active')::int scholarship_count,
      count(distinct sc.id) filter (where sc.status='active' and sc.verification_status='verified')::int verified_scholarship_count
    from schools s
    left join programs p on p.school_id=s.id
    left join scholarships sc on sc.school_id=s.id
    where s.status='active'
    group by s.id
    order by case when s.ranking ~ '^[0-9]+$' then s.ranking::int else 999999 end, s.name_en
  `);
  const rows = result.rows.map((row) => ({ ...row, complete: row.verification_status === "verified" && row.program_count > 0 && row.program_count === row.verified_program_count && row.scholarship_count > 0 && row.scholarship_count === row.verified_scholarship_count }));
  console.log(JSON.stringify({ totalActiveSchools: rows.length, completeCount: rows.filter((row) => row.complete).length, incompleteCount: rows.filter((row) => !row.complete).length, incomplete: rows.filter((row) => !row.complete).slice(0, 100) }, null, 2));
} finally { await pool.end(); }
