import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const reviewHash = required("review-hash"), publicationReference = required("publication-reference"), confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(reviewHash) || publicationReference !== "standing-user-default-publication" || confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Invalid SCUT undergraduate publication parameters.");
const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state, existingApproval] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state), parse(paths.approval).catch(() => null)]);
const { reviewHash: storedReviewHash, ...reviewBase } = review;
if (storedReviewHash !== reviewHash || sha(JSON.stringify(reviewBase)) !== reviewHash || review.status !== "standing_user_approval" || review.scope?.newProgramRouteCount !== 99 || review.scope?.newProgramIntakeCount !== 99 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0 || review.scope?.newScholarshipCount !== 0 || review.reconciliation?.destructiveDeletion !== false || review.reconciliation?.programSlugConflicts !== 0 || review.reconciliation?.semanticConflicts !== 0 || review.sourceReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass") throw new Error("SCUT undergraduate standing review is invalid.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("SCUT undergraduate candidate changed after review.");
const approvedAt = existingApproval?.approvedAt ?? new Date().toISOString();
const reviewReference = `standing-user-default-publication-scut-undergraduate-${reviewHash}`;
const programs = candidate.programs ?? [], intakes = candidate.programIntakes ?? [];
const programSlugs = programs.map((row) => row.slug);
const sourceSchemaSha256 = sha(JSON.stringify({ programFields: [...new Set(programs.flatMap((row) => Object.keys(row)))].sort(), intakeFields: [...new Set(intakes.flatMap((row) => Object.keys(row)))].sort() }));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official SCUT undergraduate catalog and international admissions", cleanedExportName: "catalog.scut-undergraduate-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities, schools: candidate.schools,
  programs: programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: intakes, scholarships: [],
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 99 || report.summary.programIntakes !== 99 || report.summary.scholarships !== 0) throw new Error(`Invalid SCUT undergraduate publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference, approvedReviewSha256: reviewHash, approvedCandidateFileSha256: sha(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.scut-undergraduate-batch-01.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "south-china-university-of-technology", programSlugs, archivedAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:scut-undergraduate-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const school = await tx.query<any>("select id,status,verification_status from schools where slug='south-china-university-of-technology'", []);
    const cityBefore = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='guangzhou'", []);
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='south-china-university-of-technology'", []);
    const rowsBefore = await tx.query<any>("select slug,status,verification_status,last_verified_at from programs where slug=any($1::text[])", [programSlugs]);
    const totalsBefore = await tx.query<any>("select count(*)::int total_count,count(*) filter(where status='active')::int active_count from programs where school_id=$1", [school[0]?.id]);
    const scholarshipsBefore = await tx.query<any>("select coalesce(jsonb_agg(to_jsonb(sch) order by sch.id),'[]'::jsonb) snapshot from scholarships sch where school_id=$1", [school[0]?.id]);
    const pre = school.length === 1 && school[0].id === review.reconciliation.databaseBaseline.schoolId && school[0].status === "active" && school[0].verification_status === "verified" && cityBefore[0]?.snapshot.id === review.reconciliation.databaseBaseline.cityId && totalsBefore[0]?.total_count === 0 && rowsBefore.length === 0;
    const post = school.length === 1 && school[0].id === review.reconciliation.databaseBaseline.schoolId && school[0].status === "active" && school[0].verification_status === "verified" && cityBefore[0]?.snapshot.id === review.reconciliation.databaseBaseline.cityId && totalsBefore[0]?.active_count === 99 && rowsBefore.length === 99 && rowsBefore.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!pre && !post) throw new Error(`SCUT undergraduate scope partially conflicts: ${JSON.stringify({ totalsBefore: totalsBefore[0], candidateRows: rowsBefore.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["guangzhou"], preserveExistingSchoolSlugs: ["south-china-university-of-technology"] });
    if (!written.ok) throw new Error(`SCUT undergraduate write failed: ${written.errors.join(" ")}`);
    const cityAfter = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='guangzhou'", []);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='south-china-university-of-technology'", []);
    const final = await tx.query<any>("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count,count(*) filter(where slug=any($2::text[]))::int published_batch from programs where school_id=$1 and status='active'", [school[0].id, programSlugs]);
    const intakeFinal = await tx.query<any>("select count(*)::int count,count(*) filter(where i.status='closed')::int closed_count from program_intakes i join programs p on p.id=i.program_id where p.school_id=$1 and p.slug=any($2::text[]) and i.intake_year=2026", [school[0].id, programSlugs]);
    const scholarshipsAfter = await tx.query<any>("select coalesce(jsonb_agg(to_jsonb(sch) order by sch.id),'[]'::jsonb) snapshot from scholarships sch where school_id=$1", [school[0].id]);
    if (JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0]?.snapshot) || JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0]?.snapshot)) throw new Error("SCUT city or school dependency changed.");
    if (JSON.stringify(scholarshipsAfter[0]?.snapshot) !== JSON.stringify(scholarshipsBefore[0]?.snapshot)) throw new Error("SCUT scholarships changed during program publication.");
    if (final[0]?.active_count !== 99 || final[0]?.verified_count !== 99 || final[0]?.published_batch !== 99 || intakeFinal[0]?.count !== 99 || intakeFinal[0]?.closed_count !== 99) throw new Error(`SCUT undergraduate post-check failed: ${JSON.stringify({ final: final[0], intakes: intakeFinal[0] })}`);
    return { written, final: final[0], intakes: intakeFinal[0], scholarshipsPreserved: review.reconciliation.databaseBaseline.activeScholarshipCount };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
