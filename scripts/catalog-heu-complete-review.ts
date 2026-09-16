import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { candidate: resolve(root,"seeds/catalog.heu-complete-batch-01.draft.json"), validation: resolve(root,"seeds/catalog.heu-complete-batch-01.validation.json"), review: resolve(root,"seeds/catalog.heu-complete-batch-01.review.json"), manifests: [resolve(root,"work/catalog-official/heu-complete-batch-01/manifest.json"),resolve(root,"work/catalog-official/heu-pdf-batch-01/manifest.json")], state: resolve(root,".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate,"utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(await readFile(paths.validation,"utf8"));
const manifestTexts = await Promise.all(paths.manifests.map((path)=>readFile(path,"utf8")));
const manifests = manifestTexts.map((text)=>JSON.parse(text));
const evidence = manifests.flatMap((manifest)=>manifest.sources);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("HEU validation changed after build.");
if (evidence.length !== 17 || evidence.some((row:any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("HEU evidence manifests incomplete.");
if (candidate.programs?.length !== 91 || candidate.programIntakes?.length !== 91 || candidate.scholarships?.length !== 10) throw new Error("HEU locked scope changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("HEU rich scholarship fields incomplete.");

const state = JSON.parse(await readFile(paths.state,"utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:heu-complete-review" });
let preflight: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url from schools where slug='harbin-engineering-university'");
  const city = await pool.query("select id,slug,status,verification_status,source_url from cities where slug='harbin'");
  const candidateProgramSlugs = (candidate.programs ?? []).map((row) => row.slug);
  const overlappingPrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug",[candidateProgramSlugs]);
  const archivePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where school_id=$1 and not(slug=any($2::text[])) order by slug",[school.rows[0]?.id,candidateProgramSlugs]);
  const archiveScholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where school_id=$1 order by slug",[school.rows[0]?.id]);
  const newProgramSlugs = candidateProgramSlugs.filter((slug) => !overlappingPrograms.rows.some((row) => row.slug === slug));
  const newConflicts = await pool.query("select slug from programs where slug=any($1::text[]) union all select slug from scholarships where slug=any($2::text[])",[newProgramSlugs,(candidate.scholarships ?? []).map((row) => row.slug)]);
  preflight = { school: school.rows, city: city.rows, overlappingPrograms: overlappingPrograms.rows, archivePrograms: archivePrograms.rows, archiveScholarships: archiveScholarships.rows, newProgramCount: newProgramSlugs.length, newConflicts: newConflicts.rows };
  if (school.rows.length !== 1 || city.rows.length !== 1 || overlappingPrograms.rows.length !== 4 || archivePrograms.rows.length !== 5 || archiveScholarships.rows.length !== 1 || newProgramSlugs.length !== 87 || newConflicts.rows.length) throw new Error(`HEU database baseline mismatch: ${JSON.stringify(preflight)}`);
  if ([...school.rows,...city.rows,...overlappingPrograms.rows,...archivePrograms.rows,...archiveScholarships.rows].some((row) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("HEU baseline rows are no longer active unverified records.");
} finally { await pool.end(); }

const scope = { schoolSlug:"harbin-engineering-university",cityOverwriteCount:1,schoolOverwriteCount:1,programRouteCount:91,bachelorRouteCount:40,masterRouteCount:33,doctoralRouteCount:18,chineseRouteCount:53,englishRouteCount:38,programIntakeCount:91,newProgramCount:87,stableProgramOverwriteCount:4,newScholarshipCount:10,archiveProgramAliasCount:5,archiveScholarshipAliasCount:1 };
const reviewBase = {
  version:1,status:"requires_explicit_approval",generatedAt:candidate.generatedAt,scope,
  candidateSha256:sha(candidateText),candidateBundleSha256:fresh.bundleSha256,operationPlanSha256:fresh.operationPlanSha256,manifestSha256:sha(manifestTexts.join("\n")),
  evidence:evidence.map((row:any) => ({sourceId:row.id,sourceUrl:row.finalUrl,sourceLabel:row.label,sha256:row.sha256,fetchedAt:row.fetchedAt,contentType:row.contentType})),
  sourceReview:{result:"pass",note:"Seventeen exact official HEU sources were captured: the 2026 admission handbook, bachelor and graduate program tables, current scholarship pages, and four directly embedded public PDF files. No CAPTCHA, login, recursive crawling or access-control bypass was used."},
  reconciliation:{destructiveDeletion:false,overwrites:[{entityType:"city",slug:"harbin",reason:"refresh the unverified Harbin provenance with HEU's current official address"},{entityType:"school",slug:"harbin-engineering-university",reason:"replace an unverified third-party school summary with current official admissions, language, fee and CSCA fields"},...preflight.overlappingPrograms.map((row:any)=>({entityType:"program",slug:row.slug,reason:"preserve the stable program URL while replacing unverified third-party fields with the official 2026 route"}))],archives:[...preflight.archivePrograms.map((row:any)=>({entityType:"program",id:row.id,slug:row.slug,reason:"not present under this canonical name in the current official 2026 international program table; archive the old third-party alias"})),...preflight.archiveScholarships.map((row:any)=>({entityType:"scholarship",id:row.id,slug:row.slug,reason:"replace the unverified merged scholarship placeholder with ten independently scoped rich official award records"}))],databaseBaseline:{schoolId:preflight.school[0].id,cityId:preflight.city[0].id,stableProgramIds:preflight.overlappingPrograms.map((row:any)=>row.id)}},
  coverageLimitations:["The five English bachelor routes are distinct from their Chinese counterparts; official tuition is published only for Civil Engineering Double Degree and Artificial Intelligence, so the other three retain an explicit 'not separately published' amount.","The maintained High-Level Graduate, Marine and Type A pages do not identify a 2026 cycle in their text; their titles and deadline labels therefore avoid inventing a year.","The corporate and International Chinese Language Teachers records are transparently labeled as closed 2025 cycles because no newer official replacement was captured.","The provincial Eurasian overview confirms HEU participation and overall coverage but does not publish HEU-specific quotas, materials or deadline; those limitations are retained on the record."],
  sensitiveDataCheck:{result:"pass",scope:"publication candidate",note:"Only public institutional, program, admissions and scholarship-policy fields are included. The raw handbook/PDF evidence contains a university bank account and named contact details, but those fields are intentionally excluded from the publication candidate together with all applicant or result data."},
  visualReview:{result:"pass",artifact:"Rendered 48 pages from four official HEU PDFs",note:"All 18 handbook pages, 12 Atomic Energy pages, 10 language-teacher scholarship pages and 8 Silk Road pages rendered. The program matrices, fee table, scholarship benefits, eligibility, materials, processes and deadlines were checked against the candidate."},
  reviewNotes:["The 91 routes comprise 40 bachelor, 33 master and 18 doctoral routes; 53 are Chinese-taught and 38 English-taught.","Ten scholarship records include two separately scoped HEU university awards, six government/provincial routes and two transparently closed 2025 routes.","Standing default publication covers 87 safe-new routes and ten safe-new scholarships, but the atomic batch also overwrites one city, one school and four stable program rows and archives six legacy aliases, so exact approval is required."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准发布哈尔滨工程大学学校、项目与奖学金完整第一批（审核哈希 ${reviewHash}），覆盖哈尔滨城市、哈尔滨工程大学学校及 4 条项目旧的未验证字段，并归档 5 条旧项目别名及 1 条旧奖学金合并概览`;
await writeFile(paths.review,`${JSON.stringify({...reviewBase,reviewHash,requiredApproval},null,2)}\n`,"utf8");
console.log(JSON.stringify({ok:true,reviewHash,requiredApproval,scope,paths},null,2));
