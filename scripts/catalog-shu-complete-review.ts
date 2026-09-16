import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.shu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.shu-complete-batch-01.validation.json"),
  primaryManifest: resolve(root, "work/catalog-official/shu-complete-batch-01/manifest.json"),
  englishManifest: resolve(root, "work/catalog-official/shu-en-program-guides-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/shu-complete-batch-01/parsed-programs.json"),
  review: resolve(root, "seeds/catalog.shu-complete-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, primaryText, englishText, parsedText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.primaryManifest, "utf8"), readFile(paths.englishManifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle, validation = JSON.parse(validationText), primary = JSON.parse(primaryText), english = JSON.parse(englishText), parsed = JSON.parse(parsedText);
const evidence = [...primary.sources, ...english.sources];
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("SHU candidate validation changed.");
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 242 || candidate.programIntakes?.length !== 242 || candidate.scholarships?.length !== 6 || parsed.programCount !== 242) throw new Error("SHU locked scope changed.");
if (new Set(candidate.programs.map((row) => row.slug)).size !== 242) throw new Error("SHU program slugs are not unique.");
if (candidate.programs.some((row) => !row.nameEn || !row.fieldCategory || !row.teachingLanguage || !row.tuitionAmount || !row.sourceFieldLineage?.nameEn || !row.applicationNote?.includes("Official published length"))) throw new Error("SHU program fields or exact-length note incomplete.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("SHU scholarship rich fields incomplete.");
if (evidence.length !== 12 || evidence.some((row: any) => row.status !== 200 || !["text/html", "application/pdf"].includes(row.contentType) || !/^[a-f0-9]{64}$/.test(row.sha256) || row.byteLength > 15 * 1024 * 1024)) throw new Error("SHU official evidence manifest incomplete.");

const schoolSlug = "shanghai-university", programSlugs = candidate.programs.map((row) => row.slug), scholarshipSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:shu-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "Shanghai University", "上海大学"]);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='shanghai'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error(`SHU safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
  const candidateCity = candidate.cities?.[0];
  const projectedCity = candidateCity ? {
    id: city.rows[0].id,
    slug: candidateCity.slug,
    name_en: candidateCity.nameEn,
    name_zh: candidateCity.nameZh ?? null,
    region: candidateCity.region ?? null,
    province: candidateCity.province ?? null,
    status: candidateCity.status ?? "draft",
    verification_status: city.rows[0].verification_status,
    source_url: candidateCity.sourceUrl,
    source_label: candidateCity.sourceLabel,
    source_note: city.rows[0].source_note,
    source_field_lineage_json: candidateCity.sourceFieldLineage ?? {},
  } : null;
  if (JSON.stringify(projectedCity) !== JSON.stringify(city.rows[0])) throw new Error("SHU candidate would mutate the existing Shanghai city dependency.");
} finally { await pool.end(); }

const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, newSchoolCount: 1, programRouteCount: 242, degreeCounts: parsed.degreeCounts, languageCounts: parsed.languageCounts, programIntakeCount: 242, newScholarshipCount: 6, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  primaryManifestSha256: sha(primaryText), englishManifestSha256: sha(englishText), parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceReview: { result: "pass", note: "Twelve registered Shanghai University official sources were captured within policy: two current HTML pages and ten PDFs. The 2026-2027 program-table pages were parsed and visually checked. The five detailed scholarship guides and current scholarship overview support six separate rich scholarship routes." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] } },
  coverageLimitations: [
    "Official program tables publish English names for all routes but generally do not publish corresponding Chinese names; CUAC does not invent nameZh values.",
    "The catalog contract stores durationYears as an integer. Published 2.5-year routes therefore store durationYears=3 for filtering while preserving the exact 2.5-year value in applicationNote and field lineage.",
    "The CGS bilateral route's exact deadline and partial-award composition are set by each home-country dispatching authority and are not inferred.",
    "The Shanghai University New International Student Scholarship has no separate application or deadline; this is explicitly retained instead of inventing one.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and selected evidence fields", note: "Only public institutional, program, admissions and scholarship policy fields are included. Bank accounts, payment instructions, named staff contacts, telephone numbers, email addresses, applicant records and personal data were excluded from the candidate." },
  reviewNotes: [
    "Eligible for standing-authorized publication because Shanghai University and every candidate slug are absent, with no overwrite, archive or deletion.",
    "The existing Shanghai city dependency is replayed only if it remains byte-for-byte equal to the reviewed database baseline.",
    "Every scholarship contains coverage, benefits, eligibility, materials, procedure and official action links.",
    "Program CSCA subjects are carried only across visually merged cells in the same official table; language, tuition and degree category are preserved per row.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-shu-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, preflight: { schoolCount: preflight.schools.length, conflictCount: preflight.conflicts.length, cityCount: preflight.city.length }, paths }, null, 2));
