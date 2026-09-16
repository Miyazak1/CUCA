import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const candidate = JSON.parse(await readFile("seeds/catalog.changan-complete-batch-01.draft.json", "utf8"));
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:changan-candidate-preflight" });
try {
  const slugs = candidate.programs.map((row: any) => row.slug);
  const overlaps = await pool.query("select id,slug,name_en,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [slugs]);
  const schoolPrograms = await pool.query("select id,slug,name_en,status,verification_status,source_url from programs where school_id=(select id from schools where slug='chang-an-university') order by slug");
  const candidateScholarships = candidate.scholarships.map((row: any) => row.slug);
  const scholarshipOverlaps = await pool.query("select id,slug,title,status,verification_status,source_url from scholarships where slug=any($1::text[]) order by slug", [candidateScholarships]);
  const oldScholarships = await pool.query("select id,slug,title,status,verification_status,source_url from scholarships where school_id=(select id from schools where slug='chang-an-university') order by slug");
  const overlapSet = new Set(overlaps.rows.map((row) => row.slug));
  const candidateSet = new Set(slugs);
  console.log(JSON.stringify({ candidateProgramCount: slugs.length, overlappingPrograms: overlaps.rows, newProgramCount: slugs.filter((slug: string) => !overlapSet.has(slug)).length, legacyProgramsNotInCandidate: schoolPrograms.rows.filter((row) => !candidateSet.has(row.slug)), scholarshipOverlaps: scholarshipOverlaps.rows, legacyScholarships: oldScholarships.rows }, null, 2));
} finally { await pool.end(); }
