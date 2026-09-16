import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), batch = "uibe-scholarships-programs-batch-02", prefix = `catalog.${batch}`, schoolSlug = "university-of-international-business-and-economics";
const paths = { candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`), output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8"), candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, oldApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}`) throw new Error("UIBE batch review mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("UIBE candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sourceReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false || review.scope?.newProgramCount !== 4 || review.scope?.newProgramIntakeCount !== 4 || review.scope?.newScholarshipCount !== 2 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0) throw new Error("UIBE batch is not standing-authorized.");
if (candidate.cities?.length !== 1 || candidate.schools?.length !== 1 || candidate.programs?.length !== 4 || candidate.programIntakes?.length !== 4 || candidate.scholarships?.length !== 2 || candidate.scholarships.some((row: any) => !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("UIBE batch candidate scope changed.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({ cityFields: [...new Set(candidate.cities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(candidate.schools.flatMap(Object.keys))].sort(), programFields: [...new Set(candidate.programs.flatMap(Object.keys))].sort(), intakeFields: [...new Set(candidate.programIntakes.flatMap(Object.keys))].sort(), scholarshipFields: [...new Set(candidate.scholarships.flatMap(Object.keys))].sort() }));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official UIBE 2026 scholarship and program notices", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities.map(row => ({ ...row, status: "active" as const })),
  schools: candidate.schools.map(row => ({ ...row, status: "active" as const })),
  programs: candidate.programs.map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: candidate.programIntakes,
  scholarships: candidate.scholarships.map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 1 || report.summary.programs !== 4 || report.summary.programIntakes !== 4 || report.summary.scholarships !== 2) throw new Error(`Invalid UIBE publication: ${report.errors.join(" ")}`);
const programSlugs = publication.programs!.map(row => row.slug), scholarshipSlugs = publication.scholarships!.map(row => row.slug);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug, programSlugs, scholarshipSlugs, archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:uibe-batch-02-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const existingProgramsBefore = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p join schools s on s.id=p.school_id where s.slug=$1 and not (p.slug=any($2::text[]))", [schoolSlug, programSlugs]);
    const existingIntakesBefore = await tx.query<any>("select jsonb_agg(to_jsonb(pi)-'created_at'-'updated_at' order by p.slug,pi.intake_year,pi.intake_term) snapshot from program_intakes pi join programs p on p.id=pi.program_id join schools s on s.id=p.school_id where s.slug=$1 and not (p.slug=any($2::text[]))", [schoolSlug, programSlugs]);
    const existingScholarshipsBefore = await tx.query<any>("select jsonb_agg(to_jsonb(h)-'created_at'-'updated_at' order by h.slug) snapshot from scholarships h join schools s on s.id=h.school_id where s.slug=$1 and not (h.slug=any($2::text[]))", [schoolSlug, scholarshipSlugs]);
    const programExisting = await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug", [programSlugs]);
    const scholarshipExisting = await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [scholarshipSlugs]);
    if (schoolBefore.length !== 1 || !Array.isArray(existingProgramsBefore[0]?.snapshot) || existingProgramsBefore[0].snapshot.length !== 21 || !Array.isArray(existingScholarshipsBefore[0]?.snapshot) || existingScholarshipsBefore[0].snapshot.length !== 3) throw new Error(`UIBE protected baseline changed: ${JSON.stringify({ schoolRows: schoolBefore.length, programSnapshotType: typeof existingProgramsBefore[0]?.snapshot, programCount: existingProgramsBefore[0]?.snapshot?.length, scholarshipSnapshotType: typeof existingScholarshipsBefore[0]?.snapshot, scholarshipCount: existingScholarshipsBefore[0]?.snapshot?.length })}`);
    const programsPre = programExisting.length === 0, programsPost = programExisting.length === 4 && programExisting.every(row => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    const scholarshipsPre = scholarshipExisting.length === 0, scholarshipsPost = scholarshipExisting.length === 2 && scholarshipExisting.every(row => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if ((!programsPre && !programsPost) || (!scholarshipsPre && !scholarshipsPost)) throw new Error("UIBE safe-new state partially conflicts.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["beijing"], preserveExistingSchoolSlugs: [schoolSlug] });
    if (!written.ok) throw new Error(`UIBE batch write failed: ${written.errors.join(" ")}`);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const existingProgramsAfter = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p join schools s on s.id=p.school_id where s.slug=$1 and not (p.slug=any($2::text[]))", [schoolSlug, programSlugs]);
    const existingIntakesAfter = await tx.query<any>("select jsonb_agg(to_jsonb(pi)-'created_at'-'updated_at' order by p.slug,pi.intake_year,pi.intake_term) snapshot from program_intakes pi join programs p on p.id=pi.program_id join schools s on s.id=p.school_id where s.slug=$1 and not (p.slug=any($2::text[]))", [schoolSlug, programSlugs]);
    const existingScholarshipsAfter = await tx.query<any>("select jsonb_agg(to_jsonb(h)-'created_at'-'updated_at' order by h.slug) snapshot from scholarships h join schools s on s.id=h.school_id where s.slug=$1 and not (h.slug=any($2::text[]))", [schoolSlug, scholarshipSlugs]);
    if (JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0]?.snapshot) || JSON.stringify(existingProgramsAfter[0]?.snapshot) !== JSON.stringify(existingProgramsBefore[0]?.snapshot) || JSON.stringify(existingIntakesAfter[0]?.snapshot) !== JSON.stringify(existingIntakesBefore[0]?.snapshot) || JSON.stringify(existingScholarshipsAfter[0]?.snapshot) !== JSON.stringify(existingScholarshipsBefore[0]?.snapshot)) throw new Error("UIBE publication changed protected existing records.");
    const totals = await tx.query<any>(`select s.id,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from programs p where p.school_id=s.id and p.status='active' and p.verification_status='verified')::int verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=s.id and p.status='active')::int intakes,(select count(*) from scholarships h where h.school_id=s.id and h.status='active')::int scholarships,(select count(*) from scholarships h where h.school_id=s.id and h.status='active' and h.verification_status='verified')::int verified_scholarships,(select count(*) from scholarships h where h.school_id=s.id and h.status='active' and h.verification_status='verified' and jsonb_array_length(h.benefit_items)>0 and jsonb_array_length(h.eligibility_items)>0 and jsonb_array_length(h.application_materials)>0 and jsonb_array_length(h.application_steps)>0 and jsonb_array_length(h.action_links)>0)::int rich_verified_scholarships from schools s where s.slug=$1 and s.status='active' and s.verification_status='verified'`, [schoolSlug]);
    if (totals.length !== 1 || totals[0].programs !== 19 || totals[0].verified_programs !== 13 || totals[0].scholarships !== 5 || totals[0].verified_scholarships !== 3 || totals[0].rich_verified_scholarships < 3) throw new Error(`UIBE post-check failed: ${JSON.stringify(totals[0])}`);
    return { written: written.summary, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, batch, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
