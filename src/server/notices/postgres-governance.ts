import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { MAX_NOTICE_VERSION, NOTICE_WITHDRAWAL_REASONS, noticeConfirmation, noticeDigest, noticeReviewReference, noticeScope,
  noticeSha256, noticeTimestamp, parseNoticeDocument, parseNoticeReview, type NoticeScope } from "./document.ts";
import { managedNoticeVersion, noticeVersionColumns, type NoticeVersionRow } from "./versions.ts";

type Scope = NoticeScope & { context: RequestContext; decisionId: string };
type PublicationRow = { versionId: string; version: number; contentSha256: string; approvalSha256: string; revision: number; status: "active" | "withdrawn"; updatedAt: Date };
const conflict = () => new CuacError("CONFLICT", "Notice state changed or cannot accept this operation. Read the current state before retrying.", 409);
const unavailable = () => forbidden("Notice scope is not available.");

function authorize(context: RequestContext, action: PolicyAction, noticeKey: unknown, locale: unknown): Scope {
  const decision = evaluatePolicy(context, action, { type: "notice", dataClasses: ["ops_confidential"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { ...noticeScope(noticeKey, locale), decisionId: decision.id,
    context: { ...context, actorUserId: inputUuid(context.actorUserId), dataClassAllowlist: [...context.dataClassAllowlist] } };
}

// Internal only. Real employee/MFA admission is required before any future management transport.
export class PostgresNoticeGovernance {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  private async lock(tx: TransactionalSqlClient, scope: Scope, write: boolean, create = false): Promise<boolean> {
    const users = await tx.query("select id from users where id = $1 and account_status = 'active' for share", [scope.context.actorUserId]);
    if (!users.length) throw forbidden("Active internal account is required.");
    const roles = await tx.query("select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for share", [scope.context.actorUserId, scope.context.activeRole]);
    if (!roles.length) throw forbidden("Active internal role is required.");
    // Both unique indexes identify the same checked scope; arbitrate either during first creation.
    if (create) await tx.query(`insert into privacy_notice_scopes (scope_key, notice_key, locale) values ($1, $2, $3)
      on conflict do nothing`, [scope.scopeKey, scope.noticeKey, scope.locale]);
    const scopes = await tx.query(`select scope_key from privacy_notice_scopes where scope_key = $1 and notice_key = $2 and locale = $3
      for ${write ? "no key update" : "share"}`, [scope.scopeKey, scope.noticeKey, scope.locale]);
    return scopes.length === 1;
  }

  private async now(tx: TransactionalSqlClient): Promise<Date> {
    return (await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []))[0].now;
  }

  private async version(tx: TransactionalSqlClient, scope: Scope, id: string): Promise<NoticeVersionRow> {
    const rows = await tx.query<NoticeVersionRow>(`select ${noticeVersionColumns} from privacy_notice_versions v where v.scope_key = $1 and v.id = $2 for share`, [scope.scopeKey, id]);
    if (!rows[0]) throw unavailable();
    return rows[0];
  }

  private async publication(tx: TransactionalSqlClient, scope: Scope): Promise<PublicationRow | null> {
    const rows = await tx.query<PublicationRow>(`select pub.version_id as "versionId", v.version, pub.content_sha256 as "contentSha256",
      pub.approval_sha256 as "approvalSha256", pub.revision, pub.status, pub.updated_at as "updatedAt"
      from privacy_notice_publications pub join privacy_notice_versions v on v.id = pub.version_id and v.scope_key = pub.scope_key
      where pub.scope_key = $1 for share of pub`, [scope.scopeKey]);
    const row = rows[0];
    if (!row) return null;
    try {
      inputUuid(row.versionId); inputInteger(row.version, "Notice version", 1, MAX_NOTICE_VERSION);
      noticeSha256(row.contentSha256); noticeSha256(row.approvalSha256);
      inputInteger(row.revision, "Publication revision", 1, MAX_NOTICE_VERSION);
      inputEnum(row.status, "Publication state", ["active", "withdrawn"]);
      noticeTimestamp(row.updatedAt.toISOString());
      return row;
    } catch { throw serviceUnavailable("Notice publication requires reconciliation."); }
  }

  private async audit(tx: TransactionalSqlClient, scope: Scope, action: string, versionId: string, metadata: Record<string, unknown>) {
    await new PostgresAuditWriter(tx).record(buildAuditEvent(scope.context, { action: `notices.${action}`, resourceType: "privacy_notice_version",
      resourceId: versionId, allowed: true, policyDecisionId: scope.decisionId, dataClasses: ["ops_confidential"], metadata: { scopeKey: scope.scopeKey, ...metadata } }));
  }

  async getVersion(context: RequestContext, noticeKey: unknown, locale: unknown, versionId: unknown) {
    const scope = authorize(context, "notice.read_review", noticeKey, locale), id = inputUuid(versionId);
    return this.client.transaction(async tx => {
      if (!await this.lock(tx, scope, false)) throw unavailable();
      return managedNoticeVersion(await this.version(tx, scope, id), scope);
    });
  }

  async listVersions(context: RequestContext, noticeKey: unknown, locale: unknown, input: unknown = {}) {
    const scope = authorize(context, "notice.read_review", noticeKey, locale), fields = inputRecord(input, ["beforeVersion", "limit"]);
    const before = fields.beforeVersion === undefined ? null : inputInteger(fields.beforeVersion, "Before version", 1, MAX_NOTICE_VERSION);
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Limit", 1, 50);
    return this.client.transaction(async tx => {
      if (!await this.lock(tx, scope, false)) return { items: [], nextBeforeVersion: null, publication: null };
      const rows = await tx.query<NoticeVersionRow>(`select ${noticeVersionColumns} from privacy_notice_versions v
        where v.scope_key = $1 and ($2::int is null or v.version < $2) order by v.version desc limit $3`, [scope.scopeKey, before, limit + 1]);
      const versions = rows.map(row => managedNoticeVersion(row, scope));
      const items = versions.slice(0, limit).map(row => ({ versionId: row.versionId, version: row.version, status: row.status,
        contentSha256: row.contentSha256, preparedByUserId: row.preparedByUserId, createdAt: row.createdAt }));
      const publication = await this.publication(tx, scope);
      return { items, nextBeforeVersion: versions.length > limit ? items.at(-1)!.version : null,
        publication: publication ? { ...publication, updatedAt: publication.updatedAt.toISOString() } : null };
    });
  }

  async createDraft(context: RequestContext, noticeKey: unknown, locale: unknown, input: unknown) {
    const scope = authorize(context, "notice.prepare", noticeKey, locale), fields = inputRecord(input, ["versionId", "document"]);
    const id = inputUuid(fields.versionId), document = parseNoticeDocument(fields.document, scope), digest = noticeDigest(document);
    return this.client.transaction(async tx => {
      if (!await this.lock(tx, scope, true, true)) throw unavailable();
      const existing = await tx.query<NoticeVersionRow>(`select ${noticeVersionColumns} from privacy_notice_versions v where v.id = $1 for share`, [id]);
      if (existing[0]) {
        if (existing[0].scopeKey !== scope.scopeKey || existing[0].preparedByUserId !== scope.context.actorUserId || existing[0].contentSha256 !== digest) throw conflict();
        return managedNoticeVersion(existing[0], scope);
      }
      const version = (await tx.query<{ version: number }>("select coalesce(max(version), 0)::int as version from privacy_notice_versions where scope_key = $1", [scope.scopeKey]))[0].version;
      if (version >= MAX_NOTICE_VERSION) throw conflict();
      const now = await this.now(tx);
      const inserted = await tx.query(`insert into privacy_notice_versions (id, scope_key, version, content_json, content_sha256, prepared_by_user_id, created_at)
        values ($1, $2, $3, $4::jsonb, $5, $6, $7) on conflict (id) do nothing returning id`, [id, scope.scopeKey, version + 1, JSON.stringify(document), digest, scope.context.actorUserId, now]);
      if (inserted.length !== 1) throw conflict();
      await this.audit(tx, scope, "prepare", id, { version: version + 1, contentSha256: digest });
      return managedNoticeVersion(await this.version(tx, scope, id), scope);
    });
  }

  async approve(context: RequestContext, noticeKey: unknown, locale: unknown, input: unknown) {
    const scope = authorize(context, "notice.approve", noticeKey, locale);
    const fields = inputRecord(input, ["versionId", "expectedContentSha256", "effectiveFrom", "reviewDueAt", "reviewReference", "scopeConfirmed", "wordingReviewed", "publicContentConfirmed"]);
    const id = inputUuid(fields.versionId), digest = noticeSha256(fields.expectedContentSha256);
    const effective = fields.effectiveFrom === null ? null : noticeTimestamp(fields.effectiveFrom), due = noticeTimestamp(fields.reviewDueAt);
    const reference = noticeReviewReference(fields.reviewReference);
    noticeConfirmation(fields.scopeConfirmed); noticeConfirmation(fields.wordingReviewed); noticeConfirmation(fields.publicContentConfirmed);
    return this.client.transaction(async tx => {
      if (!await this.lock(tx, scope, true)) throw unavailable();
      const row = await this.version(tx, scope, id), current = managedNoticeVersion(row, scope);
      if (current.status !== "draft" || row.preparedByUserId === scope.context.actorUserId || digest !== row.contentSha256) throw conflict();
      const reviewedAt = (await this.now(tx)).toISOString(), effectiveFrom = effective ?? reviewedAt;
      if (reviewedAt > effectiveFrom || effectiveFrom >= due) throw conflict();
      const binding = { versionId: id, scopeKey: scope.scopeKey, documentSha256: digest, preparedByUserId: row.preparedByUserId,
        reviewedByUserId: scope.context.actorUserId!, reviewedAt, effectiveFrom, reviewDueAt: due };
      const review = parseNoticeReview({ schemaVersion: 1, ...binding, reviewReference: reference,
        scopeConfirmed: true, wordingReviewed: true, publicContentConfirmed: true }, binding);
      const updated = await tx.query(`update privacy_notice_versions set review_status = 'approved', approved_by_user_id = $3,
        reviewed_at = $4, effective_from = $5, review_due_at = $6, review_evidence_json = $7::jsonb
        where id = $1 and scope_key = $2 and review_status = 'draft' and content_sha256 = $8 returning id`,
        [id, scope.scopeKey, scope.context.actorUserId, reviewedAt, effectiveFrom, due, JSON.stringify(review), digest]);
      if (updated.length !== 1) throw conflict();
      await this.audit(tx, scope, "approve", id, { version: row.version, contentSha256: digest, approvalSha256: noticeDigest(review) });
      return managedNoticeVersion(await this.version(tx, scope, id), scope);
    });
  }

  async publish(context: RequestContext, noticeKey: unknown, locale: unknown, input: unknown) {
    const scope = authorize(context, "notice.publish", noticeKey, locale);
    const fields = inputRecord(input, ["versionId", "expectedContentSha256", "expectedApprovalSha256", "expectedPublicationRevision"]);
    const id = inputUuid(fields.versionId), digest = noticeSha256(fields.expectedContentSha256), approval = noticeSha256(fields.expectedApprovalSha256);
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 0, MAX_NOTICE_VERSION);
    return this.client.transaction(async tx => {
      if (!await this.lock(tx, scope, true)) throw unavailable();
      const row = await this.version(tx, scope, id), version = managedNoticeVersion(row, scope);
      const current = await this.publication(tx, scope), now = await this.now(tx);
      if (version.status !== "approved" || version.contentSha256 !== digest || version.approvalSha256 !== approval
        || !row.effectiveFrom || row.effectiveFrom > now || !row.reviewDueAt || row.reviewDueAt <= now || (current?.revision ?? 0) !== revision) throw conflict();
      if (current?.status === "active" && current.versionId === id) {
        if (current.contentSha256 !== digest || current.approvalSha256 !== approval) throw serviceUnavailable("Notice publication binding requires reconciliation.");
        return { ...current, updatedAt: current.updatedAt.toISOString() };
      }
      if (revision === MAX_NOTICE_VERSION || (current && version.version <= current.version)) throw conflict();
      await tx.query(`insert into privacy_notice_publications (scope_key, version_id, revision, status, created_at, updated_at, content_sha256, approval_sha256)
        values ($1, $2, 1, 'active', $4, $4, $5, $6) on conflict (scope_key) do update set version_id = excluded.version_id,
          content_sha256 = excluded.content_sha256, approval_sha256 = excluded.approval_sha256,
          revision = privacy_notice_publications.revision + 1, status = 'active', updated_at = $4 where privacy_notice_publications.revision = $3`,
        [scope.scopeKey, id, revision, now, digest, approval]);
      const result = await this.publication(tx, scope);
      if (!result || result.revision !== revision + 1 || result.versionId !== id || result.status !== "active"
        || result.contentSha256 !== digest || result.approvalSha256 !== approval) throw serviceUnavailable("Notice publication update could not be verified.");
      await this.audit(tx, scope, "publish", id, { version: row.version, contentSha256: digest, approvalSha256: approval, previousRevision: revision, revision: result.revision });
      return { ...result, updatedAt: result.updatedAt.toISOString() };
    });
  }

  async withdraw(context: RequestContext, noticeKey: unknown, locale: unknown, input: unknown) {
    const scope = authorize(context, "notice.withdraw", noticeKey, locale);
    const fields = inputRecord(input, ["expectedVersionId", "expectedPublicationRevision", "reason"]), id = inputUuid(fields.expectedVersionId);
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 1, MAX_NOTICE_VERSION);
    const reason = inputEnum(fields.reason, "Withdrawal reason", NOTICE_WITHDRAWAL_REASONS);
    return this.client.transaction(async tx => {
      if (!await this.lock(tx, scope, true)) throw unavailable();
      const current = await this.publication(tx, scope);
      if (!current || current.revision !== revision || current.versionId !== id) throw conflict();
      if (current.status === "withdrawn") return { ...current, updatedAt: current.updatedAt.toISOString() };
      if (revision === MAX_NOTICE_VERSION) throw conflict();
      const now = await this.now(tx);
      const updated = await tx.query("update privacy_notice_publications set status = 'withdrawn', revision = revision + 1, updated_at = $3 where scope_key = $1 and revision = $2 returning revision", [scope.scopeKey, revision, now]);
      if (updated.length !== 1) throw conflict();
      await this.audit(tx, scope, "withdraw", id, { reason, previousRevision: revision, revision: revision + 1 });
      return { ...current, status: "withdrawn" as const, revision: revision + 1, updatedAt: now.toISOString() };
    });
  }
}
