export function policyDocument(admissionRouteKey = "direct_university") {
  return {
    schemaVersion: 1,
    admissionRouteKey,
    formMode: "one_program_per_form",
    maxProgramChoices: 2,
    orderingMode: "none",
    externalChannelType: "university_portal",
    sources: [{
      key: "official_admissions_notice",
      url: "https://admissions.example.edu/policy/2026",
      title: "Synthetic official admissions policy",
      capturedAt: "2026-01-01T00:00:00.000Z",
      contentSha256: "a".repeat(64),
    }],
  };
}

export function syntheticPolicyReview(row, document = policyDocument(row.admissionRouteKey)) {
  return {
    schemaVersion: 1,
    versionId: row.versionId,
    schoolId: row.schoolId,
    policyKey: row.policyKey,
    admissionRouteKey: row.admissionRouteKey,
    documentSha256: row.documentSha256,
    targetSetSha256: row.targetSetSha256,
    preparedByUserId: row.preparedByUserId,
    reviewedByUserId: row.approvedByUserId,
    reviewedAt: row.reviewedAt.toISOString(),
    effectiveFrom: row.effectiveFrom.toISOString(),
    reviewDueAt: row.reviewDueAt.toISOString(),
    scopeConfirmed: true,
    routingConfirmed: true,
    sourceChecks: document.sources.map(source => ({
      sourceKey: source.key,
      contentSha256: source.contentSha256,
      officialSourceConfirmed: true,
    })),
  };
}
