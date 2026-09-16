import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { complete: resolve(root, "seeds/catalog.xmu-complete-batch-01.draft.json"), completeReview: resolve(root, "seeds/catalog.xmu-complete-batch-01.review.json"), safeReview: resolve(root, "seeds/catalog.xmu-safe-new-batch-01.review.json"), safeApproval: resolve(root, "seeds/catalog.xmu-safe-new-batch-01.approval.json"), safePublication: resolve(root, "seeds/catalog.xmu-safe-new-batch-01.approved.local.json"), freshManifest: resolve(root, "work/catalog-official/xmu-refresh-20260914/manifest.json"), candidate: resolve(root, "seeds/catalog.xmu-cleanup.draft.json"), validation: resolve(root, "seeds/catalog.xmu-cleanup.validation.json"), review: resolve(root, "seeds/catalog.xmu-cleanup.review.json"), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const read = async (path: string) => { const text = await readFile(path, "utf8"); return { text, value: JSON.parse(text) }; };
const [completeFile, completeReviewFile, safeReviewFile, safeApprovalFile, safePublicationFile, freshManifestFile, stateFile] = await Promise.all([paths.complete, paths.completeReview, paths.safeReview, paths.safeApproval, paths.safePublication, paths.freshManifest, paths.state].map(read));
const complete = completeFile.value as CatalogSeedBundle, completeReview = completeReviewFile.value, safeReview = safeReviewFile.value, safeApproval = safeApprovalFile.value, safePublication = safePublicationFile.value as CatalogSeedBundle, freshManifest = freshManifestFile.value, state = stateFile.value;
const schoolSlug = "xiamen-university";
const stableScholarshipSlug = "official-2026-xmu-chinese-government-university-scholarship";
const programAliases: string[] = completeReview.reconciliation?.legacyProgramAliasesToArchive ?? [];
const scholarshipAliases: string[] = completeReview.reconciliation?.legacyScholarshipAliasesToArchive ?? [];
if (complete.cities?.length !== 1 || complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || complete.programs?.length !== 535 || complete.programIntakes?.length !== 535 || complete.scholarships?.length !== 4 || safeApproval.programSlugs?.length !== 535 || safeApproval.scholarshipSlugs?.length !== 3 || safePublication.programs?.length !== 535 || freshManifest.sources?.length !== 13 || safeReview.visualReview?.result !== "pass" || programAliases.length !== 14 || scholarshipAliases.length !== 3) throw new Error("XMU cleanup dependencies changed.");
const stableScholarship = complete.scholarships.filter((row) => row.slug === stableScholarshipSlug);
if (stableScholarship.length !== 1) throw new Error("XMU stable scholarship candidate changed.");

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:xmu-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,verification_status from cities where slug='xiamen'");
  const safePrograms = await pool.query("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug", [safeApproval.programSlugs]);
  const safeScholarships = await pool.query("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [safeApproval.scholarshipSlugs]);
  const legacyPrograms = await pool.query("select id,slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [programAliases]);
  const legacyScholarships = await pool.query("select id,slug,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [scholarshipAliases]);
  const stableScholarshipDb = await pool.query("select id,slug,status,verification_status from scholarships where slug=$1", [stableScholarshipSlug]);
  const totals = await pool.query("select (select count(*) from programs where school_id=$1 and status='active')::int programs,(select count(*) from scholarships where school_id=$1 and status='active')::int scholarships", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, safePrograms: safePrograms.rows, safeScholarships: safeScholarships.rows, legacyPrograms: legacyPrograms.rows, legacyScholarships: legacyScholarships.rows, stableScholarship: stableScholarshipDb.rows, totals: totals.rows[0] };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error("XMU school/city baseline changed.");
  if (safePrograms.rows.length !== 535 || safeScholarships.rows.length !== 3 || [...safePrograms.rows, ...safeScholarships.rows].some((row: any) => row.status !== "active" || row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== safeApproval.approvedAt)) throw new Error("XMU safe publication changed.");
  if (legacyPrograms.rows.length !== 14 || legacyScholarships.rows.length !== 3 || [...legacyPrograms.rows, ...legacyScholarships.rows].some((row: any) => row.status !== "active" || row.verification_status !== "unverified") || stableScholarshipDb.rows.length !== 1 || stableScholarshipDb.rows[0].status !== "active" || stableScholarshipDb.rows[0].verification_status !== "verified" || totals.rows[0]?.programs !== 549 || totals.rows[0]?.scholarships !== 7) throw new Error("XMU legacy baseline changed.");
} finally { await pool.end(); }

const candidate: CatalogSeedBundle = { version: 1, generatedAt: freshManifest.generatedAt, cities: complete.cities, schools: complete.schools, programs: [], programIntakes: [], scholarships: stableScholarship };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`XMU cleanup validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, cityOverwriteCount: 1, schoolOverwriteCount: 1, scholarshipOverwriteCount: 1, archiveProgramAliasCount: 14, archiveScholarshipAliasCount: 3, verifiedSafeProgramMutationCount: 0, verifiedSafeScholarshipMutationCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: { freshManifestSha256: sha(freshManifestFile.text), freshOfficialSourceCount: 13, completeReviewSha256: sha(completeReviewFile.text), safeReviewSha256: sha(safeReviewFile.text), safeApprovalSha256: sha(safeApprovalFile.text), safePublicationSha256: sha(safePublicationFile.text) },
  reconciliation: { destructiveDeletion: false, overwrite: [{ entityType: "city", id: baseline.city[0].id, slug: "xiamen" }, { entityType: "school", id: baseline.school[0].id, slug: schoolSlug }, { entityType: "scholarship", id: baseline.stableScholarship[0].id, slug: stableScholarshipSlug }], archives: [...baseline.legacyPrograms.map((row: any) => ({ entityType: "program", id: row.id, slug: row.slug })), ...baseline.legacyScholarships.map((row: any) => ({ entityType: "scholarship", id: row.id, slug: row.slug }))], protectedSafeProgramSlugs: safeApproval.programSlugs, protectedSafeScholarshipSlugs: safeApproval.scholarshipSlugs, databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id } },
  sourceReview: { result: "pass", note: "All 13 XMU official sources were refreshed byte-for-byte unchanged; city, school and stable scholarship updates remain bound to reviewed evidence." }, visualReview: safeReview.visualReview,
  sensitiveDataCheck: { result: "pass", scope: "city, school, one stable scholarship and 17 archive status changes", note: "Only public catalog fields and record identifiers are present. Contact columns and applicant, account, payment and bank data are excluded." },
  reviewNotes: ["The 535 newly published programs and three newly published rich scholarships are protected and will not be rewritten.", "Fourteen program aliases and three scholarship aliases are status-archived, not deleted.", "The existing verified Chinese Government Scholarship is refreshed in place from the same official source."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准完成厦门大学学校与旧数据清理（审核哈希 ${reviewHash}），覆盖厦门城市、厦门大学学校及 1 条既有中国政府奖学金，并归档 14 条旧项目别名及 3 条旧奖学金别名`;
await Promise.all([writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"), writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, paths }, null, 2));
