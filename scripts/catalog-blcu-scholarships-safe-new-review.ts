import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd(), prefix = "catalog.blcu-scholarships-safe-new-batch-02";
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), manifest: resolve(root, "work/catalog-official/blcu-scholarships-safe-new-batch-02/manifest.json"), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, stateText] = await Promise.all([readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.state, "utf8")]);
const candidate = JSON.parse(candidateText), validation = JSON.parse(validationText), manifest = JSON.parse(manifestText), state = JSON.parse(stateText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256 || candidate.scholarships.length !== 3) throw new Error("BLCU candidate validation changed.");
const scholarshipSlugs = candidate.scholarships.map((row: any) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:blcu-scholarships-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug='beijing-language-and-culture-university'");
  const city = await pool.query("select id,slug,status from cities where slug='beijing'");
  const conflicts = await pool.query("select id,slug from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
  const active = await pool.query("select id,slug,title,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const programCount = await pool.query("select count(*)::int count from programs where school_id=$1 and status='active'", [school.rows[0]?.id]);
  if (school.rows.length !== 1 || city.rows.length !== 1 || conflicts.rows.length !== 0 || active.rows.length !== 6 || programCount.rows[0]?.count !== 14) throw new Error("BLCU safe-new database baseline changed.");
  baseline = { school: school.rows[0], city: city.rows[0], existingScholarships: active.rows, activeProgramCount: programCount.rows[0].count };
} finally { await pool.end(); }
const evidence = manifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength }));
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "beijing-language-and-culture-university", dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newScholarshipCount: 3, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, manifestSha256: sha(manifestText), evidence,
  standingAuthorization: { reference: "user-chat-top-300-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts three non-conflicting official BLCU scholarship records. Beijing and BLCU are protected dependencies; no existing record is overwritten, archived or deleted." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolId: baseline.school.id, cityId: baseline.city.id, activeProgramCount: baseline.activeProgramCount, existingScholarships: baseline.existingScholarships } },
  sourceReview: { result: "pass", note: "Three exact allowlisted BLCU HTML pages were captured successfully. Each explicitly publishes the award type, applicable intake or year, coverage, eligibility and application process." },
  contentReview: { result: "pass", sectionsReviewed: ["title", "eligibility/funded categories", "coverage and standards", "application process and dates", "application materials", "award conditions"], findings: ["The High-Level Graduate notice directly states full coverage, monthly stipends and the March 5, 2026 deadline.", "The International Chinese Language Teachers notice directly states six study categories, category-specific requirements and four deadlines.", "The Beijing Government Scholarship page directly states first-year tuition-only coverage and two intake deadlines."] },
  sensitiveDataCheck: { result: "pass", scope: "three public scholarship policy records", excluded: ["telephone and email contacts", "passport identity values", "payment URLs", "bank names, account numbers and SWIFT codes", "applicant uploads or account data"], note: "Only non-sensitive material categories and public application-system links are retained." },
  coverageLimitations: ["This safe-new batch does not overwrite or archive six existing BLCU scholarship records, including two semantic duplicates that require a separate exact reconciliation approval.", "It does not verify the BLCU school profile or 14 existing program records."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-blcu-scholarships-safe-new-batch-02-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewPath: paths.review, reviewHash, publicationReference: review.publicationReference }, null, 2));
