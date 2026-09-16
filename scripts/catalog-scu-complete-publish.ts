import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map(arg => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
if ([...options.keys()].some(key => !new Set(["review-hash", "review", "approved-at", "confirm"]).has(key))) throw new Error("Unknown publication option.");
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid review hash or approval time.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.scu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.scu-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.scu-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.scu-complete-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.scu-complete-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const storedValidation = await parse(paths.validation);
const review = await parse(paths.review);
const state = await parse(paths.state);
const { reviewHash: storedHash, publicationReference: storedReference, ...reviewBase } = review;
if (storedHash !== approvedReviewHash || createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex") !== approvedReviewHash || storedReference !== reviewReference) throw new Error("SCU review hash/reference mismatch.");
if (createHash("sha256").update(candidateText).digest("hex") !== review.candidateSha256) throw new Error("SCU candidate changed after review.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !storedValidation.ok || fresh.bundleSha256 !== storedValidation.bundleSha256 || fresh.operationPlanSha256 !== storedValidation.operationPlanSha256) throw new Error("SCU candidate validation changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass") throw new Error("SCU review is not eligible for standing-authorized publication.");
if (review.scope?.schoolSlug !== "sichuan-university" || review.scope?.schoolCount !== 1 || review.scope?.programRouteCount !== 639 || review.scope?.programIntakeCount !== 639 || review.scope?.scholarshipCount !== 2) throw new Error("SCU review scope mismatch.");
if (review.scope?.cityOverwriteCount !== 0 || review.scope?.schoolOverwriteCount !== 0 || review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot archive, delete or substantively overwrite records.");

const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({
  cityFields: [...new Set((candidate.cities ?? []).flatMap(row => Object.keys(row)))].sort(),
  schoolFields: [...new Set((candidate.schools ?? []).flatMap(row => Object.keys(row)))].sort(),
  programFields: [...new Set((candidate.programs ?? []).flatMap(row => Object.keys(row)))].sort(),
  intakeFields: [...new Set((candidate.programIntakes ?? []).flatMap(row => Object.keys(row)))].sort(),
  scholarshipFields: [...new Set((candidate.scholarships ?? []).flatMap(row => Object.keys(row)))].sort(),
})).digest("hex");
const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official Sichuan University 2026 sources", cleanedExportName: "catalog.scu-complete-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: (candidate.cities ?? []).map(row => ({ ...row, status: "active" as const })),
  schools: (candidate.schools ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: (candidate.programs ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: (candidate.programIntakes ?? []).map(row => ({ ...row, status: "closed" as const })),
  scholarships: (candidate.scholarships ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.cities !== 1 || report.summary.schools !== 1 || report.summary.programs !== 639 || report.summary.programIntakes !== 639 || report.summary.scholarships !== 2) throw new Error(`Invalid SCU publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference, approvedReviewSha256: approvedReviewHash, approvedCandidateFileSha256: createHash("sha256").update(candidateText).digest("hex"), approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.scu-complete-batch-01.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "sichuan-university", programSlugs: publication.programs!.map(row => row.slug), scholarshipSlugs: publication.scholarships!.map(row => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:scu-complete-batch-01" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const cityBefore = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_field_lineage_json from cities where slug='chengdu'", []);
    const expectedCity = [{ id: "eaad5100-cb9e-401c-a9be-936666bd6d1f", slug: "chengdu", name_en: "Chengdu", name_zh: "成都", region: "西南", province: null, status: "active", verification_status: "unverified", source_url: "https://www.cscapilot.com/zh/study-china/cities/chengdu", source_label: "CSCAPilot online city catalog recovery export", source_field_lineage_json: { nameEn: "city_guides.nameEn", nameZh: "city_guides.nameZh", region: "city_guides.region" } }];
    if (JSON.stringify(cityBefore) !== JSON.stringify(expectedCity)) throw new Error(`Chengdu dependency baseline mismatch: ${JSON.stringify(cityBefore)}`);
    const schoolBefore = await tx.query<any>("select id,status,verification_status from schools where slug='sichuan-university'", []);
    const programSlugs = publication.programs!.map(row => row.slug);
    const scholarshipSlugs = publication.scholarships!.map(row => row.slug);
    const programsBefore = await tx.query<any>("select slug,status,verification_status from programs where slug=any($1::text[])", [programSlugs]);
    const scholarshipsBefore = await tx.query<any>("select slug,status,verification_status from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
    const pre = schoolBefore.length === 0 && programsBefore.length === 0 && scholarshipsBefore.length === 0;
    const post = schoolBefore.length === 1 && schoolBefore[0].status === "active" && schoolBefore[0].verification_status === "verified" && programsBefore.length === 639 && programsBefore.every(row => row.status === "active" && row.verification_status === "verified") && scholarshipsBefore.length === 2 && scholarshipsBefore.every(row => row.status === "active" && row.verification_status === "verified");
    if (!pre && !post) throw new Error(`SCU candidate is partially present: ${JSON.stringify({ school: schoolBefore.length, programs: programsBefore.length, scholarships: scholarshipsBefore.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const totals = await tx.query<any>("select s.id school_id,(select count(*) from programs p where p.school_id=s.id and p.status='active')::int programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=s.id)::int intakes,(select count(*) from scholarships sc where sc.school_id=s.id and sc.status='active')::int scholarships,(select count(*) from scholarships sc where sc.school_id=s.id and sc.status='active' and sc.verification_status='verified')::int verified_scholarships from schools s where s.slug='sichuan-university' and s.status='active' and s.verification_status='verified'", []);
    if (totals.length !== 1 || totals[0].programs !== 639 || totals[0].intakes !== 639 || totals[0].scholarships !== 2 || totals[0].verified_scholarships !== 2) throw new Error(`SCU post-check failed: ${JSON.stringify(totals)}`);
    const rich = await tx.query<any>("select count(*)::int count from scholarships where slug=any($1::text[]) and status='active' and verification_status='verified' and jsonb_array_length(benefit_items)>0 and jsonb_array_length(eligibility_items)>0 and jsonb_array_length(application_materials)>0 and jsonb_array_length(application_steps)>0 and jsonb_array_length(action_links)>0", [scholarshipSlugs]);
    if (rich[0]?.count !== 2) throw new Error(`SCU rich scholarship post-check failed: ${JSON.stringify(rich)}`);
    const cityAfter = await tx.query<any>("select id,slug,name_en,name_zh,region,province,status,verification_status,source_url,source_label,source_field_lineage_json from cities where slug='chengdu'", []);
    if (JSON.stringify(cityAfter) !== JSON.stringify(cityBefore)) throw new Error("SCU publication substantively changed the Chengdu dependency city.");
    return { written: written.summary, schoolId: totals[0].school_id, totals: totals[0], richScholarships: rich[0].count };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
