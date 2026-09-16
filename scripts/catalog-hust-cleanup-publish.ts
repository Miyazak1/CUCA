import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedHash = required("review-hash"), reviewReference = required("review"), approvedAt = required("approved-at"), confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedHash) || Number.isNaN(Date.parse(approvedAt)) || confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Invalid HUST cleanup approval parameters.");
const root = process.cwd();
const paths = { candidate: resolve(root, "seeds/catalog.hust-cleanup.draft.json"), validation: resolve(root, "seeds/catalog.hust-cleanup.validation.json"), review: resolve(root, "seeds/catalog.hust-cleanup.review.json"), output: resolve(root, "seeds/catalog.hust-cleanup.approved.local.json"), approval: resolve(root, "seeds/catalog.hust-cleanup.approval.json"), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8"), candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state)]);
const { reviewHash, requiredApproval, ...reviewBase } = review;
if (reviewHash !== approvedHash || sha(JSON.stringify(reviewBase)) !== approvedHash || requiredApproval !== reviewReference || review.status !== "requires_explicit_approval" || review.scope?.schoolOverwriteCount !== 1 || review.scope?.programOverwriteCount !== 14 || review.scope?.archiveProgramAliasCount !== 1 || review.scope?.scholarshipMutationCount !== 0 || review.reconciliation?.destructiveDeletion !== false || review.sensitiveDataCheck?.result !== "pass") throw new Error("Approved HUST cleanup review does not match stored operation.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("HUST cleanup candidate changed after review.");
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed HUST 2026 official school and program cleanup", cleanedExportName: "catalog.hust-cleanup.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256: sha(JSON.stringify({ cityFields: [...new Set(candidate.cities!.flatMap((row) => Object.keys(row)))].sort(), schoolFields: [...new Set(candidate.schools!.flatMap((row) => Object.keys(row)))].sort(), programFields: [...new Set(candidate.programs!.flatMap((row) => Object.keys(row)))].sort(), intakeFields: [...new Set(candidate.programIntakes!.flatMap((row) => Object.keys(row)))].sort() })), reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities,
  schools: candidate.schools!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: candidate.programs!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: candidate.programIntakes,
  scholarships: [],
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 1 || report.summary.programs !== 14 || report.summary.programIntakes !== 14 || report.summary.scholarships !== 0) throw new Error(`Invalid HUST cleanup publication: ${report.errors.join(" ")}`);
const stableIds: string[] = review.reconciliation.databaseBaseline.stableProgramIds, legacyIds: string[] = review.reconciliation.databaseBaseline.legacyProgramIds, stableSlugs: string[] = candidate.programs!.map((row) => row.slug), legacySlugs: string[] = review.reconciliation.archives.map((row: any) => row.slug);
const approval = { version: 1, approvedAt, reviewReference, approvedReviewSha256: approvedHash, publicationBundle: "seeds/catalog.hust-cleanup.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "huazhong-university-of-science-and-technology", overwrittenProgramSlugs: stableSlugs, archivedProgramSlugs: legacySlugs, physicalDeletion: false, prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference), pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:hust-cleanup-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const school = await tx.query<{ id: string; status: string; verification_status: string }>("select id,status,verification_status from schools where slug='huazhong-university-of-science-and-technology'", []);
    if (school.length !== 1 || school[0].id !== review.reconciliation.databaseBaseline.schoolId || school[0].status !== "active" || !["unverified", "verified"].includes(school[0].verification_status)) throw new Error("HUST school baseline changed.");
    const stable = await tx.query<{ id: string; slug: string; status: string; verification_status: string }>("select id,slug,status,verification_status from programs where id=any($1::uuid[])", [stableIds]);
    if (stable.length !== 14 || stable.some((row) => !stableSlugs.includes(row.slug) || row.status !== "active" || !["unverified", "verified"].includes(row.verification_status))) throw new Error("HUST stable programs changed.");
    const legacy = await tx.query<{ id: string; slug: string; status: string; verification_status: string }>("select id,slug,status,verification_status from programs where id=any($1::uuid[])", [legacyIds]);
    if (legacy.length !== 1 || !legacySlugs.includes(legacy[0].slug) || !["active", "archived"].includes(legacy[0].status) || legacy[0].verification_status !== "unverified") throw new Error("HUST legacy program changed.");
    const protectedPrograms = await tx.query<{ active_count: string; verified_count: string }>("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active' and not (id=any($2::uuid[])) and not (id=any($3::uuid[]))", [school[0].id, stableIds, legacyIds]);
    const scholarships = await tx.query<{ active_count: string; verified_count: string }>("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from scholarships where school_id=$1 and status='active'", [school[0].id]);
    if (protectedPrograms[0]?.active_count !== "452" || protectedPrograms[0]?.verified_count !== "452" || scholarships[0]?.active_count !== "8" || scholarships[0]?.verified_count !== "8") throw new Error("HUST protected verified catalog changed.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication); if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    await tx.query("update programs set status='archived',updated_at=now() where id=any($1::uuid[]) and status='active'", [legacyIds]);
    const final = await tx.query<{ school_verified: string; programs: string; verified_programs: string; scholarships: string; verified_scholarships: string; archives: string }>("select (select count(*) from schools where id=$1 and status='active' and verification_status='verified' and last_verified_at=$4)::text school_verified,(select count(*) from programs where school_id=$1 and status='active')::text programs,(select count(*) from programs where school_id=$1 and status='active' and verification_status='verified')::text verified_programs,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships,(select count(*) from programs where id=any($2::uuid[]) and status='archived')::text archives", [school[0].id, legacyIds, stableIds, approvedAt]);
    if (final[0]?.school_verified !== "1" || final[0]?.programs !== "466" || final[0]?.verified_programs !== "466" || final[0]?.scholarships !== "8" || final[0]?.verified_scholarships !== "8" || final[0]?.archives !== "1") throw new Error(`HUST cleanup post-check failed: ${JSON.stringify(final[0])}`);
    return { written, ...final[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
