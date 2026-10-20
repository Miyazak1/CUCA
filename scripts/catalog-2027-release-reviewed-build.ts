import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidatePath = resolve(root, "seeds/catalog.2027-release-candidate.draft.json");
const candidateReviewPath = resolve(root, "seeds/catalog.2027-release-candidate.review.json");
const outputPath = resolve(root, "seeds/catalog.2027-release.reviewed.json");
const reviewPath = resolve(root, "seeds/catalog.2027-release.review.json");
const expectedCandidateFileSha256 = "9ffbd73f611217f1115fd02f8bea387fe8b60b22419d6858a53b1af9e65c36cd";
const reviewedAt = "2026-10-20T13:16:22.604Z";
const reviewReference = "project-owner-chat-approval-2026-10-20-100-school";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const candidateText = await readFile(candidatePath, "utf8");
const candidateFileSha256 = hash(candidateText);
if (candidateFileSha256 !== expectedCandidateFileSha256) throw new Error("The approved 2027 release candidate has changed since project-owner review.");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const candidateReview = JSON.parse(await readFile(candidateReviewPath, "utf8"));
if (candidateReview.status !== "unreviewed_draft" || candidateReview.candidateSha256 !== candidateFileSha256
  || candidateReview.publicationAuthorized !== false || candidateReview.databaseWriteAuthorized !== false
  || candidateReview.target?.completedSchoolCoverage !== 100 || candidateReview.target?.updatedSchoolCount !== 99) {
  throw new Error("The source candidate review manifest is not the locked 100-school draft.");
}

const draftReport = createCatalogMigrationValidationReport(candidate);
if (!draftReport.ok || candidate.version !== 1 || draftReport.summary.cities !== 34 || draftReport.summary.schools !== 99
  || draftReport.summary.programs !== 2031 || draftReport.summary.programIntakes !== 1958 || draftReport.summary.scholarships !== 95) {
  throw new Error(`The approved 2027 candidate failed validation: ${draftReport.errors.join(" ")}`);
}
if (candidate.programIntakes?.some((row) => row.intakeYear !== 2027)) throw new Error("The approved candidate contains a non-2027 intake.");

const sourceSchemaSha256 = hash(JSON.stringify({
  cityFields: [...new Set(candidate.cities!.flatMap(Object.keys))].sort(),
  schoolFields: [...new Set(candidate.schools!.flatMap(Object.keys))].sort(),
  programFields: [...new Set(candidate.programs!.flatMap(Object.keys))].sort(),
  intakeFields: [...new Set(candidate.programIntakes!.flatMap(Object.keys))].sort(),
  scholarshipFields: [...new Set(candidate.scholarships!.flatMap(Object.keys))].sort(),
}));
const publication: CatalogSeedBundle = {
  ...candidate,
  version: 2,
  generatedAt: reviewedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official-source 2027 admissions refresh",
    cleanedExportName: "catalog.2027-release-candidate.draft.json",
    cleanedExportSha256: draftReport.bundleSha256,
    sourceSchemaSha256,
    reviewReference,
    prohibitedDataReviewReference: reviewReference,
    approvalRecordedAt: reviewedAt,
    sourceReadOnly: true,
    prohibitedDataConfirmedExcluded: true,
  },
  programs: candidate.programs!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: reviewedAt })),
  scholarships: candidate.scholarships!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: reviewedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.cities !== 34 || report.summary.schools !== 99 || report.summary.programs !== 2031
  || report.summary.programIntakes !== 1958 || report.summary.scholarships !== 95) {
  throw new Error(`Reviewed 2027 release validation failed: ${report.errors.join(" ")}`);
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
  targetSchoolCoverage: 100,
  updatedSchoolCount: 99,
  alreadyCurrentSchoolSlugs: ["qingdao-university"],
  confirmations: {
    projectOwnerApprovedDirectPublication: true,
    contentReviewed: true,
    officialSourcesReviewed: true,
    publicContentConfirmed: true,
    prohibitedDataConfirmedExcluded: true,
    missingDataMayRemainEmpty: true,
    unresolvedDatesWereNotInferred: true,
    existingSchoolAndCityProfilesMustBePreserved: true,
  },
};

await Promise.all([
  writeFile(outputPath, `${JSON.stringify(publication, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  reviewReference,
  outputPath,
  reviewPath,
  publicationBundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256,
  summary: report.summary,
}, null, 2));
