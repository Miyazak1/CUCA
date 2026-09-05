import { randomUUID } from "node:crypto";
import { NOTICE_SECTIONS, noticeDigest, noticeScope, parseNoticeDocument, parseNoticeReview } from "../../../src/server/notices/document.ts";

export function noticeDocument(locale = "en", extra = {}) {
  return { schemaVersion: 1, noticeKey: "application_disclosure", locale, title: "Synthetic disclosure notice; not production wording",
    coveredData: ["applicant_basics", "education_history", "assessment_results", "application_choices"],
    sections: NOTICE_SECTIONS.map(key => ({ key, heading: `Synthetic ${key}`, body: `Synthetic ${key} statement.\nNot a production legal notice.` })), ...extra };
}

export function noticeRow(extra = {}) {
  const document = parseNoticeDocument(noticeDocument(), noticeScope("application_disclosure", "en"));
  const now = Date.now();
  const binding = { versionId: randomUUID(), scopeKey: "application_disclosure:en", documentSha256: noticeDigest(document),
    preparedByUserId: randomUUID(), reviewedByUserId: randomUUID(), reviewedAt: new Date(now - 1000).toISOString(),
    effectiveFrom: new Date(now - 1000).toISOString(), reviewDueAt: new Date(now + 86400000).toISOString() };
  const review = parseNoticeReview({ schemaVersion: 1, ...binding, reviewReference: "synthetic-review/1", scopeConfirmed: true, wordingReviewed: true, publicContentConfirmed: true }, binding);
  return { versionId: binding.versionId, scopeKey: binding.scopeKey, version: 1, content: document, contentSha256: binding.documentSha256,
    preparedByUserId: binding.preparedByUserId, approvedByUserId: binding.reviewedByUserId, reviewStatus: "approved", reviewEvidence: review,
    reviewedAt: new Date(binding.reviewedAt), effectiveFrom: new Date(binding.effectiveFrom), reviewDueAt: new Date(binding.reviewDueAt),
    createdAt: new Date(now - 2000), publicationRevision: 1, publishedContentSha256: binding.documentSha256, publishedApprovalSha256: noticeDigest(review), ...extra };
}
