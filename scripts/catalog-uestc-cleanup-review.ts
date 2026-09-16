import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { complete: resolve(root, "seeds/catalog.uestc-complete-batch-01.draft.json"), completeReview: resolve(root, "seeds/catalog.uestc-complete-batch-01.review.json"), safeApproval: resolve(root, "seeds/catalog.uestc-safe-programs-batch-01.approval.json"), safePublication: resolve(root, "seeds/catalog.uestc-safe-programs-batch-01.approved.local.json"), pdfManifest: resolve(root, "work/catalog-official/uestc-complete-batch-01/manifest.json"), candidate: resolve(root, "seeds/catalog.uestc-cleanup.draft.json"), validation: resolve(root, "seeds/catalog.uestc-cleanup.validation.json"), review: resolve(root, "seeds/catalog.uestc-cleanup.review.json"), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const read = async (path: string) => { const text = await readFile(path, "utf8"); return { text, value: JSON.parse(text) }; };
const [completeFile, completeReviewFile, safeApprovalFile, safePublicationFile, pdfManifestFile, stateFile] = await Promise.all([paths.complete, paths.completeReview, paths.safeApproval, paths.safePublication, paths.pdfManifest, paths.state].map(read));
const complete = completeFile.value as CatalogSeedBundle, completeReview = completeReviewFile.value, safeApproval = safeApprovalFile.value, safePublication = safePublicationFile.value as CatalogSeedBundle, pdfManifest = pdfManifestFile.value, state = stateFile.value;
const schoolSlug = "university-of-electronic-science-and-technology-of-china";
if (complete.cities?.length !== 1 || complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || complete.scholarships?.length !== 10 || safeApproval.programSlugs?.length !== 72 || safePublication.programs?.length !== 72 || safeApproval.scholarshipSlugs?.length !== 0) throw new Error("UESTC cleanup dependencies changed.");
if (pdfManifest.sources?.length !== 1 || completeReview.sourceReview?.result !== "pass" || completeReview.sensitiveDataCheck?.result !== "pass") throw new Error("UESTC reviewed evidence is unavailable.");
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:uestc-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,verification_status from cities where slug='chengdu'");
  const safePrograms = await pool.query("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug", [safeApproval.programSlugs]);
  const activePrograms = await pool.query("select id,slug,status,verification_status from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const activeScholarships = await pool.query("select id,slug,title,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, safePrograms: safePrograms.rows, activePrograms: activePrograms.rows, activeScholarships: activeScholarships.rows };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error("UESTC school/city baseline changed.");
  if (safePrograms.rows.length !== 72 || safePrograms.rows.some((row: any) => row.status !== "active" || row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== safeApproval.approvedAt)) throw new Error("UESTC safe programs changed.");
  if (activePrograms.rows.length !== 75 || activeScholarships.rows.length !== 3 || activeScholarships.rows.some((row: any) => row.verification_status !== "unverified")) throw new Error("UESTC legacy totals changed.");
} finally { await pool.end(); }
const safeSet = new Set(safeApproval.programSlugs), programAliases = baseline.activePrograms.filter((row: any) => !safeSet.has(row.slug)), scholarshipAliases = baseline.activeScholarships;
if (programAliases.length !== 3 || programAliases.some((row: any) => row.verification_status !== "unverified") || scholarshipAliases.length !== 3) throw new Error("UESTC legacy alias set changed.");
const candidate: CatalogSeedBundle = { version: 1, generatedAt: pdfManifest.generatedAt, cities: complete.cities, schools: complete.schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`, validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`UESTC cleanup validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, cityDependencyReplayCount: 1, schoolOverwriteCount: 1, programOverwriteCount: 0, archiveProgramAliasCount: 3, archiveScholarshipAliasCount: 3, verifiedSafeProgramMutationCount: 0, scholarshipPublicationCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: { pdfManifestSha256: sha(pdfManifestFile.text), completeReviewSha256: sha(completeReviewFile.text), safeApprovalSha256: sha(safeApprovalFile.text), safePublicationSha256: sha(safePublicationFile.text) },
  reconciliation: { destructiveDeletion: false, overwrite: [{ entityType: "school", id: baseline.school[0].id, slug: schoolSlug }], archives: [...programAliases.map((row: any) => ({ entityType: "program", id: row.id, slug: row.slug })), ...scholarshipAliases.map((row: any) => ({ entityType: "scholarship", id: row.id, slug: row.slug, title: row.title }))], protectedSafeProgramSlugs: safeApproval.programSlugs, databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id } },
  sourceReview: { result: "pass", note: "The official 2026 UESTC brochure snapshot remains the reviewed source for the school profile; its cover and profile sections were visually checked. The current file exceeds the 15 MiB refresh cap, so no bypass was attempted." },
  visualReview: { result: "pass", artifact: "UESTC 2026 Admission Brochure PDF", pagesReviewed: completeReview.sourceReview.pdfPagesReviewed, note: completeReview.sourceReview.note },
  sensitiveDataCheck: { result: "pass", scope: "school profile and six archive status changes", note: "Only public institutional catalog fields and record identifiers are present. Applicant, account, payment, bank and personal-contact data are excluded." },
  reviewNotes: ["The 72 verified official programs are protected and will not be rewritten.", "Three legacy program aliases and three misattributed legacy scholarships are status-archived, not deleted.", "Ten incomplete brochure-level scholarship drafts remain unpublished because their benefitItems arrays are empty.", "The shared Chengdu city dependency is resolved without an update."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准完成电子科技大学学校与旧数据清理（审核哈希 ${reviewHash}），覆盖学校，并归档 3 条旧项目别名及 3 条错误旧奖学金`;
await Promise.all([writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"), writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, paths }, null, 2));
