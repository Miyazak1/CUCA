import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), batch = "ustb-safe-new-batch-01", prefix = `catalog.${batch}`;
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, oldApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}`) throw new Error("USTB review hash/reference mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("USTB candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sourceReview?.result !== "pass" || review.visualReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false) throw new Error("USTB review is not standing-authorized.");
if (review.scope?.newProgramRouteCount !== 145 || review.scope?.newProgramIntakeCount !== 145 || review.scope?.newScholarshipCount !== 5 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0) throw new Error("USTB standing scope cannot overwrite or archive records.");
const programs = candidate.programs ?? [], intakes = candidate.programIntakes ?? [], scholarships = candidate.scholarships ?? [];
if (candidate.cities?.length !== 1 || candidate.schools?.length !== 1 || programs.length !== 145 || intakes.length !== 145 || scholarships.length !== 5) throw new Error("USTB safe-new candidate scope mismatch.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({ cityFields: [...new Set(candidate.cities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(candidate.schools.flatMap(Object.keys))].sort(), programFields: [...new Set(programs.flatMap(Object.keys))].sort(), intakeFields: [...new Set(intakes.flatMap(Object.keys))].sort(), scholarshipFields: [...new Set(scholarships.flatMap(Object.keys))].sort() }));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official University of Science and Technology Beijing sources", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities, schools: candidate.schools,
  programs: programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: intakes,
  scholarships: scholarships.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 145 || report.summary.programIntakes !== 145 || report.summary.scholarships !== 5) throw new Error(`Invalid USTB publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug: review.scope.schoolSlug, programSlugs: publication.programs!.map((row) => row.slug), scholarshipSlugs: publication.scholarships!.map((row) => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:ustb-safe-new-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<any>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const cityBefore = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='beijing'", []);
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='university-of-science-and-technology-beijing'", []);
    if (cityBefore.length !== 1 || schoolBefore.length !== 1 || cityBefore[0].snapshot.id !== review.reconciliation.databaseBaseline.cityId || schoolBefore[0].snapshot.id !== review.reconciliation.databaseBaseline.schoolId || schoolBefore[0].snapshot.status !== "active" || schoolBefore[0].snapshot.verification_status !== "unverified") throw new Error("USTB dependency baseline changed.");
    const deferredProgramSlugs = [...review.reconciliation.deferredStableProgramSlugs, ...review.reconciliation.deferredLegacyProgramSlugs];
    const deferredPrograms = await tx.query<any>("select slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [deferredProgramSlugs]);
    const deferredScholarships = await tx.query<any>("select slug,status,verification_status from scholarships where slug=any($1::text[]) order by slug", [review.reconciliation.deferredLegacyScholarshipSlugs]);
    if (deferredPrograms.length !== 12 || deferredPrograms.some((row) => row.status !== "active" || row.verification_status !== "unverified") || deferredScholarships.length !== 1 || deferredScholarships[0].status !== "active" || deferredScholarships[0].verification_status !== "unverified") throw new Error("USTB deferred legacy rows changed.");
    const programSlugs = publication.programs!.map((row) => row.slug), scholarshipSlugs = publication.scholarships!.map((row) => row.slug);
    const beforePrograms = await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[])", [programSlugs]);
    const beforeScholarships = await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
    const pre = beforePrograms.length === 0 && beforeScholarships.length === 0;
    const post = beforePrograms.length === 145 && beforeScholarships.length === 5 && [...beforePrograms, ...beforeScholarships].every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error("USTB safe-new slugs partially conflict.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["beijing"], preserveExistingSchoolSlugs: ["university-of-science-and-technology-beijing"] });
    if (!written.ok) throw new Error(`USTB catalog write failed: ${written.errors.join(" ")}`);
    const cityAfter = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='beijing'", []);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='university-of-science-and-technology-beijing'", []);
    if (JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0].snapshot) || JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot)) throw new Error("USTB dependency rows were substantively changed.");
    const totals = await tx.query<any>("select (select count(*) from programs where school_id=$1 and status='active')::int programs,(select count(*) from programs where school_id=$1 and status='active' and verification_status='verified')::int verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::int intakes,(select count(*) from scholarships where school_id=$1 and status='active')::int scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified' and jsonb_array_length(benefit_items)>0 and jsonb_array_length(eligibility_items)>0 and jsonb_array_length(application_steps)>0 and jsonb_array_length(action_links)>0)::int verified_rich_scholarships", [review.reconciliation.databaseBaseline.schoolId]);
    const expected = { programs: review.reconciliation.databaseBaseline.activeProgramCount + 145, verified_programs: 145, intakes: review.reconciliation.databaseBaseline.intakeCount + 145, scholarships: review.reconciliation.databaseBaseline.activeScholarshipCount + 5, verified_rich_scholarships: 5 };
    if (Object.entries(expected).some(([key, value]) => totals[0]?.[key] !== value)) throw new Error(`USTB post-publication totals invalid: ${JSON.stringify({ expected, actual: totals[0] })}`);
    return { written: written.summary, totals: totals[0], schoolId: review.reconciliation.databaseBaseline.schoolId };
  });
  console.log(JSON.stringify({ ok: true, batch, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
