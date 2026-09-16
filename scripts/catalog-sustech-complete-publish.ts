import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
if ([...options.keys()].some((key) => !new Set(["review-hash", "review", "approved-at", "confirm"]).has(key))) throw new Error("Unknown publication option.");
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid review hash or approval time.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.sustech-complete-batch-01.draft.json"), validation: resolve(root, "seeds/catalog.sustech-complete-batch-01.validation.json"), review: resolve(root, "seeds/catalog.sustech-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.sustech-complete-batch-01.approved.local.json"), approval: resolve(root, "seeds/catalog.sustech-complete-batch-01.approval.json"), state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = await parse(paths.validation);
const review = await parse(paths.review);
const state = await parse(paths.state);
const { reviewHash: storedHash, publicationReference: storedReference, ...reviewBase } = review;
if (storedHash !== approvedReviewHash || createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex") !== approvedReviewHash || storedReference !== reviewReference) throw new Error("Standing-authorized SUSTech review hash/reference mismatch.");
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const fresh = createCatalogMigrationValidationReport(candidate);
if (candidateSha256 !== review.candidateSha256 || !fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("SUSTech candidate or validation changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass" || review.visualReview?.result !== "pass") throw new Error("SUSTech review is not eligible for standing-authorized publication.");
if (review.scope?.newSchoolCount !== 1 || review.scope?.programRouteCount !== 60 || review.scope?.programIntakeCount !== 25 || review.scope?.newScholarshipCount !== 7 || review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.scope?.cityOverwriteCount !== 0 || review.scope?.schoolOverwriteCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot archive, delete or substantively overwrite records.");

const programs = candidate.programs ?? [];
const intakes = candidate.programIntakes ?? [];
const scholarships = candidate.scholarships ?? [];
if (candidate.schools?.length !== 1 || programs.length !== 60 || intakes.length !== 25 || scholarships.length !== 7 || programs.some((row) => row.status !== "draft") || scholarships.some((row) => row.status !== "draft")) throw new Error("SUSTech candidate scope mismatch.");
const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({ cityFields: [...new Set((candidate.cities ?? []).flatMap((row) => Object.keys(row)))].sort(), schoolFields: [...new Set(candidate.schools.flatMap((row) => Object.keys(row)))].sort(), programFields: [...new Set(programs.flatMap((row) => Object.keys(row)))].sort(), intakeFields: [...new Set(intakes.flatMap((row) => Object.keys(row)))].sort(), scholarshipFields: [...new Set(scholarships.flatMap((row) => Object.keys(row)))].sort() })).digest("hex");
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official SUSTech catalog and 2026 admission sources", cleanedExportName: "catalog.sustech-complete-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities,
  schools: candidate.schools.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: intakes,
  scholarships: scholarships.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 1 || report.summary.programs !== 60 || report.summary.programIntakes !== 25 || report.summary.scholarships !== 7) throw new Error(`Invalid SUSTech publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference, approvedReviewSha256: approvedReviewHash, approvedCandidateFileSha256: candidateSha256, approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.sustech-complete-batch-01.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "southern-university-of-science-and-technology", programSlugs: publication.programs!.map((row) => row.slug), scholarshipSlugs: publication.scholarships!.map((row) => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:sustech-complete-batch-01" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const cityBefore = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,source_url,source_label,source_field_lineage_json from cities where slug='shenzhen'", []);
    const expectedCity = { id: "0ca88c73-b154-4d7b-9ba7-340bdfdbf177", slug: "shenzhen", name_en: "Shenzhen", name_zh: "深圳", region: "South China", province: "Guangdong", status: "active", source_url: "https://iso.sysu.edu.cn/en/application/guide/1420575.htm", source_label: "Sun Yat-sen University 2026 international undergraduate admission guide", source_field_lineage_json: { nameEn: "official campus descriptions", province: "official university location" } };
    if (cityBefore.length !== 1 || JSON.stringify(cityBefore[0]) !== JSON.stringify(expectedCity)) throw new Error("Shenzhen dependency city baseline changed.");
    const schoolBefore = await tx.query<any>("select id,status,verification_status from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", ["southern-university-of-science-and-technology", "Southern University of Science and Technology", "南方科技大学"]);
    const programSlugs = publication.programs!.map((row) => row.slug);
    const scholarshipSlugs = publication.scholarships!.map((row) => row.slug);
    const existingPrograms = await tx.query<any>("select slug,status,verification_status from programs where slug=any($1::text[])", [programSlugs]);
    const existingScholarships = await tx.query<any>("select slug,status,verification_status from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
    const pre = schoolBefore.length === 0 && existingPrograms.length === 0 && existingScholarships.length === 0;
    const post = schoolBefore.length === 1 && schoolBefore[0].status === "active" && schoolBefore[0].verification_status === "verified" && existingPrograms.length === 60 && existingPrograms.every((row) => row.status === "active" && row.verification_status === "verified") && existingScholarships.length === 7 && existingScholarships.every((row) => row.status === "active" && row.verification_status === "verified");
    if (!pre && !post) throw new Error(`SUSTech candidate scope partially conflicts: ${JSON.stringify({ schools: schoolBefore.length, programs: existingPrograms.length, scholarships: existingScholarships.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok || written.summary.evidence !== 94) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const school = await tx.query<{ id: string }>("select id from schools where slug=$1 and status='active' and verification_status='verified' and last_verified_at=$2", ["southern-university-of-science-and-technology", approvedAt]);
    if (school.length !== 1) throw new Error("SUSTech school post-check failed.");
    const totals = await tx.query<any>("select (select count(*) from programs where school_id=$1 and status='active')::text programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified' and jsonb_array_length(benefit_items)>0 and jsonb_array_length(eligibility_items)>0 and jsonb_array_length(application_steps)>0 and jsonb_array_length(action_links)>0)::text rich_scholarships", [school[0].id]);
    if (JSON.stringify(totals[0]) !== JSON.stringify({ programs: "60", intakes: "25", scholarships: "7", rich_scholarships: "7" })) throw new Error(`SUSTech total-count mismatch: ${JSON.stringify(totals[0])}`);
    const cityAfter = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,source_url,source_label,source_field_lineage_json from cities where slug='shenzhen'", []);
    if (JSON.stringify(cityAfter[0]) !== JSON.stringify(expectedCity)) throw new Error("Shenzhen dependency city was substantively changed.");
    return { written: written.summary, schoolId: school[0].id, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
