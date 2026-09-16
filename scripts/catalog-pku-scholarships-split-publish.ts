import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), batch = "pku-scholarships-split-batch-01", prefix = `catalog.${batch}`;
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8"), candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, oldApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}` || review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许") throw new Error("PKU split review is invalid.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("PKU split candidate changed after review.");
if (review.scope?.newScholarshipCount !== 3 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0 || review.reconciliation?.destructiveDeletion !== false || review.sourceReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || candidate.scholarships?.length !== 3) throw new Error("PKU split is not standing-authorized.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({ cityFields: [...new Set((candidate.cities ?? []).flatMap(Object.keys))].sort(), schoolFields: [...new Set((candidate.schools ?? []).flatMap(Object.keys))].sort(), scholarshipFields: [...new Set((candidate.scholarships ?? []).flatMap(Object.keys))].sort() }));
const publication: CatalogSeedBundle = { version: 2, generatedAt: approvedAt, handoff: { sourceSystem: "CUAC reviewed official Peking University scholarship notice", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true }, cities: candidate.cities, schools: candidate.schools, programs: [], programIntakes: [], scholarships: candidate.scholarships!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })) };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.scholarships !== 3) throw new Error(`Invalid PKU split publication: ${report.errors.join(" ")}`);
const slugs = publication.scholarships!.map((row) => row.slug);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug: "peking-university", scholarshipSlugs: slugs, archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference), pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:pku-scholarships-split-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='peking-university'", []);
    if (schoolBefore.length !== 1 || schoolBefore[0].snapshot.id !== review.reconciliation.databaseBaseline.schoolId || schoolBefore[0].snapshot.status !== "active" || schoolBefore[0].snapshot.verification_status !== "verified") throw new Error("PKU school baseline changed.");
    const existing = await tx.query<any>("select slug,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [review.reconciliation.databaseBaseline.schoolId]);
    if (existing.length !== 6 || existing.map((row) => row.slug).join("|") !== [...review.reconciliation.deferredExistingScholarships].sort().join("|")) throw new Error("PKU existing scholarships changed.");
    const before = await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[])", [slugs]);
    const pre = before.length === 0, post = before.length === 3 && before.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error("PKU split slugs partially conflict.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: [candidate.cities![0].slug], preserveExistingSchoolSlugs: ["peking-university"] });
    if (!written.ok) throw new Error(`PKU split write failed: ${written.errors.join(" ")}`);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='peking-university'", []);
    if (JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot)) throw new Error("PKU school dependency changed.");
    const finalRows = await tx.query<any>("select slug,verification_status,last_verified_at,jsonb_array_length(benefit_items)::int benefits,jsonb_array_length(eligibility_items)::int eligibility,jsonb_array_length(application_materials)::int materials,jsonb_array_length(application_steps)::int steps,jsonb_array_length(action_links)::int links from scholarships where slug=any($1::text[]) and status='active' order by slug", [slugs]);
    if (finalRows.length !== 3 || finalRows.some((row) => row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== approvedAt || [row.benefits,row.eligibility,row.materials,row.steps,row.links].some((value) => value < 1))) throw new Error("PKU split rich-detail check failed.");
    const total = await tx.query<any>("select count(*)::int count from scholarships where school_id=$1 and status='active'", [review.reconciliation.databaseBaseline.schoolId]);
    if (total[0]?.count !== 9) throw new Error("PKU scholarship total mismatch.");
    return { written: written.summary, publishedScholarshipCount: finalRows.length, activeScholarshipCount: total[0].count };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
