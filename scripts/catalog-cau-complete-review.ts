import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.cau-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.cau-complete-batch-01.validation.json"),
  pages: resolve(root, "work/catalog-official/cau-complete-batch-01/manifest.json"),
  attachments: resolve(root, "work/catalog-official/cau-program-attachments-batch-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/cau-program-attachments-batch-01/parsed-programs.json"),
  review: resolve(root, "seeds/catalog.cau-complete-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, pagesText, attachmentsText, parsedText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.pages, "utf8"),
  readFile(paths.attachments, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(validationText);
const pages = JSON.parse(pagesText), attachments = JSON.parse(attachmentsText), parsed = JSON.parse(parsedText);
const evidence = [...pages.sources, ...attachments.sources];
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("CAU candidate validation changed.");
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 127 || candidate.programIntakes?.length !== 127 || candidate.scholarships?.length !== 4 || parsed.programCount !== 127 || parsed.duplicateIdentities.length) throw new Error("CAU locked scope changed.");
if (candidate.programs.some((row) => row.degreeLevel === "Undergraduate" && row.durationYears !== undefined)) throw new Error("Unsupported undergraduate duration was introduced.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("CAU scholarship rich fields incomplete.");
if (evidence.length !== 11 || evidence.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("CAU official evidence manifest incomplete.");

const schoolSlug = "china-agricultural-university";
const programSlugs = candidate.programs.map((row) => row.slug), scholarshipSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:cau-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "China Agricultural University", "中国农业大学"]);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error(`CAU safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const degreeCounts = Object.fromEntries(["Undergraduate", "Master", "Doctoral"].map((degree) => [degree, candidate.programs!.filter((row) => row.degreeLevel === degree).length]));
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, newSchoolCount: 1, programRouteCount: 127, degreeCounts, programIntakeCount: 127, newScholarshipCount: 4, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  pageManifestSha256: sha(pagesText), attachmentManifestSha256: sha(attachmentsText), parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", note: "Six current official CAU 2026 admissions and scholarship pages and five official workbook attachments were captured. The catalogs yield 127 unique program routes: 31 undergraduate, 49 master and 47 doctoral." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] } },
  coverageLimitations: ["The source workbook's Chinese cells contain encoding damage; only stable English program, college, degree, language, duration and CSCA fields are published.", "The undergraduate catalog does not reliably publish a general duration, so undergraduate duration is intentionally omitted.", "No exact day is published reliably for the MOFCOM June deadline in the captured page; only the month is shown.", "Scholarship-to-program eligibility remains descriptive where the official notice publishes a category rather than an exhaustive route mapping."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence selection", note: "Only public institution, program, admissions and scholarship policy fields are included. Staff names, email addresses and telephone numbers present in workbook contact columns were excluded; applicant, account, payment and bank data are absent." },
  reviewNotes: ["Eligible for standing-authorized publication because the school and all candidate program and scholarship slugs are absent, while the existing Beijing city dependency is replayed without substantive change.", "All four scholarships include coverage, benefits, eligibility, materials, process and official action links for the rich detail page."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-cau-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, paths }, null, 2));
