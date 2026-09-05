import { randomUUID } from "node:crypto";
import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { noticeSha256 } from "../notices/document.ts";
import { officialSubmissionPolicyKey, officialSubmissionPolicySha256 } from "../submission-policy/official-submission-policy.ts";
import { getLockedPublishedOfficialSubmissionPolicy } from "../submission-policy/postgres-reader.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import { buildMaterialPreview, parseMaterialPreview, type MaterialVersions } from "./application-material-preview.ts";
import {
  APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
  APPLICATION_MATERIAL_SNAPSHOT_SCHEME,
  createApplicationMaterialSnapshotPayload,
  parseApplicationMaterialSnapshotInput,
  parseApplicationMaterialSnapshotPayload,
  type ApplicationMaterialSnapshotBinding,
  type ApplicationMaterialSnapshotCommandInput,
  type ApplicationMaterialSnapshotInput,
} from "./application-material-snapshot.ts";
import { ApplicationMaterialSnapshotCipher } from "./application-material-snapshot-envelope.ts";
import { APPLICATION_AUTHORIZATION_FORMAT_V2, applicationAuthorizationDigests } from "./application-submission-authorization.ts";
import { parseApplicationIdempotencyKey } from "./application-commands.ts";
import { PostgresApplicationCommands } from "./postgres-application-commands.ts";
import { loadMaterialPreviewRecords } from "./postgres-application-material-preview.ts";
import { readApplicationSubmissionAuthorization } from "./postgres-application-submission-authorization.ts";

type SetRow = { revision: number; status: string; lockedAt: Date | null; submittedAt: Date | null };
type ChoiceRow = { schoolId: string; programId: string | null; programIntakeId: string | null; admissionRouteKey: string | null;
  status: string; removedAt: Date | null };
type AuthorizationMaterialRow = {
  id: string; scopeSha256: string; selection: unknown; selectionSha256: string; materialContentSha256: string;
  materialSelectionRevision: number; applicationSet: number; applicant: number; education: number; assessments: number;
  noticeScopeKey: string; noticeVersionId: string; noticePublicationRevision: number;
  authorizationFormat: string; admissionRouteKey: string | null; policyVersionId: string | null;
  policyPublicationRevision: number | null; policyDocumentSha256: string | null; policyTargetSetSha256: string | null;
  policyApprovalSha256: string | null;
};
type ProfileRow = { revision: number; fullName: string | null; contactEmail: string | null; citizenshipCountry: string | null };
type SelectionRow = { revision: number; applicationSet: number; applicant: number; education: number; assessments: number; selection: unknown };
type SnapshotRow = {
  id: string; userId: string; applicationSetId: string; applicationChoiceId: string; schoolId: string;
  programId: string; programIntakeId: string; authorizationId: string; authorizationScopeSha256: string;
  materialSelectionRevision: number; applicationSet: number; applicant: number; education: number; assessments: number;
  selectionSha256: string; materialContentSha256: string; payloadSha256: string; payloadBytes: number;
  payloadFormat: string; encryptionScheme: string; encryptionKeyId: string; envelope: unknown;
  capturedRequestId: string; capturedAt: Date;
};

const missing = () => forbidden("Application material snapshot is not available to this student.");
const conflict = () => new CuacError("CONFLICT", "Application material authorization or source data changed. Reload before freezing.", 409);
const corrupt = () => serviceUnavailable("Application material snapshot requires reconciliation.");

export class PostgresApplicationMaterialSnapshot {
  private readonly client: TransactionalSqlClient;
  private readonly cipher: ApplicationMaterialSnapshotCipher;

  constructor(client: TransactionalSqlClient, cipher: ApplicationMaterialSnapshotCipher) {
    this.client = client;
    this.cipher = cipher;
  }

  async get(context: RequestContext, applicationSetId: unknown, choiceId: unknown) {
    const [userId, setId, id] = authorize(context, applicationSetId, choiceId);
    return this.client.transaction(async tx => {
      await tx.query("set transaction isolation level repeatable read, read only", []);
      await requireOwnerScope(tx, userId, setId, id);
      return readLatestApplicationMaterialSnapshot(tx, this.cipher, userId, setId, id);
    });
  }

  async create(context: RequestContext, applicationSetId: unknown, choiceId: unknown, value: unknown, idempotencyKey: unknown) {
    const [userId, setId, id] = authorize(context, applicationSetId, choiceId);
    const input = parseApplicationMaterialSnapshotInput(value), key = parseApplicationIdempotencyKey(idempotencyKey);
    const commandInput: ApplicationMaterialSnapshotCommandInput = { ...input, applicationSetId: setId, applicationChoiceId: id };
    return this.client.transaction(async tx => {
      const audit = new PostgresAuditWriter(tx), commands = new PostgresApplicationCommands(tx, audit);
      return commands.execute(context, "application_material_snapshot.create", commandInput, key,
        () => createSnapshot(tx, this.cipher, audit, context, userId, setId, id, input),
        snapshotId => readApplicationMaterialSnapshot(tx, this.cipher, userId, setId, id, snapshotId));
    });
  }
}

function authorize(context: RequestContext, setId: unknown, choiceId: unknown): [string, string, string] {
  const decision = evaluatePolicy(context, "student.manage_material_snapshot", { type: "student",
    ownerUserId: context.actorUserId, dataClasses: ["student_pii", "education_record"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return [inputUuid(context.actorUserId), inputUuid(setId, "applicationSetId"), inputUuid(choiceId, "choiceId")];
}

async function requireOwnerScope(tx: TransactionalSqlClient, userId: string, setId: string, choiceId: string) {
  const rows = await tx.query(`select c.id from users u join application_sets a on a.user_id = u.id
    join application_choices c on c.application_set_id = a.id and c.user_id = u.id
    where u.id = $1 and a.id = $2 and c.id = $3 and u.account_status = 'active'
      and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`,
  [userId, setId, choiceId]);
  if (rows.length !== 1) throw missing();
}

async function lockDraftScope(tx: TransactionalSqlClient, userId: string, setId: string, choiceId: string) {
  if ((await tx.query("select id from users where id = $1 and account_status = 'active' for update", [userId])).length !== 1) throw missing();
  if ((await tx.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId])).length !== 1) throw missing();
  const sets = await tx.query<SetRow>(`select revision, status, locked_at as "lockedAt", submitted_at as "submittedAt"
    from application_sets where id = $1 and user_id = $2 for update`, [setId, userId]);
  const choices = await tx.query<ChoiceRow>(`select school_id as "schoolId", program_id as "programId", program_intake_id as "programIntakeId",
    admission_route_key as "admissionRouteKey", status, removed_at as "removedAt"
    from application_choices where id = $1 and application_set_id = $2 and user_id = $3 for update`,
  [choiceId, setId, userId]);
  if (sets.length !== 1 || choices.length !== 1) throw missing();
  const set = sets[0], choice = choices[0];
  try { inputInteger(set.revision, "Application set revision", 1, MAX_APPLICANT_REVISION); inputUuid(choice.schoolId); }
  catch { throw corrupt(); }
  if (set.status !== "draft" || set.lockedAt !== null || set.submittedAt !== null || choice.status !== "draft"
    || choice.removedAt !== null || !choice.programId || !choice.programIntakeId) throw conflict();
  return { set, choice: { ...choice, programId: inputUuid(choice.programId), programIntakeId: inputUuid(choice.programIntakeId) } };
}

async function createSnapshot(tx: TransactionalSqlClient, cipher: ApplicationMaterialSnapshotCipher, audit: PostgresAuditWriter,
  context: RequestContext, userId: string, setId: string, choiceId: string, input: ApplicationMaterialSnapshotInput) {
  const { set, choice } = await lockDraftScope(tx, userId, setId, choiceId);
  const authRows = await tx.query<AuthorizationMaterialRow>(`select id, scope_sha256 as "scopeSha256", selection_json as selection,
    selection_sha256 as "selectionSha256", material_content_sha256 as "materialContentSha256",
    material_selection_revision as "materialSelectionRevision", source_set_revision as "applicationSet",
    source_applicant_revision as applicant, source_education_revision as education, source_assessment_revision as assessments,
    notice_scope_key as "noticeScopeKey", notice_version_id as "noticeVersionId",
    notice_publication_revision as "noticePublicationRevision", authorization_format as "authorizationFormat",
    admission_route_key as "admissionRouteKey", policy_version_id as "policyVersionId",
    policy_publication_revision as "policyPublicationRevision", policy_document_sha256 as "policyDocumentSha256",
    policy_target_set_sha256 as "policyTargetSetSha256", policy_approval_sha256 as "policyApprovalSha256"
    from application_submission_authorizations where id = $4 and user_id = $1 and application_set_id = $2
      and application_choice_id = $3 for share`, [userId, setId, choiceId, input.authorizationId]);
  if (authRows.length !== 1) throw conflict();
  const storedAuthorization = authRows[0];
  if (storedAuthorization.scopeSha256 !== input.expectedAuthorizationScopeSha256
    || storedAuthorization.materialContentSha256 !== input.expectedMaterialContentSha256) throw conflict();
  if (storedAuthorization.authorizationFormat !== APPLICATION_AUTHORIZATION_FORMAT_V2
    || choice.admissionRouteKey === null || storedAuthorization.admissionRouteKey !== choice.admissionRouteKey
    || storedAuthorization.policyVersionId === null || storedAuthorization.policyPublicationRevision === null
    || storedAuthorization.policyDocumentSha256 === null || storedAuthorization.policyTargetSetSha256 === null
    || storedAuthorization.policyApprovalSha256 === null) throw conflict();
  let admissionRouteKey: string;
  try {
    admissionRouteKey = officialSubmissionPolicyKey(storedAuthorization.admissionRouteKey, "Admission route key");
    inputUuid(storedAuthorization.policyVersionId, "Policy version id");
    inputInteger(storedAuthorization.policyPublicationRevision, "Policy publication revision", 1, MAX_APPLICANT_REVISION);
    officialSubmissionPolicySha256(storedAuthorization.policyDocumentSha256, "Policy document digest");
    officialSubmissionPolicySha256(storedAuthorization.policyTargetSetSha256, "Policy target-set digest");
    officialSubmissionPolicySha256(storedAuthorization.policyApprovalSha256, "Policy approval digest");
  } catch { throw corrupt(); }

  const targets = await tx.query(`select s.id from schools s join programs p on p.school_id = s.id and p.id = $2
    join program_intakes pi on pi.program_id = p.id and pi.id = $3 where s.id = $1 for share of s,p,pi`,
  [choice.schoolId, choice.programId, choice.programIntakeId]);
  if (targets.length !== 1) throw conflict();
  const policyCheckedAt = await databaseNow(tx);
  const policy = await getLockedPublishedOfficialSubmissionPolicy(tx, choice.programId, choice.programIntakeId,
    admissionRouteKey, policyCheckedAt);
  if (!policy || policy.schoolId !== choice.schoolId || policy.programId !== choice.programId
    || policy.programIntakeId !== choice.programIntakeId || policy.admissionRouteKey !== admissionRouteKey
    || policy.versionId !== storedAuthorization.policyVersionId
    || policy.publicationRevision !== storedAuthorization.policyPublicationRevision
    || policy.documentSha256 !== storedAuthorization.policyDocumentSha256
    || policy.targetSetSha256 !== storedAuthorization.policyTargetSetSha256
    || policy.approvalSha256 !== storedAuthorization.policyApprovalSha256) throw conflict();
  const notices = await tx.query(`select pub.scope_key from privacy_notice_publications pub
    join privacy_notice_versions v on v.id = pub.version_id and v.scope_key = pub.scope_key
    where pub.scope_key = $1 and pub.version_id = $2 and pub.revision = $3 for share of pub,v`,
  [storedAuthorization.noticeScopeKey, storedAuthorization.noticeVersionId, storedAuthorization.noticePublicationRevision]);
  if (notices.length !== 1) throw conflict();
  if ((await tx.query("select id from school_applications where application_choice_id = $1 for share", [choiceId])).length) throw conflict();

  const selections = await tx.query<SelectionRow>(`select revision, source_set_revision as "applicationSet",
    source_applicant_revision as applicant, source_education_revision as education, source_assessment_revision as assessments,
    selection_json as selection from application_material_selections where choice_id = $1 and application_set_id = $2
      and user_id = $3 for share`, [choiceId, setId, userId]);
  if (selections.length !== 1) throw conflict();
  const profiles = await tx.query<ProfileRow>(`select revision, full_name as "fullName", contact_email as "contactEmail",
    citizenship_country as "citizenshipCountry" from student_applicant_profiles where user_id = $1 for share`, [userId]);
  const educationHeaders = await tx.query<{ revision: number }>("select revision from student_education_histories where user_id = $1 for share", [userId]);
  const assessmentHeaders = await tx.query<{ revision: number }>("select revision from student_assessment_histories where user_id = $1 for share", [userId]);

  const authorization = await readApplicationSubmissionAuthorization(tx, userId, setId, choiceId, input.authorizationId);
  if (!authorization.freshness.current || authorization.status !== "active"
    || authorization.confirmation.scopeSha256 !== input.expectedAuthorizationScopeSha256
    || authorization.material.contentSha256 !== input.expectedMaterialContentSha256) throw conflict();
  const sourceVersions: MaterialVersions = { applicationSet: set.revision, applicant: profiles[0]?.revision ?? 0,
    education: educationHeaders[0]?.revision ?? 0, assessments: assessmentHeaders[0]?.revision ?? 0 };
  const storedVersions: MaterialVersions = { applicationSet: storedAuthorization.applicationSet, applicant: storedAuthorization.applicant,
    education: storedAuthorization.education, assessments: storedAuthorization.assessments };
  const selectionRow = selections[0], selectionVersions: MaterialVersions = { applicationSet: selectionRow.applicationSet,
    applicant: selectionRow.applicant, education: selectionRow.education, assessments: selectionRow.assessments };
  if (storedAuthorization.materialSelectionRevision !== selectionRow.revision
    || JSON.stringify(storedAuthorization.selection) !== JSON.stringify(selectionRow.selection)
    || Object.keys(sourceVersions).some(key => sourceVersions[key as keyof MaterialVersions] !== storedVersions[key as keyof MaterialVersions]
      || selectionVersions[key as keyof MaterialVersions] !== storedVersions[key as keyof MaterialVersions])) throw conflict();
  const request = parseMaterialPreview({ expectedVersions: storedVersions, selection: storedAuthorization.selection });
  const digests = applicationAuthorizationDigests({ userId, applicationSetId: setId, applicationChoiceId: choiceId,
    schoolId: choice.schoolId, programId: choice.programId, programIntakeId: choice.programIntakeId,
    materialSelectionRevision: storedAuthorization.materialSelectionRevision, sourceVersions: storedVersions,
    selection: request.selection, materialContentSha256: storedAuthorization.materialContentSha256,
    notice: { scopeKey: storedAuthorization.noticeScopeKey, locale: authorization.notice.locale,
      versionId: authorization.notice.versionId, publicationRevision: authorization.notice.publicationRevision,
      contentSha256: authorization.notice.contentSha256 },
    policy: { admissionRouteKey, versionId: storedAuthorization.policyVersionId,
      publicationRevision: storedAuthorization.policyPublicationRevision,
      documentSha256: storedAuthorization.policyDocumentSha256, targetSetSha256: storedAuthorization.policyTargetSetSha256,
      approvalSha256: storedAuthorization.policyApprovalSha256 } });
  if (digests.selectionSha256 !== storedAuthorization.selectionSha256 || digests.scopeSha256 !== storedAuthorization.scopeSha256) throw corrupt();

  const existing = await tx.query<{ id: string }>(`select id from application_material_snapshots
    where authorization_id = $1 for share`, [authorization.id]);
  if (existing.length > 1) throw corrupt();
  if (existing[0]) return readApplicationMaterialSnapshot(tx, cipher, userId, setId, choiceId, existing[0].id);

  const { education, assessments } = await loadMaterialPreviewRecords(tx, userId, request.selection);
  const capturedAt = await databaseNow(tx);
  const preview = buildMaterialPreview(userId, authorization.target, capturedAt, request, {
    applicant: profiles[0] ?? { fullName: null, contactEmail: null, citizenshipCountry: null }, education, assessments });
  if (preview.contentSha256 !== storedAuthorization.materialContentSha256) throw conflict();
  const payload = createApplicationMaterialSnapshotPayload(userId,
    { id: authorization.id, scopeSha256: authorization.confirmation.scopeSha256 }, preview);
  const snapshotId = randomUUID();
  const binding: ApplicationMaterialSnapshotBinding = { snapshotId, userId, ...authorization.target,
    authorizationId: authorization.id, authorizationScopeSha256: authorization.confirmation.scopeSha256,
    materialContentSha256: preview.contentSha256, payloadSha256: payload.payloadSha256,
    payloadFormat: APPLICATION_MATERIAL_SNAPSHOT_FORMAT, capturedAt };
  let envelope;
  try { envelope = cipher.seal(binding, payload.serialized); } catch { throw corrupt(); }
  if (typeof context.requestId !== "string" || context.requestId.length < 1 || context.requestId.length > 128) throw corrupt();
  const inserted = await tx.query<{ id: string }>(`insert into application_material_snapshots
    (id,user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,authorization_id,
     authorization_scope_sha256,material_selection_revision,source_set_revision,source_applicant_revision,
     source_education_revision,source_assessment_revision,selection_sha256,material_content_sha256,payload_sha256,
     payload_bytes,payload_format,encryption_scheme,encryption_key_id,envelope_json,captured_request_id,captured_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24) returning id`,
  [snapshotId, userId, setId, choiceId, choice.schoolId, choice.programId, choice.programIntakeId, authorization.id,
    authorization.confirmation.scopeSha256, authorization.material.selectionRevision, sourceVersions.applicationSet,
    sourceVersions.applicant, sourceVersions.education, sourceVersions.assessments, authorization.material.selectionSha256,
    preview.contentSha256, payload.payloadSha256, payload.payloadBytes, APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
    APPLICATION_MATERIAL_SNAPSHOT_SCHEME, envelope.keyId, JSON.stringify(envelope), context.requestId, capturedAt]);
  if (inserted.length !== 1) throw corrupt();
  await audit.record(buildAuditEvent(context, { action: "student.application_material_snapshot.create",
    resourceType: "application_material_snapshot", resourceId: snapshotId, allowed: true,
    policyDecisionId: context.policyDecisionId, dataClasses: ["student_pii", "education_record"],
    metadata: { applicationSetId: setId, applicationChoiceId: choiceId, authorizationId: authorization.id,
      materialSelectionRevision: authorization.material.selectionRevision,
      admissionRouteKey, policyVersionId: storedAuthorization.policyVersionId,
      policyPublicationRevision: storedAuthorization.policyPublicationRevision,
      applicantFieldCount: request.selection.applicantFields.length, educationRecordCount: request.selection.educationRecordIds.length,
      assessmentRecordCount: request.selection.assessmentRecordIds.length } }));
  return readApplicationMaterialSnapshot(tx, cipher, userId, setId, choiceId, snapshotId);
}

export async function readLatestApplicationMaterialSnapshot(tx: TransactionalSqlClient,
  cipher: ApplicationMaterialSnapshotCipher, userId: string, setId: string, choiceId: string) {
  const rows = await tx.query<{ id: string }>(`select id from application_material_snapshots
    where user_id = $1 and application_set_id = $2 and application_choice_id = $3
    order by captured_at desc, id desc limit 1`, [userId, setId, choiceId]);
  return rows[0] ? readApplicationMaterialSnapshot(tx, cipher, userId, setId, choiceId, rows[0].id) : null;
}

export async function readApplicationMaterialSnapshot(tx: TransactionalSqlClient, cipher: ApplicationMaterialSnapshotCipher,
  userId: string, setId: string, choiceId: string, snapshotId: string) {
  const rows = await tx.query<SnapshotRow>(`select id, user_id as "userId", application_set_id as "applicationSetId",
    application_choice_id as "applicationChoiceId", school_id as "schoolId", program_id as "programId",
    program_intake_id as "programIntakeId", authorization_id as "authorizationId",
    authorization_scope_sha256 as "authorizationScopeSha256", material_selection_revision as "materialSelectionRevision",
    source_set_revision as "applicationSet", source_applicant_revision as applicant,
    source_education_revision as education, source_assessment_revision as assessments,
    selection_sha256 as "selectionSha256", material_content_sha256 as "materialContentSha256",
    payload_sha256 as "payloadSha256", payload_bytes as "payloadBytes", payload_format as "payloadFormat",
    encryption_scheme as "encryptionScheme", encryption_key_id as "encryptionKeyId",
    case when octet_length(envelope_json::text) <= 550000 then envelope_json else null end as envelope,
    captured_request_id as "capturedRequestId", captured_at as "capturedAt"
    from application_material_snapshots where id = $4 and user_id = $1 and application_set_id = $2
      and application_choice_id = $3`, [userId, setId, choiceId, snapshotId]);
  if (rows.length !== 1) throw missing();
  const row = rows[0], sourceVersions: MaterialVersions = { applicationSet: row.applicationSet,
    applicant: row.applicant, education: row.education, assessments: row.assessments };
  try {
    for (const id of [row.id, row.userId, row.applicationSetId, row.applicationChoiceId, row.schoolId, row.programId,
      row.programIntakeId, row.authorizationId]) inputUuid(id);
    inputInteger(row.materialSelectionRevision, "Material selection revision", 1, MAX_APPLICANT_REVISION);
    for (const [field, value] of Object.entries(sourceVersions)) inputInteger(value, field, field === "applicationSet" ? 1 : 0, MAX_APPLICANT_REVISION);
    inputInteger(row.payloadBytes, "Snapshot payload bytes", 1, 409600);
    for (const digest of [row.authorizationScopeSha256, row.selectionSha256, row.materialContentSha256, row.payloadSha256]) noticeSha256(digest);
    if (row.payloadFormat !== APPLICATION_MATERIAL_SNAPSHOT_FORMAT || row.encryptionScheme !== APPLICATION_MATERIAL_SNAPSHOT_SCHEME
      || !/^[A-Za-z0-9_-]{1,64}$/.test(row.encryptionKeyId) || typeof row.capturedRequestId !== "string"
      || row.capturedRequestId.length < 1 || row.capturedRequestId.length > 128 || !validDate(row.capturedAt)) throw new Error();
  } catch { throw corrupt(); }
  const authorization = await readApplicationSubmissionAuthorization(tx, userId, setId, choiceId, row.authorizationId);
  if (JSON.stringify(authorization.target) !== JSON.stringify({ applicationSetId: row.applicationSetId, choiceId: row.applicationChoiceId,
    schoolId: row.schoolId, programId: row.programId, programIntakeId: row.programIntakeId })
    || authorization.confirmation.scopeSha256 !== row.authorizationScopeSha256
    || authorization.material.selectionRevision !== row.materialSelectionRevision
    || JSON.stringify(authorization.material.sourceVersions) !== JSON.stringify(sourceVersions)
    || authorization.material.selectionSha256 !== row.selectionSha256
    || authorization.material.contentSha256 !== row.materialContentSha256) throw corrupt();
  const binding: ApplicationMaterialSnapshotBinding = { snapshotId: row.id, userId: row.userId,
    applicationSetId: row.applicationSetId, choiceId: row.applicationChoiceId, schoolId: row.schoolId,
    programId: row.programId, programIntakeId: row.programIntakeId, authorizationId: row.authorizationId,
    authorizationScopeSha256: row.authorizationScopeSha256, materialContentSha256: row.materialContentSha256,
    payloadSha256: row.payloadSha256, payloadFormat: APPLICATION_MATERIAL_SNAPSHOT_FORMAT, capturedAt: row.capturedAt };
  let plaintext;
  if (!row.envelope || typeof row.envelope !== "object" || Array.isArray(row.envelope)
    || (row.envelope as Record<string, unknown>).keyId !== row.encryptionKeyId) throw corrupt();
  try { plaintext = cipher.open(binding, row.envelope); } catch { throw corrupt(); }
  if (Buffer.byteLength(plaintext, "utf8") !== row.payloadBytes) throw corrupt();
  parseApplicationMaterialSnapshotPayload(plaintext, { ownerUserId: row.userId, authorizationId: row.authorizationId,
    authorizationScopeSha256: row.authorizationScopeSha256, materialContentSha256: row.materialContentSha256,
    payloadSha256: row.payloadSha256, target: authorization.target });
  return { id: row.id, mode: "immutable_material_snapshot" as const, persisted: true as const, canSubmit: false as const,
    target: authorization.target, authorization: { id: authorization.id, scopeSha256: authorization.confirmation.scopeSha256 },
    material: { selectionRevision: row.materialSelectionRevision, sourceVersions, selectionSha256: row.selectionSha256,
      contentSha256: row.materialContentSha256, payloadSha256: row.payloadSha256 },
    capturedAt: row.capturedAt.toISOString(), freshness: authorization.freshness };
}

async function databaseNow(tx: TransactionalSqlClient) {
  const rows = await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []);
  if (rows.length !== 1 || !validDate(rows[0].now)) throw corrupt();
  return rows[0].now;
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
