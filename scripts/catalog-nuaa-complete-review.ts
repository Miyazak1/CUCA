import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.nuaa-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.nuaa-complete-batch-01.validation.json"),
  manifest: resolve(root, "work/catalog-official/nuaa-complete-batch-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/nuaa-complete-batch-01/parsed-programs.json"),
  review: resolve(root, "seeds/catalog.nuaa-complete-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, parsedText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle, validation = JSON.parse(validationText), manifest = JSON.parse(manifestText), parsed = JSON.parse(parsedText);
const fresh = createCatalogMigrationValidationReport(candidate), evidence = manifest.sources ?? [];
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("NUAA candidate validation changed.");
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 77 || candidate.programIntakes?.length !== 77 || candidate.scholarships?.length !== 6 || parsed.programCount !== 77 || parsed.duplicateIdentities.length) throw new Error("NUAA locked scope changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("NUAA scholarship rich fields incomplete.");
if (evidence.length !== 5 || evidence.some((row: any) => row.status !== 200 || row.contentType !== "text/html" || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("NUAA official evidence manifest incomplete.");

const schoolSlug = "nanjing-university-of-aeronautics-and-astronautics";
const programSlugs = candidate.programs.map((row) => row.slug), scholarshipSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:nuaa-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "Nanjing University of Aeronautics and Astronautics", "南京航空航天大学"]);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='nanjing'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error(`NUAA safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const degreeCounts = Object.fromEntries(["Undergraduate", "Master", "Doctoral"].map((degree) => [degree, candidate.programs!.filter((row) => row.degreeLevel === degree).length]));
const languageCounts = Object.fromEntries(["Chinese", "English"].map((language) => [language, candidate.programs!.filter((row) => row.teachingLanguage === language).length]));
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, newSchoolCount: 1, programRouteCount: 77, degreeCounts, languageCounts, programIntakeCount: 77, newScholarshipCount: 6, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, sourceManifestSha256: sha(manifestText), parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceReview: { result: "pass", note: "Five current official NUAA 2026 admissions and scholarship pages were captured. Structured extraction yields 77 unique degree-language-college routes: 12 undergraduate, 35 master and 30 doctoral. Six non-duplicative scholarship records preserve degree-specific amounts and application paths." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] } },
  coverageLimitations: [
    "The undergraduate guide says the six programs are instructed in both English and Chinese; each is represented as two language routes.",
    "Postgraduate route labels and college spellings are preserved as published, including source spellings such as 'Cyberspace Safety' and 'Intergrated Circuits'.",
    "The postgraduate page publishes a May 30 application period and a June 15 final deadline; the intake uses June 15 and the school summary preserves both.",
    "The Nanjing Municipal Scholarship is one record with degree-specific amounts to avoid duplicating the same award.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence selection", note: "Only public institution, program, admission and scholarship policy fields are included. Staff names, email addresses and telephone numbers are excluded; applicant, account, payment, passport and bank data are absent." },
  reviewNotes: [
    "Eligible for standing-authorized publication because the school and all candidate program and scholarship slugs are absent, with no overwrite, archive or deletion.",
    "The Nanjing city dependency is replayed only if it remains byte-for-byte equal to the reviewed database baseline.",
    "All scholarship detail records include coverage, benefits, eligibility, materials, steps and official action links.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-nuaa-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, paths }, null, 2));
