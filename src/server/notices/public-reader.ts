import type { SqlCatalogClient } from "../catalog/postgres-repository.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { MAX_NOTICE_VERSION, noticeScope, type NoticeDocument, type NoticeKey, type NoticeLocale } from "./document.ts";
import { managedNoticeVersion, noticeVersionColumns, type NoticeVersionRow } from "./versions.ts";

export type PublishedNoticeDto = { noticeKey: NoticeKey; locale: NoticeLocale; versionId: string; version: number;
  contentSha256: string; publicationRevision: number; effectiveFrom: string; reviewDueAt: string; document: NoticeDocument };

export class PostgresNoticeReader {
  private readonly client: SqlCatalogClient;
  constructor(client: SqlCatalogClient) { this.client = client; }

  async getPublished(context: RequestContext, noticeKey: unknown, locale: unknown, snapshotTime?: Date): Promise<PublishedNoticeDto | null> {
    const decision = evaluatePolicy(context, "notice.read_public", { type: "notice", dataClasses: ["public_notice"] });
    if (!decision.allowed) throw forbidden(decision.reason);
    const scope = noticeScope(noticeKey, locale);
    // Internal preparation reads share a database snapshot clock, never a browser-supplied time.
    if (snapshotTime !== undefined && (!(snapshotTime instanceof Date) || !Number.isFinite(snapshotTime.getTime()))) throw serviceUnavailable("Invalid notice snapshot clock.");
    const at = snapshotTime === undefined ? "statement_timestamp()" : "$4::timestamptz";
    // One statement follows only the explicit pointer and never reads student data or prior versions.
    const rows = await this.client.query<NoticeVersionRow & { publicationRevision: number; publishedContentSha256: string; publishedApprovalSha256: string }>(
      `select ${noticeVersionColumns}, pub.revision as "publicationRevision", pub.content_sha256 as "publishedContentSha256", pub.approval_sha256 as "publishedApprovalSha256"
      from privacy_notice_scopes s join privacy_notice_publications pub on pub.scope_key = s.scope_key
      join privacy_notice_versions v on v.scope_key = s.scope_key and v.id = pub.version_id
      where s.scope_key = $1 and s.notice_key = $2 and s.locale = $3 and pub.status = 'active' and v.review_status = 'approved'
        and v.reviewed_at <= ${at} and v.effective_from <= ${at} and v.review_due_at > ${at}`,
      snapshotTime === undefined ? [scope.scopeKey, scope.noticeKey, scope.locale] : [scope.scopeKey, scope.noticeKey, scope.locale, snapshotTime]);
    if (!rows[0]) return null;
    try {
      if (rows.length !== 1) throw new Error("Ambiguous publication.");
      const row = rows[0], version = managedNoticeVersion(row, scope);
      const publicationRevision = inputInteger(row.publicationRevision, "Publication revision", 1, MAX_NOTICE_VERSION);
      if (version.status !== "approved" || !version.review || row.publishedContentSha256 !== version.contentSha256
        || row.publishedApprovalSha256 !== version.approvalSha256) throw new Error("Publication approval binding differs.");
      return { noticeKey: scope.noticeKey, locale: scope.locale, versionId: version.versionId, version: version.version,
        contentSha256: version.contentSha256, publicationRevision, effectiveFrom: version.review.effectiveFrom,
        reviewDueAt: version.review.reviewDueAt, document: version.document };
    } catch { throw serviceUnavailable("Published notice requires reconciliation."); }
  }
}
