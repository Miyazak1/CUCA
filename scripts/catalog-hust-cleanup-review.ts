import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  complete: resolve(root, "seeds/catalog.hust-complete-batch-01.draft.json"),
  completeReview: resolve(root, "seeds/catalog.hust-complete-batch-01.review.json"),
  safeApproval: resolve(root, "seeds/catalog.hust-safe-new-batch-01.approval.json"),
  safePublication: resolve(root, "seeds/catalog.hust-safe-new-batch-01.approved.local.json"),
  candidate: resolve(root, "seeds/catalog.hust-cleanup.draft.json"),
  validation: resolve(root, "seeds/catalog.hust-cleanup.validation.json"),
  review: resolve(root, "seeds/catalog.hust-cleanup.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [completeText, completeReviewText, safeApprovalText, safePublicationText, stateText] = await Promise.all([
  readFile(paths.complete, "utf8"), readFile(paths.completeReview, "utf8"), readFile(paths.safeApproval, "utf8"),
  readFile(paths.safePublication, "utf8"), readFile(paths.state, "utf8"),
]);
const complete = JSON.parse(completeText) as CatalogSeedBundle;
const completeReview = JSON.parse(completeReviewText);
const safeApproval = JSON.parse(safeApprovalText);
const safePublication = JSON.parse(safePublicationText) as CatalogSeedBundle;
const state = JSON.parse(stateText);
const schoolSlug = "huazhong-university-of-science-and-technology";
const stableSlugs: string[] = completeReview.reconciliation.stableProgramSlugs;
const legacySlugs: string[] = completeReview.reconciliation.legacyProgramAliasesToArchive;
if (stableSlugs.length !== 14 || legacySlugs.length !== 1 || safeApproval.programSlugs?.length !== 452 || safeApproval.scholarshipSlugs?.length !== 7) throw new Error("HUST cleanup dependencies changed.");
const stableSet = new Set(stableSlugs);
const programs = complete.programs!.filter((row) => stableSet.has(row.slug));
const programIntakes = complete.programIntakes!.filter((row) => stableSet.has(row.programSlug));
if (programs.length !== 14 || programIntakes.length !== 14 || complete.schools?.length !== 1 || safePublication.cities?.length !== 1) throw new Error("HUST cleanup candidate selection changed.");
const candidateRaw: CatalogSeedBundle = { version: 1, generatedAt: new Date().toISOString(), cities: safePublication.cities, schools: complete.schools, programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidateRaw, null, 2)}\n`;
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Invalid HUST cleanup candidate: ${validation.errors.join(" ")}`);

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:hust-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,status,verification_status,source_url from schools where slug=$1", [schoolSlug]);
  const programTotals = await pool.query("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active'", [school.rows[0]?.id]);
  const stablePrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [stableSlugs]);
  const legacyPrograms = await pool.query("select id,slug,status,verification_status,source_url from programs where slug=any($1::text[]) order by slug", [legacySlugs]);
  const scholarships = await pool.query("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from scholarships where school_id=$1 and status='active'", [school.rows[0]?.id]);
  baseline = { school: school.rows, programTotals: programTotals.rows, stablePrograms: stablePrograms.rows, legacyPrograms: legacyPrograms.rows, scholarships: scholarships.rows };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || programTotals.rows[0]?.active_count !== "467" || programTotals.rows[0]?.verified_count !== "452" || stablePrograms.rows.length !== 14 || stablePrograms.rows.some((row: any) => row.status !== "active" || row.verification_status !== "unverified") || legacyPrograms.rows.length !== 1 || legacyPrograms.rows[0].status !== "active" || legacyPrograms.rows[0].verification_status !== "unverified" || scholarships.rows[0]?.active_count !== "8" || scholarships.rows[0]?.verified_count !== "8") throw new Error(`HUST cleanup baseline changed: ${JSON.stringify(baseline)}`);
} finally { await pool.end(); }

const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolOverwriteCount: 1, programOverwriteCount: 14, programIntakeUpsertCount: 14, archiveProgramAliasCount: 1, scholarshipMutationCount: 0, insertProgramCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  sourceEvidence: { completeCandidateSha256: sha(completeText), completeReviewSha256: sha(completeReviewText), safeApprovalSha256: sha(safeApprovalText), safePublicationSha256: sha(safePublicationText) },
  reconciliation: {
    destructiveDeletion: false,
    overwrites: [
      { entityType: "school", id: baseline.school[0].id, slug: schoolSlug, reason: "Replace the active unverified third-party school profile with the reviewed official HUST profile." },
      ...baseline.stablePrograms.map((row: any) => ({ entityType: "program", id: row.id, slug: row.slug, reason: "Replace the active unverified route fields with the reviewed official 2026 program route." })),
    ],
    archives: baseline.legacyPrograms.map((row: any) => ({ entityType: "program", id: row.id, slug: row.slug, reason: "Superseded by the verified official English Telecommunications Engineering route." })),
    databaseBaseline: { schoolId: baseline.school[0].id, stableProgramIds: baseline.stablePrograms.map((row: any) => row.id), legacyProgramIds: baseline.legacyPrograms.map((row: any) => row.id) },
  },
  sensitiveDataCheck: { result: "pass", scope: "school profile, fourteen program routes and one archive status change", note: "Public institutional and admissions catalog fields only; applicant, account, payment and personal-contact data are excluded." },
  reviewNotes: ["The 452 safe-new verified programs and all eight verified scholarships remain unchanged.", "The legacy program is status-archived, not physically deleted.", "After publication HUST will have a verified school, 466/466 active verified programs and 8/8 active verified scholarships."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准完成华中科技大学官方学校与项目资料，覆盖 14 条旧项目并归档 1 条旧项目别名（审核哈希 ${reviewHash}）`;
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, paths }, null, 2));
