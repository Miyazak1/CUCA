import {
  createCatalogMigrationValidationReport,
  type CatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "./seed-contract.ts";

type ReviewRecord = {
  schoolSlug: string;
  scholarshipSlug: string;
  status: string;
};

type ScholarshipReview = {
  status: string;
  schoolCount: number;
  scholarshipCount: number;
  sensitiveDataCheck?: { result?: string };
  records: ReviewRecord[];
};

type StoredValidation = {
  ok: boolean;
  errors: unknown[];
  bundleSha256: string;
};

export type ReviewedScholarshipPublication = {
  bundle: CatalogSeedBundle;
  report: CatalogMigrationValidationReport;
  approvedDraftBundleSha256: string;
  scholarshipSlugs: string[];
};

export function createReviewedScholarshipPublication(input: {
  draft: unknown;
  review: unknown;
  storedValidation: unknown;
  approvedDraftBundleSha256: string;
  reviewReference: string;
  approvalRecordedAt: string;
}): ReviewedScholarshipPublication {
  const draft = requireBundle(input.draft);
  const review = requireReview(input.review);
  const storedValidation = requireStoredValidation(input.storedValidation);
  const approvedHash = requireSha256(input.approvedDraftBundleSha256, "Approved draft bundle hash");
  const reviewReference = requireCompletedReviewReference(input.reviewReference);
  const approvalRecordedAt = requireTimestamp(input.approvalRecordedAt, "Approval time");
  const freshDraftReport = createCatalogMigrationValidationReport(draft);

  if (!freshDraftReport.ok) throw new Error(`Reviewed draft is invalid: ${freshDraftReport.errors.join(" ")}`);
  if (!storedValidation.ok || storedValidation.errors.length) throw new Error("Stored validation report is not clean.");
  if (storedValidation.bundleSha256 !== freshDraftReport.bundleSha256) throw new Error("Stored validation hash does not match the reviewed draft.");
  if (approvedHash !== freshDraftReport.bundleSha256) throw new Error("Approval hash does not match the reviewed draft.");
  if (review.status !== "awaiting_user_approval") throw new Error("Scholarship review is not awaiting user approval.");
  if (review.sensitiveDataCheck?.result !== "pass") throw new Error("Scholarship review has not passed the sensitive-data check.");
  if (review.schoolCount !== 20 || review.scholarshipCount !== 20 || review.records.length !== 20) {
    throw new Error("Scholarship publication requires the reviewed batch of exactly 20 schools and 20 scholarships.");
  }
  if (draft.version !== 2 || !draft.handoff) throw new Error("Scholarship publication requires a version 2 reviewed draft.");

  const scholarshipSlugs = review.records.map(record => record.scholarshipSlug);
  const schoolSlugsFromReview = new Set(review.records.map(record => record.schoolSlug));
  if (new Set(scholarshipSlugs).size !== 20 || schoolSlugsFromReview.size !== 20) {
    throw new Error("Scholarship review must contain 20 distinct schools and scholarship records.");
  }
  if (review.records.some(record => record.status !== "draft")) throw new Error("Every reviewed scholarship must still be draft before publication.");

  const scholarshipsBySlug = new Map((draft.scholarships ?? []).map(record => [record.slug, record]));
  const selectedScholarships = scholarshipSlugs.map(slug => {
    const scholarship = scholarshipsBySlug.get(slug);
    if (!scholarship) throw new Error(`Reviewed scholarship is missing from the draft: ${slug}`);
    if (scholarship.status !== "draft") throw new Error(`Reviewed scholarship is no longer draft: ${slug}`);
    if (!scholarship.schoolSlug || !schoolSlugsFromReview.has(scholarship.schoolSlug)) {
      throw new Error(`Reviewed scholarship school does not match the review: ${slug}`);
    }
    return {
      ...scholarship,
      status: "active" as const,
      verificationStatus: "verified" as const,
      lastVerifiedAt: approvalRecordedAt,
    };
  });

  const referencedProgramSlugs = new Set(selectedScholarships.flatMap(record => record.programSlug ? [record.programSlug] : []));
  const selectedPrograms = (draft.programs ?? []).filter(record => referencedProgramSlugs.has(record.slug));
  if (selectedPrograms.length !== referencedProgramSlugs.size) throw new Error("A reviewed scholarship references a missing program.");

  const referencedSchoolSlugs = new Set([
    ...selectedScholarships.flatMap(record => record.schoolSlug ? [record.schoolSlug] : []),
    ...selectedPrograms.map(record => record.schoolSlug),
  ]);
  const selectedSchools = (draft.schools ?? []).filter(record => referencedSchoolSlugs.has(record.slug));
  if (selectedSchools.length !== referencedSchoolSlugs.size) throw new Error("A reviewed scholarship references a missing school.");

  const referencedCitySlugs = new Set([
    ...selectedSchools.flatMap(record => record.citySlug ? [record.citySlug] : []),
    ...selectedPrograms.flatMap(record => record.citySlug ? [record.citySlug] : []),
  ]);
  const selectedCities = (draft.cities ?? []).filter(record => referencedCitySlugs.has(record.slug));
  if (selectedCities.length !== referencedCitySlugs.size) throw new Error("A reviewed scholarship dependency references a missing city.");

  const bundle: CatalogSeedBundle = {
    version: 2,
    generatedAt: approvalRecordedAt,
    handoff: {
      ...draft.handoff,
      reviewReference,
      prohibitedDataReviewReference: reviewReference,
      approvalRecordedAt,
      sourceReadOnly: true,
      prohibitedDataConfirmedExcluded: true,
    },
    cities: selectedCities,
    schools: selectedSchools,
    programs: selectedPrograms,
    programIntakes: [],
    scholarships: selectedScholarships,
  };
  const report = createCatalogMigrationValidationReport(bundle);
  if (!report.ok) throw new Error(`Publication delta is invalid: ${report.errors.join(" ")}`);
  if (report.summary.scholarships !== 20) throw new Error("Publication delta does not contain exactly 20 scholarships.");

  return { bundle, report, approvedDraftBundleSha256: approvedHash, scholarshipSlugs };
}

function requireBundle(value: unknown): CatalogSeedBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Reviewed draft must be an object.");
  return value as CatalogSeedBundle;
}

function requireReview(value: unknown): ScholarshipReview {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Scholarship review must be an object.");
  const review = value as Partial<ScholarshipReview>;
  if (!Array.isArray(review.records)) throw new Error("Scholarship review records are required.");
  for (const record of review.records) {
    if (!record || typeof record !== "object" || typeof record.schoolSlug !== "string"
      || typeof record.scholarshipSlug !== "string" || typeof record.status !== "string") {
      throw new Error("Scholarship review contains an invalid record.");
    }
  }
  return review as ScholarshipReview;
}

function requireStoredValidation(value: unknown): StoredValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stored validation report must be an object.");
  const report = value as Partial<StoredValidation>;
  if (typeof report.ok !== "boolean" || !Array.isArray(report.errors) || typeof report.bundleSha256 !== "string") {
    throw new Error("Stored validation report is invalid.");
  }
  return report as StoredValidation;
}

function requireSha256(value: string, label: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}

function requireCompletedReviewReference(value: string) {
  const normalized = value?.trim();
  if (!normalized || /pending|unreviewed|todo/i.test(normalized)) throw new Error("A completed review reference is required.");
  if (normalized.length > 200) throw new Error("Review reference is too long.");
  return normalized;
}

function requireTimestamp(value: string, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO UTC timestamp.`);
  return value;
}
