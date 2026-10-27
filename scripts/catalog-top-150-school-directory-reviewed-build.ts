import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidateFile = "catalog.top-150-school-directory.candidate.draft.json";
const candidateReviewFile = "catalog.top-150-school-directory.candidate.review.json";
const outputFile = "catalog.reviewed-top-150-school-directory.json";
const reviewFile = "catalog.reviewed-top-150-school-directory.review.json";
const expectedCandidateFileSha256 = "df4b9d75bd49832898ddbc51549df436fdc86a71e1524fa27deb253fcad056d6";
const reviewedAt = "2026-10-27T13:46:38.308Z";
const reviewReference = "project-owner-chat-approval-2026-10-27-top-150-school-directory";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const candidateText = await readFile(resolve(root, "seeds", candidateFile), "utf8");
const candidateFileSha256 = hash(candidateText);
if (candidateFileSha256 !== expectedCandidateFileSha256) throw new Error("The approved top-150 school-directory candidate has changed.");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const candidateReview = JSON.parse(await readFile(resolve(root, "seeds", candidateReviewFile), "utf8"));
const draftReport = createCatalogMigrationValidationReport(candidate);
if (!draftReport.ok || candidate.version !== 1 || candidateReview.status !== "unreviewed_draft"
  || candidateReview.candidateFileSha256 !== expectedCandidateFileSha256
  || candidateReview.bundleSha256 !== draftReport.bundleSha256
  || candidateReview.operationPlanSha256 !== draftReport.operationPlanSha256
  || candidateReview.publicationAuthorized !== false || candidateReview.databaseWriteAuthorized !== false
  || candidateReview.policy?.schoolsOnly !== true || candidateReview.policy?.preserveExistingSchools !== true
  || draftReport.summary.cities !== 51 || draftReport.summary.schools !== 150
  || draftReport.summary.programs !== 0 || draftReport.summary.programIntakes !== 0 || draftReport.summary.scholarships !== 0) {
  throw new Error(`The approved top-150 school-directory candidate is invalid: ${draftReport.errors.join(" ")}`);
}
if (candidate.schools?.some((row) => row.contactNotes)) throw new Error("The approved school-directory candidate contains contact notes.");

const sourceSchemaSha256 = hash(JSON.stringify({
  cityFields: [...new Set(candidate.cities!.flatMap(Object.keys))].sort(),
  schoolFields: [...new Set(candidate.schools!.flatMap(Object.keys))].sort(),
}));
const publication: CatalogSeedBundle = {
  ...candidate,
  version: 2,
  generatedAt: reviewedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official-source top-150 school directory",
    cleanedExportName: candidateFile,
    cleanedExportSha256: draftReport.bundleSha256,
    sourceSchemaSha256,
    reviewReference,
    prohibitedDataReviewReference: reviewReference,
    approvalRecordedAt: reviewedAt,
    sourceReadOnly: true,
    prohibitedDataConfirmedExcluded: true,
  },
  cities: candidate.cities!.map((row) => ({
    ...row,
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: reviewedAt,
  })),
  schools: candidate.schools!.map((row) => ({
    ...row,
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: reviewedAt,
  })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.cities !== 51 || report.summary.schools !== 150
  || report.summary.programs !== 0 || report.summary.programIntakes !== 0 || report.summary.scholarships !== 0) {
  throw new Error(`Reviewed top-150 school-directory validation failed: ${report.errors.join(" ")}`);
}
const review = {
  version: 1,
  status: "human_review_completed",
  reviewReference,
  reviewedAt,
  approvedCandidateFileSha256: candidateFileSha256,
  approvedCandidateBundleSha256: draftReport.bundleSha256,
  publicationBundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256,
  scope: report.summary,
  targetSchoolCoverage: 150,
  confirmations: {
    projectOwnerApprovedDirectPublication: true,
    contentReviewed: true,
    officialSourcesReviewed: true,
    publicContentConfirmed: true,
    prohibitedDataConfirmedExcluded: true,
    missingDataMayRemainEmpty: true,
    preserveSchoolsOutsideTarget: true,
    preserveExistingSchoolDetails: true,
    preserveExistingCities: true,
    programsMustRemainUnchanged: true,
    programIntakesMustRemainUnchanged: true,
    scholarshipsMustRemainUnchanged: true,
  },
};
await Promise.all([
  writeFile(resolve(root, "seeds", outputFile), `${JSON.stringify(publication, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds", reviewFile), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  reviewReference,
  outputFile: `seeds/${outputFile}`,
  reviewFile: `seeds/${reviewFile}`,
  publicationBundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256,
  summary: report.summary,
}, null, 2));
