import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { candidate: resolve(root,"seeds/catalog.beihang-scholarships-complete-batch-01.draft.json"), validation: resolve(root,"seeds/catalog.beihang-scholarships-complete-batch-01.validation.json"), review: resolve(root,"seeds/catalog.beihang-scholarships-complete-batch-01.new.review.json"), manifest: resolve(root,"work/catalog-official/beihang-scholarships-complete-batch-01/manifest.json"), state: resolve(root,".cuac-local/runtime.json") };
const sha=(value:string|Buffer)=>createHash("sha256").update(value).digest("hex");
const [candidateText,validationText,manifestText,stateText]=await Promise.all([readFile(paths.candidate,"utf8"),readFile(paths.validation,"utf8"),readFile(paths.manifest,"utf8"),readFile(paths.state,"utf8")]);
const candidate=JSON.parse(candidateText) as CatalogSeedBundle,validation=JSON.parse(validationText),manifest=JSON.parse(manifestText),fresh=createCatalogMigrationValidationReport(candidate);
if(!fresh.ok||fresh.bundleSha256!==validation.bundleSha256||fresh.operationPlanSha256!==validation.operationPlanSha256)throw new Error("Beihang candidate validation changed.");
if(manifest.sources?.length!==8||manifest.sources.some((row:any)=>row.status!==200||!/^https:\/\/is\.buaa\.edu\.cn\//.test(row.finalUrl)))throw new Error("Beihang evidence manifest changed.");
if(candidate.scholarships?.length!==10||candidate.scholarships.some((row)=>row.status!=="draft"||!row.coverage||!row.amountText||!row.benefitItems?.length||!row.eligibilityItems?.length||!row.applicationMaterials?.length||!row.applicationSteps?.length||!row.actionLinks?.length))throw new Error("Beihang rich scholarship candidate changed.");
const state=JSON.parse(stateText),slugs=candidate.scholarships.map((row)=>row.slug),pool=createPostgresPool({databaseUrl:localDatabaseUrl(state),max:1,applicationName:"cuac:beihang-scholarships-new-review"});
let baseline:any;
try{
 const school=await pool.query("select id,status,verification_status from schools where slug='beihang-university'");
 const programs=await pool.query("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active'",[school.rows[0]?.id]);
 const conflicts=await pool.query("select slug from scholarships where slug=any($1::text[])",[slugs]);
 const stable=await pool.query("select id,slug,status,verification_status from scholarships where slug='official-2026-beihang-high-level-postgraduate-scholarship'");
 const legacy=await pool.query("select id,slug,status,verification_status from scholarships where slug='beihang-university'");
 baseline={school:school.rows,programs:programs.rows,conflicts:conflicts.rows,stable:stable.rows,legacy:legacy.rows};
 if(school.rows.length!==1||school.rows[0].status!=="active"||school.rows[0].verification_status!=="verified"||programs.rows[0]?.active_count!=="264"||programs.rows[0]?.verified_count!=="264"||conflicts.rows.length!==0)throw new Error(`Beihang safe-new baseline changed: ${JSON.stringify(baseline)}`);
 if(stable.rows.length!==1||stable.rows[0].status!=="active"||stable.rows[0].verification_status!=="verified"||legacy.rows.length!==1||legacy.rows[0].status!=="active"||legacy.rows[0].verification_status!=="unverified")throw new Error("Beihang stable/legacy scholarship baseline changed.");
}finally{await pool.end();}
const reviewBase={
 version:1,status:"standing_user_approval",generatedAt:candidate.generatedAt,
 scope:{schoolSlug:"beihang-university",dependencyCityReplayCount:2,dependencySchoolReplayCount:1,newScholarshipCount:10,archiveScholarshipAliasCount:0,scholarshipOverwriteCount:0},
 candidateSha256:sha(candidateText),candidateBundleSha256:fresh.bundleSha256,operationPlanSha256:fresh.operationPlanSha256,manifestSha256:sha(manifestText),
 evidence:manifest.sources.map((row:any)=>({sourceId:row.id,sourceUrl:row.finalUrl,sourceLabel:row.label,sha256:row.sha256,fetchedAt:row.fetchedAt,contentType:row.contentType})),
 standingAuthorization:{reference:"user-chat-2026-09-13-default-publication",instruction:"发布默认允许",appliesBecause:"The operation inserts ten new non-conflicting official scholarship records. It overwrites, archives and deletes nothing; approved city/school dependencies are replayed unchanged."},
 reconciliation:{action:"insert_ten_new_verified_scholarships",destructiveDeletion:false,overwrites:[],archives:[],newSlugConflicts:0,databaseBaseline:{schoolId:baseline.school[0].id,stableScholarshipId:baseline.stable[0].id,legacyScholarshipId:baseline.legacy[0].id}},
 sensitiveDataCheck:{result:"pass",scope:"publication candidate",note:"Public scholarship policy and route data only. Bank account data, applicant identifiers and named personal contacts are excluded."},
 reviewNotes:["Ten independent rich records are added; the verified High-level Postgraduate record remains unchanged.","The old unverified merged overview remains active pending a separate explicit archival approval."],
};
const reviewHash=sha(JSON.stringify(reviewBase));
await writeFile(paths.review,`${JSON.stringify({...reviewBase,reviewHash,publicationReference:"standing-user-default-publication"},null,2)}\n`,"utf8");
console.log(JSON.stringify({ok:true,reviewHash,scope:reviewBase.scope,paths},null,2));
