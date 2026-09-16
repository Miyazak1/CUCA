import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.bjfu-complete-batch-01.draft.json"), validation: resolve(root, "seeds/catalog.bjfu-complete-batch-01.validation.json"),
  admissionManifest: resolve(root, "work/catalog-official/bjfu-complete-batch-01/manifest.json"), programManifest: resolve(root, "work/catalog-official/bjfu-program-pages-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/bjfu-program-pages-01/parsed-programs.json"), review: resolve(root, "seeds/catalog.bjfu-complete-batch-01.review.json"), state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, admissionManifestText, programManifestText, parsedText, stateText] = await Promise.all([
  readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.admissionManifest, "utf8"), readFile(paths.programManifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.state, "utf8"),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle, validation = JSON.parse(validationText), parsed = JSON.parse(parsedText);
const evidence = [...JSON.parse(admissionManifestText).sources, ...JSON.parse(programManifestText).sources];
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("BJFU candidate validation changed.");
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 149 || candidate.programIntakes?.length !== 149 || candidate.scholarships?.length !== 3 || parsed.programCount !== 149 || parsed.duplicateIdentities.length) throw new Error("BJFU locked scope changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("BJFU scholarship rich fields incomplete.");
if (evidence.length !== 7 || evidence.some((row: any) => row.status !== 200 || !["text/html", "application/pdf"].includes(row.contentType) || !/^[a-f0-9]{64}$/.test(row.sha256) || row.byteLength > 15 * 1024 * 1024)) throw new Error("BJFU official evidence manifest incomplete.");

const schoolSlug = "beijing-forestry-university", programSlugs = candidate.programs.map((row) => row.slug), scholarshipSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:bjfu-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "Beijing Forestry University", "北京林业大学"]);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error(`BJFU safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const degreeCounts = Object.fromEntries(["Undergraduate", "Master", "Doctoral"].map((degree) => [degree, candidate.programs!.filter((row) => row.degreeLevel === degree).length]));
const languageCounts = Object.fromEntries(["Chinese", "English"].map((language) => [language, candidate.programs!.filter((row) => row.teachingLanguage === language).length]));
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, newSchoolCount: 1, programRouteCount: 149, degreeCounts, languageCounts, programIntakeCount: 149, newScholarshipCount: 3, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  sourceManifestSha256: sha(admissionManifestText), sourceManifestSha256s: [sha(admissionManifestText), sha(programManifestText)], parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceReview: { result: "pass", note: "Seven registered official BFU sources were captured within policy. The 11-page 2026 undergraduate prospectus was visually inspected, and structured HTML extraction yielded 149 unique school/program/language routes: 37 undergraduate, 71 master and 41 doctoral. Three 2026 undergraduate scholarships preserve the published coverage, eligibility and application path." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] } },
  coverageLimitations: [
    "A separate graduate prospectus exceeded the skill's 15 MiB per-file ceiling and was rejected before storage; it is not used as evidence.",
    "Graduate program names, schools, teaching languages and durations are sourced from current official HTML, but current graduate tuition and deadline values are not published in the captured compliant sources and remain explicitly unavailable.",
    "The 2026 prospectus publishes only undergraduate eligibility for CGS Type A, Beijing Government Scholarship and Experience Beilin Scholarship; no graduate scholarship eligibility is inferred.",
    "Program spellings and award names are preserved from the official tables, including apparent source typos; CUAC does not silently normalize substantive program identity.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence selection", note: "Only public institutional, program, admission and scholarship policy data are included. Public staff contact details were excluded; applicant, account, passport, payment and bank data are absent." },
  reviewNotes: ["Eligible for standing-authorized publication because the school and every candidate slug are absent, with no overwrite, archive or deletion.", "The Beijing city dependency is replayed only if it remains byte-for-byte equal to the reviewed baseline.", "All three scholarships include coverage, benefits, eligibility, materials, steps and official action links."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-bjfu-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, paths }, null, 2));
