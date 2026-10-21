import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import type { LocalDevelopmentState } from "./lib/local-development.ts";

type ValidationArtifact = { bundleSha256: string };
type ReviewArtifact = {
  reviewHash: string;
  publicationReference: string;
  status: string;
  standingAuthorization?: { instruction?: string };
  candidateSha256: string;
  scope: { newScholarshipCount: number; overwriteCount: number; archiveCount: number; deleteCount: number };
  reconciliation: {
    destructiveDeletion: boolean;
    scholarshipSlugs: string[];
    baseline: { school: { id: string }; city: { id: string } };
  };
  sourceReview: { result: string };
  sensitiveDataCheck: { result: string };
  [key: string]: unknown;
};
type ExistingApproval = { approvedAt?: string };
type SchoolSnapshotRow = { id: string; snapshot: Record<string, unknown> };
type SnapshotRow = { snapshot: Record<string, unknown> };
type AggregateSnapshotRow = { snapshot: unknown[] | null };
type ScholarshipStatusRow = { slug: string; status: string; verification_status: string; last_verified_at: Date | null };
type ScholarshipTotalsRow = { scholarships: number; verified_scholarships: number };

const prefix = "catalog.zjut-scholarships-safe-new-batch-01", sha = (value: string) => createHash("sha256").update(value).digest("hex"), read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T;
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8"), candidate = JSON.parse(candidateText) as CatalogSeedBundle, validation = await read<ValidationArtifact>(`seeds/${prefix}.validation.json`), review = await read<ReviewArtifact>(`seeds/${prefix}.review.json`), state = await read<LocalDevelopmentState>(".cuac-local/runtime.json"), existingApproval = await read<ExistingApproval>(`seeds/${prefix}.approval.json`).catch(() => null), fresh = createCatalogMigrationValidationReport(candidate);
const candidateScholarships = candidate.scholarships;
if (!candidateScholarships?.length) throw new Error("ZJUT scholarship candidate is empty.");
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-zjut-scholarships-safe-new-batch-01-${reviewHash}` || review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.scope.newScholarshipCount !== 9 || review.scope.overwriteCount !== 0 || review.scope.archiveCount !== 0 || review.scope.deleteCount !== 0 || review.reconciliation.destructiveDeletion !== false || review.sourceReview.result !== "pass" || review.sensitiveDataCheck.result !== "pass" || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== validation.bundleSha256) throw new Error("ZJUT scholarship review or candidate changed.");
const approvedAt = existingApproval?.approvedAt ?? new Date().toISOString();
const publication: CatalogSeedBundle = { ...candidate, version: 2, generatedAt: approvedAt, handoff: { sourceSystem: "CUAC reviewed official Zhejiang University of Technology scholarship pages", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256: sha(JSON.stringify(Object.keys(candidateScholarships[0]).sort())), reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true }, scholarships: candidateScholarships.map((row) => ({ ...row, status: "active", verificationStatus: "verified", lastVerifiedAt: approvedAt })) };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.scholarships !== 9) throw new Error(`Invalid ZJUT scholarship publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug: "zhejiang-university-of-technology", scholarshipSlugs: review.reconciliation.scholarshipSlugs, archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(`seeds/${prefix}.approved.local.json`, publication); await writeOrVerify(`seeds/${prefix}.approval.json`, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference), pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:zjut-scholarships-publish" });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async (tx) => {
    const baseline = review.reconciliation.baseline;
    const schoolBefore = await tx.query<SchoolSnapshotRow>("select id,to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='zhejiang-university-of-technology'", []);
    const cityBefore = await tx.query<SnapshotRow>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='hangzhou'", []);
    const programsBefore = await tx.query<AggregateSnapshotRow>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.school_id=$1", [schoolBefore[0]?.id]);
    const intakesBefore = await tx.query<AggregateSnapshotRow>("select jsonb_agg(to_jsonb(pi)-'created_at'-'updated_at' order by pi.id) snapshot from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [schoolBefore[0]?.id]);
    const existing = await tx.query<ScholarshipStatusRow>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [review.reconciliation.scholarshipSlugs]);
    if (schoolBefore.length !== 1 || schoolBefore[0].id !== baseline.school.id || cityBefore[0]?.snapshot?.id !== baseline.city.id || programsBefore[0]?.snapshot?.length !== 23) throw new Error("ZJUT protected baseline changed.");
    const pre = existing.length === 0, post = existing.length === 9 && existing.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error(`ZJUT scholarship state conflicts: ${existing.length} candidate rows already exist.`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["hangzhou"], preserveExistingSchoolSlugs: ["zhejiang-university-of-technology"] });
    if (!written.ok) throw new Error(written.errors.join(" "));
    const schoolAfter = await tx.query<SnapshotRow>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where id=$1", [schoolBefore[0].id]);
    const cityAfter = await tx.query<SnapshotRow>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='hangzhou'", []);
    const programsAfter = await tx.query<AggregateSnapshotRow>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.school_id=$1", [schoolBefore[0].id]);
    const intakesAfter = await tx.query<AggregateSnapshotRow>("select jsonb_agg(to_jsonb(pi)-'created_at'-'updated_at' order by pi.id) snapshot from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [schoolBefore[0].id]);
    if (JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot) || JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0].snapshot) || JSON.stringify(programsAfter[0]?.snapshot) !== JSON.stringify(programsBefore[0].snapshot) || JSON.stringify(intakesAfter[0]?.snapshot) !== JSON.stringify(intakesBefore[0]?.snapshot)) throw new Error("ZJUT publication changed protected records.");
    const totals = await tx.query<ScholarshipTotalsRow>("select count(*) filter(where status='active')::int scholarships,count(*) filter(where status='active' and verification_status='verified')::int verified_scholarships from scholarships where school_id=$1", [schoolBefore[0].id]);
    if (totals[0]?.scholarships !== 9 || totals[0]?.verified_scholarships !== 9) throw new Error(`ZJUT scholarship post-check failed: ${JSON.stringify(totals[0])}`);
    return { written: written.summary, totals: totals[0], schoolId: schoolBefore[0].id };
  });
  console.log(JSON.stringify({ ok: true, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, ...result }, null, 2));
} finally { await pool.end(); }
