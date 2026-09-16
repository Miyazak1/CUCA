import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { candidate: resolve(root,"seeds/catalog.changan-complete-batch-01.draft.json"), validation: resolve(root,"seeds/catalog.changan-complete-batch-01.validation.json"), review: resolve(root,"seeds/catalog.changan-complete-batch-01.review.json"), manifest: resolve(root,"work/catalog-official/changan-complete-batch-01/manifest.json"), state: resolve(root,".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate,"utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(await readFile(paths.validation,"utf8"));
const manifestText = await readFile(paths.manifest,"utf8");
const manifest = JSON.parse(manifestText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("Chang'an validation changed after build.");
if (manifest.sources.length !== 18 || manifest.sources.some((row:any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("Chang'an evidence manifest incomplete.");
if (candidate.programs?.length !== 215 || candidate.programIntakes?.length !== 215 || candidate.scholarships?.length !== 6) throw new Error("Chang'an locked scope changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("Chang'an rich scholarship fields incomplete.");

const state = JSON.parse(await readFile(paths.state,"utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:changan-complete-review" });
let preflight: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url from schools where slug='chang-an-university'");
  const city = await pool.query("select id,slug,status,verification_status,source_url from cities where slug='xian'");
  const candidateProgramSlugs = (candidate.programs ?? []).map((row) => row.slug);
  const overlappingPrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug",[candidateProgramSlugs]);
  const archivePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where school_id=$1 and not(slug=any($2::text[])) order by slug",[school.rows[0]?.id,candidateProgramSlugs]);
  const archiveScholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where school_id=$1 order by slug",[school.rows[0]?.id]);
  const newProgramSlugs = candidateProgramSlugs.filter((slug) => !overlappingPrograms.rows.some((row) => row.slug === slug));
  const newConflicts = await pool.query("select slug from programs where slug=any($1::text[]) union all select slug from scholarships where slug=any($2::text[])",[newProgramSlugs,(candidate.scholarships ?? []).map((row) => row.slug)]);
  preflight = { school: school.rows, city: city.rows, overlappingPrograms: overlappingPrograms.rows, archivePrograms: archivePrograms.rows, archiveScholarships: archiveScholarships.rows, newProgramCount: newProgramSlugs.length, newConflicts: newConflicts.rows };
  if (school.rows.length !== 1 || city.rows.length !== 1 || overlappingPrograms.rows.length !== 16 || archivePrograms.rows.length !== 8 || archiveScholarships.rows.length !== 1 || newProgramSlugs.length !== 199 || newConflicts.rows.length) throw new Error(`Chang'an database baseline mismatch: ${JSON.stringify(preflight)}`);
  if ([...overlappingPrograms.rows,...archivePrograms.rows,...archiveScholarships.rows].some((row) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("Chang'an legacy rows are no longer active unverified records.");
} finally { await pool.end(); }

const scope = { schoolSlug:"chang-an-university",cityOverwriteCount:1,schoolOverwriteCount:1,programRouteCount:215,bachelorRouteCount:84,masterRouteCount:80,doctoralRouteCount:51,chineseRouteCount:144,englishRouteCount:71,programIntakeCount:215,newProgramCount:199,stableProgramOverwriteCount:16,newScholarshipCount:6,archiveProgramAliasCount:8,archiveScholarshipAliasCount:1 };
const reviewBase = {
  version:1,status:"requires_explicit_approval",generatedAt:candidate.generatedAt,scope,
  candidateSha256:sha(candidateText),candidateBundleSha256:fresh.bundleSha256,operationPlanSha256:fresh.operationPlanSha256,manifestSha256:sha(manifestText),
  evidence:manifest.sources.map((row:any) => ({sourceId:row.id,sourceUrl:row.finalUrl,sourceLabel:row.label,sha256:row.sha256,fetchedAt:row.fetchedAt,contentType:row.contentType})),
  sourceReview:{result:"pass",note:"Eighteen exact official Chang'an University 2026/2026-2027 sources were captured: degree guides, Chinese/English program catalogs, CSCA matrices and six current scholarship pages. One withdrawn brochure attachment returned 404 and was excluded from the registry and evidence set."},
  reconciliation:{destructiveDeletion:false,overwrites:[{entityType:"city",slug:"xian",reason:"refresh the existing Xi'an provenance with the current official Chang'an University address while preserving city identity"},{entityType:"school",slug:"chang-an-university",reason:"replace an unverified third-party school summary with current official 2026 admissions, fees, language and CSCA fields"},...preflight.overlappingPrograms.map((row:any)=>({entityType:"program",slug:row.slug,reason:"preserve the stable program URL while replacing unverified third-party fields with the official 2026 route"}))],archives:[...preflight.archivePrograms.map((row:any)=>({entityType:"program",id:row.id,slug:row.slug,reason:"the current official catalog uses a different canonical major/route; archive the unmatched third-party alias after publishing official routes"})),...preflight.archiveScholarships.map((row:any)=>({entityType:"scholarship",id:row.id,slug:row.slug,reason:"replace the unverified merged scholarship placeholder with six independently documented rich official awards"}))],databaseBaseline:{schoolId:preflight.school[0].id,cityId:preflight.city[0].id,stableProgramIds:preflight.overlappingPrograms.map((row:any)=>row.id)}},
  coverageLimitations:["Program records represent the official major column, not each research field; research fields remain part of the captured PDF evidence and are not misrepresented as separate degrees.","The official catalogs publish English major titles even for Chinese-taught routes; these titles are retained as both display names instead of inventing unofficial Chinese translations.","Program deadlines use the degree-level self-funded deadline of June 15, 2026; scholarship deadlines are stored on the separate award records."],
  sensitiveDataCheck:{result:"pass",scope:"publication candidate",note:"Only public institutional, program, admissions and scholarship-policy fields are included. Applicant data, result lists, personal contacts, accounts and payment records are excluded."},
  visualReview:{result:"pass",artifact:"Rendered six official Chang'an University 2026 PDF catalogs/CSCA matrices",note:"All PDF pages rendered successfully. Representative pages for every document type were visually checked against pdfplumber extraction; table headings, degree/language scopes and major columns agree."},
  reviewNotes:["The 215 routes comprise 84 bachelor, 80 master and 51 doctoral routes; Chinese and English admissions paths are separate records.","Standing default publication covers 199 safe-new routes and six safe-new rich scholarship records, but the atomic batch also overwrites one city, one school and 16 stable program rows and archives nine legacy aliases, so exact approval is required."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准发布长安大学学校、项目与奖学金完整第一批（审核哈希 ${reviewHash}），覆盖西安城市、长安大学学校及 16 条项目旧的未验证字段，并归档 8 条旧项目别名及 1 条旧奖学金合并概览`;
await writeFile(paths.review,`${JSON.stringify({...reviewBase,reviewHash,requiredApproval},null,2)}\n`,"utf8");
console.log(JSON.stringify({ok:true,reviewHash,requiredApproval,scope,paths},null,2));
