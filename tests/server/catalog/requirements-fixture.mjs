import { requirementDigest } from "../../../src/server/catalog/requirements.ts";

export function requirementDocument() {
  return {
    schemaVersion: 1, language: "en", coverage: "partial",
    sources: [{ key: "official_notice", url: "https://university.example.org/admissions?year=2027", title: "Synthetic admissions notice",
      capturedAt: "2020-01-01T00:00:00.000Z", contentSha256: "a".repeat(64) }],
    requirements: [{ key: "degree", category: "education", stage: "submission", level: "conditional",
      appliesTo: "Applicants completing their current degree", ruleText: "Synthetic rule: a current enrollment statement is required; final evidence is checked separately.",
      evidenceType: "school_review", references: [{ sourceKey: "official_notice", locator: "Section 3" }] }],
  };
}

// Synthetic attestations are never a production source-verification mechanism.
export function syntheticReview(row, document) {
  return { schemaVersion: 1, versionId: row.versionId, programIntakeId: row.programIntakeId, documentSha256: requirementDigest(document),
    preparedByUserId: row.preparedByUserId, reviewedByUserId: row.approvedByUserId,
    reviewedAt: row.reviewedAt.toISOString(), effectiveFrom: row.effectiveFrom.toISOString(), reviewDueAt: row.reviewDueAt.toISOString(),
    scopeConfirmed: true, publicContentConfirmed: true,
    sourceChecks: document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256, officialSourceConfirmed: true })) };
}
