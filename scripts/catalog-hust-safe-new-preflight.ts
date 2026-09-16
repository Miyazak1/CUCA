import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const state=JSON.parse(await readFile(".cuac-local/runtime.json","utf8"));
const candidate=JSON.parse(await readFile("seeds/catalog.hust-complete-batch-01.draft.json","utf8"));
const pool=createPostgresPool({databaseUrl:localDatabaseUrl(state),max:1,applicationName:"cuac:hust-safe-new-preflight"});
try{
 const school=await pool.query("select id,status,verification_status,source_url from schools where slug='huazhong-university-of-science-and-technology'");
 const programs=await pool.query("select slug,status,verification_status,source_url from programs where school_id=$1 order by slug",[school.rows[0]?.id]);
 const scholarships=await pool.query("select id,slug,status,verification_status,source_url from scholarships where school_id=$1 order by slug",[school.rows[0]?.id]);
 const programConflicts=await pool.query("select slug from programs where slug=any($1::text[]) order by slug",[candidate.programs.map((row:any)=>row.slug)]);
 const scholarshipConflicts=await pool.query("select slug from scholarships where slug=any($1::text[]) order by slug",[candidate.scholarships.map((row:any)=>row.slug)]);
 console.log(JSON.stringify({school:school.rows,programCount:programs.rows.length,programs:programs.rows,scholarships:scholarships.rows,programCandidateConflicts:programConflicts.rows,scholarshipCandidateConflicts:scholarshipConflicts.rows},null,2));
}finally{await pool.end();}
