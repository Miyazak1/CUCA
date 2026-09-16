import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.ucas-complete-batch-01.draft.json"), validation: resolve(root, "seeds/catalog.ucas-complete-batch-01.validation.json"),
  manifest: resolve(root, "work/catalog-official/ucas-complete-batch-01/manifest.json"), parsed: resolve(root, "work/catalog-official/ucas-complete-batch-01/parsed-programs.json"),
  review: resolve(root, "seeds/catalog.ucas-complete-batch-01.review.json"), state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, parsedText, stateText] = await Promise.all([readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.state, "utf8")]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle, validation = JSON.parse(validationText), manifest = JSON.parse(manifestText), parsed = JSON.parse(parsedText);
const evidence = manifest.sources, fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("UCAS candidate validation changed.");
if (candidate.schools?.length !== 1 || candidate.programs?.length !== 174 || candidate.programIntakes?.length !== 174 || candidate.scholarships?.length !== 3 || parsed.programCount !== 174 || parsed.excludedAmbiguousCodeCount !== 54) throw new Error("UCAS locked scope changed.");
if (new Set(candidate.programs.map((row) => row.slug)).size !== 174 || candidate.programs.some((row) => row.degreeLevel !== "Master" || row.teachingLanguage !== "English" || !row.sourceFieldLineage?.degreeLevel?.includes("derived"))) throw new Error("UCAS program interpretation changed.");
if (candidate.scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("UCAS scholarship rich fields incomplete.");
if (evidence.length !== 6 || evidence.some((row: any) => row.status !== 200 || row.contentType !== "text/html" || !/^[a-f0-9]{64}$/.test(row.sha256) || row.byteLength > 15 * 1024 * 1024)) throw new Error("UCAS official evidence manifest incomplete.");

const schoolSlug = "university-of-chinese-academy-of-sciences", programSlugs = candidate.programs.map((row) => row.slug), scholarshipSlugs = candidate.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(JSON.parse(stateText)), max: 1, applicationName: "cuac:ucas-complete-review" });
let preflight: any;
try {
  const schools = await pool.query("select id,slug,name_en,name_zh,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", [schoolSlug, "University of Chinese Academy of Sciences", "中国科学院大学"]);
  const conflicts = await pool.query("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'");
  preflight = { schools: schools.rows, conflicts: conflicts.rows, city: city.rows };
  if (schools.rows.length || conflicts.rows.length || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error(`UCAS safe-new baseline mismatch: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, newSchoolCount: 1, programRouteCount: 174, degreeCounts: { Master: 174 }, languageCounts: { English: 174 }, programIntakeCount: 174, newScholarshipCount: 3, cityOverwriteCount: 0, schoolOverwriteCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  sourceManifestSha256: sha(manifestText), parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceReview: { result: "pass", note: "Six registered official UCAS 2026 HTML sources were captured within policy. The 2026 graduate call directly links the current major index as the English-instructed master's-program list. Only 174 subject codes with one stable label are included; 54 codes with conflicting labels are excluded. Three 2026 scholarship records preserve published coverage, eligibility, materials, deadlines and application routes." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolCount: 0, candidateSlugConflictCount: 0, cityDependency: preflight.city[0] } },
  coverageLimitations: [
    "This first batch includes only unambiguous English-instructed master's majors. Chinese-instructed and doctoral program identities are not inferred from the shared major index.",
    "Fifty-four subject codes map to multiple conflicting English labels on the official index and are excluded pending direct program-level evidence.",
    "Host faculty or CAS institute is selected in the UCAS application system and is not assigned where the captured index does not publish an unambiguous host mapping.",
    "The CAS-ANSO page publishes itemized benefit values in an image; this batch uses only the benefit categories explicitly stated in captured HTML and does not transcribe unseen image values.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence selection", note: "Only public institutional, program, admissions and scholarship policy data are included. The official admission page's bank/payment details and all public staff contact details were excluded; no applicant records or account data are present in the candidate." },
  reviewNotes: ["Eligible for standing-authorized publication because the school and every candidate slug are absent, with no overwrite, archive or deletion.", "The Beijing city dependency is replayed only if it remains byte-for-byte equal to the reviewed baseline.", "All three scholarships contain coverage, benefits, eligibility, materials, steps and official action links.", "Program degree and language are explicitly marked as a cross-source derivation from the 2026 call's direct link context, not guessed from subject codes."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-ucas-complete-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, paths }, null, 2));
