import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { canonicalTimestamp, GUIDE_WITHDRAWAL_REASONS, guideConfirmation, guideDigest, guideReviewReference, guideSha256,
  guideVersionColumns, managedGuideVersion, MAX_GUIDE_VERSION, parseGuideDocument, parseGuideReview, type GuideVersionRow } from "./guide-document.ts";

type Scope = { guideId: string; context: RequestContext; decisionId: string };
type PublicationRow = { versionId: string; version: number; contentSha256: string; approvalSha256: string; revision: number; status: "active" | "withdrawn"; updatedAt: Date };
const conflict = () => new CuacError("CONFLICT", "Guide state changed or cannot accept this operation. Read the current state before retrying.", 409);
const unavailable = () => forbidden("Guide scope is not available.");

function authorize(context: RequestContext, action: PolicyAction, guideId: unknown): Scope {
  const decision = evaluatePolicy(context, action, { type: "catalog", dataClasses: ["internal_catalog_metadata"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { guideId: inputUuid(guideId, "Guide id"), decisionId: decision.id,
    context: { ...context, actorUserId: inputUuid(context.actorUserId, "Actor id"), dataClassAllowlist: [...context.dataClassAllowlist] } };
}

function authorizeCollection(context: RequestContext): Omit<Scope, "guideId"> {
  const decision = evaluatePolicy(context, "catalog.read_guides_review", { type: "catalog", dataClasses: ["internal_catalog_metadata"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { decisionId: decision.id, context: { ...context, actorUserId: inputUuid(context.actorUserId, "Actor id"), dataClassAllowlist: [...context.dataClassAllowlist] } };
}

export class PostgresGuideGovernance {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  private async lock(tx: TransactionalSqlClient, scope: Scope, write: boolean) {
    const users = await tx.query("select id from users where id = $1 and account_status = 'active' for share", [scope.context.actorUserId]);
    if (!users.length) throw forbidden("Active internal account is required.");
    const roles = await tx.query("select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for share", [scope.context.actorUserId, scope.context.activeRole]);
    if (!roles.length) throw forbidden("Active internal role is required.");
    const guides = await tx.query(`select id from public_guides where id = $1 for ${write ? "no key update" : "share"}`, [scope.guideId]);
    if (!guides.length) throw unavailable();
  }

  private async now(tx: TransactionalSqlClient) {
    return (await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []))[0].now;
  }

  private async version(tx: TransactionalSqlClient, scope: Scope, versionId: string) {
    const rows = await tx.query<GuideVersionRow>(`select ${guideVersionColumns} from guide_versions v where v.guide_id = $1 and v.id = $2 for share`, [scope.guideId, versionId]);
    if (!rows[0]) throw unavailable();
    return rows[0];
  }

  private async publication(tx: TransactionalSqlClient, scope: Scope): Promise<PublicationRow | null> {
    const rows = await tx.query<PublicationRow>(`select pub.version_id as "versionId", v.version, pub.content_sha256 as "contentSha256",
      pub.approval_sha256 as "approvalSha256", pub.revision, pub.status, pub.updated_at as "updatedAt"
      from guide_publications pub join guide_versions v on v.id = pub.version_id and v.guide_id = pub.guide_id
      where pub.guide_id = $1 for share of pub`, [scope.guideId]);
    return rows[0] ?? null;
  }

  private async audit(tx: TransactionalSqlClient, scope: Scope, action: string, versionId: string, metadata: Record<string, unknown>) {
    await new PostgresAuditWriter(tx).record(buildAuditEvent(scope.context, { action: `catalog.guides.${action}`,
      resourceType: "guide_version", resourceId: versionId, allowed: true, policyDecisionId: scope.decisionId,
      dataClasses: ["internal_catalog_metadata"], metadata: { guideId: scope.guideId, ...metadata } }));
  }

  async listGuides(context: RequestContext) {
    const scope = authorizeCollection(context);
    return this.client.transaction(async tx => {
      const users = await tx.query("select id from users where id = $1 and account_status = 'active' for share", [scope.context.actorUserId]);
      const roles = await tx.query("select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for share", [scope.context.actorUserId, scope.context.activeRole]);
      if (!users.length || !roles.length) throw forbidden("Active internal guide-management authority is required.");
      return tx.query(`select g.id::text as id, g.slug, g.title_en as "titleEn", g.title_zh as "titleZh",
        g.subtitle_en as "subtitleEn", g.subtitle_zh as "subtitleZh", g.summary_en as "summaryEn", g.summary_zh as "summaryZh",
        g.content_json as content, g.href, g.status, g.verification_status as "verificationStatus", g.sort_order as "sortOrder",
        g.version, g.published_at as "publishedAt", g.updated_at as "updatedAt"
        from public_guides g order by g.sort_order asc, g.title_en asc, g.id asc`, []);
    });
  }

  async listVersions(context: RequestContext, guideId: unknown, input: unknown = {}) {
    const scope = authorize(context, "catalog.read_guides_review", guideId), fields = inputRecord(input, ["beforeVersion", "limit"]);
    const before = fields.beforeVersion === undefined ? null : inputInteger(fields.beforeVersion, "Before version", 1, MAX_GUIDE_VERSION);
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Limit", 1, 50);
    return this.client.transaction(async tx => {
      await this.lock(tx, scope, false);
      const rows = await tx.query<GuideVersionRow>(`select ${guideVersionColumns} from guide_versions v
        where v.guide_id = $1 and ($2::int is null or v.version < $2) order by v.version desc limit $3`, [scope.guideId, before, limit + 1]);
      const versions = rows.map(row => managedGuideVersion(row, scope.guideId));
      const items = versions.slice(0, limit).map(row => ({ versionId: row.versionId, version: row.version, status: row.status,
        contentSha256: row.contentSha256, approvalSha256: row.approvalSha256,
        preparedByUserId: row.preparedByUserId, createdAt: row.createdAt }));
      const publication = await this.publication(tx, scope);
      return { items, nextBeforeVersion: versions.length > limit ? items.at(-1)!.version : null,
        publication: publication ? { ...publication, updatedAt: publication.updatedAt.toISOString() } : null };
    });
  }

  async getVersion(context: RequestContext, guideId: unknown, versionId: unknown) {
    const scope = authorize(context, "catalog.read_guides_review", guideId), id = inputUuid(versionId, "Version id");
    return this.client.transaction(async tx => { await this.lock(tx, scope, false); return managedGuideVersion(await this.version(tx, scope, id), scope.guideId); });
  }

  async createDraft(context: RequestContext, guideId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.prepare_guides", guideId), fields = inputRecord(input, ["versionId", "document"]);
    const id = inputUuid(fields.versionId, "Version id"), document = parseGuideDocument(fields.document), digest = guideDigest(document);
    return this.client.transaction(async tx => {
      await this.lock(tx, scope, true);
      const existing = await tx.query<GuideVersionRow>(`select ${guideVersionColumns} from guide_versions v where v.id = $1 for share`, [id]);
      if (existing[0]) {
        if (existing[0].guideId !== scope.guideId || existing[0].preparedByUserId !== scope.context.actorUserId || existing[0].contentSha256 !== digest) throw conflict();
        return managedGuideVersion(existing[0], scope.guideId);
      }
      const latest = (await tx.query<{ version: number }>("select coalesce(max(version), 0)::int as version from guide_versions where guide_id = $1", [scope.guideId]))[0].version;
      if (latest >= MAX_GUIDE_VERSION) throw conflict();
      const now = await this.now(tx);
      if (document.sources.some(source => new Date(source.capturedAt) > now)) throw conflict();
      const inserted = await tx.query(`insert into guide_versions (id, guide_id, version, content_json, content_sha256, prepared_by_user_id, created_at)
        values ($1, $2, $3, $4::jsonb, $5, $6, $7) on conflict (id) do nothing returning id`,
      [id, scope.guideId, latest + 1, JSON.stringify(document), digest, scope.context.actorUserId, now]);
      if (inserted.length !== 1) throw conflict();
      await this.audit(tx, scope, "prepare", id, { version: latest + 1, contentSha256: digest });
      return managedGuideVersion(await this.version(tx, scope, id), scope.guideId);
    });
  }

  async approve(context: RequestContext, guideId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.approve_guides", guideId);
    const fields = inputRecord(input, ["versionId", "expectedContentSha256", "effectiveFrom", "reviewDueAt", "reviewReference", "contentReviewed", "sourcesVerified", "publicContentConfirmed"]);
    const id = inputUuid(fields.versionId), digest = guideSha256(fields.expectedContentSha256);
    const effective = fields.effectiveFrom === null ? null : canonicalTimestamp(fields.effectiveFrom), due = canonicalTimestamp(fields.reviewDueAt);
    const reference = guideReviewReference(fields.reviewReference);
    guideConfirmation(fields.contentReviewed); guideConfirmation(fields.sourcesVerified); guideConfirmation(fields.publicContentConfirmed);
    return this.client.transaction(async tx => {
      await this.lock(tx, scope, true);
      const row = await this.version(tx, scope, id), current = managedGuideVersion(row, scope.guideId);
      if (current.status !== "draft" || row.preparedByUserId === scope.context.actorUserId || digest !== row.contentSha256) throw conflict();
      const reviewedAt = (await this.now(tx)).toISOString(), effectiveFrom = effective ?? reviewedAt;
      if (reviewedAt > effectiveFrom || effectiveFrom >= due) throw conflict();
      const binding = { versionId: id, guideId: scope.guideId, contentSha256: digest, preparedByUserId: row.preparedByUserId,
        reviewedByUserId: scope.context.actorUserId!, reviewedAt, effectiveFrom, reviewDueAt: due };
      const review = parseGuideReview({ schemaVersion: 1, ...binding, reviewReference: reference, contentReviewed: true, sourcesVerified: true, publicContentConfirmed: true }, binding);
      const updated = await tx.query(`update guide_versions set review_status = 'approved', approved_by_user_id = $3,
        reviewed_at = $4, effective_from = $5, review_due_at = $6, review_evidence_json = $7::jsonb
        where id = $1 and guide_id = $2 and review_status = 'draft' and content_sha256 = $8 returning id`,
      [id, scope.guideId, scope.context.actorUserId, reviewedAt, effectiveFrom, due, JSON.stringify(review), digest]);
      if (updated.length !== 1) throw conflict();
      const approvalSha256 = guideDigest(review);
      await this.audit(tx, scope, "approve", id, { version: row.version, contentSha256: digest, approvalSha256 });
      return managedGuideVersion(await this.version(tx, scope, id), scope.guideId);
    });
  }

  async publish(context: RequestContext, guideId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.publish_guides", guideId);
    const fields = inputRecord(input, ["versionId", "expectedContentSha256", "expectedApprovalSha256", "expectedPublicationRevision"]);
    const id = inputUuid(fields.versionId), digest = guideSha256(fields.expectedContentSha256), approval = guideSha256(fields.expectedApprovalSha256);
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 0, MAX_GUIDE_VERSION);
    return this.client.transaction(async tx => {
      await this.lock(tx, scope, true);
      const row = await this.version(tx, scope, id), version = managedGuideVersion(row, scope.guideId);
      const current = await this.publication(tx, scope), now = await this.now(tx);
      if (version.status !== "approved" || version.contentSha256 !== digest || version.approvalSha256 !== approval
        || !row.effectiveFrom || row.effectiveFrom > now || !row.reviewDueAt || row.reviewDueAt <= now || (current?.revision ?? 0) !== revision) throw conflict();
      if (current?.status === "active" && current.versionId === id) return { ...current, updatedAt: current.updatedAt.toISOString() };
      if (revision === MAX_GUIDE_VERSION || (current && version.version <= current.version)) throw conflict();
      const document = version.document;
      const projected = await tx.query(`update public_guides set slug = $2, title_en = $3, title_zh = $4, subtitle_en = $5, subtitle_zh = $6,
        summary_en = $7, summary_zh = $8, content_json = $9::jsonb, href = $10, search_terms = $11::jsonb,
        status = 'published', verification_status = 'verified', sort_order = sort_order, version = $12,
        published_at = coalesce(published_at, $13), updated_at = $13 where id = $1 returning id`,
      [scope.guideId, document.slug, document.titleEn, document.titleZh, document.subtitleEn, document.subtitleZh,
        document.summaryEn, document.summaryZh, JSON.stringify({ sections: document.sections }), document.href,
        JSON.stringify(document.searchTerms), version.version, now]);
      if (projected.length !== 1) throw serviceUnavailable("Guide public projection could not be updated.");
      await tx.query(`insert into guide_publications (guide_id, version_id, content_sha256, approval_sha256, revision, status, created_at, updated_at)
        values ($1, $2, $4, $5, 1, 'active', $6, $6) on conflict (guide_id) do update set version_id = excluded.version_id,
          content_sha256 = excluded.content_sha256, approval_sha256 = excluded.approval_sha256,
          revision = guide_publications.revision + 1, status = 'active', updated_at = $6 where guide_publications.revision = $3`,
      [scope.guideId, id, revision, digest, approval, now]);
      const result = await this.publication(tx, scope);
      if (!result || result.revision !== revision + 1 || result.versionId !== id || result.status !== "active"
        || result.contentSha256 !== digest || result.approvalSha256 !== approval) throw serviceUnavailable("Guide publication update could not be verified.");
      await this.audit(tx, scope, "publish", id, { version: row.version, contentSha256: digest, approvalSha256: approval, previousRevision: revision, revision: result.revision });
      return { ...result, updatedAt: result.updatedAt.toISOString() };
    });
  }

  async withdraw(context: RequestContext, guideId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.withdraw_guides", guideId);
    const fields = inputRecord(input, ["expectedVersionId", "expectedPublicationRevision", "reason"]);
    const id = inputUuid(fields.expectedVersionId), revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 1, MAX_GUIDE_VERSION);
    const reason = inputEnum(fields.reason, "Withdrawal reason", GUIDE_WITHDRAWAL_REASONS);
    return this.client.transaction(async tx => {
      await this.lock(tx, scope, true);
      const current = await this.publication(tx, scope);
      if (!current || current.versionId !== id || current.revision !== revision) throw conflict();
      if (current.status === "withdrawn") return { ...current, updatedAt: current.updatedAt.toISOString() };
      if (revision === MAX_GUIDE_VERSION) throw conflict();
      const now = await this.now(tx);
      const updated = await tx.query("update guide_publications set status = 'withdrawn', revision = revision + 1, updated_at = $3 where guide_id = $1 and revision = $2 returning revision", [scope.guideId, revision, now]);
      if (updated.length !== 1) throw conflict();
      await tx.query("update public_guides set status = 'archived', updated_at = $2 where id = $1 and status = 'published'", [scope.guideId, now]);
      await this.audit(tx, scope, "withdraw", id, { reason, previousRevision: revision, revision: revision + 1 });
      return { ...current, status: "withdrawn" as const, revision: revision + 1, updatedAt: now.toISOString() };
    });
  }
}
