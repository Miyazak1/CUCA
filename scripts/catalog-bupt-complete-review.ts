import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.bupt-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.bupt-complete-batch-01.validation.json"),
  manifest: resolve(root, "work/catalog-official/bupt-complete-batch-01/manifest.json"),
  review: resolve(root, "seeds/catalog.bupt-complete-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(validationText);
const manifest = JSON.parse(manifestText);
const evidence = manifest.sources ?? [];
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("BUPT candidate validation changed.");
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 58 || candidate.programIntakes?.length !== 58 || candidate.scholarships?.length !== 0) throw new Error("BUPT locked scope changed.");
if (new Set(candidate.programs.map((row) => row.slug)).size !== 58 || candidate.programs.some((row) => !row.nameEn || !row.degreeLevel || !row.teachingLanguage || !row.tuitionAmount || !row.applicationNote || !row.sourceFieldLineage)) throw new Error("BUPT program route fields incomplete.");
if (evidence.length !== 1 || evidence[0].status !== 200 || evidence[0].contentType !== "application/pdf" || evidence[0].byteLength !== 185780 || evidence[0].sha256 !== "60c223830d1e46ab8625daa3060584544ad699bf3c7925a33ce59cc0d32d56a8") throw new Error("BUPT official evidence manifest incomplete.");

const schoolSlug = "beijing-university-of-posts-and-telecommunications";
const programSlugs = candidate.programs.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:bupt-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "Beijing University of Posts and Telecommunications", "北京邮电大学"]);
  const conflicts = await pool.query("select slug,status,verification_status from programs where slug=any($1::text[])", [programSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error(`BUPT safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const degreeCounts = Object.fromEntries(["Undergraduate", "Master", "Doctoral"].map((degree) => [degree, candidate.programs!.filter((row) => row.degreeLevel === degree).length]));
const languageCounts = Object.fromEntries(["Chinese", "English"].map((language) => [language, candidate.programs!.filter((row) => row.teachingLanguage === language).length]));
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, newSchoolCount: 1, programRouteCount: 58, degreeCounts, languageCounts, programIntakeCount: 58, newScholarshipCount: 0, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256: sha(candidateText),
  candidateBundleSha256: fresh.bundleSha256,
  operationPlanSha256: fresh.operationPlanSha256,
  sourceManifestSha256: sha(manifestText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceReview: { result: "pass", note: "The official BUPT 2026 international admission brochure was captured byte-for-byte and all 10 pages were extracted and visually reviewed. It publishes 58 distinct degree-language routes: 17 undergraduate, 28 master and 13 doctoral." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] } },
  coverageLimitations: [
    "The 2026 brochure gives a general two-or-three-year duration for Chinese-taught master's routes but no route-level mapping, so those duration fields are intentionally omitted.",
    "The official table spells one master's route as 'Juris'; the catalog preserves that published label without inference.",
    "No current-cycle scholarship detail is published in the reviewed 2026 brochure. Scholarship records are intentionally excluded from this safe batch rather than importing stale 2021/2023 guidance as 2026 data.",
    "Institutional contact names, email addresses and telephone numbers shown on the brochure are not copied into the public catalog.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and selected official evidence", note: "Only public institution, program, fee, admissions and policy fields are included. Staff contact details shown in the source are excluded; applicant, account, payment, passport and bank data are absent." },
  reviewNotes: [
    "Eligible for standing-authorized publication because the school and all 58 program slugs are absent, with no overwrite, archive or deletion.",
    "The existing Beijing city is a dependency only and must remain byte-for-byte unchanged by the transaction.",
    "All 17 undergraduate routes carry the brochure's CSCA Mathematics and Physics requirement; English routes carry TOEFL 80 or IELTS 6.0; Chinese routes carry HSK 5 except Chinese Language at HSK 4.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-bupt-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, paths }, null, 2));
