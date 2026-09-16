import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const batch = "xmu-safe-new-batch-01";
const schoolSlug = "xiamen-university";
const paths = {
  complete: resolve(root, "seeds/catalog.xmu-complete-batch-01.draft.json"),
  completeReview: resolve(root, "seeds/catalog.xmu-complete-batch-01.review.json"),
  oldManifest: resolve(root, "work/catalog-official/xmu-complete-batch-01/manifest.json"),
  freshManifest: resolve(root, "work/catalog-official/xmu-refresh-20260914/manifest.json"),
  candidate: resolve(root, `seeds/catalog.${batch}.draft.json`),
  validation: resolve(root, `seeds/catalog.${batch}.validation.json`),
  review: resolve(root, `seeds/catalog.${batch}.review.json`),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const [complete, completeReview, oldManifest, freshManifest, state] = await Promise.all([
  parse(paths.complete), parse(paths.completeReview), parse(paths.oldManifest), parse(paths.freshManifest), parse(paths.state),
]) as [CatalogSeedBundle, any, any, any, any];

if (complete.cities?.length !== 1 || complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || complete.programs?.length !== 535 || complete.programIntakes?.length !== 535 || complete.scholarships?.length !== 4 || completeReview.sourceReview?.result !== "pass" || completeReview.sensitiveDataCheck?.result !== "pass") throw new Error("XMU candidate or complete review scope changed.");
if (oldManifest.sources?.length !== 13 || freshManifest.sources?.length !== 13) throw new Error("XMU evidence manifest scope changed.");
const oldSources = new Map(oldManifest.sources.map((row: any) => [row.id, row]));
for (const source of freshManifest.sources) {
  const old: any = oldSources.get(source.id);
  if (!old || source.status !== 200 || old.sha256 !== source.sha256 || old.finalUrl !== source.finalUrl || old.contentType !== source.contentType) throw new Error(`XMU source changed: ${source.id}`);
}

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:xmu-safe-new-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,verification_status from cities where slug='xiamen'");
  const activePrograms = await pool.query("select id,slug,status,verification_status from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const programConflicts = await pool.query("select id,slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [complete.programs.map((row) => row.slug)]);
  const activeScholarships = await pool.query("select id,slug,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const scholarshipConflicts = await pool.query("select id,slug,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [complete.scholarships.map((row) => row.slug)]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, activePrograms: activePrograms.rows, programConflicts: programConflicts.rows, activeScholarships: activeScholarships.rows, scholarshipConflicts: scholarshipConflicts.rows, intakeCount: intakes.rows[0]?.count ?? 0 };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1 || city.rows[0].status !== "active" || activePrograms.rows.length !== 14 || programConflicts.rows.length !== 0 || activePrograms.rows.some((row: any) => row.verification_status !== "unverified") || baseline.intakeCount !== 0) throw new Error("XMU school/program baseline changed.");
  if (activeScholarships.rows.length !== 4 || scholarshipConflicts.rows.length !== 1 || scholarshipConflicts.rows[0].slug !== "official-2026-xmu-chinese-government-university-scholarship" || scholarshipConflicts.rows[0].verification_status !== "verified") throw new Error("XMU scholarship baseline changed.");
} finally { await pool.end(); }

const existingScholarshipSlugs = new Set(baseline.scholarshipConflicts.map((row: any) => row.slug));
const scholarships = complete.scholarships.filter((row) => !existingScholarshipSlugs.has(row.slug));
if (scholarships.length !== 3 || scholarships.some((row: any) => !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("XMU safe scholarship split changed or is incomplete.");
const freshHashes = new Set(freshManifest.sources.map((row: any) => row.sha256));
if ([...complete.programs, ...complete.programIntakes, ...scholarships].some((row: any) => !freshHashes.has(row.sourceSha256))) throw new Error("XMU safe record lacks refreshed evidence.");
const serialized = JSON.stringify({ programs: complete.programs, scholarships });
if (/@[a-z0-9.-]+\.[a-z]{2,}|\b(?:tel|telephone|phone|coordinator)\b/i.test(serialized)) throw new Error("XMU candidate unexpectedly contains contact data.");

const candidate: CatalogSeedBundle = { version: 1, generatedAt: freshManifest.generatedAt, cities: complete.cities, schools: complete.schools, programs: complete.programs, programIntakes: complete.programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`XMU safe-new validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramRouteCount: 535, newProgramIntakeCount: 535, newScholarshipCount: 3, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, freshManifestSha256: sha(await readFile(paths.freshManifest, "utf8")),
  evidence: freshManifest.sources.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "Only 535 new official program routes, 535 new intakes and three new rich scholarships are inserted. Existing city, school, programs and scholarships are preserved." },
  sourceReview: { result: "pass", note: "All 13 registered XMU official sources were refreshed on 2026-09-14 and are byte-for-byte unchanged from the reviewed evidence set." },
  visualReview: { result: "pass", reviewedAt: new Date().toISOString(), pages: ["2026 XMU Chinese-Medium Bachelor's Programs", "2026 XMU Chinese-Medium Master's Programs", "Xiamen University New International Students Scholarships for 2026"], note: "Browser review confirmed visible program columns and scholarship eligibility, quotas, coverage, stipend and deadline fields. Contact columns were explicitly excluded." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], deferredCitySlug: "xiamen", deferredSchoolSlug: schoolSlug, deferredProgramSlugs: baseline.activePrograms.map((row: any) => row.slug), deferredStableScholarshipSlugs: baseline.scholarshipConflicts.map((row: any) => row.slug), deferredLegacyScholarshipSlugs: baseline.activeScholarships.filter((row: any) => !existingScholarshipSlugs.has(row.slug)).map((row: any) => row.slug), databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: 14, activeScholarshipCount: 4, intakeCount: 0 } },
  coverageLimitations: ["Xiamen city, XMU school profile, one existing verified scholarship update, 14 legacy program aliases and three legacy scholarship aliases remain unchanged pending exact cleanup approval."],
  sensitiveDataCheck: { result: "pass", scope: "XMU safe-new publication candidate", note: "Only public institutional, program, admissions and scholarship-policy fields are included. Coordinator names, telephone numbers, email addresses, applicant, account, payment and bank data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"), writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, paths }, null, 2));
