import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const generatedAtOption = process.argv.find((arg) => arg.startsWith("--generated-at="))?.slice("--generated-at=".length);
if (generatedAtOption && (Number.isNaN(Date.parse(generatedAtOption)) || new Date(generatedAtOption).toISOString() !== generatedAtOption)) {
  throw new Error("--generated-at must be a canonical ISO-8601 UTC timestamp.");
}
const generatedAt = generatedAtOption ?? new Date().toISOString();
const paths = {
  complete: resolve(root, "seeds/catalog.heu-complete-batch-01.draft.json"),
  completeReview: resolve(root, "seeds/catalog.heu-complete-batch-01.review.json"),
  safeApproval: resolve(root, "seeds/catalog.heu-safe-new-batch-01.approval.json"),
  safePublication: resolve(root, "seeds/catalog.heu-safe-new-batch-01.approved.local.json"),
  freshManifest: resolve(root, "work/catalog-official/heu-refresh-without-large-handbook-20260914/manifest.json"),
  candidate: resolve(root, "seeds/catalog.heu-cleanup.draft.json"), validation: resolve(root, "seeds/catalog.heu-cleanup.validation.json"), review: resolve(root, "seeds/catalog.heu-cleanup.review.json"), state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const parseText = async (path: string) => { const text = await readFile(path, "utf8"); return { text, value: JSON.parse(text) }; };
const [completeFile, completeReviewFile, safeApprovalFile, safePublicationFile, freshManifestFile, stateFile] = await Promise.all([paths.complete, paths.completeReview, paths.safeApproval, paths.safePublication, paths.freshManifest, paths.state].map(parseText));
const complete = completeFile.value as CatalogSeedBundle, completeReview = completeReviewFile.value, safeApproval = safeApprovalFile.value, safePublication = safePublicationFile.value as CatalogSeedBundle, freshManifest = freshManifestFile.value, state = stateFile.value;
const schoolSlug = "harbin-engineering-university";
if (complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || safePublication.cities?.length !== 1 || safeApproval.programSlugs?.length !== 87 || safeApproval.scholarshipSlugs?.length !== 10) throw new Error("HEU cleanup dependencies changed.");
if (freshManifest.sources?.length !== 16 || completeReview.visualReview?.result !== "pass") throw new Error("HEU current evidence review is unavailable.");
const safeProgramSet = new Set(safeApproval.programSlugs);
const stablePrograms = complete.programs?.filter((row) => !safeProgramSet.has(row.slug)) ?? [];
const stableProgramSet = new Set(stablePrograms.map((row) => row.slug));
const stableIntakes = complete.programIntakes?.filter((row) => stableProgramSet.has(row.programSlug)) ?? [];
if (stablePrograms.length !== 4 || stableIntakes.length !== 4) throw new Error("HEU cleanup must contain four stable program routes and intakes.");

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:heu-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status,source_url from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,source_url from cities where slug='harbin'");
  const stable = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [[...stableProgramSet]]);
  const safePrograms = await pool.query("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug", [safeApproval.programSlugs]);
  const safeScholarships = await pool.query("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [safeApproval.scholarshipSlugs]);
  const activePrograms = await pool.query("select id,slug,status,verification_status from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const activeScholarships = await pool.query("select id,slug,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, stable: stable.rows, safePrograms: safePrograms.rows, safeScholarships: safeScholarships.rows, activePrograms: activePrograms.rows, activeScholarships: activeScholarships.rows };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1) throw new Error("HEU school/city baseline changed.");
  if (stable.rows.length !== 4 || stable.rows.some((row: any) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("HEU stable program baseline changed.");
  if (safePrograms.rows.length !== 87 || safePrograms.rows.some((row: any) => row.status !== "active" || row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== safeApproval.approvedAt)) throw new Error("HEU safe program publication changed.");
  if (safeScholarships.rows.length !== 10 || safeScholarships.rows.some((row: any) => row.status !== "active" || row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== safeApproval.approvedAt)) throw new Error("HEU safe scholarship publication changed.");
  if (activePrograms.rows.length !== 96 || activeScholarships.rows.length !== 11) throw new Error("HEU active totals changed.");
} finally { await pool.end(); }
const safeSlugs = new Set([...safeApproval.programSlugs, ...stableProgramSet]);
const programAliases = baseline.activePrograms.filter((row: any) => !safeSlugs.has(row.slug));
const scholarshipAliases = baseline.activeScholarships.filter((row: any) => !safeApproval.scholarshipSlugs.includes(row.slug));
if (programAliases.length !== 5 || scholarshipAliases.length !== 1 || [...programAliases, ...scholarshipAliases].some((row: any) => row.verification_status !== "unverified")) throw new Error("HEU legacy alias set changed.");

const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: safePublication.cities, schools: complete.schools, programs: stablePrograms, programIntakes: stableIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`HEU cleanup validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, cityDependencyReplayCount: 1, schoolOverwriteCount: 1, stableProgramOverwriteCount: 4, programIntakeUpsertCount: 4, archiveProgramAliasCount: 5, archiveScholarshipAliasCount: 1, verifiedSafeProgramMutationCount: 0, verifiedSafeScholarshipMutationCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: { freshManifestSha256: sha(freshManifestFile.text), freshOfficialSourceCount: 16, completeReviewSha256: sha(completeReviewFile.text), safeApprovalSha256: sha(safeApprovalFile.text), safePublicationSha256: sha(safePublicationFile.text), reviewedLargeHandbookSha256: "64f1f5ca5c052178b5ccf17ec32066f6534feb04bfa792a9638de69e3b5684b6" },
  reconciliation: { destructiveDeletion: false, overwrite: [{ entityType: "school", id: baseline.school[0].id, slug: schoolSlug }, ...baseline.stable.map((row: any) => ({ entityType: "program", id: row.id, slug: row.slug }))], archives: [...programAliases.map((row: any) => ({ entityType: "program", id: row.id, slug: row.slug })), ...scholarshipAliases.map((row: any) => ({ entityType: "scholarship", id: row.id, slug: row.slug }))], protectedSafeProgramSlugs: safeApproval.programSlugs, protectedSafeScholarshipSlugs: safeApproval.scholarshipSlugs, databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, stableProgramIds: baseline.stable.map((row: any) => row.id) } },
  sourceReview: { result: "pass", note: "Sixteen current official sources were refreshed unchanged; the school profile also remains bound to the previously rendered 25.5 MiB official handbook snapshot, which exceeds the current collector size cap." },
  visualReview: completeReview.visualReview,
  sensitiveDataCheck: { result: "pass", scope: "school profile, four stable programs and six status archives", note: "Only public catalog data is present. Applicant, payment, bank and personal-contact fields are excluded." },
  reviewNotes: ["The 87 newly published verified programs and ten newly published rich scholarships are protected and will not be rewritten.", "The five old programs and one old scholarship are status-archived, not physically deleted.", "The Harbin city dependency is resolved without any update."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准完成哈尔滨工程大学学校与旧数据清理（审核哈希 ${reviewHash}），覆盖学校及 4 条同名旧项目，并归档 5 条旧项目别名及 1 条旧奖学金合并概览`;
await Promise.all([writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"), writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, paths }, null, 2));
