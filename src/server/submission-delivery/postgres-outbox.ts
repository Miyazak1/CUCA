import { randomUUID } from "node:crypto";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import {
  ApplicationMaterialSnapshotCipher,
  ApplicationMaterialSnapshotEnvelopeError,
} from "../student/application-material-snapshot-envelope.ts";
import {
  APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
  APPLICATION_MATERIAL_SNAPSHOT_SCHEME,
  parseApplicationMaterialSnapshotPayload,
  type ApplicationMaterialSnapshotBinding,
} from "../student/application-material-snapshot.ts";
import {
  OFFICIAL_SUBMISSION_DISPATCH_FORMAT,
  OFFICIAL_SUBMISSION_GROUP_FORMAT,
  PROGRAM_APPLICATION_FORMAT_V2,
  submissionSha256,
} from "../student/application-submission.ts";
import {
  createOfficialSubmissionPackage,
  validateOfficialSubmissionDeliveryResult,
  validateOfficialSubmissionProviderName,
  type OfficialSubmissionDeliveryResult,
  type PreparedOfficialSubmissionPackage,
} from "./contract.ts";

export type OfficialSubmissionLease = {
  id: string;
  groupId: string;
  applicationSubmissionId: string;
  schoolId: string;
  leaseToken: string;
};

export type PreparedOfficialSubmissionDelivery = OfficialSubmissionLease & PreparedOfficialSubmissionPackage;

type LockedJob = OfficialSubmissionLease & {
  status: string;
  eventType: string;
  payloadFormat: string;
  manifestSha256: string;
  attemptCount: number;
  providerName: string | null;
  payloadSha256: string | null;
  leaseValid: boolean;
  userId: string;
  applicationSetId: string;
  groupFormat: string;
  admissionRouteKey: string;
  policyVersionId: string;
  policyDocumentSha256: string;
  policyTargetSetSha256: string;
  policyApprovalSha256: string;
  formMode: "one_program_per_form" | "multi_program_form";
  maxProgramChoices: number;
  orderingMode: "none" | "ranked";
  externalChannelType: "university_portal" | "approved_manual_handoff";
  memberCount: number;
  memberManifestSha256: string;
  groupStatus: string;
  acceptedAt: Date;
};

type MemberRow = {
  schoolApplicationId: string;
  applicationChoiceId: string;
  programId: string;
  programIntakeId: string;
  authorizationId: string;
  materialSnapshotId: string;
  feeEntitlementId: string;
  memberPosition: number;
  memberManifestSha256: string;
  applicationRecordFormat: string;
  applicationStatus: string;
  applicationSubmittedAt: Date | null;
  schoolRevision: number;
  snapshotUserId: string;
  snapshotApplicationSetId: string;
  snapshotChoiceId: string;
  snapshotSchoolId: string;
  snapshotProgramId: string;
  snapshotProgramIntakeId: string;
  snapshotAuthorizationId: string;
  authorizationScopeSha256: string;
  materialContentSha256: string;
  payloadSha256: string;
  payloadBytes: number;
  snapshotPayloadFormat: string;
  encryptionScheme: string;
  encryptionKeyId: string;
  envelope: unknown;
  capturedAt: Date;
};

const MAX_ATTEMPTS = 5;

export class PostgresOfficialSubmissionOutbox {
  private readonly client: TransactionalSqlClient;
  private readonly cipher: ApplicationMaterialSnapshotCipher;

  constructor(client: TransactionalSqlClient, cipher: ApplicationMaterialSnapshotCipher) {
    this.client = client;
    this.cipher = cipher;
  }

  async claim(): Promise<OfficialSubmissionLease | null> {
    const leaseToken = randomUUID();
    return this.client.transaction(async tx => {
      const rows = await tx.query<OfficialSubmissionLease>(`with candidate as (
        select o.id from official_submission_outbox o
        join official_submission_groups g on g.id = o.group_id and g.application_submission_id = o.application_submission_id
          and g.school_id = o.school_id
        where o.status = 'pending' and o.available_at <= clock_timestamp() and o.attempt_count < 5
          and g.transport_status = 'pending'
        order by o.available_at, o.id limit 1 for update of o skip locked
      ) update official_submission_outbox o set status = 'leased', lease_token = $1,
        leased_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '120 seconds',
        updated_at = clock_timestamp()
        from candidate c where o.id = c.id
        returning o.id, o.group_id as "groupId", o.application_submission_id as "applicationSubmissionId",
          o.school_id as "schoolId", o.lease_token as "leaseToken"`, [leaseToken]);
      const lease = rows[0];
      if (!lease) return null;
      const group = await tx.query<{ id: string }>(`update official_submission_groups set transport_status = 'leased',
        updated_at = clock_timestamp() where id = $1 and application_submission_id = $2 and school_id = $3
          and transport_status = 'pending' returning id`, [lease.groupId, lease.applicationSubmissionId, lease.schoolId]);
      if (group.length !== 1) throw corrupt();
      await audit(tx, lease.id, "leased", lease, { attemptCount: null, outcome: null });
      return lease;
    });
  }

  async prepare(lease: OfficialSubmissionLease, providerValue: unknown): Promise<PreparedOfficialSubmissionDelivery | null> {
    const providerName = validateOfficialSubmissionProviderName(providerValue);
    validateLease(lease);
    return this.client.transaction(async tx => {
      const job = await lockJob(tx, lease, "leased");
      if (!job) return null;
      if (job.attemptCount >= MAX_ATTEMPTS) {
        await quarantine(tx, job, "attempt_limit", "ATTEMPT_LIMIT");
        return null;
      }
      let prepared: PreparedOfficialSubmissionPackage;
      try {
        prepared = await buildPackage(tx, this.cipher, job);
      } catch (error) {
        if (error instanceof ApplicationMaterialSnapshotEnvelopeError && error.reason === "key_unavailable") throw error;
        await quarantine(tx, job, "invalid_payload", "INVALID_PAYLOAD");
        return null;
      }
      if ((job.providerName !== null && job.providerName !== providerName)
        || (job.payloadSha256 !== null && job.payloadSha256 !== prepared.payloadSha256)) {
        await quarantine(tx, job, "invalid_payload", "DELIVERY_BINDING_CHANGED");
        return null;
      }
      const updated = await tx.query<{ id: string }>(`update official_submission_outbox set status = 'sending',
        attempt_count = attempt_count + 1, provider_name = $2, payload_sha256 = $3, outcome = null,
        last_error_code = null, updated_at = clock_timestamp()
        where id = $1 and status = 'leased' and lease_token = $4 and lease_expires_at > clock_timestamp()
        returning id`, [job.id, providerName, prepared.payloadSha256, lease.leaseToken]);
      if (updated.length !== 1) return null;
      await audit(tx, job.id, "sending", job, { attemptCount: job.attemptCount + 1,
        outcome: null, providerName, payloadSha256: prepared.payloadSha256 });
      return { ...lease, ...prepared };
    });
  }

  async finish(lease: OfficialSubmissionLease, resultValue: OfficialSubmissionDeliveryResult): Promise<boolean> {
    validateLease(lease);
    return this.client.transaction(async tx => {
      const job = await lockJob(tx, lease, "sending");
      if (!job || !job.providerName || !job.payloadSha256) return false;
      const result = validateOfficialSubmissionDeliveryResult(resultValue,
        { providerName: job.providerName, payloadSha256: job.payloadSha256 });
      if (result.status === "unknown") {
        await quarantine(tx, job, "unknown", "PROVIDER_RESULT_UNKNOWN");
        return true;
      }
      if (result.status === "not_accepted") {
        if (job.attemptCount >= MAX_ATTEMPTS) await quarantine(tx, job, "attempt_limit", "ATTEMPT_LIMIT");
        else await retry(tx, job);
        return true;
      }
      const now = await databaseNow(tx);
      if (result.receivedAt.getTime() > now.getTime() + 5 * 60_000
        || result.receivedAt.getTime() < job.acceptedAt.getTime() - 5 * 60_000) {
        await quarantine(tx, job, "unknown", "PROVIDER_RECEIPT_TIME_INVALID");
        return true;
      }
      const receiptId = randomUUID();
      await tx.query(`insert into official_submission_delivery_receipts
        (id,outbox_id,group_id,application_submission_id,school_id,provider_name,provider_receipt_id,
         provider_received_at,confirmed_at,payload_sha256,manifest_sha256,created_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$9)`,
      [receiptId, job.id, job.groupId, job.applicationSubmissionId, job.schoolId, result.providerName,
        result.receiptId, result.receivedAt, now, result.payloadSha256, job.manifestSha256]);
      const applications = await tx.query<{ id: string }>(`update school_applications sa set status = 'new',
        submitted_at = $2, status_changed_at = $2, updated_at = $2
        from official_submission_group_members m
        where m.group_id = $1 and m.school_application_id = sa.id and m.school_id = sa.school_id
          and sa.application_record_format = 'cuac.program-application.v2'
          and sa.status = 'pending_submission' and sa.submitted_at is null and sa.school_revision = 1
        returning sa.id`, [job.groupId, now]);
      if (applications.length !== job.memberCount) throw corrupt();
      for (const application of applications) {
        await tx.query(`insert into school_application_status_events
          (school_application_id,actor_user_id,from_status,to_status,reason,application_revision,
           command_key_hash,request_hash,metadata_json,created_at)
          values ($1,null,'pending_submission','new',null,1,null,null,$2::jsonb,$3)`,
        [application.id, JSON.stringify({ source: "official_submission_delivery", deliveryReceiptId: receiptId }), now]);
      }
      const outbox = await tx.query<{ id: string }>(`update official_submission_outbox set status = 'dispatched',
        outcome = 'accepted', provider_receipt_id = $2, provider_received_at = $3, completed_at = $4,
        dispatched_at = $4, lease_token = null, leased_at = null, lease_expires_at = null,
        last_error_code = null, updated_at = $4 where id = $1 and status = 'sending' returning id`,
      [job.id, result.receiptId, result.receivedAt, now]);
      const group = await tx.query<{ id: string }>(`update official_submission_groups set transport_status = 'dispatched',
        updated_at = $2 where id = $1 and transport_status = 'leased' returning id`, [job.groupId, now]);
      if (outbox.length !== 1 || group.length !== 1) throw corrupt();
      await audit(tx, job.id, "dispatched", job, { attemptCount: job.attemptCount, outcome: "accepted",
        providerName: result.providerName, payloadSha256: result.payloadSha256, applicationCount: applications.length });
      return true;
    });
  }

  async recover(limit = 100): Promise<{ recovered: number; quarantined: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw corrupt();
    return this.client.transaction(async tx => {
      const jobs = await tx.query<LockedJob>(`${jobProjection}
        where (o.status in ('leased','sending') and o.lease_expires_at <= clock_timestamp())
          or (o.status = 'pending' and o.attempt_count >= 5)
        order by o.updated_at, o.id limit $1 for update of o skip locked`, [limit]);
      let quarantined = 0;
      for (const job of jobs) {
        await tx.query("select id from official_submission_groups where id = $1 for update", [job.groupId]);
        if (job.status === "sending") {
          await quarantine(tx, job, "unknown", "SENDING_LEASE_EXPIRED");
          quarantined += 1;
        } else if (job.attemptCount >= MAX_ATTEMPTS) {
          await quarantine(tx, job, "attempt_limit", "ATTEMPT_LIMIT");
          quarantined += 1;
        } else {
          const outbox = await tx.query<{ id: string }>(`update official_submission_outbox set status = 'pending',
            lease_token = null, leased_at = null, lease_expires_at = null, outcome = 'lease_expired',
            last_error_code = 'LEASE_EXPIRED', available_at = clock_timestamp(), updated_at = clock_timestamp()
            where id = $1 and status = 'leased' returning id`, [job.id]);
          const group = await tx.query<{ id: string }>(`update official_submission_groups set transport_status = 'pending',
            updated_at = clock_timestamp() where id = $1 and transport_status = 'leased' returning id`, [job.groupId]);
          if (outbox.length !== 1 || group.length !== 1) throw corrupt();
          await audit(tx, job.id, "recovered", job, { attemptCount: job.attemptCount, outcome: "lease_expired" });
        }
      }
      return { recovered: jobs.length, quarantined };
    });
  }
}

async function lockJob(tx: TransactionalSqlClient, lease: OfficialSubmissionLease, status: "leased" | "sending") {
  const rows = await tx.query<LockedJob>(`${jobProjection}
    where o.id = $1 and o.group_id = $2 and o.application_submission_id = $3 and o.school_id = $4
      and o.lease_token = $5 and o.status = $6 and o.lease_expires_at > clock_timestamp()
    for update of o,g`, [lease.id, lease.groupId, lease.applicationSubmissionId, lease.schoolId, lease.leaseToken, status]);
  return rows[0] ?? null;
}

const jobProjection = `select o.id, o.group_id as "groupId", o.application_submission_id as "applicationSubmissionId",
  o.school_id as "schoolId", o.lease_token as "leaseToken", o.status, o.event_type as "eventType",
  o.payload_format as "payloadFormat", o.manifest_sha256 as "manifestSha256", o.attempt_count as "attemptCount",
  o.provider_name as "providerName", o.payload_sha256 as "payloadSha256",
  o.lease_expires_at > clock_timestamp() as "leaseValid", g.user_id as "userId",
  g.application_set_id as "applicationSetId", g.group_format as "groupFormat",
  g.admission_route_key as "admissionRouteKey", g.policy_version_id as "policyVersionId",
  g.policy_document_sha256 as "policyDocumentSha256", g.policy_target_set_sha256 as "policyTargetSetSha256",
  g.policy_approval_sha256 as "policyApprovalSha256", g.form_mode as "formMode",
  g.max_program_choices as "maxProgramChoices", g.ordering_mode as "orderingMode",
  g.external_channel_type as "externalChannelType", g.member_count as "memberCount",
  g.member_manifest_sha256 as "memberManifestSha256", g.transport_status as "groupStatus",
  g.accepted_at as "acceptedAt"
  from official_submission_outbox o join official_submission_groups g
    on g.id = o.group_id and g.application_submission_id = o.application_submission_id and g.school_id = o.school_id`;

async function buildPackage(tx: TransactionalSqlClient, cipher: ApplicationMaterialSnapshotCipher, job: LockedJob) {
  if (!job.leaseValid || job.groupStatus !== "leased" || job.groupFormat !== OFFICIAL_SUBMISSION_GROUP_FORMAT
    || job.eventType !== "official_submission.dispatch_requested" || job.payloadFormat !== OFFICIAL_SUBMISSION_DISPATCH_FORMAT
    || !validDate(job.acceptedAt)) throw corrupt();
  const expectedOutboxManifest = submissionSha256({
    schemaVersion: 1,
    eventType: "official_submission.dispatch_requested",
    payloadFormat: OFFICIAL_SUBMISSION_DISPATCH_FORMAT,
    outboxId: job.id,
    applicationSubmissionId: job.applicationSubmissionId,
    officialSubmissionGroupId: job.groupId,
    schoolId: job.schoolId,
    groupManifestSha256: job.memberManifestSha256,
  });
  if (expectedOutboxManifest !== job.manifestSha256) throw corrupt();
  const rows = await tx.query<MemberRow>(`select m.school_application_id as "schoolApplicationId",
    m.application_choice_id as "applicationChoiceId", m.program_id as "programId",
    m.program_intake_id as "programIntakeId", m.authorization_id as "authorizationId",
    m.material_snapshot_id as "materialSnapshotId", m.fee_entitlement_id as "feeEntitlementId",
    m.member_position as "memberPosition", m.member_manifest_sha256 as "memberManifestSha256",
    sa.application_record_format as "applicationRecordFormat", sa.status as "applicationStatus",
    sa.submitted_at as "applicationSubmittedAt", sa.school_revision as "schoolRevision",
    s.user_id as "snapshotUserId", s.application_set_id as "snapshotApplicationSetId",
    s.application_choice_id as "snapshotChoiceId", s.school_id as "snapshotSchoolId",
    s.program_id as "snapshotProgramId", s.program_intake_id as "snapshotProgramIntakeId",
    s.authorization_id as "snapshotAuthorizationId", s.authorization_scope_sha256 as "authorizationScopeSha256",
    s.material_content_sha256 as "materialContentSha256", s.payload_sha256 as "payloadSha256",
    s.payload_bytes as "payloadBytes", s.payload_format as "snapshotPayloadFormat",
    s.encryption_scheme as "encryptionScheme", s.encryption_key_id as "encryptionKeyId",
    s.envelope_json as envelope, s.captured_at as "capturedAt"
    from official_submission_group_members m
    join school_applications sa on sa.id = m.school_application_id and sa.application_submission_id = m.application_submission_id
      and sa.student_user_id = m.user_id and sa.application_set_id = m.application_set_id and sa.school_id = m.school_id
    join application_material_snapshots s on s.id = m.material_snapshot_id and s.user_id = m.user_id
      and s.application_set_id = m.application_set_id and s.application_choice_id = m.application_choice_id
      and s.school_id = m.school_id and s.program_id = m.program_id and s.program_intake_id = m.program_intake_id
      and s.authorization_id = m.authorization_id
    where m.group_id = $1 and m.application_submission_id = $2 and m.school_id = $3
    order by m.member_position`, [job.groupId, job.applicationSubmissionId, job.schoolId]);
  if (rows.length !== job.memberCount) throw corrupt();
  const memberDigests: Array<{ position: number; sha256: string }> = [];
  const members = [];
  for (const [index, row] of rows.entries()) {
    const position = index + 1;
    if (row.memberPosition !== position || row.applicationRecordFormat !== PROGRAM_APPLICATION_FORMAT_V2
      || row.applicationStatus !== "pending_submission" || row.applicationSubmittedAt !== null || row.schoolRevision !== 1
      || row.snapshotUserId !== job.userId || row.snapshotApplicationSetId !== job.applicationSetId
      || row.snapshotChoiceId !== row.applicationChoiceId || row.snapshotSchoolId !== job.schoolId
      || row.snapshotProgramId !== row.programId || row.snapshotProgramIntakeId !== row.programIntakeId
      || row.snapshotAuthorizationId !== row.authorizationId || row.snapshotPayloadFormat !== APPLICATION_MATERIAL_SNAPSHOT_FORMAT
      || row.encryptionScheme !== APPLICATION_MATERIAL_SNAPSHOT_SCHEME || !validDate(row.capturedAt)
      || !row.envelope || typeof row.envelope !== "object" || Array.isArray(row.envelope)
      || (row.envelope as Record<string, unknown>).keyId !== row.encryptionKeyId) throw corrupt();
    const memberManifestSha256 = submissionSha256({
      schemaVersion: 1,
      applicationSubmissionId: job.applicationSubmissionId,
      officialSubmissionGroupId: job.groupId,
      memberPosition: position,
      schoolApplicationId: row.schoolApplicationId,
      applicationChoiceId: row.applicationChoiceId,
      schoolId: job.schoolId,
      programId: row.programId,
      programIntakeId: row.programIntakeId,
      admissionRouteKey: job.admissionRouteKey,
      policyVersionId: job.policyVersionId,
      authorizationId: row.authorizationId,
      materialSnapshotId: row.materialSnapshotId,
      feeEntitlementId: row.feeEntitlementId,
    });
    if (memberManifestSha256 !== row.memberManifestSha256) throw corrupt();
    memberDigests.push({ position, sha256: memberManifestSha256 });
    const binding: ApplicationMaterialSnapshotBinding = {
      snapshotId: row.materialSnapshotId,
      userId: row.snapshotUserId,
      applicationSetId: row.snapshotApplicationSetId,
      choiceId: row.snapshotChoiceId,
      schoolId: row.snapshotSchoolId,
      programId: row.snapshotProgramId,
      programIntakeId: row.snapshotProgramIntakeId,
      authorizationId: row.snapshotAuthorizationId,
      authorizationScopeSha256: row.authorizationScopeSha256,
      materialContentSha256: row.materialContentSha256,
      payloadSha256: row.payloadSha256,
      payloadFormat: APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
      capturedAt: row.capturedAt,
    };
    const plaintext = cipher.open(binding, row.envelope);
    if (Buffer.byteLength(plaintext, "utf8") !== row.payloadBytes) throw corrupt();
    const snapshot = parseApplicationMaterialSnapshotPayload(plaintext, {
      ownerUserId: job.userId,
      authorizationId: row.authorizationId,
      authorizationScopeSha256: row.authorizationScopeSha256,
      materialContentSha256: row.materialContentSha256,
      payloadSha256: row.payloadSha256,
      target: { applicationSetId: job.applicationSetId, choiceId: row.applicationChoiceId,
        schoolId: job.schoolId, programId: row.programId, programIntakeId: row.programIntakeId },
    });
    members.push({ position, schoolApplicationId: row.schoolApplicationId, programId: row.programId,
      programIntakeId: row.programIntakeId, materialContentSha256: row.materialContentSha256,
      content: snapshot.content });
  }
  const rule = { formMode: job.formMode, maxProgramChoices: job.maxProgramChoices,
    orderingMode: job.orderingMode, externalChannelType: job.externalChannelType };
  const groupManifest = submissionSha256({
    schemaVersion: 1,
    applicationSubmissionId: job.applicationSubmissionId,
    officialSubmissionGroupId: job.groupId,
    schoolId: job.schoolId,
    admissionRouteKey: job.admissionRouteKey,
    policyVersionId: job.policyVersionId,
    policyDocumentSha256: job.policyDocumentSha256,
    policyTargetSetSha256: job.policyTargetSetSha256,
    policyApprovalSha256: job.policyApprovalSha256,
    rule,
    members: memberDigests,
  });
  if (groupManifest !== job.memberManifestSha256) throw corrupt();
  return createOfficialSubmissionPackage({
    outboxId: job.id,
    groupId: job.groupId,
    applicationSubmissionId: job.applicationSubmissionId,
    schoolId: job.schoolId,
    admissionRouteKey: job.admissionRouteKey,
    externalChannelType: job.externalChannelType,
    memberManifestSha256: job.memberManifestSha256,
    members,
  });
}

async function retry(tx: TransactionalSqlClient, job: LockedJob) {
  const delaySeconds = 60 * 2 ** (job.attemptCount - 1);
  const outbox = await tx.query<{ id: string }>(`update official_submission_outbox set status = 'pending',
    lease_token = null, leased_at = null, lease_expires_at = null, outcome = 'not_accepted',
    last_error_code = 'PROVIDER_NOT_ACCEPTED', available_at = clock_timestamp() + $2 * interval '1 second',
    updated_at = clock_timestamp() where id = $1 and status = 'sending' returning id`, [job.id, delaySeconds]);
  const group = await tx.query<{ id: string }>(`update official_submission_groups set transport_status = 'pending',
    updated_at = clock_timestamp() where id = $1 and transport_status = 'leased' returning id`, [job.groupId]);
  if (outbox.length !== 1 || group.length !== 1) throw corrupt();
  await audit(tx, job.id, "retry", job, { attemptCount: job.attemptCount, outcome: "not_accepted" });
}

async function quarantine(tx: TransactionalSqlClient, job: LockedJob,
  outcome: "unknown" | "invalid_payload" | "attempt_limit", errorCode: string) {
  const outbox = await tx.query<{ id: string }>(`update official_submission_outbox set status = 'quarantined',
    lease_token = null, leased_at = null, lease_expires_at = null, outcome = $2, last_error_code = $3,
    quarantined_at = clock_timestamp(), completed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = $1 and status in ('pending','leased','sending') returning id`, [job.id, outcome, errorCode]);
  const group = await tx.query<{ id: string }>(`update official_submission_groups set transport_status = 'quarantined',
    updated_at = clock_timestamp() where id = $1 and transport_status in ('pending','leased') returning id`, [job.groupId]);
  if (outbox.length !== 1 || group.length !== 1) throw corrupt();
  await audit(tx, job.id, "quarantined", job, { attemptCount: job.attemptCount, outcome, errorCode });
}

async function audit(tx: TransactionalSqlClient, resourceId: string, transition: string,
  scope: Pick<OfficialSubmissionLease, "groupId" | "applicationSubmissionId" | "schoolId">,
  metadata: Record<string, unknown>) {
  await tx.query(`insert into audit_logs
    (request_id,actor_type,active_role,action,resource_type,resource_id,allowed,data_classes,redaction_applied,metadata_json)
    values ($1,'service','system',$2,'official_submission_outbox',$3,true,
      '["student_pii","education_record","tenant_confidential"]'::jsonb,true,$4::jsonb)`,
  [randomUUID(), `official_submission.delivery.${transition}`, resourceId, JSON.stringify({
    groupId: scope.groupId,
    applicationSubmissionId: scope.applicationSubmissionId,
    schoolId: scope.schoolId,
    ...metadata,
  })]);
}

async function databaseNow(tx: TransactionalSqlClient): Promise<Date> {
  const rows = await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []);
  if (rows.length !== 1 || !validDate(rows[0].now)) throw corrupt();
  return rows[0].now;
}

function validateLease(lease: OfficialSubmissionLease) {
  for (const value of [lease.id, lease.groupId, lease.applicationSubmissionId, lease.schoolId, lease.leaseToken]) inputUuid(value);
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function corrupt() {
  return serviceUnavailable("Official submission delivery state requires reconciliation.");
}
