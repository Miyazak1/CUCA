import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "ustb-safe-new-batch-01";
const paths = {
  complete: resolve(root, "seeds/catalog.ustb-complete-batch-01.draft.json"),
  freshManifest: resolve(root, "work/catalog-official/ustb-refresh-20260914/manifest.json"),
  oldManifest: resolve(root, "work/catalog-official/ustb-complete-batch-01/manifest.json"),
  completeReview: resolve(root, "seeds/catalog.ustb-complete-batch-01.review.json"),
  candidate: resolve(root, `seeds/catalog.${batch}.draft.json`),
  validation: resolve(root, `seeds/catalog.${batch}.validation.json`),
  review: resolve(root, `seeds/catalog.${batch}.review.json`),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [complete, freshManifest, oldManifest, completeReview, state] = await Promise.all([
  parse(paths.complete), parse(paths.freshManifest), parse(paths.oldManifest), parse(paths.completeReview), parse(paths.state),
]) as [CatalogSeedBundle, any, any, any, any];
const schoolSlug = "university-of-science-and-technology-beijing";
if (complete.cities?.length !== 1 || complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug
  || complete.programs?.length !== 156 || complete.programIntakes?.length !== 156 || complete.scholarships?.length !== 5) {
  throw new Error("USTB complete candidate scope changed.");
}
if (freshManifest.sources?.length !== 14 || freshManifest.sources.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) {
  throw new Error("USTB fresh evidence manifest is incomplete.");
}
const oldSources = new Map((oldManifest.sources ?? []).map((row: any) => [row.id, row]));
for (const source of freshManifest.sources) {
  const old: any = oldSources.get(source.id);
  if (!old || old.sha256 !== source.sha256 || old.finalUrl !== source.finalUrl || old.contentType !== source.contentType) {
    throw new Error(`USTB official source changed and requires renewed interpretation: ${source.id}`);
  }
}
if (completeReview.sourceReview?.result !== "pass" || completeReview.visualReview?.result !== "pass" || completeReview.sensitiveDataCheck?.result !== "pass") {
  throw new Error("USTB complete review is unavailable.");
}

const candidateProgramSlugs = complete.programs.map((row) => row.slug);
const candidateScholarshipSlugs = complete.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ustb-safe-new-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url,city_id from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,verification_status from cities where slug='beijing'");
  const activePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const overlappingPrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [candidateProgramSlugs]);
  const scholarshipConflicts = await pool.query("select id,slug,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [candidateScholarshipSlugs]);
  const activeScholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, activePrograms: activePrograms.rows, overlappingPrograms: overlappingPrograms.rows, scholarshipConflicts: scholarshipConflicts.rows, activeScholarships: activeScholarships.rows, intakeCount: intakes.rows[0]?.count ?? 0 };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error("USTB dependency baseline changed.");
  if (activePrograms.rows.length !== 12 || overlappingPrograms.rows.length !== 11 || overlappingPrograms.rows.some((row: any) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("USTB legacy program baseline changed.");
  if (scholarshipConflicts.rows.length !== 0 || activeScholarships.rows.length !== 1 || activeScholarships.rows[0].status !== "active" || activeScholarships.rows[0].verification_status !== "unverified") throw new Error("USTB scholarship baseline changed.");
} finally { await pool.end(); }

const overlapSlugs = new Set(baseline.overlappingPrograms.map((row: any) => row.slug));
const programs = complete.programs.filter((row) => !overlapSlugs.has(row.slug));
const safeProgramSlugs = new Set(programs.map((row) => row.slug));
const programIntakes = complete.programIntakes.filter((row) => safeProgramSlugs.has(row.programSlug));
const scholarships = complete.scholarships;
if (programs.length !== 145 || programIntakes.length !== 145 || scholarships.length !== 5) throw new Error("USTB safe-new split changed.");
const freshHashes = new Set(freshManifest.sources.map((row: any) => row.sha256));
if ([...programs, ...programIntakes, ...scholarships].some((row: any) => !freshHashes.has(row.sourceSha256))) throw new Error("A USTB safe-new record lacks freshly confirmed evidence.");

const candidate: CatalogSeedBundle = { version: 1, generatedAt: freshManifest.generatedAt, cities: complete.cities, schools: complete.schools, programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`USTB safe-new validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramRouteCount: 145, newProgramIntakeCount: 145, newScholarshipCount: 5, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  freshManifestSha256: sha(await readFile(paths.freshManifest, "utf8")),
  evidence: freshManifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts only 145 new non-conflicting official program routes, 145 new intakes and five new rich scholarship records. Beijing city and the USTB school are read-only dependencies; no record is overwritten or archived." },
  sourceReview: { result: "pass", note: "Fourteen registered official USTB 2026/2026-2027 pages were refreshed on 2026-09-14 and are byte-for-byte unchanged from the interpreted review set." },
  visualReview: completeReview.visualReview,
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], deferredStableProgramSlugs: baseline.overlappingPrograms.map((row: any) => row.slug), deferredLegacyProgramSlugs: baseline.activePrograms.filter((row: any) => !overlapSlugs.has(row.slug)).map((row: any) => row.slug), deferredLegacyScholarshipSlugs: baseline.activeScholarships.map((row: any) => row.slug), databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: baseline.activePrograms.length, activeScholarshipCount: baseline.activeScholarships.length, intakeCount: baseline.intakeCount } },
  coverageLimitations: ["Eleven stable legacy program slugs require explicit overwrite and are excluded.", "One erroneous legacy program alias and one merged legacy scholarship require explicit archival and remain active.", "The USTB school and Beijing city profile remain unchanged pending explicit overwrite approval."],
  sensitiveDataCheck: { result: "pass", scope: "safe-new publication candidate", note: "Only public institutional, program, admissions and scholarship-policy fields are included. Applicant, account, payment, bank, staff-name and personal-contact data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, paths }, null, 2));
