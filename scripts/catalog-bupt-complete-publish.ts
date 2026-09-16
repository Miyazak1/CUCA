import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.bupt-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.bupt-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.bupt-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.bupt-complete-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.bupt-complete-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, existingApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-bupt-complete-batch-01-${reviewHash}`) throw new Error("BUPT review hash/reference mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("BUPT candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass" || review.sourceReview?.result !== "pass") throw new Error("BUPT review is not eligible for standing publication.");
if (review.scope?.newSchoolCount !== 1 || review.scope?.programRouteCount !== 58 || review.scope?.programIntakeCount !== 58 || review.scope?.newScholarshipCount !== 0 || review.scope?.cityOverwriteCount !== 0 || review.scope?.schoolOverwriteCount !== 0 || review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot overwrite, archive or delete records.");

const approvedAt = existingApproval?.approvedAt ?? new Date().toISOString();
const programs = candidate.programs ?? [], intakes = candidate.programIntakes ?? [], scholarships = candidate.scholarships ?? [];
const sourceSchemaSha256 = sha(JSON.stringify({
  cityFields: [...new Set((candidate.cities ?? []).flatMap((row) => Object.keys(row)))].sort(),
  schoolFields: [...new Set((candidate.schools ?? []).flatMap((row) => Object.keys(row)))].sort(),
  programFields: [...new Set(programs.flatMap((row) => Object.keys(row)))].sort(),
  intakeFields: [...new Set(intakes.flatMap((row) => Object.keys(row)))].sort(),
  scholarshipFields: [...new Set(scholarships.flatMap((row) => Object.keys(row)))].sort(),
}));
const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official Beijing University of Posts and Telecommunications 2026 brochure", cleanedExportName: "catalog.bupt-complete-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities,
  schools: candidate.schools!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: intakes,
  scholarships: [],
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 1 || report.summary.programs !== 58 || report.summary.programIntakes !== 58 || report.summary.scholarships !== 0) throw new Error(`Invalid BUPT publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.bupt-complete-batch-01.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "beijing-university-of-posts-and-telecommunications", programSlugs: publication.programs!.map((row) => row.slug), scholarshipSlugs: [], archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:bupt-complete-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const expectedCity = review.reconciliation.databaseBaseline.cityDependency;
    const cityBefore = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'", []);
    if (cityBefore.length !== 1 || JSON.stringify(cityBefore[0]) !== JSON.stringify(expectedCity)) throw new Error("Beijing dependency baseline changed.");
    const schools = await tx.query<any>("select id,status,verification_status,last_verified_at from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", ["beijing-university-of-posts-and-telecommunications", "Beijing University of Posts and Telecommunications", "北京邮电大学"]);
    const programSlugs = publication.programs!.map((row) => row.slug);
    const programRows = await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[])", [programSlugs]);
    const pre = schools.length === 0 && programRows.length === 0;
    const post = schools.length === 1 && schools[0].status === "active" && schools[0].verification_status === "verified" && schools[0].last_verified_at?.toISOString() === approvedAt && programRows.length === 58 && programRows.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error(`BUPT candidate scope partially conflicts: ${JSON.stringify({ schools: schools.length, programs: programRows.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const afterSchool = await tx.query<any>("select id,status,verification_status,last_verified_at from schools where slug='beijing-university-of-posts-and-telecommunications'", []);
    const totals = await tx.query<any>("select (select count(*) from programs where school_id=$1 and status='active')::text programs,(select count(*) from programs where school_id=$1 and verification_status='verified')::text verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships", [afterSchool[0]?.id]);
    if (afterSchool.length !== 1 || afterSchool[0].verification_status !== "verified" || totals[0]?.programs !== "58" || totals[0]?.verified_programs !== "58" || totals[0]?.intakes !== "58" || totals[0]?.scholarships !== "0") throw new Error(`BUPT post-publication totals invalid: ${JSON.stringify(totals[0])}`);
    const cityAfter = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug='beijing'", []);
    if (JSON.stringify(cityAfter[0]) !== JSON.stringify(expectedCity)) throw new Error("Beijing dependency was substantively changed.");
    return { written: written.summary, schoolId: afterSchool[0].id, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
