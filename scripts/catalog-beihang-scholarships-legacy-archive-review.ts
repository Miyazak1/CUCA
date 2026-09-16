import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root=process.cwd(),paths={approval:resolve(root,"seeds/catalog.beihang-scholarships-complete-batch-01.approval.json"),publication:resolve(root,"seeds/catalog.beihang-scholarships-complete-batch-01.approved.local.json"),review:resolve(root,"seeds/catalog.beihang-scholarships-legacy-archive.review.json"),state:resolve(root,".cuac-local/runtime.json")};
const sha=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const [approvalText,publicationText,stateText]=await Promise.all([readFile(paths.approval,"utf8"),readFile(paths.publication,"utf8"),readFile(paths.state,"utf8")]);
const approval=JSON.parse(approvalText),publication=JSON.parse(publicationText),state=JSON.parse(stateText),candidateSlugs:string[]=approval.scholarshipSlugs;
if(candidateSlugs?.length!==10||publication.scholarships?.length!==10||approval.archivedScholarshipAliases?.length!==0)throw new Error("Beihang safe-new publication artifact changed.");
const pool=createPostgresPool({databaseUrl:localDatabaseUrl(state),max:1,applicationName:"cuac:beihang-scholarships-legacy-archive-review"});let baseline:any;
try{
 const school=await pool.query("select id,status,verification_status from schools where slug='beihang-university'");
 const programs=await pool.query("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active'",[school.rows[0]?.id]);
 const active=await pool.query("select id,slug,status,verification_status,source_url,last_verified_at,jsonb_array_length(benefit_items)::text benefit_count,jsonb_array_length(application_materials)::text material_count,jsonb_array_length(application_steps)::text step_count,jsonb_array_length(action_links)::text action_count from scholarships where school_id=$1 and status='active' order by slug",[school.rows[0]?.id]);
 baseline={school:school.rows,programs:programs.rows,active:active.rows};
 if(school.rows.length!==1||school.rows[0].status!=="active"||school.rows[0].verification_status!=="verified"||programs.rows[0]?.active_count!=="264"||programs.rows[0]?.verified_count!=="264"||active.rows.length!==12)throw new Error(`Beihang archive baseline changed: ${JSON.stringify(baseline)}`);
 const legacy=active.rows.find((row:any)=>row.slug==="beihang-university"),stable=active.rows.find((row:any)=>row.slug==="official-2026-beihang-high-level-postgraduate-scholarship"),candidates=active.rows.filter((row:any)=>candidateSlugs.includes(row.slug));
 if(!legacy||legacy.verification_status!=="unverified"||!stable||stable.verification_status!=="verified"||candidates.length!==10||candidates.some((row:any)=>row.verification_status!=="verified"||row.last_verified_at?.toISOString()!==approval.approvedAt||[row.benefit_count,row.material_count,row.step_count,row.action_count].some((v:string)=>Number(v)<1)))throw new Error("Beihang archive reconciliation rows changed.");
}finally{await pool.end();}
const legacy=baseline.active.find((row:any)=>row.slug==="beihang-university");
const reviewBase={version:1,status:"requires_explicit_approval",generatedAt:new Date().toISOString(),scope:{schoolSlug:"beihang-university",archiveScholarshipAliasCount:1,insertCount:0,overwriteCount:0,deleteCount:0},publicationEvidence:{approvalSha256:sha(approvalText),publicationSha256:sha(publicationText),publishedScholarshipSlugs:candidateSlugs},reconciliation:{destructiveDeletion:false,archive:{entityType:"scholarship",id:legacy.id,slug:legacy.slug,reason:"The unverified third-party merged overview has been superseded by eleven independently scoped verified official scholarship records."},databaseBaseline:{schoolId:baseline.school[0].id,legacyScholarshipId:legacy.id,activeScholarshipCount:12,verifiedScholarshipCount:11}},sensitiveDataCheck:{result:"pass",scope:"archive operation only",note:"The operation changes only the catalog status of one public unverified scholarship alias; it reads or writes no applicant or personal data."},reviewNotes:["No school, program, intake or verified scholarship field will be changed.","The operation is a recoverable status archive, not a physical delete.","After archive, Beihang will have 11 active scholarships and all 11 will be verified."]};
const reviewHash=sha(JSON.stringify(reviewBase));
const requiredApproval=`批准归档北京航空航天大学 1 条旧奖学金合并概览（审核哈希 ${reviewHash}）`;
await writeFile(paths.review,`${JSON.stringify({...reviewBase,reviewHash,requiredApproval},null,2)}\n`,"utf8");
console.log(JSON.stringify({ok:true,reviewHash,requiredApproval,scope:reviewBase.scope,paths},null,2));
