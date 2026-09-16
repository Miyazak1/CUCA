import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), batch = "sjtu-medicine-scholarships-batch-01", prefix = `catalog.${batch}`, schoolSlug = "shanghai-jiao-tong-university-school-of-medicine";
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8"), candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, oldApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}`) throw new Error("SJTUSM scholarship review mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("SJTUSM candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sourceReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false || review.scope?.newScholarshipCount !== 3 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0) throw new Error("SJTUSM scholarship batch is not standing-authorized.");
if (candidate.cities?.length !== 1 || candidate.schools?.length !== 1 || candidate.programs?.length !== 0 || candidate.programIntakes?.length !== 0 || candidate.scholarships?.length !== 3 || candidate.scholarships.some((row: any) => !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("SJTUSM scholarship candidate scope changed.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({ cityFields: [...new Set(candidate.cities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(candidate.schools.flatMap(Object.keys))].sort(), scholarshipFields: [...new Set(candidate.scholarships.flatMap(Object.keys))].sort() }));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official Shanghai Jiao Tong University School of Medicine 2026 scholarship sources", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities.map(row => ({ ...row, status: "active" as const })), schools: candidate.schools.map(row => ({ ...row, status: "active" as const })), programs: [], programIntakes: [],
  scholarships: candidate.scholarships.map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 1 || report.summary.programs !== 0 || report.summary.scholarships !== 3) throw new Error(`Invalid SJTUSM scholarship publication: ${report.errors.join(" ")}`);
const scholarshipSlugs = publication.scholarships!.map(row => row.slug);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug, scholarshipSlugs, archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:sjtu-medicine-scholarships-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const programBefore = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p join schools s on s.id=p.school_id where s.slug=$1", [schoolSlug]);
    const existing = await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [scholarshipSlugs]);
    if (schoolBefore.length !== 1 || !Array.isArray(programBefore[0]?.snapshot) || programBefore[0].snapshot.length !== 3) throw new Error("SJTUSM school or programs changed.");
    const pre = existing.length === 0, post = existing.length === 3 && existing.every(row => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error("SJTUSM scholarship safe-new state partially conflicts.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["shanghai"], preserveExistingSchoolSlugs: [schoolSlug] });
    if (!written.ok) throw new Error(`SJTUSM scholarship write failed: ${written.errors.join(" ")}`);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const programAfter = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p join schools s on s.id=p.school_id where s.slug=$1", [schoolSlug]);
    if (JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0]?.snapshot) || JSON.stringify(programAfter[0]?.snapshot) !== JSON.stringify(programBefore[0]?.snapshot)) throw new Error("SJTUSM publication changed protected school or programs.");
    const totals = await tx.query<any>(`select s.id,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from scholarships h where h.school_id=s.id and h.status='active')::int scholarships,(select count(*) from scholarships h where h.school_id=s.id and h.status='active' and h.verification_status='verified' and jsonb_array_length(h.benefit_items)>0 and jsonb_array_length(h.eligibility_items)>0 and jsonb_array_length(h.application_materials)>0 and jsonb_array_length(h.application_steps)>0 and jsonb_array_length(h.action_links)>0)::int rich_verified_scholarships from schools s where s.slug=$1 and s.status='active' and s.verification_status='verified'`, [schoolSlug]);
    const expected = { programs: 3, scholarships: 3, rich_verified_scholarships: 3 };
    if (totals.length !== 1 || Object.entries(expected).some(([key, value]) => totals[0]?.[key] !== value)) throw new Error(`SJTUSM scholarship post-check failed: ${JSON.stringify({ expected, actual: totals[0] })}`);
    return { written: written.summary, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, batch, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
