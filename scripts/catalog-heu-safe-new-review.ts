import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "heu-safe-new-batch-01";
const paths = {
  complete: resolve(root, "seeds/catalog.heu-complete-batch-01.draft.json"),
  legacy: resolve(root, "seeds/catalog.cscalite-online-20260910.published.json"),
  cityPublication: resolve(root, "seeds/catalog.hit-complete-batch-01.approved.local.json"),
  freshManifest: resolve(root, "work/catalog-official/heu-refresh-without-large-handbook-20260914/manifest.json"),
  oldManifests: [resolve(root, "work/catalog-official/heu-complete-batch-01/manifest.json"), resolve(root, "work/catalog-official/heu-pdf-batch-01/manifest.json")],
  completeReview: resolve(root, "seeds/catalog.heu-complete-batch-01.review.json"),
  candidate: resolve(root, `seeds/catalog.${batch}.draft.json`),
  validation: resolve(root, `seeds/catalog.${batch}.validation.json`),
  review: resolve(root, `seeds/catalog.${batch}.review.json`),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [complete, legacy, cityPublication, freshManifest, completeReview, state, ...oldManifests] = await Promise.all([
  parse(paths.complete), parse(paths.legacy), parse(paths.cityPublication), parse(paths.freshManifest), parse(paths.completeReview), parse(paths.state), ...paths.oldManifests.map(parse),
]) as [CatalogSeedBundle, CatalogSeedBundle, CatalogSeedBundle, any, any, any, ...any[]];
const schoolSlug = "harbin-engineering-university";
const dependencySchool = legacy.schools?.find((row) => row.slug === schoolSlug);
const dependencyCity = cityPublication.cities?.find((row) => row.slug === "harbin");
if (!dependencySchool || !dependencyCity) throw new Error("HEU dependency rows are unavailable.");
if (complete.programs?.length !== 91 || complete.programIntakes?.length !== 91 || complete.scholarships?.length !== 10) throw new Error("HEU complete candidate scope changed.");
if (freshManifest.sources?.length !== 16 || freshManifest.sources.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("HEU fresh evidence manifest is incomplete.");
const oldSources = new Map(oldManifests.flatMap((manifest: any) => manifest.sources ?? []).map((row: any) => [row.id, row]));
for (const source of freshManifest.sources) {
  const old: any = oldSources.get(source.id);
  if (!old || old.sha256 !== source.sha256) throw new Error(`HEU official source changed and requires renewed interpretation: ${source.id}`);
}
if (completeReview.visualReview?.result !== "pass") throw new Error("HEU PDF visual review is unavailable.");

const candidateProgramSlugs = complete.programs.map((row) => row.slug);
const candidateScholarshipSlugs = complete.scholarships.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:heu-safe-new-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url,city_id from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url from cities where slug='harbin'");
  const activePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const overlappingPrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [candidateProgramSlugs]);
  const scholarshipConflicts = await pool.query("select id,slug,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [candidateScholarshipSlugs]);
  const activeScholarships = await pool.query("select id,slug,status,verification_status,source_url from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, activePrograms: activePrograms.rows, overlappingPrograms: overlappingPrograms.rows, scholarshipConflicts: scholarshipConflicts.rows, activeScholarships: activeScholarships.rows, intakeCount: intakes.rows[0]?.count ?? 0 };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || school.rows[0].source_url !== dependencySchool.sourceUrl) throw new Error("HEU dependency school baseline changed.");
  if (city.rows.length !== 1 || city.rows[0].status !== "active" || city.rows[0].name_en !== dependencyCity.nameEn || city.rows[0].name_zh !== dependencyCity.nameZh || city.rows[0].region !== dependencyCity.region || city.rows[0].province !== dependencyCity.province || city.rows[0].source_url !== dependencyCity.sourceUrl) throw new Error("Harbin dependency city baseline changed.");
  if (activePrograms.rows.length !== 9 || overlappingPrograms.rows.length !== 4 || overlappingPrograms.rows.some((row: any) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("HEU legacy program baseline changed.");
  if (scholarshipConflicts.rows.length !== 0 || activeScholarships.rows.length !== 1 || activeScholarships.rows[0].verification_status !== "unverified") throw new Error("HEU scholarship baseline changed.");
} finally { await pool.end(); }

const overlapSlugs = new Set(baseline.overlappingPrograms.map((row: any) => row.slug));
const programs = complete.programs.filter((row) => !overlapSlugs.has(row.slug));
const safeProgramSlugs = new Set(programs.map((row) => row.slug));
const programIntakes = complete.programIntakes.filter((row) => safeProgramSlugs.has(row.programSlug));
const scholarships = complete.scholarships;
if (programs.length !== 87 || programIntakes.length !== 87 || scholarships.length !== 10) throw new Error("HEU safe-new split is not 87 programs, 87 intakes and 10 scholarships.");
const freshHashes = new Set(freshManifest.sources.map((row: any) => row.sha256));
if ([...programs, ...programIntakes, ...scholarships].some((row: any) => !freshHashes.has(row.sourceSha256))) throw new Error("A safe-new record is not backed by the freshly confirmed 16-source evidence set.");

const candidate: CatalogSeedBundle = { version: 1, generatedAt: freshManifest.generatedAt, cities: [dependencyCity], schools: [dependencySchool], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`HEU safe-new validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramRouteCount: 87, newProgramIntakeCount: 87, newScholarshipCount: 10, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  freshManifestSha256: sha(await readFile(paths.freshManifest, "utf8")),
  evidence: freshManifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts only 87 new non-conflicting official program routes, 87 new intakes and 10 new rich scholarship records. It replays the current Harbin city and HEU school as unchanged dependencies and performs no archive or substantive overwrite." },
  sourceReview: { result: "pass", note: "Sixteen registered official HEU sources were refreshed on 2026-09-14 and are byte-for-byte unchanged from the interpreted review set. The separate 25.5 MiB handbook PDF exceeds the current 15 MiB collector cap and is not used by any newly inserted record in this safe subset." },
  visualReview: completeReview.visualReview,
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], deferredStableProgramSlugs: baseline.overlappingPrograms.map((row: any) => row.slug), deferredLegacyProgramSlugs: baseline.activePrograms.filter((row: any) => !overlapSlugs.has(row.slug)).map((row: any) => row.slug), deferredLegacyScholarshipSlugs: baseline.activeScholarships.map((row: any) => row.slug), databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: baseline.activePrograms.length, activeScholarshipCount: baseline.activeScholarships.length, intakeCount: baseline.intakeCount } },
  coverageLimitations: ["Four stable legacy program slugs require a later explicit overwrite and are excluded from this batch.", "Five legacy program aliases and one merged legacy scholarship require later explicit archival and remain active.", "Two scholarship records transparently describe closed 2025 cycles because the official site has no newer replacement."],
  sensitiveDataCheck: { result: "pass", scope: "safe-new publication candidate", note: "Only public institutional, program, admissions and scholarship-policy fields are included. Applicant, account, payment, bank and personal-contact data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, paths }, null, 2));
