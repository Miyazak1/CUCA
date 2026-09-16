import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map(arg => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const allowed = new Set(["review-hash", "review", "approved-at", "confirm"]);
const unknown = [...options.keys()].filter(key => !allowed.has(key));
if (unknown.length) throw new Error(`Unknown options: ${unknown.join(", ")}`);
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvalRecordedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash)) throw new Error("Review hash must be a lowercase SHA-256 digest.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvalRecordedAt) || Number.isNaN(Date.parse(approvalRecordedAt))) throw new Error("Approval time must be an ISO UTC timestamp.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.csu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.csu-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.csu-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.csu-complete-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.csu-complete-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const storedValidation = await parse(paths.validation);
const review = await parse(paths.review);
const state = await parse(paths.state);
const { reviewHash: storedReviewHash, approvalPhrase: _approvalPhrase, ...reviewBase } = review;
const actualReviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
if (storedReviewHash !== approvedReviewHash || actualReviewHash !== approvedReviewHash) throw new Error("User-approved review hash does not match the stored CSU review.");
const candidateFileSha256 = createHash("sha256").update(candidateText).digest("hex");
if (candidateFileSha256 !== review.candidateSha256) throw new Error("CSU candidate file changed after review.");
const freshValidation = createCatalogMigrationValidationReport(candidate);
if (!freshValidation.ok || !storedValidation.ok || freshValidation.bundleSha256 !== storedValidation.bundleSha256 || freshValidation.operationPlanSha256 !== storedValidation.operationPlanSha256) throw new Error("CSU candidate validation no longer matches the reviewed bundle.");
if (review.status !== "awaiting_user_approval" || review.sensitiveDataCheck?.result !== "pass") throw new Error("CSU review is not eligible for publication processing.");
if (review.scope?.schoolSlug !== "central-south-university" || review.scope?.programRouteCount !== 370 || review.scope?.scholarshipCount !== 7 || review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0) throw new Error("CSU review scope mismatch.");
if ((review.reconciliation?.legacyProgramAliasesToArchive?.length ?? -1) !== 0 || (review.reconciliation?.legacyScholarshipAliasesToArchive?.length ?? -1) !== 0) throw new Error("CSU review must not archive catalog aliases.");
const stablePrograms: string[] = review.reconciliation?.stableUndergraduateSlugs;
const stableScholarships: string[] = review.reconciliation?.stableScholarshipSlugs;
if (!Array.isArray(stablePrograms) || stablePrograms.length !== 10 || new Set(stablePrograms).size !== 10) throw new Error("CSU review must preserve ten stable undergraduate slugs.");
if (!Array.isArray(stableScholarships) || stableScholarships.length !== 1 || stableScholarships[0] !== "official-2026-csu-international-student-scholarship") throw new Error("CSU review must preserve the existing scholarship slug.");

const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({
  cityFields: [...new Set((candidate.cities ?? []).flatMap(item => Object.keys(item)))].sort(),
  schoolFields: [...new Set((candidate.schools ?? []).flatMap(item => Object.keys(item)))].sort(),
  programFields: [...new Set((candidate.programs ?? []).flatMap(item => Object.keys(item)))].sort(),
  intakeFields: [...new Set((candidate.programIntakes ?? []).flatMap(item => Object.keys(item)))].sort(),
  scholarshipFields: [...new Set((candidate.scholarships ?? []).flatMap(item => Object.keys(item)))].sort(),
})).digest("hex");
const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvalRecordedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official Central South University 2026 sources",
    cleanedExportName: "catalog.csu-complete-batch-01.draft.json",
    cleanedExportSha256: freshValidation.bundleSha256,
    sourceSchemaSha256,
    reviewReference,
    prohibitedDataReviewReference: reviewReference,
    approvalRecordedAt,
    sourceReadOnly: true,
    prohibitedDataConfirmedExcluded: true,
  },
  cities: (candidate.cities ?? []).map(row => ({ ...row, status: "active" as const })),
  schools: (candidate.schools ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
  programs: (candidate.programs ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
  programIntakes: candidate.programIntakes ?? [],
  scholarships: (candidate.scholarships ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
};
const publicationReport = createCatalogMigrationValidationReport(publication);
if (!publicationReport.ok || publicationReport.summary.schools !== 1 || publicationReport.summary.programs !== 370 || publicationReport.summary.programIntakes !== 370 || publicationReport.summary.scholarships !== 7) throw new Error(`CSU publication bundle is invalid: ${publicationReport.errors.join(" ")}`);
const approvalRecord = {
  version: 1, approvedAt: approvalRecordedAt, reviewReference, approvedReviewSha256: approvedReviewHash,
  approvedCandidate: "seeds/catalog.csu-complete-batch-01.draft.json", approvedCandidateFileSha256: candidateFileSha256,
  approvedCandidateBundleSha256: freshValidation.bundleSha256, publicationBundle: "seeds/catalog.csu-complete-batch-01.approved.local.json",
  publicationBundleSha256: publicationReport.bundleSha256, schoolSlug: "central-south-university",
  programSlugs: publication.programs?.map(row => row.slug), scholarshipSlugs: publication.scholarships?.map(row => row.slug),
  stableProgramSlugs: stablePrograms, stableScholarshipSlugs: stableScholarships, archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true,
};
async function writeOrVerify(path: string, value: unknown) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, text, { encoding: "utf8", flag: "wx" }); }
  catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== text) throw new Error(`Existing artifact does not match this approval: ${path}`); }
}
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approvalRecord);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:csu-complete-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() as database_name, current_user as database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Connected PostgreSQL identity does not match the CUAC local runtime.");
    const school = await tx.query<{ status: string; verification_status: string }>("select status, verification_status from schools where slug = $1", ["central-south-university"]);
    if (school.length !== 1 || school[0]?.status !== "active" || !["unverified", "verified"].includes(school[0]?.verification_status)) throw new Error("CSU school no longer matches the reviewed pre-state or approved post-state.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const counts = await tx.query<{ programs: string; scholarships: string; intakes: string }>(`select count(distinct p.id) filter (where p.status='active' and p.verification_status='verified')::text as programs, count(distinct sc.id) filter (where sc.status='active' and sc.verification_status='verified')::text as scholarships, count(distinct pi.id) filter (where p.status='active')::text as intakes from schools s left join programs p on p.school_id=s.id left join program_intakes pi on pi.program_id=p.id left join scholarships sc on sc.school_id=s.id where s.slug=$1 group by s.id`, ["central-south-university"]);
    if (counts[0]?.programs !== "370" || counts[0]?.scholarships !== "7" || counts[0]?.intakes !== "370") throw new Error(`CSU publication count mismatch: ${JSON.stringify(counts[0])}`);
    return { written, activeVerifiedProgramCount: 370, activeVerifiedScholarshipCount: 7, intakeCount: 370 };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, approvedCandidateBundleSha256: freshValidation.bundleSha256, publicationBundleSha256: publicationReport.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
