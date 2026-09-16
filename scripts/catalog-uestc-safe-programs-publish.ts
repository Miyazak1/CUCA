import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), batch = "uestc-safe-programs-batch-01", prefix = `catalog.${batch}`;
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8"), candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, oldApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}`) throw new Error("UESTC safe-program review hash mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("UESTC safe-program candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sourceReview?.result !== "pass" || review.visualReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false || review.scope?.newProgramRouteCount !== 72 || review.scope?.newProgramIntakeCount !== 72 || review.scope?.newScholarshipCount !== 0 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0) throw new Error("UESTC safe-program scope is not standing-authorized.");
if (candidate.cities?.length !== 1 || candidate.schools?.length !== 1 || candidate.programs?.length !== 72 || candidate.programIntakes?.length !== 72 || candidate.scholarships?.length !== 0) throw new Error("UESTC safe-program candidate scope mismatch.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({ cityFields: [...new Set(candidate.cities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(candidate.schools.flatMap(Object.keys))].sort(), programFields: [...new Set(candidate.programs.flatMap(Object.keys))].sort(), intakeFields: [...new Set(candidate.programIntakes.flatMap(Object.keys))].sort() }));
const publication: CatalogSeedBundle = { version: 2, generatedAt: approvedAt, handoff: { sourceSystem: "CUAC reviewed official UESTC 2026 brochure", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true }, cities: candidate.cities, schools: candidate.schools, programs: candidate.programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })), programIntakes: candidate.programIntakes, scholarships: [] };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 72 || report.summary.programIntakes !== 72 || report.summary.scholarships !== 0) throw new Error(`Invalid UESTC safe-program publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug: review.scope.schoolSlug, programSlugs: publication.programs!.map((row) => row.slug), scholarshipSlugs: [], archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference), pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:uestc-safe-programs-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<any>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const cityBefore = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='chengdu'", []);
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='university-of-electronic-science-and-technology-of-china'", []);
    if (cityBefore.length !== 1 || schoolBefore.length !== 1 || cityBefore[0].snapshot.id !== review.reconciliation.databaseBaseline.cityId || schoolBefore[0].snapshot.id !== review.reconciliation.databaseBaseline.schoolId || schoolBefore[0].snapshot.status !== "active" || schoolBefore[0].snapshot.verification_status !== "unverified") throw new Error("UESTC dependency baseline changed.");
    const deferredPrograms = await tx.query<any>("select slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [review.reconciliation.deferredLegacyProgramSlugs]);
    const deferredScholarships = await tx.query<any>("select slug,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [review.reconciliation.deferredLegacyScholarshipSlugs]);
    if (deferredPrograms.length !== 3 || deferredPrograms.some((row) => row.status !== "active" || row.verification_status !== "unverified") || deferredScholarships.length !== 3 || deferredScholarships.some((row) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("UESTC deferred legacy rows changed.");
    const programSlugs = publication.programs!.map((row) => row.slug), before = await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[])", [programSlugs]);
    const pre = before.length === 0, post = before.length === 72 && before.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error("UESTC safe-program slugs partially conflict.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["chengdu"], preserveExistingSchoolSlugs: ["university-of-electronic-science-and-technology-of-china"] });
    if (!written.ok) throw new Error(`UESTC safe-program write failed: ${written.errors.join(" ")}`);
    const cityAfter = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='chengdu'", []), schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='university-of-electronic-science-and-technology-of-china'", []);
    if (JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0].snapshot) || JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot)) throw new Error("UESTC dependency rows changed.");
    const totals = await tx.query<any>("select (select count(*) from programs where school_id=$1 and status='active')::int programs,(select count(*) from programs where school_id=$1 and status='active' and verification_status='verified')::int verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::int intakes,(select count(*) from scholarships where school_id=$1 and status='active')::int scholarships", [review.reconciliation.databaseBaseline.schoolId]);
    const expected = { programs: review.reconciliation.databaseBaseline.activeProgramCount + 72, verified_programs: 72, intakes: review.reconciliation.databaseBaseline.intakeCount + 72, scholarships: review.reconciliation.databaseBaseline.activeScholarshipCount };
    if (Object.entries(expected).some(([key, value]) => totals[0]?.[key] !== value)) throw new Error(`UESTC safe-program post-check failed: ${JSON.stringify({ expected, actual: totals[0] })}`);
    return { written: written.summary, totals: totals[0], schoolId: review.reconciliation.databaseBaseline.schoolId };
  });
  console.log(JSON.stringify({ ok: true, batch, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
