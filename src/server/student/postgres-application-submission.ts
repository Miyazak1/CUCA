import { randomUUID } from "node:crypto";
import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { readLockedCurrentApplicationFeeEntitlement } from "../billing/postgres-application-fee-entitlement.ts";
import { getLockedPublishedProgramRequirements } from "../catalog/postgres-requirements.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../notifications/postgres-repository.ts";
import { materializeApplicationSubmittedNotification, type NotificationEventMaterialization } from "../notifications/templates.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { getLockedPublishedOfficialSubmissionPolicy,
  type PublishedOfficialSubmissionPolicyBinding } from "../submission-policy/postgres-reader.ts";
import { APPLICATION_AUTHORIZATION_FORMAT_V2 } from "./application-submission-authorization.ts";
import type { ApplicationMaterialSnapshotCipher } from "./application-material-snapshot-envelope.ts";
import {
  APPLICATION_SUBMISSION_FORMAT,
  buildOfficialSubmissionGroupPlans,
  OFFICIAL_SUBMISSION_DISPATCH_FORMAT,
  OFFICIAL_SUBMISSION_GROUP_FORMAT,
  parseApplicationSubmissionInput,
  PROGRAM_APPLICATION_FORMAT_V2,
  submissionSha256,
  type ApplicationSubmissionCommandInput,
  type PreparedProgramApplication,
} from "./application-submission.ts";
import { parseApplicationIdempotencyKey } from "./application-commands.ts";
import { PostgresApplicationCommands } from "./postgres-application-commands.ts";
import { readApplicationMaterialSnapshot } from "./postgres-application-material-snapshot.ts";
import { readApplicationSubmissionAuthorization } from "./postgres-application-submission-authorization.ts";

type ApplicationSetRow = {
  cuacId: string;
  revision: number;
  status: string;
  lockedAt: Date | null;
  submittedAt: Date | null;
};

type ApplicationChoiceRow = {
  id: string;
  schoolId: string;
  programId: string | null;
  programIntakeId: string | null;
  admissionRouteKey: string | null;
  rankOrder: number;
  status: string;
};

type AuthorizationLockRow = {
  id: string;
  noticeScopeKey: string;
  noticeVersionId: string;
  noticePublicationRevision: number;
  noticeContentSha256: string;
};

type PreparedSubmissionApplication = PreparedProgramApplication & {
  requirement: { versionId: string; publicationRevision: number; contentSha256: string };
  policy: PublishedOfficialSubmissionPolicyBinding;
};

type StoredSubmissionRow = {
  id: string;
  applicationSetId: string;
  cuacId: string;
  sourceSetRevision: number;
  choiceCount: number;
  groupCount: number;
  manifestSha256: string;
  status: string;
  submittedAt: Date;
};

const conflict = () => new CuacError("CONFLICT",
  "Application submission prerequisites changed. Reload every project before submitting again.", 409);
const corrupt = () => serviceUnavailable("Application submission evidence requires reconciliation.");

export class PostgresApplicationSubmissionService {
  private readonly client: TransactionalSqlClient;
  private readonly snapshotCipher: ApplicationMaterialSnapshotCipher;
  private readonly notificationPublisherFactory: (client: TransactionalSqlClient) => NotificationPublisher;

  constructor(client: TransactionalSqlClient, snapshotCipher: ApplicationMaterialSnapshotCipher,
    notificationPublisherFactory: (client: TransactionalSqlClient) => NotificationPublisher =
      transaction => new PostgresNotificationPublisher(transaction)) {
    this.client = client;
    this.snapshotCipher = snapshotCipher;
    this.notificationPublisherFactory = notificationPublisherFactory;
  }

  async submit(context: RequestContext, applicationSetId: unknown, value: unknown, idempotencyKey: unknown) {
    const userId = authorizeSubmission(context);
    const setId = inputUuid(applicationSetId, "applicationSetId");
    const input = parseApplicationSubmissionInput(value);
    const key = parseApplicationIdempotencyKey(idempotencyKey);
    const commandInput: ApplicationSubmissionCommandInput = { ...input, applicationSetId: setId };
    return this.client.transaction(async tx => {
      const audit = new PostgresAuditWriter(tx);
      const commands = new PostgresApplicationCommands(tx, audit);
      return commands.execute(context, "application.submit", commandInput, key,
        () => acceptSubmission(tx, this.snapshotCipher, audit, this.notificationPublisherFactory(tx),
          context, userId, setId, input),
        submissionId => readApplicationSubmission(tx, userId, setId, submissionId));
    });
  }
}

type NotificationPublisher = {
  publish(input: NotificationEventMaterialization): Promise<{ eventId: string; created: boolean }>;
};

function authorizeSubmission(context: RequestContext): string {
  const decision = evaluatePolicy(context, "student.submit_application", {
    type: "student",
    ownerUserId: context.actorUserId,
    dataClasses: ["student_pii", "education_record", "payment_business", "public_catalog", "public_notice"],
  });
  if (!decision.allowed) throw forbidden(decision.reason);
  return inputUuid(context.actorUserId);
}

async function acceptSubmission(
  tx: TransactionalSqlClient,
  cipher: ApplicationMaterialSnapshotCipher,
  audit: PostgresAuditWriter,
  notifications: NotificationPublisher,
  context: RequestContext,
  userId: string,
  setId: string,
  input: ReturnType<typeof parseApplicationSubmissionInput>,
) {
  const { set, choices } = await lockSubmissionScope(tx, userId, setId, input.expectedRevision, input.choiceIds);
  const acceptedAt = await databaseNow(tx);
  const submissionId = randomUUID();
  const prepared: PreparedSubmissionApplication[] = [];
  for (const choice of choices) {
    prepared.push(await prepareChoice(tx, cipher, userId, setId, choice, acceptedAt, randomUUID()));
  }
  const groups = buildOfficialSubmissionGroupPlans(submissionId, prepared, randomUUID);
  const manifestSha256 = submissionSha256({
    format: APPLICATION_SUBMISSION_FORMAT,
    id: submissionId,
    userId,
    applicationSetId: setId,
    sourceSetRevision: set.revision,
    acceptedAt: acceptedAt.toISOString(),
    applications: prepared.map(application => ({
      schoolApplicationId: application.schoolApplicationId,
      applicationChoiceId: application.applicationChoiceId,
      schoolId: application.schoolId,
      programId: application.programId,
      programIntakeId: application.programIntakeId,
      admissionRouteKey: application.admissionRouteKey,
      authorizationId: application.authorizationId,
      materialSnapshotId: application.materialSnapshotId,
      feeEntitlementId: application.feeEntitlementId,
      requirement: application.requirement,
      policyVersionId: application.policy.versionId,
      policyPublicationRevision: application.policy.publicationRevision,
      policyDocumentSha256: application.policy.documentSha256,
      policyTargetSetSha256: application.policy.targetSetSha256,
      policyApprovalSha256: application.policy.approvalSha256,
    })),
    groups: groups.map(group => ({ id: group.id, sequence: group.groupSequence,
      memberCount: group.memberCount, memberManifestSha256: group.memberManifestSha256 })),
  });
  requireRequestId(context.requestId);
  const inserted = await tx.query<{ id: string }>(`insert into application_submissions
    (id,user_id,application_set_id,submission_format,source_set_revision,choice_count,group_count,
     manifest_sha256,confirmed_request_id,submitted_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
  [submissionId, userId, setId, APPLICATION_SUBMISSION_FORMAT, set.revision, prepared.length, groups.length,
    manifestSha256, context.requestId, acceptedAt]);
  if (inserted.length !== 1) throw corrupt();

  for (const application of prepared) await insertProgramApplication(tx, submissionId, userId, setId, set.cuacId, application, acceptedAt);
  for (const group of groups) await insertOfficialSubmissionGroup(tx, submissionId, userId, setId, group, acceptedAt);

  const changedChoices = await tx.query<{ id: string }>(`update application_choices
    set status = 'submitted', updated_at = $4 where user_id = $1 and application_set_id = $2
      and id = any($3::uuid[]) and status = 'draft' and removed_at is null returning id`,
  [userId, setId, choices.map(choice => choice.id), acceptedAt]);
  if (changedChoices.length !== choices.length) throw conflict();
  for (const choice of choices) {
    await tx.query(`insert into application_choice_status_events
      (application_choice_id,actor_user_id,from_status,to_status,reason,metadata_json,created_at)
      values ($1,$2,'draft','submitted','atomic_application_submission','{}'::jsonb,$3)`,
    [choice.id, userId, acceptedAt]);
  }
  const changedSet = await tx.query<{ id: string }>(`update application_sets
    set status = 'submitted', locked_at = $3, submitted_at = $3, updated_at = $3
    where id = $1 and user_id = $2 and status = 'draft' and locked_at is null and submitted_at is null
      and revision = $4 returning id`, [setId, userId, acceptedAt, set.revision]);
  if (changedSet.length !== 1) throw conflict();
  await audit.record(buildAuditEvent(context, {
    action: "student.application_submission.accept",
    resourceType: "application_submission",
    resourceId: submissionId,
    allowed: true,
    policyDecisionId: context.policyDecisionId,
    dataClasses: ["student_pii", "education_record", "payment_business"],
    metadata: { applicationSetId: setId, sourceSetRevision: set.revision,
      choiceCount: prepared.length, groupCount: groups.length, manifestSha256 },
  }));
  await notifications.publish(materializeApplicationSubmittedNotification({
    recipientUserId: userId,
    applicationSubmissionId: submissionId,
    applicationSetId: setId,
    occurredAt: acceptedAt,
  }));
  const result = await readApplicationSubmission(tx, userId, setId, submissionId);
  if (!result) throw corrupt();
  return result;
}

async function lockSubmissionScope(tx: TransactionalSqlClient, userId: string, setId: string,
  expectedRevision: number, requestedChoiceIds: readonly string[]) {
  const sets = await tx.query<ApplicationSetRow>(`select cuac_id as "cuacId",revision,status,locked_at as "lockedAt",
    submitted_at as "submittedAt" from application_sets where id = $1 and user_id = $2 for update`,
  [setId, userId]);
  if (sets.length !== 1) throw forbidden("Application set is not available to this student.");
  const set = sets[0];
  if (!/^CUAC-[0-9]{4}-[0-9]{6}$/.test(set.cuacId)) throw corrupt();
  if (set.status !== "draft" || set.lockedAt !== null || set.submittedAt !== null
    || set.revision !== expectedRevision) throw conflict();
  const choices = await tx.query<ApplicationChoiceRow>(`select id,school_id as "schoolId",program_id as "programId",
    program_intake_id as "programIntakeId",admission_route_key as "admissionRouteKey",rank_order as "rankOrder",status
    from application_choices where application_set_id = $1 and user_id = $2 and removed_at is null
    order by id for update`, [setId, userId]);
  const storedIds = choices.map(choice => choice.id).sort();
  if (!choices.length || choices.length > 20 || JSON.stringify(storedIds) !== JSON.stringify(requestedChoiceIds)
    || choices.some(choice => choice.status !== "draft" || !choice.programId || !choice.programIntakeId
      || !choice.admissionRouteKey || !Number.isSafeInteger(choice.rankOrder) || choice.rankOrder < 0)) throw conflict();
  const existingSubmission = await tx.query("select id from application_submissions where application_set_id = $1 for share", [setId]);
  const existingApplications = await tx.query("select id from school_applications where application_set_id = $1 limit 1 for share", [setId]);
  if (existingSubmission.length || existingApplications.length) throw conflict();
  return { set, choices: choices.sort((a, b) => a.rankOrder - b.rankOrder || a.id.localeCompare(b.id)) };
}

async function prepareChoice(tx: TransactionalSqlClient, cipher: ApplicationMaterialSnapshotCipher,
  userId: string, setId: string, choice: ApplicationChoiceRow, checkedAt: Date,
  schoolApplicationId: string): Promise<PreparedSubmissionApplication> {
  if (!choice.programId || !choice.programIntakeId || !choice.admissionRouteKey) throw conflict();
  const requirements = await getLockedPublishedProgramRequirements(tx, choice.programId, choice.programIntakeId, checkedAt);
  const policy = await getLockedPublishedOfficialSubmissionPolicy(tx, choice.programId, choice.programIntakeId,
    choice.admissionRouteKey, checkedAt);
  if (!requirements || !policy || requirements.programId !== choice.programId
    || requirements.programIntakeId !== choice.programIntakeId || policy.schoolId !== choice.schoolId
    || policy.programId !== choice.programId || policy.programIntakeId !== choice.programIntakeId
    || policy.admissionRouteKey !== choice.admissionRouteKey) throw conflict();

  const authLocks = await tx.query<AuthorizationLockRow>(`select id,notice_scope_key as "noticeScopeKey",
    notice_version_id as "noticeVersionId",notice_publication_revision as "noticePublicationRevision",
    notice_content_sha256 as "noticeContentSha256" from application_submission_authorizations
    where user_id = $1 and application_set_id = $2 and application_choice_id = $3 and status = 'active'
    order by id for share`, [userId, setId, choice.id]);
  if (authLocks.length !== 1) throw conflict();
  const authLock = authLocks[0];
  await lockNoticeEvidence(tx, authLock, checkedAt);
  const authorization = await readApplicationSubmissionAuthorization(tx, userId, setId, choice.id, authLock.id);
  if (authorization.status !== "active" || authorization.confirmation.format !== APPLICATION_AUTHORIZATION_FORMAT_V2
    || !authorization.freshness.current || authorization.target.schoolId !== choice.schoolId
    || authorization.target.programId !== choice.programId
    || authorization.target.programIntakeId !== choice.programIntakeId
    || authorization.officialSubmissionPolicy?.admissionRouteKey !== choice.admissionRouteKey
    || authorization.officialSubmissionPolicy.versionId !== policy.versionId
    || authorization.officialSubmissionPolicy.publicationRevision !== policy.publicationRevision
    || authorization.officialSubmissionPolicy.documentSha256 !== policy.documentSha256) throw conflict();

  const snapshots = await tx.query<{ id: string }>(`select id from application_material_snapshots
    where user_id = $1 and application_set_id = $2 and application_choice_id = $3 and authorization_id = $4
    order by captured_at desc,id desc limit 1 for share`, [userId, setId, choice.id, authorization.id]);
  if (snapshots.length !== 1) throw conflict();
  const snapshot = await readApplicationMaterialSnapshot(tx, cipher, userId, setId, choice.id, snapshots[0].id);
  if (!snapshot.freshness.current || snapshot.authorization.id !== authorization.id
    || snapshot.target.schoolId !== choice.schoolId || snapshot.target.programId !== choice.programId
    || snapshot.target.programIntakeId !== choice.programIntakeId) throw conflict();
  const entitlement = await readLockedCurrentApplicationFeeEntitlement(tx, userId, setId, choice.id);
  if (!entitlement || !entitlement.evidenceCurrent || entitlement.status !== "active"
    || entitlement.schoolId !== choice.schoolId || entitlement.programId !== choice.programId
    || entitlement.programIntakeId !== choice.programIntakeId
    || entitlement.admissionRouteKey !== choice.admissionRouteKey) throw conflict();
  return {
    schoolApplicationId,
    applicationChoiceId: choice.id,
    schoolId: choice.schoolId,
    programId: choice.programId,
    programIntakeId: choice.programIntakeId,
    admissionRouteKey: choice.admissionRouteKey,
    authorizationId: authorization.id,
    materialSnapshotId: snapshot.id,
    feeEntitlementId: entitlement.id,
    rankOrder: choice.rankOrder,
    requirement: { versionId: requirements.versionId, publicationRevision: requirements.publicationRevision,
      contentSha256: requirements.contentSha256 },
    policy,
  };
}

async function lockNoticeEvidence(tx: TransactionalSqlClient, authorization: AuthorizationLockRow, checkedAt: Date) {
  const rows = await tx.query(`select pub.scope_key from privacy_notice_publications pub
    join privacy_notice_versions v on v.id = pub.version_id and v.scope_key = pub.scope_key
    where pub.scope_key = $1 and pub.version_id = $2 and pub.revision = $3
      and pub.content_sha256 = $4 and pub.status = 'active' and v.review_status = 'approved'
      and v.content_sha256 = $4 and v.reviewed_at <= $5 and v.effective_from <= $5 and v.review_due_at > $5
    for share of pub,v`, [authorization.noticeScopeKey, authorization.noticeVersionId,
    authorization.noticePublicationRevision, authorization.noticeContentSha256, checkedAt]);
  if (rows.length !== 1) throw conflict();
}

async function insertProgramApplication(tx: TransactionalSqlClient, submissionId: string, userId: string,
  setId: string, cuacId: string, application: PreparedSubmissionApplication, acceptedAt: Date) {
  const policy = application.policy;
  const rows = await tx.query<{ id: string }>(`insert into school_applications
    (id,application_record_format,application_submission_id,application_set_id,cuac_id,application_choice_id,
     student_user_id,school_id,program_id,program_intake_id,admission_route_key,authorization_id,
     material_snapshot_id,fee_entitlement_id,requirement_version_id,requirement_publication_revision,
     requirement_content_sha256,policy_version_id,policy_publication_revision,policy_document_sha256,
     policy_target_set_sha256,policy_approval_sha256,status,accepted_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
      'pending_submission',$23) returning id`,
  [application.schoolApplicationId, PROGRAM_APPLICATION_FORMAT_V2, submissionId, setId, cuacId,
    application.applicationChoiceId, userId, application.schoolId, application.programId,
    application.programIntakeId, application.admissionRouteKey, application.authorizationId,
    application.materialSnapshotId, application.feeEntitlementId, application.requirement.versionId,
    application.requirement.publicationRevision, application.requirement.contentSha256, policy.versionId,
    policy.publicationRevision, policy.documentSha256, policy.targetSetSha256, policy.approvalSha256, acceptedAt]);
  if (rows.length !== 1) throw corrupt();
  await tx.query(`insert into school_application_status_events
    (school_application_id,actor_user_id,from_status,to_status,reason,metadata_json,created_at)
    values ($1,$2,null,'pending_submission','atomic_application_submission','{}'::jsonb,$3)`,
  [application.schoolApplicationId, userId, acceptedAt]);
}

async function insertOfficialSubmissionGroup(tx: TransactionalSqlClient, submissionId: string, userId: string,
  setId: string, group: ReturnType<typeof buildOfficialSubmissionGroupPlans>[number], acceptedAt: Date) {
  const policy = group.policy;
  const rows = await tx.query<{ id: string }>(`insert into official_submission_groups
    (id,application_submission_id,user_id,application_set_id,school_id,group_format,admission_route_key,
     policy_version_id,policy_document_sha256,policy_target_set_sha256,policy_approval_sha256,
     form_mode,max_program_choices,ordering_mode,external_channel_type,group_sequence,member_count,
     member_manifest_sha256,transport_status,accepted_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending',$19) returning id`,
  [group.id, submissionId, userId, setId, group.schoolId, OFFICIAL_SUBMISSION_GROUP_FORMAT,
    group.admissionRouteKey, policy.versionId, policy.documentSha256, policy.targetSetSha256,
    policy.approvalSha256, policy.rule.formMode, policy.rule.maxProgramChoices, policy.rule.orderingMode,
    policy.rule.externalChannelType, group.groupSequence, group.memberCount, group.memberManifestSha256, acceptedAt]);
  if (rows.length !== 1) throw corrupt();
  for (const member of group.members) {
    await tx.query(`insert into official_submission_group_members
      (group_id,application_submission_id,user_id,application_set_id,school_id,admission_route_key,
       policy_version_id,school_application_id,application_choice_id,program_id,program_intake_id,
       authorization_id,material_snapshot_id,fee_entitlement_id,member_position,member_manifest_sha256,created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [group.id, submissionId, userId, setId, group.schoolId, group.admissionRouteKey, policy.versionId,
      member.schoolApplicationId, member.applicationChoiceId, member.programId, member.programIntakeId,
      member.authorizationId, member.materialSnapshotId, member.feeEntitlementId,
      member.memberPosition, member.memberManifestSha256, acceptedAt]);
  }
  const outboxId = randomUUID();
  const outboxManifestSha256 = submissionSha256({
    schemaVersion: 1,
    eventType: "official_submission.dispatch_requested",
    payloadFormat: OFFICIAL_SUBMISSION_DISPATCH_FORMAT,
    outboxId,
    applicationSubmissionId: submissionId,
    officialSubmissionGroupId: group.id,
    schoolId: group.schoolId,
    groupManifestSha256: group.memberManifestSha256,
  });
  await tx.query(`insert into official_submission_outbox
    (id,group_id,application_submission_id,school_id,event_type,payload_format,manifest_sha256,
     status,attempt_count,available_at)
    values ($1,$2,$3,$4,'official_submission.dispatch_requested',$5,$6,'pending',0,$7)`,
  [outboxId, group.id, submissionId, group.schoolId, OFFICIAL_SUBMISSION_DISPATCH_FORMAT,
    outboxManifestSha256, acceptedAt]);
}

export async function readApplicationSubmission(tx: TransactionalSqlClient, userId: string,
  setId: string, submissionId: string) {
  const rows = await tx.query<StoredSubmissionRow>(`select s.id,s.application_set_id as "applicationSetId",
    a.cuac_id as "cuacId",
    source_set_revision as "sourceSetRevision",choice_count as "choiceCount",group_count as "groupCount",
    manifest_sha256 as "manifestSha256",s.status,s.submitted_at as "submittedAt"
    from application_submissions s join application_sets a on a.id = s.application_set_id
    where s.id = $3 and s.user_id = $1 and s.application_set_id = $2`,
  [userId, setId, submissionId]);
  if (!rows[0]) return null;
  const applications = await tx.query<{ id: string; applicationChoiceId: string; schoolId: string;
    programId: string; programIntakeId: string; status: string }>(`select id,
    application_choice_id as "applicationChoiceId",school_id as "schoolId",program_id as "programId",
    program_intake_id as "programIntakeId",status from school_applications
    where application_submission_id = $1 and student_user_id = $2 order by application_choice_id`,
  [submissionId, userId]);
  const groups = await tx.query<{ id: string; schoolId: string; admissionRouteKey: string; formMode: string;
    orderingMode: string; externalChannelType: string; memberCount: number; transportStatus: string }>(`select id,
    school_id as "schoolId",admission_route_key as "admissionRouteKey",form_mode as "formMode",
    ordering_mode as "orderingMode",external_channel_type as "externalChannelType",
    member_count as "memberCount",transport_status as "transportStatus"
    from official_submission_groups where application_submission_id = $1 and user_id = $2
    order by group_sequence`, [submissionId, userId]);
  const row = rows[0];
  if (row.status !== "accepted" || !(row.submittedAt instanceof Date)
    || applications.length !== row.choiceCount || groups.length !== row.groupCount
    || !/^CUAC-[0-9]{4}-[0-9]{6}$/.test(row.cuacId)
    || !/^[a-f0-9]{64}$/.test(row.manifestSha256)) throw corrupt();
  return {
    id: row.id,
    applicationSetId: row.applicationSetId,
    cuacId: row.cuacId,
    sourceRevision: row.sourceSetRevision,
    status: "accepted" as const,
    acceptanceScope: "cuac_internal" as const,
    submittedAt: row.submittedAt.toISOString(),
    manifestSha256: row.manifestSha256,
    programApplications: applications,
    officialSubmissionGroups: groups,
  };
}

async function databaseNow(tx: TransactionalSqlClient): Promise<Date> {
  const rows = await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []);
  const now = rows[0]?.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw corrupt();
  return now;
}

function requireRequestId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw corrupt();
}
