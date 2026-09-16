import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map(arg => {
  const at = arg.indexOf("=");
  if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`);
  return [arg.slice(2, at), arg.slice(at + 1)];
}));
const required = (name: string) => {
  const value = options.get(name)?.trim();
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
};
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvalRecordedAt = required("approved-at");
const confirmation = required("confirm");
if ([...options.keys()].some(key => !new Set(["review-hash", "review", "approved-at", "confirm"]).has(key))) throw new Error("Unknown publication option.");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash)) throw new Error("Review hash must be a lowercase SHA-256 digest.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvalRecordedAt) || Number.isNaN(Date.parse(approvalRecordedAt))) throw new Error("Approval time must be an ISO UTC timestamp.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.tsinghua-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.tsinghua-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.tsinghua-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.tsinghua-complete-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.tsinghua-complete-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const storedValidation = await parse(paths.validation);
const review = await parse(paths.review);
const state = await parse(paths.state);
const { reviewHash: storedReviewHash, publicationReference: _publicationReference, ...reviewBase } = review;
const actualReviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
if (storedReviewHash !== approvedReviewHash || actualReviewHash !== approvedReviewHash) throw new Error("Standing-authorized review hash does not match the stored Tsinghua review.");
if (createHash("sha256").update(candidateText).digest("hex") !== review.candidateSha256) throw new Error("Tsinghua candidate changed after review.");
const freshValidation = createCatalogMigrationValidationReport(candidate);
if (!freshValidation.ok || !storedValidation.ok || freshValidation.bundleSha256 !== storedValidation.bundleSha256 || freshValidation.operationPlanSha256 !== storedValidation.operationPlanSha256) throw new Error("Tsinghua candidate validation no longer matches the reviewed bundle.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass") throw new Error("Tsinghua review is not eligible for standing-authorized publication.");
if (review.scope?.schoolSlug !== "tsinghua-university" || review.scope?.schoolCount !== 1 || review.scope?.programRouteCount !== 128 || review.scope?.programIntakeCount !== 91 || review.scope?.scholarshipCount !== 4) throw new Error("Tsinghua review scope mismatch.");
if (review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot archive or delete records.");

const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({
  cityFields: [...new Set((candidate.cities ?? []).flatMap(item => Object.keys(item)))].sort(),
  schoolFields: [...new Set((candidate.schools ?? []).flatMap(item => Object.keys(item)))].sort(),
  programFields: [...new Set((candidate.programs ?? []).flatMap(item => Object.keys(item)))].sort(),
  intakeFields: [...new Set((candidate.programIntakes ?? []).flatMap(item => Object.keys(item)))].sort(),
  scholarshipFields: [...new Set((candidate.scholarships ?? []).flatMap(item => Object.keys(item)))].sort(),
})).digest("hex");
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvalRecordedAt,
  handoff: { sourceSystem: "CUAC reviewed official Tsinghua University 2026 sources", cleanedExportName: "catalog.tsinghua-complete-batch-01.draft.json", cleanedExportSha256: freshValidation.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: (candidate.cities ?? []).map(row => ({ ...row, status: "active" as const })),
  schools: (candidate.schools ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
  programs: (candidate.programs ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
  programIntakes: (candidate.programIntakes ?? []).map(row => ({ ...row, status: "closed" as const })),
  scholarships: (candidate.scholarships ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
};
const publicationReport = createCatalogMigrationValidationReport(publication);
if (!publicationReport.ok || publicationReport.summary.schools !== 1 || publicationReport.summary.programs !== 128 || publicationReport.summary.programIntakes !== 91 || publicationReport.summary.scholarships !== 4) throw new Error(`Tsinghua publication bundle is invalid: ${publicationReport.errors.join(" ")}`);
const approvalRecord = { version: 1, approvedAt: approvalRecordedAt, reviewReference, approvedReviewSha256: approvedReviewHash, approvalMode: "standing-user-default-publication", approvedCandidate: "seeds/catalog.tsinghua-complete-batch-01.draft.json", approvedCandidateBundleSha256: freshValidation.bundleSha256, publicationBundle: "seeds/catalog.tsinghua-complete-batch-01.approved.local.json", publicationBundleSha256: publicationReport.bundleSha256, schoolSlug: "tsinghua-university", programSlugs: publication.programs?.map(row => row.slug), scholarshipSlugs: publication.scholarships?.map(row => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, text, { encoding: "utf8", flag: "wx" }); }
  catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== text) throw new Error(`Existing artifact does not match this publication: ${path}`); }
}
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approvalRecord);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:tsinghua-complete-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() as database_name, current_user as database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Connected PostgreSQL identity does not match the CUAC local runtime.");
    const before = await tx.query<{ id: string }>("select id from schools where slug=$1 or lower(name_en)=lower($2) or name_zh=$3", ["tsinghua-university", "Tsinghua University", "清华大学"]);
    if (before.length !== 0) throw new Error("Tsinghua record now exists; standing authorization requires a new conflict review before overwrite.");
    const city = await tx.query<{ name_en: string; name_zh: string; region: string; province: string }>("select name_en,name_zh,region,province from cities where slug=$1", ["beijing"]);
    if (city.length !== 1 || city[0].name_en !== "Beijing" || city[0].name_zh !== "北京" || city[0].region !== "North China" || city[0].province !== "Beijing") throw new Error(`Existing Beijing city record is not the reviewed reference target: ${JSON.stringify(city)}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const counts = await tx.query<{ school_id: string; programs: string; intakes: string; scholarships: string }>("select s.id school_id,(select count(*) from programs p where p.school_id=s.id and p.status='active')::text programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=s.id)::text intakes,(select count(*) from scholarships sc where sc.school_id=s.id and sc.status='active' and sc.verification_status='verified')::text scholarships from schools s where s.slug=$1", ["tsinghua-university"]);
    if (counts[0]?.programs !== "128" || counts[0]?.intakes !== "91" || counts[0]?.scholarships !== "4") throw new Error(`Tsinghua publication count mismatch: ${JSON.stringify(counts[0])}`);
    return { written, schoolId: counts[0].school_id, activeProgramCount: 128, intakeCount: 91, activeVerifiedScholarshipCount: 4 };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: publicationReport.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
