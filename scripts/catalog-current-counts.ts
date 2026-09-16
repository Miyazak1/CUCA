import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-counts" });
try {
  const result = await pool.query(`
    select
      (select count(*) from schools where status='active')::int schools,
      (select count(*) from schools where status='active' and verification_status='verified')::int verified_schools,
      (select count(*) from programs where status='active')::int programs,
      (select count(*) from programs where status='active' and verification_status='verified')::int verified_programs,
      (select count(*) from programs where status='archived')::int archived_programs,
      (select count(*) from program_intakes)::int program_intakes,
      (select count(*) from scholarships where status='active')::int scholarships,
      (select count(*) from scholarships where status='active' and verification_status='verified')::int verified_scholarships,
      (select count(*) from scholarships where status='archived')::int archived_scholarships
  `);
  console.log(JSON.stringify(result.rows[0], null, 2));
} finally {
  await pool.end();
}
