import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const batch = process.argv.find((arg) => arg.startsWith("--batch="))?.slice("--batch=".length);
if (!batch || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batch)) throw new Error("Provide --batch=<safe-batch-name>.");
const root = process.cwd(), prefix = `catalog.${batch}`;
const paths = {
  candidate: resolve(root, `seeds/${prefix}.draft.json`),
  validation: resolve(root, `seeds/${prefix}.validation.json`),
  review: resolve(root, `seeds/${prefix}.review.json`),
  output: resolve(root, `seeds/${prefix}.approved.local.json`),
  approval: resolve(root, `seeds/${prefix}.approval.json`),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, existingApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || publicationReference !== `standing-authorized-${batch}-${reviewHash}`) throw new Error("Review hash/reference mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("Candidate changed after review.");
const programs = candidate.programs ?? [], intakes = candidate.programIntakes ?? [], scholarships = candidate.scholarships ?? [], schools = candidate.schools ?? [];
if (schools.length !== 1 || review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass" || review.sourceReview?.result !== "pass") throw new Error("Review is not eligible for standing publication.");
if (review.scope?.newSchoolCount !== 1 || review.scope?.programRouteCount !== programs.length || review.scope?.programIntakeCount !== intakes.length || review.scope?.newScholarshipCount !== scholarships.length || review.scope?.cityOverwriteCount !== 0 || review.scope?.schoolOverwriteCount !== 0 || review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot overwrite, archive or delete records.");
const school = schools[0];
if (review.scope.schoolSlug !== school.slug) throw new Error("Review school scope mismatch.");

const approvedAt = existingApproval?.approvedAt ?? new Date().toISOString();
const sourceSchemaSha256 = sha(JSON.stringify({
  cityFields: [...new Set((candidate.cities ?? []).flatMap((row) => Object.keys(row)))].sort(),
  schoolFields: [...new Set(schools.flatMap((row) => Object.keys(row)))].sort(),
  programFields: [...new Set(programs.flatMap((row) => Object.keys(row)))].sort(),
  intakeFields: [...new Set(intakes.flatMap((row) => Object.keys(row)))].sort(),
  scholarshipFields: [...new Set(scholarships.flatMap((row) => Object.keys(row)))].sort(),
}));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: `CUAC reviewed official ${school.nameEn} sources`, cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities,
  schools: schools.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: intakes,
  scholarships: scholarships.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 1 || report.summary.programs !== programs.length || report.summary.programIntakes !== intakes.length || report.summary.scholarships !== scholarships.length) throw new Error(`Invalid publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: `seeds/${prefix}.approved.local.json`, publicationBundleSha256: report.bundleSha256, schoolSlug: school.slug, programSlugs: publication.programs!.map((row) => row.slug), scholarshipSlugs: publication.scholarships!.map((row) => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: `cuac:${batch}:publish` });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const citySlug = candidate.cities?.[0]?.slug;
    const expectedCity = review.reconciliation.databaseBaseline.cityDependency;
    if (!citySlug || !expectedCity || candidate.cities?.length !== 1) throw new Error("Exactly one reviewed city dependency is required.");
    const cityBefore = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug=$1", [citySlug]);
    if (cityBefore.length !== 1 || JSON.stringify(cityBefore[0]) !== JSON.stringify(expectedCity)) throw new Error("City dependency baseline changed.");
    const schoolRows = await tx.query<any>("select id,status,verification_status,last_verified_at from schools where slug=$1 or lower(name_en)=lower($2) or ($3::text is not null and name_zh=$3)", [school.slug, school.nameEn, school.nameZh ?? null]);
    const programSlugs = publication.programs!.map((row) => row.slug), scholarshipSlugs = publication.scholarships!.map((row) => row.slug);
    const programRows = programSlugs.length ? await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[])", [programSlugs]) : [];
    const scholarshipRows = scholarshipSlugs.length ? await tx.query<any>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[])", [scholarshipSlugs]) : [];
    const pre = schoolRows.length === 0 && programRows.length === 0 && scholarshipRows.length === 0;
    const post = schoolRows.length === 1 && schoolRows[0].status === "active" && schoolRows[0].verification_status === "verified" && schoolRows[0].last_verified_at?.toISOString() === approvedAt && programRows.length === programs.length && programRows.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt) && scholarshipRows.length === scholarships.length && scholarshipRows.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error(`Candidate scope partially conflicts: ${JSON.stringify({ schools: schoolRows.length, programs: programRows.length, scholarships: scholarshipRows.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const afterSchool = await tx.query<any>("select id,status,verification_status,last_verified_at from schools where slug=$1", [school.slug]);
    const totals = await tx.query<any>("select (select count(*) from programs where school_id=$1 and status='active')::int programs,(select count(*) from programs where school_id=$1 and verification_status='verified')::int verified_programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::int intakes,(select count(*) from scholarships where school_id=$1 and status='active')::int scholarships,(select count(*) from scholarships where school_id=$1 and verification_status='verified')::int verified_scholarships", [afterSchool[0]?.id]);
    if (afterSchool.length !== 1 || afterSchool[0].verification_status !== "verified" || totals[0]?.programs !== programs.length || totals[0]?.verified_programs !== programs.length || totals[0]?.intakes !== intakes.length || totals[0]?.scholarships !== scholarships.length || totals[0]?.verified_scholarships !== scholarships.length) throw new Error(`Post-publication totals invalid: ${JSON.stringify(totals[0])}`);
    const cityAfter = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_note,source_field_lineage_json from cities where slug=$1", [citySlug]);
    if (JSON.stringify(cityAfter[0]) !== JSON.stringify(expectedCity)) throw new Error("City dependency was substantively changed.");
    return { written: written.summary, schoolId: afterSchool[0].id, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, batch, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
