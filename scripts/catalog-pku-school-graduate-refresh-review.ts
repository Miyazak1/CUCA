import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";

const root = process.cwd();
const paths = {
  prior: resolve(root, "seeds/catalog.pku-school-program-batch-01.approved.local.json"),
  graduateApproval: resolve(root, "seeds/catalog.pku-graduate-core-batch-01.approval.json"),
  candidate: resolve(root, "seeds/catalog.pku-school-graduate-refresh.draft.json"),
  validation: resolve(root, "seeds/catalog.pku-school-graduate-refresh.validation.json"),
  review: resolve(root, "seeds/catalog.pku-school-graduate-refresh.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [prior, graduateApproval, state] = await Promise.all([parse(paths.prior), parse(paths.graduateApproval), parse(paths.state)]);
const city = prior.cities?.find((row: any) => row.slug === "beijing");
const oldSchool = prior.schools?.find((row: any) => row.slug === "peking-university");
if (!city || !oldSchool || graduateApproval.approvedReviewSha256 !== "e78219a8ef30b43f64531132b3e873f05caca865c20dc077c3408fb1a9767722") throw new Error("Reviewed PKU dependency publications are unavailable.");
const evidenceIds = ["pku-graduate-admissions-guide-2026", "pku-graduate-tuition-2026"];
const evidence: any[] = [];
for (const id of evidenceIds) {
  const manifestText = await readFile(resolve(root, `work/catalog-official/pku-graduate-core-20260914/${id}/manifest.json`), "utf8");
  const item = JSON.parse(manifestText).sources?.[0];
  if (item?.id !== id || item?.status !== 200 || !/^[a-f0-9]{64}$/.test(item?.sha256 ?? "")) throw new Error(`PKU school evidence mismatch: ${id}`);
  evidence.push({ sourceId: item.id, sourceUrl: item.finalUrl, sourceLabel: item.label, sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType, manifestSha256: sha(manifestText) });
}
const guide = evidence.find((row) => row.sourceId === "pku-graduate-admissions-guide-2026")!;
const tuition = evidence.find((row) => row.sourceId === "pku-graduate-tuition-2026")!;
const school = {
  ...oldSchool,
  applicationLevel: "Undergraduate, Master, Doctoral",
  languageOfInstruction: "Chinese and English, depending on program",
  languageRequirement: "Undergraduate teaching is Chinese. Graduate Chinese-taught routes require the published HSK standard; English-taught routes require the published English proof and may set program-specific thresholds.",
  hskRequirement: "Graduate Chinese-taught programs: HSK 6 with 200+ for science or 210+ for humanities, and writing 65+; HSK 7-9 is also accepted.",
  englishRequirement: "Graduate English-taught programs: TOEFL iBT 100+, GRE 315+, or other accepted proof; individual programs may publish additional requirements.",
  deadlineSummary: "Undergraduate 2026 routes use the published examination or exemption rounds. General graduate application period: October 20-December 23, 2025; English-taught programs may use program-specific deadlines.",
  tuitionSummary: "Undergraduate tuition remained pending in the reviewed 2026 notice. Graduate fees are route-specific: 42 named routes currently publish totals from RMB 78,000 to RMB 828,000; several generic or individual routes remain pending/TBA.",
  admissionsUrl: guide.sourceUrl,
  languageTags: ["Chinese-taught", "English-taught"],
  tuitionBandLabel: "Graduate named routes: RMB 78,000-828,000 total; other routes TBA",
  campusHighlights: ["23 reviewed undergraduate department application routes", "42 reviewed 2026 graduate routes with explicit tuition-table rows", "Master's and doctoral study across Yanyuan, Changping, Daxing and Shenzhen contexts", "Nine active scholarship records pending legacy reconciliation"],
  status: "draft" as const,
  sourceUrl: guide.sourceUrl,
  sourceLabel: guide.sourceLabel,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
  sourceFieldLineage: {
    nameEn: "preserved from reviewed official undergraduate school publication",
    nameZh: "preserved from reviewed official undergraduate school publication",
    applicationLevel: "2026 graduate admissions guide, title and Disciplines and Majors",
    languageOfInstruction: "2026 graduate admissions guide, language requirements and official tuition schedule",
    languageRequirement: "2026 graduate admissions guide, Application Materials item 6",
    hskRequirement: "2026 graduate admissions guide, Application Materials item 6 Chinese table",
    englishRequirement: "2026 graduate admissions guide, Application Materials item 6 English rule",
    deadlineSummary: "reviewed undergraduate notices plus 2026 graduate admissions guide, Application Period",
    tuitionSummary: "2026 graduate tuition schedule, rows 1-47",
    admissionsUrl: "2026 graduate admissions guide URL",
    campusHighlights: "reviewed undergraduate batch, published graduate batch and 2026 graduate guide campus scope",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: guide.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Invalid PKU school refresh candidate: ${validation.errors.join(" ")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:pku-school-graduate-refresh-review" });
let baseline: any;
try {
  const schoolRows = await pool.query("select id,status,verification_status,last_verified_at,application_level,language_of_instruction,deadline_summary,tuition_summary from schools where slug='peking-university'");
  const counts = await pool.query("select (select count(*)::int from programs where school_id=$1 and status='active') programs,(select count(*)::int from scholarships where school_id=$1 and status='active') scholarships", [schoolRows.rows[0]?.id]);
  baseline = { school: schoolRows.rows, counts: counts.rows[0] };
} finally { await pool.end(); }
if (baseline.school.length !== 1 || baseline.school[0].status !== "active" || baseline.school[0].verification_status !== "verified" || baseline.school[0].application_level !== "Undergraduate" || baseline.counts.programs !== 65 || baseline.counts.scholarships !== 9) throw new Error(`PKU school refresh baseline changed: ${JSON.stringify(baseline)}`);
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: guide.fetchedAt,
  scope: { schoolSlug: "peking-university", schoolOverwriteCount: 1, insertCount: 0, archiveCount: 0, programMutationCount: 0, scholarshipMutationCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence, dependentPublication: { graduateReviewSha256: graduateApproval.approvedReviewSha256, graduatePublicationBundleSha256: graduateApproval.publicationBundleSha256, publishedGraduateRoutes: 42 },
  visualReview: { result: "pass", pdfPagesReviewed: 4, note: "The official 2026 graduate tuition schedule was rendered and checked page by page before summarizing its range and unresolved rows." },
  reconciliation: { destructiveDeletion: false, overwrite: { entityType: "school", id: baseline.school[0].id, slug: "peking-university", reason: "Expand the verified school profile from undergraduate-only to the now-published undergraduate, master and doctoral catalog scope." }, archives: [], databaseBaseline: { schoolId: baseline.school[0].id, lastVerifiedAt: baseline.school[0].last_verified_at, activeProgramCount: 65, activeScholarshipCount: 9 } },
  protectedContent: { programs: 65, scholarships: 9, note: "No program, intake or scholarship row will be inserted, updated or archived by this operation." },
  unresolvedFields: ["Graduate generic humanities/science tuition remains pending approval.", "Several program-specific fees remain TBA.", "English-taught deadlines remain program-specific where explicitly deferred by the official guide."],
  sensitiveDataCheck: { result: "pass", scope: "school profile only", note: "Only public institutional catalog summaries are included. Applicant, account, payment, bank, staff-name and personal-contact data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准更新北京大学学校资料为本科、硕士与博士完整概览（审核哈希 ${reviewHash}）`;
const review = { ...reviewBase, reviewHash, requiredApproval };
await writeFile(paths.candidate, candidateText, "utf8");
await writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, baseline: reviewBase.reconciliation.databaseBaseline, candidatePath: paths.candidate, reviewPath: paths.review }, null, 2));
