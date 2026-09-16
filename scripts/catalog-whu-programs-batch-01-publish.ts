import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const root = process.cwd(), batch = "whu-programs-batch-01", prefix = `catalog.${batch}`, schoolSlug = "wuhan-university";
const paths = {
  candidate: resolve(root, `seeds/${prefix}.draft.json`), validation: resolve(root, `seeds/${prefix}.validation.json`), review: resolve(root, `seeds/${prefix}.review.json`),
  output: resolve(root, `seeds/${prefix}.approved.local.json`), approval: resolve(root, `seeds/${prefix}.approval.json`), state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const [candidateText, validation, review, state, oldApproval] = await Promise.all([
  readFile(paths.candidate, "utf8"), parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null),
]);
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}`) throw new Error("WHU review hash mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("WHU candidate changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sourceReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false || review.scope?.newProgramCount !== 599 || review.scope?.newProgramIntakeCount !== 599 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0 || review.scope?.scholarshipMutationCount !== 0) throw new Error("WHU batch is not standing-authorized.");
if (candidate.cities?.length !== 1 || candidate.schools?.length !== 1 || candidate.programs?.length !== 599 || candidate.programIntakes?.length !== 599 || candidate.scholarships?.length !== 0) throw new Error("WHU candidate scope changed.");
const approvedAt = oldApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({
  cityFields: [...new Set(candidate.cities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(candidate.schools.flatMap(Object.keys))].sort(),
  programFields: [...new Set(candidate.programs.flatMap(Object.keys))].sort(), intakeFields: [...new Set(candidate.programIntakes.flatMap(Object.keys))].sort(),
}));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official Wuhan University 2026 program catalogs and admissions guides", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities.map(row => ({ ...row, status: "active" as const })),
  schools: candidate.schools.map(row => ({ ...row, status: "active" as const })),
  programs: candidate.programs.map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: candidate.programIntakes,
  scholarships: [],
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 599 || report.summary.programIntakes !== 599 || report.summary.scholarships !== 0) throw new Error(`Invalid WHU publication: ${report.errors.join(" ")}`);
const programSlugs = publication.programs!.map(row => row.slug);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug, programSlugs, archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication); await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:whu-programs-batch-01-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const schoolBefore = await tx.query<any>("select id,to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const scholarshipBefore = await tx.query<any>("select jsonb_agg(to_jsonb(h)-'created_at'-'updated_at' order by h.slug) snapshot from scholarships h where h.school_id=$1", [schoolBefore[0]?.id]);
    const existing = await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug", [programSlugs]);
    const existingIntakes = await tx.query<any>("select p.slug,pi.intake_year,pi.intake_term,pi.status from program_intakes pi join programs p on p.id=pi.program_id where p.slug=any($1::text[]) order by p.slug", [programSlugs]);
    if (schoolBefore.length !== 1 || review.reconciliation.databaseBaseline.schoolId !== schoolBefore[0].id || !Array.isArray(scholarshipBefore[0]?.snapshot) || scholarshipBefore[0].snapshot.length !== 6) throw new Error("WHU protected baseline changed.");
    const preState = existing.length === 0 && existingIntakes.length === 0;
    const postState = existing.length === 599 && existingIntakes.length === 599 && existing.every(row => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt) && existingIntakes.every(row => row.intake_year === 2026 && row.intake_term === "Fall" && row.status === "closed");
    if (!preState && !postState) throw new Error(`WHU safe-new state partially conflicts: ${JSON.stringify({ programs: existing.length, intakes: existingIntakes.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["wuhan"], preserveExistingSchoolSlugs: [schoolSlug] });
    if (!written.ok) throw new Error(`WHU catalog write failed: ${written.errors.join(" ")}`);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug=$1", [schoolSlug]);
    const scholarshipAfter = await tx.query<any>("select jsonb_agg(to_jsonb(h)-'created_at'-'updated_at' order by h.slug) snapshot from scholarships h where h.school_id=$1", [schoolBefore[0].id]);
    if (JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot) || JSON.stringify(scholarshipAfter[0]?.snapshot) !== JSON.stringify(scholarshipBefore[0].snapshot)) throw new Error("WHU publication changed protected school or scholarship records.");
    const totals = await tx.query<any>(`select s.id,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from programs p where p.school_id=s.id and p.status='active' and p.verification_status='verified')::int verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=s.id and p.status='active')::int intakes,(select count(*) from scholarships h where h.school_id=s.id and h.status='active')::int scholarships,(select count(*) from scholarships h where h.school_id=s.id and h.status='active' and h.verification_status='verified')::int verified_scholarships from schools s where s.slug=$1 and s.status='active' and s.verification_status='verified'`, [schoolSlug]);
    if (totals.length !== 1 || totals[0].programs !== 599 || totals[0].verified_programs !== 599 || totals[0].intakes !== 599 || totals[0].scholarships !== 6 || totals[0].verified_scholarships !== 6) throw new Error(`WHU post-check failed: ${JSON.stringify(totals[0])}`);
    return { written: written.summary, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, batch, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally {
  await pool.end();
}
