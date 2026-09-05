import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { parseRequirementDocument, requirementDigest, type RequirementDocument } from "./requirements.ts";
import { approvedRequirementReview, bindRequirementSourceChecks, confirmed, MAX_REQUIREMENT_VERSION, parseRequirementReview,
  parseRequirementSourceChecks, REQUIREMENT_WITHDRAWAL_REASONS, requirementReviewDigest, requirementSha256, requirementTimestamp,
  type RequirementApprovalRow, type RequirementReviewEvidence } from "./requirement-review.ts";

type VersionRow = RequirementApprovalRow & { version: number; content: unknown; reviewStatus: "draft" | "approved"; createdAt: Date };
type PublicationRow = { versionId: string; version: number; revision: number; status: "active" | "withdrawn"; updatedAt: Date };
type Scope = { programId: string; programIntakeId: string; context: RequestContext; decisionId: string };
type LockedScope = Scope & { available: boolean; now: Date; deadlineDate: Date | null };
const columns = `v.id as "versionId", v.program_intake_id as "programIntakeId", v.version, v.content_json as content,
  v.content_sha256 as "contentSha256", v.prepared_by_user_id as "preparedByUserId", v.review_status as "reviewStatus",
  v.approved_by_user_id as "approvedByUserId", v.reviewed_at as "reviewedAt", v.effective_from as "effectiveFrom",
  v.review_due_at as "reviewDueAt", v.review_evidence_json as "reviewEvidence", v.created_at as "createdAt"`;
const conflict = () => new CuacError("CONFLICT", "Requirement state changed or cannot accept this operation. Read the current state before retrying.", 409);
const unavailable = () => forbidden("Requirement scope is not available.");

export type ManagedRequirementVersionDto = {
  versionId: string; programIntakeId: string; version: number; contentSha256: string; preparedByUserId: string | null;
  governanceStatus: "legacy" | "draft" | "approved"; createdAt: string; document: RequirementDocument;
  review: RequirementReviewEvidence | null; approvalSha256: string | null;
};

function managedVersion(row: VersionRow): ManagedRequirementVersionDto {
  try {
    const document = parseRequirementDocument(row.content);
    if (requirementDigest(document) !== row.contentSha256) throw new Error("Digest mismatch");
    const legacy = row.preparedByUserId === null;
    const review = !legacy && row.reviewStatus === "approved" ? approvedRequirementReview(row, document) : null;
    return { versionId: row.versionId, programIntakeId: row.programIntakeId, version: row.version, contentSha256: row.contentSha256,
      preparedByUserId: row.preparedByUserId, governanceStatus: legacy ? "legacy" : row.reviewStatus,
      createdAt: row.createdAt.toISOString(), document, review, approvalSha256: review ? requirementReviewDigest(review) : null };
  } catch { throw serviceUnavailable("Requirement version requires reconciliation."); }
}

function authorize(context: RequestContext, action: PolicyAction, programId: unknown, intakeId: unknown): Scope {
  const decision = evaluatePolicy(context, action, { type: "catalog", dataClasses: ["internal_catalog_metadata"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return { programId: inputUuid(programId, "Program id"), programIntakeId: inputUuid(intakeId, "Intake id"), decisionId: decision.id,
    context: { ...context, actorUserId: inputUuid(context.actorUserId, "Actor id"), dataClassAllowlist: [...context.dataClassAllowlist] } };
}

// Internal service only: no HTTP adapter, Agent tool, automatic publisher or importer is registered.
export class PostgresRequirementGovernance {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  private async lock(tx: TransactionalSqlClient, scope: Scope, write: boolean): Promise<LockedScope> {
    const accounts = await tx.query("select id from users where id = $1 and account_status = 'active' for share", [scope.context.actorUserId]);
    if (!accounts.length) throw forbidden("Active internal account is required.");
    const roles = await tx.query("select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for share", [scope.context.actorUserId, scope.context.activeRole]);
    if (!roles.length) throw forbidden("Active internal role is required.");
    const schools = await tx.query<{ id: string; status: string }>("select s.id, s.status from schools s join programs p on p.school_id = s.id where p.id = $1 for share of s", [scope.programId]);
    if (!schools[0]) throw unavailable();
    const programs = await tx.query<{ status: string }>("select status from programs where id = $1 and school_id = $2 for share", [scope.programId, schools[0].id]);
    if (!programs[0]) throw unavailable();
    const intakes = await tx.query<{ status: string; openDate: Date | null; deadlineDate: Date | null }>(
      `select status, open_date as "openDate", deadline_date as "deadlineDate" from program_intakes
       where id = $1 and program_id = $2 for ${write ? "no key update" : "share"}`, [scope.programIntakeId, scope.programId]);
    if (!intakes[0]) throw unavailable();
    // Read the database clock after waits; transaction-start time could now be stale.
    const now = (await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []))[0].now;
    const intake = intakes[0];
    const available = schools[0].status === "active" && programs[0].status === "active" && intake.status === "open"
      && (!intake.deadlineDate || intake.deadlineDate > now) && (!intake.openDate || !intake.deadlineDate || intake.openDate < intake.deadlineDate);
    return { ...scope, available, now, deadlineDate: intake.deadlineDate };
  }

  private async currentTime(tx: TransactionalSqlClient, scope: LockedScope): Promise<Date> {
    const now = (await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []))[0].now;
    if (!scope.available || (scope.deadlineDate && scope.deadlineDate <= now)) throw conflict();
    return now;
  }

  private async version(tx: TransactionalSqlClient, scope: Scope, versionId: string): Promise<VersionRow> {
    const rows = await tx.query<VersionRow>(`select ${columns} from program_requirement_versions v where v.program_intake_id = $1 and v.id = $2 for share`, [scope.programIntakeId, versionId]);
    if (!rows[0]) throw unavailable();
    return rows[0];
  }

  private async publication(tx: TransactionalSqlClient, scope: Scope): Promise<PublicationRow | null> {
    const rows = await tx.query<PublicationRow>(`select pub.version_id as "versionId", v.version, pub.revision, pub.status, pub.updated_at as "updatedAt"
      from program_requirement_publications pub join program_requirement_versions v on v.id = pub.version_id and v.program_intake_id = pub.program_intake_id
      where pub.program_intake_id = $1 for share of pub`, [scope.programIntakeId]);
    return rows[0] ?? null;
  }

  private async audit(tx: TransactionalSqlClient, scope: Scope, action: string, versionId: string, metadata: Record<string, unknown>) {
    await new PostgresAuditWriter(tx).record(buildAuditEvent(scope.context, { action: `catalog.requirements.${action}`,
      resourceType: "program_requirement_version", resourceId: versionId, allowed: true, policyDecisionId: scope.decisionId,
      dataClasses: ["internal_catalog_metadata"], metadata: { programId: scope.programId, programIntakeId: scope.programIntakeId, ...metadata } }));
  }

  async getVersion(context: RequestContext, programId: unknown, intakeId: unknown, versionId: unknown): Promise<ManagedRequirementVersionDto> {
    const scope = authorize(context, "catalog.read_requirements_review", programId, intakeId), id = inputUuid(versionId, "Version id");
    return this.client.transaction(async tx => { await this.lock(tx, scope, false); return managedVersion(await this.version(tx, scope, id)); });
  }

  async listVersions(context: RequestContext, programId: unknown, intakeId: unknown, input: unknown = {}) {
    const scope = authorize(context, "catalog.read_requirements_review", programId, intakeId), fields = inputRecord(input, ["beforeVersion", "limit"]);
    const before = fields.beforeVersion === undefined ? null : inputInteger(fields.beforeVersion, "Before version", 1, MAX_REQUIREMENT_VERSION);
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Limit", 1, 50);
    return this.client.transaction(async tx => {
      await this.lock(tx, scope, false);
      const rows = await tx.query<{ versionId: string; version: number; contentSha256: string; preparedByUserId: string | null; reviewStatus: string; createdAt: Date }>(
        `select id as "versionId", version, content_sha256 as "contentSha256", prepared_by_user_id as "preparedByUserId", review_status as "reviewStatus", created_at as "createdAt"
         from program_requirement_versions where program_intake_id = $1 and ($2::int is null or version < $2) order by version desc limit $3`, [scope.programIntakeId, before, limit + 1]);
      const items = rows.slice(0, limit).map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
      const publication = await this.publication(tx, scope);
      return { items, nextBeforeVersion: rows.length > limit ? items.at(-1)!.version : null,
        publication: publication ? { ...publication, updatedAt: publication.updatedAt.toISOString() } : null };
    });
  }

  async createDraft(context: RequestContext, programId: unknown, intakeId: unknown, input: unknown): Promise<ManagedRequirementVersionDto> {
    const scope = authorize(context, "catalog.prepare_requirements", programId, intakeId), fields = inputRecord(input, ["versionId", "document"]);
    const id = inputUuid(fields.versionId, "Version id"), document = parseRequirementDocument(fields.document), digest = requirementDigest(document);
    return this.client.transaction(async tx => {
      const locked = await this.lock(tx, scope, true);
      const existing = await tx.query<VersionRow>(`select ${columns} from program_requirement_versions v where v.id = $1 for share`, [id]);
      if (existing[0]) {
        if (existing[0].programIntakeId !== scope.programIntakeId || existing[0].preparedByUserId !== scope.context.actorUserId || existing[0].contentSha256 !== digest) throw conflict();
        return managedVersion(existing[0]);
      }
      const now = await this.currentTime(tx, locked);
      if (document.sources.some(source => new Date(source.capturedAt) > now)) throw conflict();
      const latest = (await tx.query<{ version: number }>("select coalesce(max(version), 0)::int as version from program_requirement_versions where program_intake_id = $1", [scope.programIntakeId]))[0].version;
      if (latest >= MAX_REQUIREMENT_VERSION) throw conflict();
      // The caller-generated UUID is a stable creation identity, not permission or a publication pointer.
      const inserted = await tx.query(`insert into program_requirement_versions (id, program_intake_id, version, content_json, content_sha256, prepared_by_user_id, created_at)
        values ($1, $2, $3, $4::jsonb, $5, $6, $7) on conflict (id) do nothing returning id`, [id, scope.programIntakeId, latest + 1, JSON.stringify(document), digest, scope.context.actorUserId, now]);
      if (!inserted.length) throw conflict();
      await this.audit(tx, scope, "prepare", id, { version: latest + 1, contentSha256: digest });
      return managedVersion(await this.version(tx, scope, id));
    });
  }

  async approve(context: RequestContext, programId: unknown, intakeId: unknown, input: unknown): Promise<ManagedRequirementVersionDto> {
    const scope = authorize(context, "catalog.approve_requirements", programId, intakeId);
    const fields = inputRecord(input, ["versionId", "expectedContentSha256", "effectiveFrom", "reviewDueAt", "sourceChecks", "scopeConfirmed", "publicContentConfirmed"]);
    const id = inputUuid(fields.versionId, "Version id"), digest = requirementSha256(fields.expectedContentSha256);
    const effective = fields.effectiveFrom === null ? null : requirementTimestamp(fields.effectiveFrom), due = requirementTimestamp(fields.reviewDueAt);
    const checks = parseRequirementSourceChecks(fields.sourceChecks);
    confirmed(fields.scopeConfirmed); confirmed(fields.publicContentConfirmed);
    return this.client.transaction(async tx => {
      const locked = await this.lock(tx, scope, true), row = await this.version(tx, scope, id), current = managedVersion(row);
      if (!locked.available || current.governanceStatus !== "draft" || row.preparedByUserId === scope.context.actorUserId || digest !== row.contentSha256) throw conflict();
      const reviewedAt = (await this.currentTime(tx, locked)).toISOString(), effectiveFrom = effective ?? reviewedAt;
      if (reviewedAt > effectiveFrom || effectiveFrom >= due) throw conflict();
      const binding = { versionId: id, programIntakeId: scope.programIntakeId, documentSha256: digest, preparedByUserId: row.preparedByUserId!,
        reviewedByUserId: scope.context.actorUserId!, reviewedAt, effectiveFrom, reviewDueAt: due };
      const evidence = parseRequirementReview({ schemaVersion: 1, ...binding, scopeConfirmed: true, publicContentConfirmed: true,
        sourceChecks: bindRequirementSourceChecks(checks, current.document) }, binding, current.document);
      const updated = await tx.query(`update program_requirement_versions set review_status = 'approved', approved_by_user_id = $3,
        reviewed_at = $4, effective_from = $5, review_due_at = $6, review_evidence_json = $7::jsonb
        where id = $1 and program_intake_id = $2 and review_status = 'draft' and content_sha256 = $8 returning id`,
        [id, scope.programIntakeId, scope.context.actorUserId, reviewedAt, effectiveFrom, due, JSON.stringify(evidence), digest]);
      if (updated.length !== 1) throw conflict();
      await this.audit(tx, scope, "approve", id, { version: row.version, contentSha256: digest, approvalSha256: requirementReviewDigest(evidence) });
      return managedVersion(await this.version(tx, scope, id));
    });
  }

  async publish(context: RequestContext, programId: unknown, intakeId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.publish_requirements", programId, intakeId);
    const fields = inputRecord(input, ["versionId", "expectedContentSha256", "expectedApprovalSha256", "expectedPublicationRevision"]);
    const id = inputUuid(fields.versionId, "Version id"), digest = requirementSha256(fields.expectedContentSha256), approval = requirementSha256(fields.expectedApprovalSha256);
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 0, MAX_REQUIREMENT_VERSION);
    return this.client.transaction(async tx => {
      const locked = await this.lock(tx, scope, true), row = await this.version(tx, scope, id), version = managedVersion(row);
      const current = await this.publication(tx, scope);
      const now = await this.currentTime(tx, locked);
      if (!locked.available || version.governanceStatus !== "approved" || version.contentSha256 !== digest || version.approvalSha256 !== approval
        || !row.effectiveFrom || row.effectiveFrom > now || !row.reviewDueAt || row.reviewDueAt <= now || (current?.revision ?? 0) !== revision) throw conflict();
      if (current?.status === "active" && current.versionId === id) return { ...current, updatedAt: current.updatedAt.toISOString() };
      if (revision === MAX_REQUIREMENT_VERSION || (current && version.version <= current.version)) throw conflict();
      await tx.query(`insert into program_requirement_publications (program_intake_id, version_id, revision, status, created_at, updated_at)
        values ($1, $2, 1, 'active', $4, $4) on conflict (program_intake_id) do update set version_id = excluded.version_id,
          revision = program_requirement_publications.revision + 1, status = 'active', updated_at = $4
        where program_requirement_publications.revision = $3`, [scope.programIntakeId, id, revision, now]);
      const result = await this.publication(tx, scope);
      if (!result || result.revision !== revision + 1 || result.versionId !== id || result.status !== "active") throw serviceUnavailable("Publication update could not be verified.");
      await this.audit(tx, scope, "publish", id, { version: row.version, contentSha256: digest, approvalSha256: approval, previousRevision: revision, revision: result.revision });
      return { ...result, updatedAt: result.updatedAt.toISOString() };
    });
  }

  async withdraw(context: RequestContext, programId: unknown, intakeId: unknown, input: unknown) {
    const scope = authorize(context, "catalog.withdraw_requirements", programId, intakeId);
    const fields = inputRecord(input, ["expectedVersionId", "expectedPublicationRevision", "reason"]), id = inputUuid(fields.expectedVersionId, "Version id");
    const revision = inputInteger(fields.expectedPublicationRevision, "Publication revision", 1, MAX_REQUIREMENT_VERSION);
    const reason = inputEnum(fields.reason, "Withdrawal reason", REQUIREMENT_WITHDRAWAL_REASONS);
    return this.client.transaction(async tx => {
      const locked = await this.lock(tx, scope, true), current = await this.publication(tx, scope);
      if (!current || current.revision !== revision || current.versionId !== id) throw conflict();
      if (current.status === "withdrawn") return { ...current, updatedAt: current.updatedAt.toISOString() };
      if (revision === MAX_REQUIREMENT_VERSION) throw conflict();
      const updated = await tx.query("update program_requirement_publications set status = 'withdrawn', revision = revision + 1, updated_at = $3 where program_intake_id = $1 and revision = $2 returning revision", [scope.programIntakeId, revision, locked.now]);
      if (updated.length !== 1) throw conflict();
      await this.audit(tx, scope, "withdraw", id, { reason, previousRevision: revision, revision: revision + 1 });
      return { ...current, status: "withdrawn" as const, revision: revision + 1, updatedAt: locked.now.toISOString() };
    });
  }
}
