import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), prefix = "catalog.ahu-scholarship-safe-new-batch-01", schoolSlug = "anhui-university";
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const [candidateText, validation, review, state, oldApproval] = await Promise.all([readFile(paths.candidate, "utf8"), parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-ahu-scholarship-safe-new-batch-01-${reviewHash}`) throw new Error("AHU review hash mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("AHU candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sourceReview?.result !== "pass" || review.visualReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false || review.scope?.newScholarshipCount !== 1 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0) throw new Error("AHU batch is not standing-authorized.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({ cityFields: [...new Set(candidate.cities!.flatMap(Object.keys))].sort(), schoolFields: [...new Set(candidate.schools!.flatMap(Object.keys))].sort(), scholarshipFields: [...new Set(candidate.scholarships!.flatMap(Object.keys))].sort() }));
const publication: CatalogSeedBundle = { version: 2, generatedAt: approvedAt, handoff: { sourceSystem: "CUAC reviewed official Anhui University 2026/2027 scholarship brochure", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true }, cities: candidate.cities, schools: candidate.schools, programs: [], programIntakes: [], scholarships: candidate.scholarships!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })) };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.scholarships !== 1 || report.summary.programs !== 0) throw new Error(`Invalid AHU publication: ${report.errors.join(" ")}`);
const scholarshipSlug = publication.scholarships![0].slug;
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug, scholarshipSlugs: [scholarshipSlug], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:ahu-scholarship-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const schoolBefore = await tx.query<any>("select id,to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const cityBefore = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='hefei'", []);
    const programsBefore = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.school_id=$1", [schoolBefore[0]?.id]);
    const oldScholarshipsBefore = await tx.query<any>("select jsonb_agg(to_jsonb(s)-'created_at'-'updated_at' order by s.slug) snapshot from scholarships s where s.school_id=$1 and s.slug<>$2", [schoolBefore[0]?.id, scholarshipSlug]);
    const existing = await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=$1", [scholarshipSlug]);
    if (schoolBefore.length !== 1 || schoolBefore[0].id !== review.reconciliation.databaseBaseline.schoolId || cityBefore[0]?.snapshot?.id !== review.reconciliation.databaseBaseline.cityId || programsBefore[0]?.snapshot?.length !== 2 || oldScholarshipsBefore[0]?.snapshot?.length !== 1) throw new Error("AHU protected baseline changed.");
    const pre = existing.length === 0;
    const post = existing.length === 1 && existing[0].status === "active" && existing[0].verification_status === "verified" && existing[0].last_verified_at?.toISOString() === approvedAt;
    if (!pre && !post) throw new Error("AHU target scholarship conflicts with the reviewed safe-new operation.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["hefei"], preserveExistingSchoolSlugs: [schoolSlug] });
    if (!written.ok) throw new Error(`AHU scholarship write failed: ${written.errors.join(" ")}`);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const cityAfter = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='hefei'", []);
    const programsAfter = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.school_id=$1", [schoolBefore[0].id]);
    const oldScholarshipsAfter = await tx.query<any>("select jsonb_agg(to_jsonb(s)-'created_at'-'updated_at' order by s.slug) snapshot from scholarships s where s.school_id=$1 and s.slug<>$2", [schoolBefore[0].id, scholarshipSlug]);
    if (JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot) || JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0].snapshot) || JSON.stringify(programsAfter[0]?.snapshot) !== JSON.stringify(programsBefore[0].snapshot) || JSON.stringify(oldScholarshipsAfter[0]?.snapshot) !== JSON.stringify(oldScholarshipsBefore[0].snapshot)) throw new Error("AHU publication changed protected records.");
    const totals = await tx.query<any>("select count(*) filter(where status='active')::int active,count(*) filter(where status='active' and verification_status='verified')::int verified from scholarships where school_id=$1", [schoolBefore[0].id]);
    if (totals[0]?.active !== 2 || totals[0]?.verified !== 1) throw new Error(`AHU post-check failed: ${JSON.stringify(totals[0])}`);
    return { written: written.summary, totals: totals[0], schoolId: schoolBefore[0].id };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
