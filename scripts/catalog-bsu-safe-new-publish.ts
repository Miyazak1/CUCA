import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root=process.cwd(), batch="bsu-safe-new-batch-01", prefix=`catalog.${batch}`, schoolSlug="beijing-sport-university";
const paths={candidate:resolve(root,`seeds/${prefix}.draft.json`),validation:resolve(root,`seeds/${prefix}.validation.json`),review:resolve(root,`seeds/${prefix}.review.json`),output:resolve(root,`seeds/${prefix}.approved.local.json`),approval:resolve(root,`seeds/${prefix}.approval.json`),state:resolve(root,".cuac-local/runtime.json")};
const parse=async(path:string)=>JSON.parse(await readFile(path,"utf8"));
const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
const [candidateText,validation,review,state,oldApproval]=await Promise.all([readFile(paths.candidate,"utf8"),parse(paths.validation),parse(paths.review),parse(paths.state),parse(paths.approval).catch(()=>null)]);
const candidate=JSON.parse(candidateText) as CatalogSeedBundle;
const {reviewHash,publicationReference,...reviewBase}=review;
if(sha(JSON.stringify(reviewBase))!==reviewHash||publicationReference!==`standing-authorized-${batch}-${reviewHash}`) throw new Error("BSU review hash mismatch.");
const fresh=createCatalogMigrationValidationReport(candidate);
if(!fresh.ok||!validation.ok||sha(candidateText)!==review.candidateSha256||fresh.bundleSha256!==review.candidateBundleSha256||fresh.bundleSha256!==validation.bundleSha256||fresh.operationPlanSha256!==review.operationPlanSha256||fresh.operationPlanSha256!==validation.operationPlanSha256) throw new Error("BSU candidate changed after review.");
if(review.status!=="standing_user_approval"||review.standingAuthorization?.instruction!=="发布默认允许"||review.sourceReview?.result!=="pass"||review.sensitiveDataCheck?.result!=="pass"||review.reconciliation?.destructiveDeletion!==false||review.scope?.newProgramCount!==96||review.scope?.newProgramIntakeCount!==96||review.scope?.newScholarshipCount!==1||review.scope?.overwriteCount!==0||review.scope?.archiveCount!==0) throw new Error("BSU batch is not standing-authorized.");
if(candidate.cities?.length!==1||candidate.schools?.length!==1||candidate.programs?.length!==96||candidate.programIntakes?.length!==96||candidate.scholarships?.length!==1) throw new Error("BSU candidate scope changed.");
const approvedAt=oldApproval?.approvedAt??new Date().toISOString();
const sourceSchemaSha256=sha(JSON.stringify({cityFields:[...new Set(candidate.cities.flatMap(Object.keys))].sort(),schoolFields:[...new Set(candidate.schools.flatMap(Object.keys))].sort(),programFields:[...new Set(candidate.programs.flatMap(Object.keys))].sort(),intakeFields:[...new Set(candidate.programIntakes.flatMap(Object.keys))].sort(),scholarshipFields:[...new Set(candidate.scholarships.flatMap(Object.keys))].sort()}));
const publication:CatalogSeedBundle={version:2,generatedAt:approvedAt,handoff:{sourceSystem:"CUAC reviewed official Beijing Sport University 2026 catalog, admissions guide and scholarship notice",cleanedExportName:`${prefix}.draft.json`,cleanedExportSha256:fresh.bundleSha256,sourceSchemaSha256,reviewReference:publicationReference,prohibitedDataReviewReference:publicationReference,approvalRecordedAt:approvedAt,sourceReadOnly:true,prohibitedDataConfirmedExcluded:true},cities:candidate.cities.map(row=>({...row,status:"active" as const})),schools:candidate.schools.map(row=>({...row,status:"active" as const})),programs:candidate.programs.map(row=>({...row,status:"active" as const,verificationStatus:"verified" as const,lastVerifiedAt:approvedAt})),programIntakes:candidate.programIntakes,scholarships:candidate.scholarships.map(row=>({...row,status:"active" as const,verificationStatus:"verified" as const,lastVerifiedAt:approvedAt}))};
const report=createCatalogMigrationValidationReport(publication);
if(!report.ok||report.summary.programs!==96||report.summary.programIntakes!==96||report.summary.scholarships!==1) throw new Error(`Invalid BSU publication: ${report.errors.join(" ")}`);
const programSlugs=publication.programs!.map(row=>row.slug),scholarshipSlugs=publication.scholarships!.map(row=>row.slug);
const approval={version:1,approvedAt,approvalMode:"standing-user-default-publication",reviewReference:publicationReference,approvedReviewSha256:reviewHash,approvedCandidateFileSha256:sha(candidateText),approvedCandidateBundleSha256:fresh.bundleSha256,publicationBundle:`seeds/${prefix}.approved.local.json`,publicationBundleSha256:report.bundleSha256,schoolSlug,programSlugs,scholarshipSlugs,archivedProgramAliases:[],archivedScholarshipAliases:[],prohibitedDataConfirmedExcluded:true};
async function writeOrVerify(path:string,value:unknown){const body=`${JSON.stringify(value,null,2)}\n`;try{await writeFile(path,body,{encoding:"utf8",flag:"wx"});}catch(error:any){if(error?.code!=="EEXIST")throw error;if(await readFile(path,"utf8")!==body)throw new Error(`Existing artifact differs: ${path}`);}}
await writeOrVerify(paths.output,publication);await writeOrVerify(paths.approval,approval);
const target=assertLocalCatalogPublishTarget(state,publication,LOCAL_CATALOG_PUBLISH_CONFIRMATION,publicationReference);
const pool=createPostgresPool({databaseUrl:target.databaseUrl,max:1,applicationName:"cuac:bsu-safe-new-publish"});
try{
 const client=createTransactionalSqlClient(pool);
 const result=await client.transaction(async tx=>{
  const schoolBefore=await tx.query<any>("select id,to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1",[schoolSlug]);
  const oldProgramsBefore=await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.school_id=$1 and not(p.slug=any($2::text[]))",[schoolBefore[0]?.id,programSlugs]);
  const existing=await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug",[programSlugs]);
  const existingIntakes=await tx.query<any>("select p.slug,pi.intake_year,pi.status from program_intakes pi join programs p on p.id=pi.program_id where p.slug=any($1::text[])",[programSlugs]);
  const existingScholarships=await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[])",[scholarshipSlugs]);
  if(schoolBefore.length!==1||review.reconciliation.databaseBaseline.schoolId!==schoolBefore[0].id||!Array.isArray(oldProgramsBefore[0]?.snapshot)||oldProgramsBefore[0].snapshot.length!==10) throw new Error("BSU protected baseline changed.");
  const pre=existing.length===0&&existingIntakes.length===0&&existingScholarships.length===0;
  const post=existing.length===96&&existingIntakes.length===96&&existingScholarships.length===1&&existing.every(row=>row.status==="active"&&row.verification_status==="verified"&&row.last_verified_at?.toISOString()===approvedAt)&&existingIntakes.every(row=>row.intake_year===2026&&row.status==="closed")&&existingScholarships.every(row=>row.status==="active"&&row.verification_status==="verified"&&row.last_verified_at?.toISOString()===approvedAt);
  if(!pre&&!post) throw new Error(`BSU safe-new state partially conflicts: ${JSON.stringify({programs:existing.length,intakes:existingIntakes.length,scholarships:existingScholarships.length})}`);
  const written=await new CatalogSeedWriter(tx).writeBundle(publication,{preserveExistingCitySlugs:["beijing"],preserveExistingSchoolSlugs:[schoolSlug]});
  if(!written.ok) throw new Error(`BSU catalog write failed: ${written.errors.join(" ")}`);
  const schoolAfter=await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1",[schoolSlug]);
  const oldProgramsAfter=await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.school_id=$1 and not(p.slug=any($2::text[]))",[schoolBefore[0].id,programSlugs]);
  if(JSON.stringify(schoolAfter[0]?.snapshot)!==JSON.stringify(schoolBefore[0].snapshot)||JSON.stringify(oldProgramsAfter[0]?.snapshot)!==JSON.stringify(oldProgramsBefore[0].snapshot)) throw new Error("BSU publication changed protected school or old programs.");
  const totals=await tx.query<any>(`select s.id,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from programs p where p.school_id=s.id and p.status='active' and p.verification_status='verified')::int verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=s.id and p.status='active')::int intakes,(select count(*) from scholarships h where h.school_id=s.id and h.status='active')::int scholarships,(select count(*) from scholarships h where h.school_id=s.id and h.status='active' and h.verification_status='verified')::int verified_scholarships from schools s where s.slug=$1`,[schoolSlug]);
  if(totals.length!==1||totals[0].programs!==106||totals[0].verified_programs!==96||totals[0].intakes!==106||totals[0].scholarships!==1||totals[0].verified_scholarships!==1) throw new Error(`BSU post-check failed: ${JSON.stringify(totals[0])}`);
  return{written:written.summary,totals:totals[0]};
 });
 console.log(JSON.stringify({ok:true,batch,target:target.publicTarget,approvedReviewSha256:reviewHash,publicationBundleSha256:report.bundleSha256,approvalPath:paths.approval,outputPath:paths.output,...result},null,2));
}finally{await pool.end();}
