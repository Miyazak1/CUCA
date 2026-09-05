import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import {
  approvedOfficialSubmissionPolicyReview,
  MAX_OFFICIAL_SUBMISSION_POLICY_VERSION,
  OFFICIAL_SUBMISSION_POLICY_WITHDRAWAL_REASONS,
  officialSubmissionPolicyApprovalDigest,
  officialSubmissionPolicyConfirmation,
  officialSubmissionPolicyDocumentDigest,
  officialSubmissionPolicyKey,
  officialSubmissionPolicySha256,
  officialSubmissionPolicyTargetSetDigest,
  officialSubmissionPolicyTimestamp,
  parseOfficialSubmissionPolicyDocument,
  parseOfficialSubmissionPolicyReview,
  parseOfficialSubmissionPolicySourceChecks,
  parseOfficialSubmissionPolicyTargets,
  type OfficialSubmissionPolicyApprovalRow,
  type OfficialSubmissionPolicyDocument,
  type OfficialSubmissionPolicyReviewEvidence,
  type OfficialSubmissionPolicyTarget,
} from "./official-submission-policy.ts";

type Scope = {
  schoolId: string;
  policyKey: string;
  admissionRouteKey: string;
  context: RequestContext;
  decisionId: string;
};
type VersionRow = OfficialSubmissionPolicyApprovalRow & {
  version: number;
  formMode: string;
  maxProgramChoices: number;
  orderingMode: string;
  externalChannelType: string;
  document: unknown;
  reviewStatus: "draft" | "approved";
  createdAt: Date;
};
type TargetRow = OfficialSubmissionPolicyTarget & { schoolId: string; admissionRouteKey: string; createdAt: Date };
type PublicationRow = {
  programIntakeId: string;
  programId: string;
  schoolId: string;
  admissionRouteKey: string;
  versionId: string;
  documentSha256: string;
  targetSetSha256: string;
  approvalSha256: string;
  revision: number;
  status: "active" | "withdrawn";
  updatedAt: Date;
};
type PublicationExpectation = { programIntakeId: string; expectedRevision: number };

export type ManagedOfficialSubmissionPolicyVersionDto = {
  versionId: string;
  schoolId: string;
  policyKey: string;
  admissionRouteKey: string;
  version: number;
  documentSha256: string;
  targetSetSha256: string;
  preparedByUserId: string;
  status: "draft" | "approved";
  createdAt: string;
  document: OfficialSubmissionPolicyDocument;
  targets: OfficialSubmissionPolicyTarget[];
  review: OfficialSubmissionPolicyReviewEvidence | null;
  approvalSha256: string | null;
};

const columns = `v.id as "versionId", v.school_id as "schoolId", v.policy_key as "policyKey",
  v.admission_route_key as "admissionRouteKey", v.version, v.form_mode as "formMode",
  v.max_program_choices as "maxProgramChoices", v.ordering_mode as "orderingMode",
  v.external_channel_type as "externalChannelType", v.document_json as document,
  v.document_sha256 as "documentSha256", v.target_set_sha256 as "targetSetSha256",
  v.prepared_by_user_id as "preparedByUserId", v.review_status as "reviewStatus",
  v.approved_by_user_id as "approvedByUserId", v.reviewed_at as "reviewedAt",
  v.effective_from as "effectiveFrom", v.review_due_at as "reviewDueAt",
  v.review_evidence_json as "reviewEvidence", v.created_at as "createdAt"`;
const conflict = () => new CuacError("CONFLICT", "Submission-policy state changed or cannot accept this operation. Read the current state before retrying.", 409);
const unavailable = () => forbidden("Submission-policy scope is not available.");

function authorize(context: RequestContext, action: PolicyAction, schoolId: unknown, policyKey: unknown, routeKey: unknown): Scope {
  const decision = evaluatePolicy(context, action, { type: "catalog", dataClasses: ["internal_catalog_metadata"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return {
    schoolId: inputUuid(schoolId, "School id"),
    policyKey: officialSubmissionPolicyKey(policyKey),
    admissionRouteKey: officialSubmissionPolicyKey(routeKey, "Admission route key"),
    context: { ...context, actorUserId: inputUuid(context.actorUserId, "Actor id"), dataClassAllowlist: [...context.dataClassAllowlist] },
    decisionId: decision.id,
  };
}

function parsePublicationExpectations(value: unknown, minimumRevision: number): PublicationExpectation[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) throw new CuacError("BAD_REQUEST", "Publication expectations must contain 1 to 200 items.", 400);
  const ids = new Set<string>();
  return value.map(value => {
    const input = inputRecord(value, ["programIntakeId", "expectedRevision"]);
    const result = { programIntakeId: inputUuid(input.programIntakeId, "Program intake id"),
      expectedRevision: inputInteger(input.expectedRevision, "Expected publication revision", minimumRevision, MAX_OFFICIAL_SUBMISSION_POLICY_VERSION) };
    if (ids.has(result.programIntakeId)) throw new CuacError("BAD_REQUEST", "Publication expectations must be unique.", 400);
    ids.add(result.programIntakeId);
    return result;
  }).sort((a, b) => a.programIntakeId.localeCompare(b.programIntakeId));
}

function sameTargetIds(targets: OfficialSubmissionPolicyTarget[], expected: PublicationExpectation[]): boolean {
  return targets.length === expected.length && targets.every((target, index) => target.programIntakeId === expected[index].programIntakeId);
}

function managedVersion(row: VersionRow, targetRows: TargetRow[]): ManagedOfficialSubmissionPolicyVersionDto {
  try {
    const document = parseOfficialSubmissionPolicyDocument(row.document, row.admissionRouteKey);
    const targets = parseOfficialSubmissionPolicyTargets(targetRows.map(row => ({ programId: row.programId, programIntakeId: row.programIntakeId })));
    if (officialSubmissionPolicyDocumentDigest(document) !== row.documentSha256
      || officialSubmissionPolicyTargetSetDigest(row.schoolId, row.admissionRouteKey, targets) !== row.targetSetSha256
      || row.formMode !== document.formMode || row.maxProgramChoices !== document.maxProgramChoices
      || row.orderingMode !== document.orderingMode || row.externalChannelType !== document.externalChannelType
      || targetRows.some(target => target.schoolId !== row.schoolId || target.admissionRouteKey !== row.admissionRouteKey)) {
      throw new Error("Policy content or targets differ from the version binding.");
    }
    let review: OfficialSubmissionPolicyReviewEvidence | null = null;
    if (row.reviewStatus === "approved") review = approvedOfficialSubmissionPolicyReview(row, document);
    else if (row.reviewStatus !== "draft" || row.approvedByUserId !== null || row.reviewedAt !== null || row.effectiveFrom !== null
      || row.reviewDueAt !== null || row.reviewEvidence !== null) throw new Error("Policy draft has invalid approval fields.");
    return {
      versionId: row.versionId,
      schoolId: row.schoolId,
      policyKey: row.policyKey,
      admissionRouteKey: row.admissionRouteKey,
      version: inputInteger(row.version, "Policy version", 1, MAX_OFFICIAL_SUBMISSION_POLICY_VERSION),
      documentSha256: officialSubmissionPolicySha256(row.documentSha256, "Document digest"),
      targetSetSha256: officialSubmissionPolicySha256(row.targetSetSha256, "Target-set digest"),
      preparedByUserId: inputUuid(row.preparedByUserId, "Preparer id"),
      status: row.reviewStatus,
      createdAt: officialSubmissionPolicyTimestamp(row.createdAt.toISOString(), "Created at"),
      document,
      targets,
      review,
      approvalSha256: review ? officialSubmissionPolicyApprovalDigest(review) : null,
    };
  } catch { throw serviceUnavailable("Official submission policy version requires reconciliation."); }
}

function managedPublication(row: PublicationRow): PublicationRow {
  try {
    inputUuid(row.programIntakeId); inputUuid(row.programId); inputUuid(row.schoolId); inputUuid(row.versionId);
    officialSubmissionPolicyKey(row.admissionRouteKey, "Admission route key");
    officialSubmissionPolicySha256(row.documentSha256); officialSubmissionPolicySha256(row.targetSetSha256);
    officialSubmissionPolicySha256(row.approvalSha256); inputInteger(row.revision, "Publication revision", 1, MAX_OFFICIAL_SUBMISSION_POLICY_VERSION);
    inputEnum(row.status, "Publication status", ["active", "withdrawn"] as const);
    officialSubmissionPolicyTimestamp(row.updatedAt.toISOString(), "Publication updated at");
    return row;
  } catch { throw serviceUnavailable("Official submission policy publication requires reconciliation."); }
}

// Internal service only. No management HTTP adapter, Agent tool or automatic publisher is registered.
export class PostgresOfficialSubmissionPolicyGovernance {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  private async lockScope(tx: TransactionalSqlClient, scope: Scope, write: boolean): Promise<void> {
    const accounts = await tx.query("select id from users where id = $1 and account_status = 'active' for share", [scope.context.actorUserId]);
    if (!accounts.length) throw forbidden("Active internal account is required.");
    const roles = await tx.query("select id from user_roles where user_id = $1 and role = $2 and revoked_at is null for share", [scope.context.actorUserId, scope.context.activeRole]);
    if (!roles.length) throw forbidden("Active internal role is required.");
    const schools = await tx.query<{ status: string }>(`select status from schools where id = $1 for ${write ? "no key update" : "share"}`, [scope.schoolId]);
    if (!schools[0]) throw unavailable();
    if (write && schools[0].status !== "active") throw conflict();
  }

  private async lockTargets(tx: TransactionalSqlClient, scope: Scope, targets: OfficialSubmissionPolicyTarget[]): Promise<void> {
    const rows = await tx.query<{ programId: string; programIntakeId: string; schoolId: string; programStatus: string }>(
      `select p.id as "programId", pi.id as "programIntakeId", p.school_id as "schoolId", p.status as "programStatus"
       from program_intakes pi join programs p on p.id = pi.program_id
       where pi.id = any($1::uuid[]) order by pi.id for no key update of p, pi`, [targets.map(target => target.programIntakeId)]);
    if (rows.length !== targets.length) throw unavailable();
    const byIntake = new Map(rows.map(row => [row.programIntakeId, row]));
    for (const expected of targets) {
      const row = byIntake.get(expected.programIntakeId);
      if (!row || row.programId !== expected.programId
        || row.schoolId !== scope.schoolId || row.programStatus !== "active") throw unavailable();
    }
  }

  private async now(tx: TransactionalSqlClient): Promise<Date> {
    return (await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []))[0].now;
  }

  private async targetRows(tx: TransactionalSqlClient, versionId: string): Promise<TargetRow[]> {
    return tx.query<TargetRow>(`select school_id as "schoolId", program_id as "programId", program_intake_id as "programIntakeId",
      admission_route_key as "admissionRouteKey", created_at as "createdAt"
      from official_submission_policy_version_targets where policy_version_id = $1 order by program_intake_id`, [versionId]);
  }

  private async version(tx: TransactionalSqlClient, scope: Scope, versionId: string): Promise<{ row: VersionRow; dto: ManagedOfficialSubmissionPolicyVersionDto }> {
    const rows = await tx.query<VersionRow>(`select ${columns} from official_submission_policy_versions v
      where v.id = $1 and v.school_id = $2 and v.policy_key = $3 and v.admission_route_key = $4 for share`,
      [versionId, scope.schoolId, scope.policyKey, scope.admissionRouteKey]);
    if (!rows[0]) throw unavailable();
    return { row: rows[0], dto: managedVersion(rows[0], await this.targetRows(tx, versionId)) };
  }

  private async publications(tx: TransactionalSqlClient, routeKey: string, targets: OfficialSubmissionPolicyTarget[]): Promise<PublicationRow[]> {
    if (!targets.length) return [];
    const rows = await tx.query<PublicationRow>(`select program_intake_id as "programIntakeId", program_id as "programId", school_id as "schoolId",
      admission_route_key as "admissionRouteKey", version_id as "versionId", document_sha256 as "documentSha256",
      target_set_sha256 as "targetSetSha256", approval_sha256 as "approvalSha256", revision, status, updated_at as "updatedAt"
      from official_submission_policy_publications where admission_route_key = $1 and program_intake_id = any($2::uuid[])
      order by program_intake_id for update`, [routeKey, targets.map(target => target.programIntakeId)]);
    return rows.map(managedPublication);
  }

  private async audit(tx: TransactionalSqlClient, scope: Scope, action: string, versionId: string, metadata: Record<string, unknown>) {
    await new PostgresAuditWriter(tx).record(buildAuditEvent(scope.context, {
      action: `catalog.official_submission_policy.${action}`,
      resourceType: "official_submission_policy_version",
      resourceId: versionId,
      allowed: true,
      policyDecisionId: scope.decisionId,
      dataClasses: ["internal_catalog_metadata"],
      metadata: { schoolId: scope.schoolId, policyKey: scope.policyKey, admissionRouteKey: scope.admissionRouteKey, ...metadata },
    }));
  }

  async getVersion(context: RequestContext, schoolId: unknown, policyKey: unknown, routeKey: unknown, versionId: unknown) {
    const scope = authorize(context, "catalog.read_submission_policy_review", schoolId, policyKey, routeKey);
    const id = inputUuid(versionId, "Version id");
    return this.client.transaction(async tx => { await this.lockScope(tx, scope, false); return (await this.version(tx, scope, id)).dto; });
  }

  async listVersions(context: RequestContext, schoolId: unknown, policyKey: unknown, routeKey: unknown, input: unknown = {}) {
    const scope = authorize(context, "catalog.read_submission_policy_review", schoolId, policyKey, routeKey);
    const fields = inputRecord(input, ["beforeVersion", "limit"]);
    const before = fields.beforeVersion === undefined ? null : inputInteger(fields.beforeVersion, "Before version", 1, MAX_OFFICIAL_SUBMISSION_POLICY_VERSION);
    const limit = fields.limit === undefined ? 20 : inputInteger(fields.limit, "Limit", 1, 50);
    return this.client.transaction(async tx => {
      await this.lockScope(tx, scope, false);
      const rows = await tx.query<{ versionId: string; version: number }>(`select id as "versionId", version
        from official_submission_policy_versions where school_id = $1 and policy_key = $2 and admission_route_key = $3
          and ($4::int is null or version < $4) order by version desc limit $5`,
        [scope.schoolId, scope.policyKey, scope.admissionRouteKey, before, limit + 1]);
      const versions = [];
      for (const row of rows.slice(0, limit)) versions.push((await this.version(tx, scope, row.versionId)).dto);
      return { items: versions.map(version => ({ versionId: version.versionId, version: version.version, status: version.status,
        documentSha256: version.documentSha256, targetSetSha256: version.targetSetSha256,
        targetCount: version.targets.length, preparedByUserId: version.preparedByUserId, createdAt: version.createdAt })),
      nextBeforeVersion: rows.length > limit ? versions.at(-1)!.version : null };
    });
  }

  async createDraft(context: RequestContext, schoolId: unknown, policyKey: unknown, routeKey: unknown, input: unknown) {
    const scope = authorize(context, "catalog.prepare_submission_policy", schoolId, policyKey, routeKey);
    const fields = inputRecord(input, ["versionId", "document", "targets"]), id = inputUuid(fields.versionId, "Version id");
    const document = parseOfficialSubmissionPolicyDocument(fields.document, scope.admissionRouteKey);
    const targets = parseOfficialSubmissionPolicyTargets(fields.targets);
    const documentSha256 = officialSubmissionPolicyDocumentDigest(document);
    const targetSetSha256 = officialSubmissionPolicyTargetSetDigest(scope.schoolId, scope.admissionRouteKey, targets);
    return this.client.transaction(async tx => {
      await this.lockScope(tx, scope, true);
      const existing = await tx.query<VersionRow>(`select ${columns} from official_submission_policy_versions v where v.id = $1 for share`, [id]);
      if (existing[0]) {
        if (existing[0].schoolId !== scope.schoolId || existing[0].policyKey !== scope.policyKey
          || existing[0].admissionRouteKey !== scope.admissionRouteKey || existing[0].preparedByUserId !== scope.context.actorUserId
          || existing[0].documentSha256 !== documentSha256 || existing[0].targetSetSha256 !== targetSetSha256) throw conflict();
        return managedVersion(existing[0], await this.targetRows(tx, id));
      }
      await this.lockTargets(tx, scope, targets);
      const now = await this.now(tx);
      if (document.sources.some(source => new Date(source.capturedAt) > now)) throw conflict();
      const latest = (await tx.query<{ version: number }>(`select coalesce(max(version), 0)::int as version
        from official_submission_policy_versions where school_id = $1 and policy_key = $2 and admission_route_key = $3`,
        [scope.schoolId, scope.policyKey, scope.admissionRouteKey]))[0].version;
      if (latest >= MAX_OFFICIAL_SUBMISSION_POLICY_VERSION) throw conflict();
      const inserted = await tx.query(`insert into official_submission_policy_versions
        (id,school_id,policy_key,admission_route_key,version,form_mode,max_program_choices,ordering_mode,external_channel_type,
         document_json,document_sha256,target_set_sha256,prepared_by_user_id,created_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14) on conflict (id) do nothing returning id`,
        [id, scope.schoolId, scope.policyKey, scope.admissionRouteKey, latest + 1, document.formMode, document.maxProgramChoices,
          document.orderingMode, document.externalChannelType, JSON.stringify(document), documentSha256, targetSetSha256,
          scope.context.actorUserId, now]);
      if (inserted.length !== 1) throw conflict();
      for (const target of targets) await tx.query(`insert into official_submission_policy_version_targets
        (policy_version_id,school_id,program_id,program_intake_id,admission_route_key,created_at) values ($1,$2,$3,$4,$5,$6)`,
        [id, scope.schoolId, target.programId, target.programIntakeId, scope.admissionRouteKey, now]);
      await this.audit(tx, scope, "prepare", id, { version: latest + 1, documentSha256, targetSetSha256, targetCount: targets.length });
      return (await this.version(tx, scope, id)).dto;
    });
  }

  async approve(context: RequestContext, schoolId: unknown, policyKey: unknown, routeKey: unknown, input: unknown) {
    const scope = authorize(context, "catalog.approve_submission_policy", schoolId, policyKey, routeKey);
    const fields = inputRecord(input, ["versionId", "expectedDocumentSha256", "expectedTargetSetSha256", "effectiveFrom", "reviewDueAt",
      "sourceChecks", "scopeConfirmed", "routingConfirmed"]);
    const id = inputUuid(fields.versionId, "Version id"), documentSha256 = officialSubmissionPolicySha256(fields.expectedDocumentSha256, "Document digest");
    const targetSetSha256 = officialSubmissionPolicySha256(fields.expectedTargetSetSha256, "Target-set digest");
    const effective = fields.effectiveFrom === null ? null : officialSubmissionPolicyTimestamp(fields.effectiveFrom, "Effective from");
    const due = officialSubmissionPolicyTimestamp(fields.reviewDueAt, "Review due at");
    const sourceChecks = parseOfficialSubmissionPolicySourceChecks(fields.sourceChecks);
    officialSubmissionPolicyConfirmation(fields.scopeConfirmed); officialSubmissionPolicyConfirmation(fields.routingConfirmed);
    return this.client.transaction(async tx => {
      await this.lockScope(tx, scope, true);
      const current = await this.version(tx, scope, id), row = current.row, version = current.dto;
      await this.lockTargets(tx, scope, version.targets);
      if (version.status !== "draft" || row.preparedByUserId === scope.context.actorUserId
        || version.documentSha256 !== documentSha256 || version.targetSetSha256 !== targetSetSha256) throw conflict();
      const reviewedAt = (await this.now(tx)).toISOString(), effectiveFrom = effective ?? reviewedAt;
      if (reviewedAt > effectiveFrom || effectiveFrom >= due) throw conflict();
      const binding = { versionId: id, schoolId: scope.schoolId, policyKey: scope.policyKey,
        admissionRouteKey: scope.admissionRouteKey, documentSha256, targetSetSha256,
        preparedByUserId: row.preparedByUserId, reviewedByUserId: scope.context.actorUserId!, reviewedAt, effectiveFrom, reviewDueAt: due };
      const review = parseOfficialSubmissionPolicyReview({ schemaVersion: 1, ...binding, scopeConfirmed: true, routingConfirmed: true,
        sourceChecks }, binding, version.document);
      const updated = await tx.query(`update official_submission_policy_versions set review_status = 'approved', approved_by_user_id = $5,
        reviewed_at = $6, effective_from = $7, review_due_at = $8, review_evidence_json = $9::jsonb
        where id = $1 and school_id = $2 and policy_key = $3 and admission_route_key = $4 and review_status = 'draft'
          and document_sha256 = $10 and target_set_sha256 = $11 returning id`,
        [id, scope.schoolId, scope.policyKey, scope.admissionRouteKey, scope.context.actorUserId, reviewedAt, effectiveFrom, due,
          JSON.stringify(review), documentSha256, targetSetSha256]);
      if (updated.length !== 1) throw conflict();
      const approvalSha256 = officialSubmissionPolicyApprovalDigest(review);
      await this.audit(tx, scope, "approve", id, { version: version.version, documentSha256, targetSetSha256, approvalSha256, targetCount: version.targets.length });
      return (await this.version(tx, scope, id)).dto;
    });
  }

  async publish(context: RequestContext, schoolId: unknown, policyKey: unknown, routeKey: unknown, input: unknown) {
    const scope = authorize(context, "catalog.publish_submission_policy", schoolId, policyKey, routeKey);
    const fields = inputRecord(input, ["versionId", "expectedDocumentSha256", "expectedTargetSetSha256", "expectedApprovalSha256", "expectedPublications"]);
    const id = inputUuid(fields.versionId, "Version id"), documentSha256 = officialSubmissionPolicySha256(fields.expectedDocumentSha256, "Document digest");
    const targetSetSha256 = officialSubmissionPolicySha256(fields.expectedTargetSetSha256, "Target-set digest");
    const approvalSha256 = officialSubmissionPolicySha256(fields.expectedApprovalSha256, "Approval digest");
    const expected = parsePublicationExpectations(fields.expectedPublications, 0);
    return this.client.transaction(async tx => {
      await this.lockScope(tx, scope, true);
      const { row, dto: version } = await this.version(tx, scope, id);
      if (!sameTargetIds(version.targets, expected)) throw conflict();
      await this.lockTargets(tx, scope, version.targets);
      const now = await this.now(tx);
      if (version.status !== "approved" || version.documentSha256 !== documentSha256 || version.targetSetSha256 !== targetSetSha256
        || version.approvalSha256 !== approvalSha256 || !row.effectiveFrom || row.effectiveFrom > now || !row.reviewDueAt || row.reviewDueAt <= now) throw conflict();
      const current = await this.publications(tx, scope.admissionRouteKey, version.targets);
      const byIntake = new Map(current.map(row => [row.programIntakeId, row]));
      const exact = current.length === version.targets.length && version.targets.every(target => {
        const row = byIntake.get(target.programIntakeId);
        return row?.status === "active" && row.versionId === id && row.documentSha256 === documentSha256
          && row.targetSetSha256 === targetSetSha256 && row.approvalSha256 === approvalSha256
          && row.programId === target.programId && row.schoolId === scope.schoolId;
      });
      if (exact) return current.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
      if (current.some(row => row.status === "active")) throw conflict();
      for (let index = 0; index < version.targets.length; index += 1) {
        const target = version.targets[index], expectation = expected[index], prior = byIntake.get(target.programIntakeId);
        if ((prior?.revision ?? 0) !== expectation.expectedRevision || expectation.expectedRevision === MAX_OFFICIAL_SUBMISSION_POLICY_VERSION) throw conflict();
        const result = await tx.query(`insert into official_submission_policy_publications
          (program_intake_id,program_id,school_id,admission_route_key,version_id,document_sha256,target_set_sha256,approval_sha256,revision,status,created_at,updated_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8,1,'active',$10,$10)
          on conflict (program_intake_id,admission_route_key) do update set program_id = excluded.program_id, school_id = excluded.school_id,
            version_id = excluded.version_id, document_sha256 = excluded.document_sha256, target_set_sha256 = excluded.target_set_sha256,
            approval_sha256 = excluded.approval_sha256, revision = official_submission_policy_publications.revision + 1,
            status = 'active', updated_at = $10
          where official_submission_policy_publications.revision = $9 and official_submission_policy_publications.status = 'withdrawn'
          returning revision`, [target.programIntakeId, target.programId, scope.schoolId, scope.admissionRouteKey, id, documentSha256,
            targetSetSha256, approvalSha256, expectation.expectedRevision, now]);
        if (result.length !== 1 || result[0].revision !== expectation.expectedRevision + 1) throw conflict();
      }
      const published = await this.publications(tx, scope.admissionRouteKey, version.targets);
      if (published.length !== version.targets.length || published.some(row => row.status !== "active" || row.versionId !== id
        || row.documentSha256 !== documentSha256 || row.targetSetSha256 !== targetSetSha256 || row.approvalSha256 !== approvalSha256)) {
        throw serviceUnavailable("Official submission policy publication update could not be verified.");
      }
      await this.audit(tx, scope, "publish", id, { version: version.version, documentSha256, targetSetSha256, approvalSha256, targetCount: version.targets.length });
      return published.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
    });
  }

  async withdraw(context: RequestContext, schoolId: unknown, policyKey: unknown, routeKey: unknown, input: unknown) {
    const scope = authorize(context, "catalog.withdraw_submission_policy", schoolId, policyKey, routeKey);
    const fields = inputRecord(input, ["versionId", "expectedPublications", "reason"]), id = inputUuid(fields.versionId, "Version id");
    const expected = parsePublicationExpectations(fields.expectedPublications, 1);
    const reason = inputEnum(fields.reason, "Withdrawal reason", OFFICIAL_SUBMISSION_POLICY_WITHDRAWAL_REASONS);
    return this.client.transaction(async tx => {
      await this.lockScope(tx, scope, true);
      const { dto: version } = await this.version(tx, scope, id);
      if (!sameTargetIds(version.targets, expected)) throw conflict();
      const current = await this.publications(tx, scope.admissionRouteKey, version.targets);
      if (current.length !== version.targets.length || current.some(row => row.versionId !== id)) throw conflict();
      if (current.every(row => row.status === "withdrawn")) return current.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
      const byIntake = new Map(current.map(row => [row.programIntakeId, row])), now = await this.now(tx);
      for (const expectation of expected) {
        const row = byIntake.get(expectation.programIntakeId);
        if (!row || row.status !== "active" || row.revision !== expectation.expectedRevision
          || row.revision === MAX_OFFICIAL_SUBMISSION_POLICY_VERSION) throw conflict();
        const updated = await tx.query(`update official_submission_policy_publications set status = 'withdrawn', revision = revision + 1,
          updated_at = $4 where program_intake_id = $1 and admission_route_key = $2 and version_id = $3 and revision = $5 and status = 'active'
          returning revision`, [row.programIntakeId, scope.admissionRouteKey, id, now, row.revision]);
        if (updated.length !== 1 || updated[0].revision !== row.revision + 1) throw conflict();
      }
      const withdrawn = await this.publications(tx, scope.admissionRouteKey, version.targets);
      if (withdrawn.some(row => row.versionId !== id || row.status !== "withdrawn")) throw serviceUnavailable("Policy withdrawal could not be verified.");
      await this.audit(tx, scope, "withdraw", id, { reason, targetCount: version.targets.length });
      return withdrawn.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
    });
  }
}
