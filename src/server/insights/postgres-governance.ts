import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { INSIGHT_WITHDRAWAL_REASONS, insightDigest, insightSha256, parseInsightDocument } from "./insight-document.ts";
import { listInsights as listBaselineInsights } from "../../content/insights.ts";

const MAX_VERSION = 2_147_483_647;
const conflict = () => new CuacError("CONFLICT", "Insight state changed or cannot accept this operation. Read the current state before retrying.", 409);
type Scope = { context: RequestContext; decisionId: string; postId?: string };
type VersionRow = { versionId: string; postId: string; version: number; content: unknown; contentSha256: string; preparedByUserId: string; publishedByUserId: string | null; publishedAt: Date | null; createdAt: Date };

function authorize(context: RequestContext, action: PolicyAction, postId?: unknown): Scope {
  const decision = evaluatePolicy(context, action, { type: "catalog", dataClasses: ["internal_catalog_metadata"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { decisionId: decision.id, postId: postId === undefined ? undefined : inputUuid(postId, "Insight post id"),
    context: { ...context, actorUserId: inputUuid(context.actorUserId, "Actor id"), dataClassAllowlist: [...context.dataClassAllowlist] } };
}

export class PostgresInsightGovernance {
  constructor(private readonly client: TransactionalSqlClient) {}

  private async liveAuthority(tx: TransactionalSqlClient, scope: Scope) {
    const users = await tx.query("select id from users where id = $1 and account_status = 'active' for share", [scope.context.actorUserId]);
    const roles = await tx.query("select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for share", [scope.context.actorUserId, scope.context.activeRole]);
    if (!users.length || !roles.length) throw forbidden("Active internal insight-management authority is required.");
    if (scope.postId) {
      const posts = await tx.query("select id from insight_posts where id = $1 for no key update", [scope.postId]);
      if (!posts.length) throw forbidden("Insight scope is not available.");
    }
  }

  private async audit(tx: TransactionalSqlClient, scope: Scope, action: string, resourceId: string, metadata: Record<string, unknown>) {
    await new PostgresAuditWriter(tx).record(buildAuditEvent(scope.context, { action: `catalog.insights.${action}`,
      resourceType: "insight_version", resourceId, allowed: true, policyDecisionId: scope.decisionId,
      dataClasses: ["internal_catalog_metadata"], metadata: { postId: scope.postId, ...metadata } }));
  }

  async listPosts(context: RequestContext) {
    const scope = authorize(context, "catalog.read_insights_review");
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      const rows = await tx.query(`select p.id::text as id, p.slug, p.status, p.publication_revision as "publicationRevision",
        p.current_version_id::text as "currentVersionId", p.created_at as "createdAt", p.updated_at as "updatedAt",
        v.version, v.content_json as content, v.content_sha256 as "contentSha256", v.published_at as "publishedAt"
        from insight_posts p left join insight_versions v on v.id = p.current_version_id and v.post_id = p.id
        order by p.updated_at desc, p.id asc`, []);
      const baseline = new Map(listBaselineInsights().map(post => [post.slug, post]));
      return rows.map(row => ({ ...row, content: row.content ?? baseline.get(String(row.slug)) ?? null }));
    });
  }

  async listVersions(context: RequestContext, postId: unknown) {
    const scope = authorize(context, "catalog.read_insights_review", postId);
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      return tx.query(`select id::text as "versionId", version, content_sha256 as "contentSha256",
        prepared_by_user_id::text as "preparedByUserId", published_by_user_id::text as "publishedByUserId",
        published_at as "publishedAt", created_at as "createdAt" from insight_versions
        where post_id = $1 order by version desc limit 50`, [scope.postId]);
    });
  }

  async createPost(context: RequestContext, input: unknown) {
    const scope = authorize(context, "catalog.prepare_insights"), fields = inputRecord(input, ["postId", "versionId", "document"]);
    const postId = inputUuid(fields.postId, "Insight post id"), versionId = inputUuid(fields.versionId, "Insight version id"), document = parseInsightDocument(fields.document), digest = insightDigest(document);
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      const inserted = await tx.query(`insert into insight_posts (id, slug, status, publication_revision, created_at, updated_at)
        values ($1, $2, 'draft', 0, now(), now()) on conflict (id) do nothing returning id`, [postId, document.slug]);
      if (inserted.length !== 1) throw conflict();
      scope.postId = postId;
      const version = await tx.query(`insert into insight_versions (id, post_id, version, content_json, content_sha256, prepared_by_user_id)
        values ($1, $2, 1, $3::jsonb, $4, $5) returning id::text as "versionId", version, content_sha256 as "contentSha256", created_at as "createdAt"`,
      [versionId, postId, JSON.stringify(document), digest, scope.context.actorUserId]);
      await this.audit(tx, scope, "prepare", versionId, { version: 1, contentSha256: digest, created: true });
      return version[0];
    });
  }

  async createDraft(context: RequestContext, postId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.prepare_insights", postId), fields = inputRecord(input, ["versionId", "document"]);
    const versionId = inputUuid(fields.versionId, "Insight version id"), document = parseInsightDocument(fields.document), digest = insightDigest(document);
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      const post = (await tx.query<{ slug: string }>("select slug from insight_posts where id = $1 for no key update", [scope.postId]))[0];
      if (!post || post.slug !== document.slug) throw conflict();
      const latest = (await tx.query<{ version: number }>("select coalesce(max(version), 0)::int as version from insight_versions where post_id = $1", [scope.postId]))[0].version;
      if (latest >= MAX_VERSION) throw conflict();
      const inserted = await tx.query(`insert into insight_versions (id, post_id, version, content_json, content_sha256, prepared_by_user_id)
        values ($1, $2, $3, $4::jsonb, $5, $6) on conflict (id) do nothing returning id::text as "versionId", version, content_sha256 as "contentSha256", created_at as "createdAt"`,
      [versionId, scope.postId, latest + 1, JSON.stringify(document), digest, scope.context.actorUserId]);
      if (inserted.length !== 1) throw conflict();
      await tx.query("update insight_posts set updated_at = now() where id = $1", [scope.postId]);
      await this.audit(tx, scope, "prepare", versionId, { version: latest + 1, contentSha256: digest });
      return inserted[0];
    });
  }

  async getVersion(context: RequestContext, postId: unknown, versionId: unknown) {
    const scope = authorize(context, "catalog.read_insights_review", postId), id = inputUuid(versionId, "Insight version id");
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      const rows = await tx.query<VersionRow>(`select id::text as "versionId", post_id::text as "postId", version, content_json as content,
        content_sha256 as "contentSha256", prepared_by_user_id::text as "preparedByUserId", published_by_user_id::text as "publishedByUserId",
        published_at as "publishedAt", created_at as "createdAt" from insight_versions where post_id = $1 and id = $2`, [scope.postId, id]);
      if (!rows[0] || insightDigest(parseInsightDocument({ schemaVersion: 1, ...(rows[0].content as Record<string, unknown>) })) !== rows[0].contentSha256) throw serviceUnavailable("Insight version requires reconciliation.");
      return rows[0];
    });
  }

  async publish(context: RequestContext, postId: unknown, versionId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.publish_insights", postId), id = inputUuid(versionId, "Insight version id");
    const fields = inputRecord(input, ["expectedContentSha256", "expectedPublicationRevision"]), digest = insightSha256(fields.expectedContentSha256);
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 0, MAX_VERSION);
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      const rows = await tx.query<VersionRow>(`select id::text as "versionId", post_id::text as "postId", version, content_json as content,
        content_sha256 as "contentSha256", prepared_by_user_id::text as "preparedByUserId", published_by_user_id::text as "publishedByUserId",
        published_at as "publishedAt", created_at as "createdAt" from insight_versions where post_id = $1 and id = $2 for update`, [scope.postId, id]);
      const row = rows[0], post = (await tx.query<{ publicationRevision: number }>(`select publication_revision as "publicationRevision" from insight_posts where id = $1 for update`, [scope.postId]))[0];
      if (!row || !post || row.contentSha256 !== digest || post.publicationRevision !== revision || revision >= MAX_VERSION) throw conflict();
      const now = (await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []))[0].now;
      await tx.query("update insight_versions set published_by_user_id = coalesce(published_by_user_id, $3), published_at = coalesce(published_at, $4) where post_id = $1 and id = $2", [scope.postId, id, scope.context.actorUserId, now]);
      const updated = await tx.query(`update insight_posts set slug = $3, status = 'published', current_version_id = $2,
        publication_revision = publication_revision + 1, updated_at = $4 where id = $1 and publication_revision = $5 returning publication_revision as "publicationRevision", updated_at as "updatedAt"`,
      [scope.postId, id, (row.content as { slug: string }).slug, now, revision]);
      if (updated.length !== 1) throw conflict();
      const catalogRevision = await tx.query(`update catalog_publication_revisions set revision = revision + 1, updated_at = $1
        where scope_key = 'public_catalog' and revision < $2 returning revision`, [now, MAX_VERSION]);
      if (catalogRevision.length !== 1) throw serviceUnavailable("Insight search revision could not be advanced.");
      await this.audit(tx, scope, "publish", id, { version: row.version, contentSha256: digest, previousRevision: revision, revision: revision + 1 });
      return { versionId: id, status: "published", publicationRevision: revision + 1, publishedAt: now.toISOString() };
    });
  }

  async withdraw(context: RequestContext, postId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.withdraw_insights", postId), fields = inputRecord(input, ["expectedPublicationRevision", "reason"]);
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 1, MAX_VERSION), reason = inputEnum(fields.reason, "Withdrawal reason", INSIGHT_WITHDRAWAL_REASONS);
    return this.client.transaction(async tx => {
      await this.liveAuthority(tx, scope);
      const updated = await tx.query<{ versionId: string; publicationRevision: number; updatedAt: Date }>(`update insight_posts set status = 'archived', publication_revision = publication_revision + 1, updated_at = now()
        where id = $1 and status = 'published' and publication_revision = $2 returning current_version_id::text as "versionId", publication_revision as "publicationRevision", updated_at as "updatedAt"`, [scope.postId, revision]);
      if (updated.length !== 1) throw conflict();
      const catalogRevision = await tx.query(`update catalog_publication_revisions set revision = revision + 1, updated_at = now()
        where scope_key = 'public_catalog' and revision < $1 returning revision`, [MAX_VERSION]);
      if (catalogRevision.length !== 1) throw serviceUnavailable("Insight search revision could not be advanced.");
      await this.audit(tx, scope, "withdraw", updated[0].versionId, { reason, previousRevision: revision, revision: revision + 1 });
      return { ...updated[0], status: "archived" };
    });
  }
}
