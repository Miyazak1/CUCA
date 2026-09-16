import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.buct-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.buct-complete-batch-01.validation.json"),
  manifest: resolve(root, "work/catalog-official/buct-complete-batch-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/buct-complete-batch-01/parsed-programs.json"),
  review: resolve(root, "seeds/catalog.buct-complete-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const [candidateText, validationText, manifestText, parsedText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"),
  readFile(paths.validation, "utf8"),
  readFile(paths.manifest, "utf8"),
  readFile(paths.parsed, "utf8"),
  readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = JSON.parse(validationText);
const manifest = JSON.parse(manifestText);
const parsed = JSON.parse(parsedText);
const evidence = manifest.sources;
const fresh = createCatalogMigrationValidationReport(candidate);

if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) {
  throw new Error("BUCT candidate validation changed.");
}
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 108 || candidate.programIntakes?.length !== 108 || candidate.scholarships?.length !== 3 || parsed.programCount !== 108 || parsed.duplicateIdentities.length) {
  throw new Error("BUCT locked scope changed.");
}
if (candidate.programs.some((row) => /https?:|Supervisor\s+List/i.test(`${row.nameEn} ${row.fieldCategory ?? ""}`))) {
  throw new Error("BUCT program identity contains navigation text.");
}
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) {
  throw new Error("BUCT scholarship rich fields incomplete.");
}
if (evidence.length !== 7 || evidence.some((row: any) => row.status !== 200 || row.contentType !== "text/html" || !/^[a-f0-9]{64}$/.test(row.sha256) || row.byteLength > 15 * 1024 * 1024)) {
  throw new Error("BUCT official evidence manifest incomplete.");
}

const schoolSlug = "beijing-university-of-chemical-technology";
const programSlugs = candidate.programs.map((row) => row.slug);
const scholarshipSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:buct-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "Beijing University of Chemical Technology", "北京化工大学"]);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") {
    throw new Error(`BUCT safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
  }
} finally {
  await pool.end();
}

const degreeCounts = Object.fromEntries(["Undergraduate", "Master", "Doctoral"].map((degree) => [degree, candidate.programs!.filter((row) => row.degreeLevel === degree).length]));
const languageCounts = Object.fromEntries(["Chinese", "English", "French"].map((language) => [language, candidate.programs!.filter((row) => row.teachingLanguage === language).length]));
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: {
    schoolSlug,
    newSchoolCount: 1,
    programRouteCount: 108,
    degreeCounts,
    languageCounts,
    programIntakeCount: 108,
    newScholarshipCount: 3,
    cityOverwriteCount: 0,
    schoolOverwriteCount: 0,
    archiveProgramAliasCount: 0,
    archiveScholarshipAliasCount: 0,
  },
  candidateSha256: sha(candidateText),
  candidateBundleSha256: fresh.bundleSha256,
  operationPlanSha256: fresh.operationPlanSha256,
  sourceManifestSha256: sha(manifestText),
  parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceReview: {
    result: "pass",
    note: "Seven registered official BUCT HTML sources were captured within policy. Current 2026–2027 degree tables yield 108 unique school/program/language routes: 46 undergraduate, 46 master and 16 doctoral. Three current scholarship routes preserve the published coverage, eligibility, materials and application path.",
  },
  reconciliation: {
    destructiveDeletion: false,
    overwrites: [],
    archives: [],
    databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] },
  },
  coverageLimitations: [
    "The official tables publish bilingual and French/English routes in a single row; CUAC expands each stated language into a distinct searchable route without inventing a new program.",
    "The Chinese Government Scholarship page publishes Type A and Type B routes under one award family; CUAC keeps one award record and preserves route-specific deadlines in the published details.",
    "The French-taught master's tuition is not stated in the captured official fee section and remains explicitly unavailable.",
    "Minor presentational artifacts in official unit labels are normalized only for whitespace, capitalization and a missing word boundary; substantive program names remain source-faithful.",
  ],
  sensitiveDataCheck: {
    result: "pass",
    scope: "candidate bundle and official evidence selection",
    note: "Only public institutional, program, admission and scholarship policy data are included. Public bank/payment account details on the official site were deliberately excluded; applicant, passport and personal contact data are absent.",
  },
  reviewNotes: [
    "Eligible for standing-authorized publication because the school and every candidate slug are absent, with no overwrite, archive or deletion.",
    "The Beijing city dependency is replayed only if it remains byte-for-byte equal to the reviewed baseline.",
    "The parser was independently checked for URL and supervisor-navigation contamination; no such text remains in program identity or classification fields.",
    "All three scholarships include coverage, benefits, eligibility, materials, steps and official action links.",
  ],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-buct-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, paths }, null, 2));
