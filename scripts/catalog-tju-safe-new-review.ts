import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "tju-safe-new-batch-01";
const paths = {
  complete: resolve(root, "seeds/catalog.tju-complete-batch-01.draft.json"),
  completeReview: resolve(root, "seeds/catalog.tju-complete-batch-01.review.json"),
  freshManifest: resolve(root, "work/catalog-official/tju-refresh-20260914/manifest.json"),
  oldManifests: [
    resolve(root, "work/catalog-official/tju-complete-batch-01/manifest.json"),
    resolve(root, "work/catalog-official/tju-csca-batch-01/manifest.json"),
  ],
  candidate: resolve(root, `seeds/catalog.${batch}.draft.json`),
  validation: resolve(root, `seeds/catalog.${batch}.validation.json`),
  review: resolve(root, `seeds/catalog.${batch}.review.json`),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [complete, completeReview, freshManifest, state, ...oldManifests] = await Promise.all([
  parse(paths.complete), parse(paths.completeReview), parse(paths.freshManifest), parse(paths.state), ...paths.oldManifests.map(parse),
]) as [CatalogSeedBundle, any, any, any, ...any[]];
const schoolSlug = "tianjin-university";
if (complete.cities?.length !== 1 || complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || complete.programs?.length !== 296 || complete.programIntakes?.length !== 296 || complete.scholarships?.length !== 6 || freshManifest.sources?.length !== 13 || completeReview.sourceReview?.result !== "pass" || completeReview.sensitiveDataCheck?.result !== "pass") throw new Error("TJU candidate or reviewed source scope changed.");
const oldSources = new Map(oldManifests.flatMap((manifest: any) => manifest.sources ?? []).map((row: any) => [row.id, row]));
for (const source of freshManifest.sources) {
  const old: any = oldSources.get(source.id);
  if (!old || old.sha256 !== source.sha256 || old.finalUrl !== source.finalUrl || old.contentType !== source.contentType) throw new Error(`TJU source changed: ${source.id}`);
}
const programSlugs = complete.programs.map((row) => row.slug), scholarshipSlugs = complete.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:tju-safe-new-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,verification_status from cities where slug='tianjin'");
  const activePrograms = await pool.query("select id,slug,status,verification_status from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const conflicts = await pool.query("select id,slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [programSlugs]);
  const scholarshipConflicts = await pool.query("select id,slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [scholarshipSlugs]);
  const activeScholarships = await pool.query("select id,slug,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, activePrograms: activePrograms.rows, conflicts: conflicts.rows, scholarshipConflicts: scholarshipConflicts.rows, activeScholarships: activeScholarships.rows, intakeCount: intakes.rows[0]?.count ?? 0 };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1 || city.rows[0].status !== "active" || activePrograms.rows.length !== 13 || conflicts.rows.length !== 0 || activePrograms.rows.some((row: any) => row.verification_status !== "unverified")) throw new Error("TJU dependency/program baseline changed.");
  if (scholarshipConflicts.rows.length !== 1 || scholarshipConflicts.rows[0].slug !== "official-2026-tju-silk-road-scholarship" || scholarshipConflicts.rows[0].status !== "active" || scholarshipConflicts.rows[0].verification_status !== "verified" || activeScholarships.rows.length !== 5) throw new Error("TJU scholarship baseline changed.");
} finally { await pool.end(); }
const conflictingScholarships = new Set(baseline.scholarshipConflicts.map((row: any) => row.slug));
const scholarships = complete.scholarships.filter((row) => !conflictingScholarships.has(row.slug));
if (scholarships.length !== 5 || scholarships.some((row: any) => !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("TJU safe scholarship split is incomplete or changed.");
const freshHashes = new Set(freshManifest.sources.map((row: any) => row.sha256));
if ([...complete.programs, ...complete.programIntakes, ...scholarships].some((row: any) => !freshHashes.has(row.sourceSha256))) throw new Error("TJU safe record lacks freshly confirmed evidence.");
const candidate: CatalogSeedBundle = { version: 1, generatedAt: freshManifest.generatedAt, cities: complete.cities, schools: complete.schools, programs: complete.programs, programIntakes: complete.programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`, validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`TJU safe-new validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramRouteCount: 296, newProgramIntakeCount: 296, newScholarshipCount: 5, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, freshManifestSha256: sha(await readFile(paths.freshManifest, "utf8")),
  evidence: freshManifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts only 296 new official program routes, 296 intakes and five new rich scholarships. Tianjin city and Tianjin University are read-only dependencies; no record is overwritten or archived." },
  sourceReview: { ...completeReview.sourceReview, freshnessNote: "All 13 registered TJU sources were refreshed on 2026-09-14 and are byte-for-byte unchanged from the interpreted review set." },
  visualReview: { result: "pass", pagesReviewed: completeReview.sourceReview.cscaPdfPagesReviewed, note: "The official three-page CSCA PDF was rendered and visually reviewed as recorded in the complete-batch source review." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], deferredLegacyProgramSlugs: baseline.activePrograms.map((row: any) => row.slug), deferredStableScholarshipSlugs: baseline.scholarshipConflicts.map((row: any) => row.slug), deferredLegacyScholarshipSlugs: baseline.activeScholarships.filter((row: any) => !conflictingScholarships.has(row.slug)).map((row: any) => row.slug), databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: baseline.activePrograms.length, activeScholarshipCount: baseline.activeScholarships.length, intakeCount: baseline.intakeCount } },
  coverageLimitations: ["The school profile, shared Tianjin city, one stable scholarship update, 13 legacy program aliases and four legacy scholarships remain unchanged pending explicit cleanup approval."],
  sensitiveDataCheck: { result: "pass", scope: "safe-new publication candidate", note: "Only public institutional, program, admissions and scholarship-policy fields are included. Applicant, account, payment, bank, staff-name and personal-contact data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase)), publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"), writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, paths }, null, 2));
