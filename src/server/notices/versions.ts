import { serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputUuid } from "../shared/input.ts";
import { MAX_NOTICE_VERSION, noticeDigest, noticeTimestamp, parseNoticeDocument, parseNoticeReview,
  type NoticeDocument, type NoticeReviewEvidence, type NoticeScope } from "./document.ts";

export const noticeVersionColumns = `v.id as "versionId", v.scope_key as "scopeKey", v.version,
  v.content_json as content, v.content_sha256 as "contentSha256", v.prepared_by_user_id as "preparedByUserId",
  v.review_status as "reviewStatus", v.approved_by_user_id as "approvedByUserId", v.reviewed_at as "reviewedAt",
  v.effective_from as "effectiveFrom", v.review_due_at as "reviewDueAt", v.review_evidence_json as "reviewEvidence", v.created_at as "createdAt"`;

export type NoticeVersionRow = {
  versionId: string; scopeKey: string; version: number; content: unknown; contentSha256: string;
  preparedByUserId: string; reviewStatus: string; approvedByUserId: string | null;
  reviewedAt: Date | null; effectiveFrom: Date | null; reviewDueAt: Date | null; reviewEvidence: unknown; createdAt: Date;
};
export type ManagedNoticeVersionDto = {
  versionId: string; scopeKey: string; version: number; contentSha256: string; preparedByUserId: string;
  status: "draft" | "approved"; createdAt: string; document: NoticeDocument; review: NoticeReviewEvidence | null; approvalSha256: string | null;
};

export function managedNoticeVersion(row: NoticeVersionRow, scope: NoticeScope): ManagedNoticeVersionDto {
  try {
    const document = parseNoticeDocument(row.content, scope);
    inputUuid(row.versionId); inputUuid(row.preparedByUserId); inputInteger(row.version, "Notice version", 1, MAX_NOTICE_VERSION);
    const createdAt = noticeTimestamp(row.createdAt.toISOString());
    if (row.scopeKey !== scope.scopeKey || noticeDigest(document) !== row.contentSha256) throw new Error("Notice content differs from its version.");
    let review: NoticeReviewEvidence | null = null;
    if (row.reviewStatus === "approved") {
      if (!row.approvedByUserId || !row.reviewedAt || !row.effectiveFrom || !row.reviewDueAt || row.createdAt > row.reviewedAt) throw new Error("Notice approval is incomplete.");
      review = parseNoticeReview(row.reviewEvidence, { versionId: row.versionId, scopeKey: scope.scopeKey,
        documentSha256: row.contentSha256, preparedByUserId: row.preparedByUserId, reviewedByUserId: row.approvedByUserId,
        reviewedAt: row.reviewedAt.toISOString(), effectiveFrom: row.effectiveFrom.toISOString(), reviewDueAt: row.reviewDueAt.toISOString() });
    } else if (row.reviewStatus !== "draft" || row.approvedByUserId !== null || row.reviewedAt !== null
      || row.effectiveFrom !== null || row.reviewDueAt !== null || row.reviewEvidence !== null) throw new Error("Notice draft has invalid approval fields.");
    return { versionId: row.versionId, scopeKey: row.scopeKey, version: row.version, contentSha256: row.contentSha256,
      preparedByUserId: row.preparedByUserId, status: row.reviewStatus, createdAt, document, review, approvalSha256: review ? noticeDigest(review) : null };
  } catch { throw serviceUnavailable("Notice version requires reconciliation."); }
}
