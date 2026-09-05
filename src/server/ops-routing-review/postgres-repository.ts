import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import {
  OPS_ROUTING_RETRY_CODE,
  type OpsRoutingCloseCode,
  type OpsRoutingErrorCode,
  type OpsRoutingEscalationCode,
  type OpsRoutingOutcome,
  type OpsRoutingQueueRow,
  type OpsRoutingReview,
  type OpsRoutingReviewRepository,
  type OpsRoutingRole,
} from "./service.ts";

type Actor = { actorUserId: string; activeRole: OpsRoutingRole };

type ReviewRow = {
  reviewId: string;
  sourceOutcome: OpsRoutingOutcome;
  sourceErrorCode: OpsRoutingErrorCode;
  sourceAttemptCount: number;
  sourceQuarantinedAt: Date;
  revision: number;
  status: OpsRoutingReview["status"];
  assignedUserId: string;
  assignedRole: OpsRoutingRole;
  escalationCode: OpsRoutingEscalationCode | null;
  escalationReference: string | null;
  escalatedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionCode: OpsRoutingReview["resolutionCode"];
  resolutionReference: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type QueueRow = Omit<OpsRoutingQueueRow, "review"> & Omit<ReviewRow, "reviewId"> & { reviewId: string | null };
type RetrySource = { groupId: string };

const reviewColumns = `
  r.id as "reviewId", r.source_outcome as "sourceOutcome", r.source_error_code as "sourceErrorCode",
  r.source_attempt_count as "sourceAttemptCount", r.source_quarantined_at as "sourceQuarantinedAt",
  r.revision, r.status, r.assigned_user_id as "assignedUserId", r.assigned_role as "assignedRole",
  r.escalation_code as "escalationCode", r.escalation_reference as "escalationReference",
  r.escalated_at as "escalatedAt", r.resolved_by_user_id as "resolvedByUserId",
  r.resolution_code as "resolutionCode", r.resolution_reference as "resolutionReference",
  r.resolved_at as "resolvedAt", r.created_at as "createdAt", r.updated_at as "updatedAt"`;

export class PostgresOpsRoutingReviewRepository implements OpsRoutingReviewRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async listQuarantinedDeliveries(input: Actor & { beforeOutboxId: string | null; limit: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      if (input.beforeOutboxId) {
        const cursor = await tx.query<{ id: string }>(`select o.id from official_submission_outbox o
          join official_submission_groups g on g.id = o.group_id
          where o.id = $1 and o.status = 'quarantined' and g.transport_status = 'quarantined' for share of o`,
        [input.beforeOutboxId]);
        if (!cursor[0]) return { authorized: true, cursorFound: false, rows: [] as OpsRoutingQueueRow[] } as const;
      }
      const rows = await tx.query<QueueRow>(`
        select o.id as "outboxId", o.group_id as "groupId", o.school_id as "schoolId",
          s.name_en as "schoolNameEn", g.admission_route_key as "admissionRouteKey",
          g.external_channel_type as "externalChannelType", g.member_count as "memberCount",
          o.attempt_count as "attemptCount", o.outcome, o.last_error_code as "errorCode",
          o.quarantined_at as "quarantinedAt",
          (o.outcome = 'attempt_limit' and o.last_error_code = 'ATTEMPT_LIMIT' and o.attempt_count = 5
            and (r.id is null or r.status in ('investigating','escalated'))
            and not exists (select 1 from ops_submission_delivery_reviews prior
              where prior.official_submission_outbox_id = o.id and prior.status = 'retry_approved')) as "retryEligible",
          ${reviewColumns}
        from official_submission_outbox o
        join official_submission_groups g on g.id = o.group_id and g.application_submission_id = o.application_submission_id
          and g.school_id = o.school_id and g.transport_status = 'quarantined'
        join schools s on s.id = o.school_id
        left join ops_submission_delivery_reviews r on r.official_submission_outbox_id = o.id
          and r.source_outcome = o.outcome and r.source_error_code = o.last_error_code
          and r.source_attempt_count = o.attempt_count and r.source_quarantined_at = o.quarantined_at
        where o.status = 'quarantined'
          and ($1::uuid is null or (o.quarantined_at, o.id) < (
            select c.quarantined_at, c.id from official_submission_outbox c where c.id = $1 and c.status = 'quarantined'
          ))
        order by o.quarantined_at desc, o.id desc limit $2`, [input.beforeOutboxId, input.limit]);
      return { authorized: true, cursorFound: true, rows: rows.map(toQueueRow) } as const;
    });
  }

  async claimReview(input: Actor & { outboxId: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`
        with database_clock as (select clock_timestamp() as recorded_at)
        insert into ops_submission_delivery_reviews (
          official_submission_outbox_id, source_outcome, source_error_code, source_attempt_count,
          source_quarantined_at, assigned_user_id, assigned_grant_id, assigned_role, created_at, updated_at
        )
        select o.id, o.outcome, o.last_error_code, o.attempt_count, o.quarantined_at,
          $2, $3, $4, c.recorded_at, c.recorded_at
        from official_submission_outbox o
        join official_submission_groups g on g.id = o.group_id and g.transport_status = 'quarantined'
        cross join database_clock c
        where o.id = $1 and o.status = 'quarantined'
          and ((o.outcome = 'attempt_limit' and o.last_error_code = 'ATTEMPT_LIMIT' and o.attempt_count = 5)
            or (o.outcome = 'invalid_payload' and o.last_error_code in ('INVALID_PAYLOAD','DELIVERY_BINDING_CHANGED'))
            or (o.outcome = 'unknown' and o.last_error_code in (
              'PROVIDER_RESULT_UNKNOWN','PROVIDER_RECEIPT_TIME_INVALID','SENDING_LEASE_EXPIRED')))
        on conflict (official_submission_outbox_id, source_quarantined_at) do nothing
        returning ${returningReviewColumns()}`, [input.outboxId, input.actorUserId, authority.grantId, input.activeRole]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async escalateReview(input: Actor & { outboxId: string; expectedRevision: number; code: OpsRoutingEscalationCode;
    reference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`
        update ops_submission_delivery_reviews r set status = 'escalated', revision = r.revision + 1,
          escalation_code = $6, escalation_reference = $7, escalated_at = clock_timestamp(),
          updated_at = clock_timestamp()
        from official_submission_outbox o, official_submission_groups g
        where o.id = $1 and o.status = 'quarantined' and g.id = o.group_id
          and g.transport_status = 'quarantined' and r.official_submission_outbox_id = o.id
          and r.source_outcome = o.outcome and r.source_error_code = o.last_error_code
          and r.source_attempt_count = o.attempt_count and r.source_quarantined_at = o.quarantined_at
          and r.revision = $2 and r.status = 'investigating'
          and r.assigned_user_id = $3 and r.assigned_grant_id = $4 and r.assigned_role = $5
        returning ${returningReviewColumns("r")}`,
      [input.outboxId, input.expectedRevision, input.actorUserId, authority.grantId,
        input.activeRole, input.code, input.reference]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async closeReview(input: Actor & { outboxId: string; expectedRevision: number; code: OpsRoutingCloseCode;
    reference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`
        update ops_submission_delivery_reviews r set status = 'closed_no_retry', revision = r.revision + 1,
          resolved_by_user_id = $3, resolved_by_grant_id = $4, resolved_by_role = $5,
          resolution_code = $6, resolution_reference = $7, resolved_at = clock_timestamp(),
          updated_at = clock_timestamp()
        from official_submission_outbox o, official_submission_groups g
        where o.id = $1 and o.status = 'quarantined' and g.id = o.group_id
          and g.transport_status = 'quarantined' and r.official_submission_outbox_id = o.id
          and r.source_outcome = o.outcome and r.source_error_code = o.last_error_code
          and r.source_attempt_count = o.attempt_count and r.source_quarantined_at = o.quarantined_at
          and r.revision = $2 and r.status in ('investigating','escalated') and r.assigned_user_id <> $3
        returning ${returningReviewColumns("r")}`,
      [input.outboxId, input.expectedRevision, input.actorUserId, authority.grantId,
        input.activeRole, input.code, input.reference]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async approveRetry(input: Actor & { outboxId: string; expectedRevision: number;
    code: typeof OPS_ROUTING_RETRY_CODE; reference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const sources = await tx.query<RetrySource>(`select o.group_id as "groupId"
        from official_submission_outbox o where o.id = $1 and o.status = 'quarantined'
          and o.outcome = 'attempt_limit' and o.last_error_code = 'ATTEMPT_LIMIT' and o.attempt_count = 5
          and o.provider_name is not null and o.payload_sha256 is not null
          and not exists (select 1 from official_submission_delivery_receipts d where d.outbox_id = o.id)
          and not exists (select 1 from ops_submission_delivery_reviews prior
            where prior.official_submission_outbox_id = o.id and prior.status = 'retry_approved')
        for update of o`, [input.outboxId]);
      const source = sources[0];
      if (!source) return { authorized: true, value: null } as const;
      const groups = await tx.query<{ id: string }>(`select id from official_submission_groups
        where id = $1 and transport_status = 'quarantined' for update`, [source.groupId]);
      if (!groups[0]) throw corrupt();
      const rows = await tx.query<ReviewRow>(`
        update ops_submission_delivery_reviews r set status = 'retry_approved', revision = r.revision + 1,
          resolved_by_user_id = $3, resolved_by_grant_id = $4, resolved_by_role = $5,
          resolution_code = $6, resolution_reference = $7, resolved_at = clock_timestamp(),
          updated_at = clock_timestamp()
        from official_submission_outbox o
        where o.id = $1 and o.status = 'quarantined'
          and o.outcome = 'attempt_limit' and o.last_error_code = 'ATTEMPT_LIMIT' and o.attempt_count = 5
          and r.official_submission_outbox_id = o.id and r.revision = $2
          and r.status in ('investigating','escalated') and r.assigned_user_id <> $3
          and r.source_outcome = o.outcome and r.source_error_code = o.last_error_code
          and r.source_attempt_count = o.attempt_count and r.source_quarantined_at = o.quarantined_at
        returning ${returningReviewColumns("r")}`,
      [input.outboxId, input.expectedRevision, input.actorUserId, authority.grantId, input.activeRole,
        input.code, input.reference]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const outbox = await tx.query<{ id: string }>(`update official_submission_outbox set status = 'pending',
        attempt_count = 0, available_at = clock_timestamp(), outcome = 'not_accepted',
        last_error_code = 'OPS_RETRY_APPROVED', completed_at = null, quarantined_at = null,
        updated_at = clock_timestamp() where id = $1 and status = 'quarantined'
          and outcome = 'attempt_limit' and last_error_code = 'ATTEMPT_LIMIT' and attempt_count = 5 returning id`,
      [input.outboxId]);
      const group = await tx.query<{ id: string }>(`update official_submission_groups set transport_status = 'pending',
        updated_at = clock_timestamp() where id = $1 and transport_status = 'quarantined' returning id`, [source.groupId]);
      if (!outbox[0] || !group[0]) throw corrupt();
      return { authorized: true, value: toReview(rows[0]) } as const;
    });
  }
}

function returningReviewColumns(alias = "ops_submission_delivery_reviews"): string {
  return `${alias}.id as "reviewId", ${alias}.source_outcome as "sourceOutcome",
    ${alias}.source_error_code as "sourceErrorCode", ${alias}.source_attempt_count as "sourceAttemptCount",
    ${alias}.source_quarantined_at as "sourceQuarantinedAt", ${alias}.revision, ${alias}.status,
    ${alias}.assigned_user_id as "assignedUserId", ${alias}.assigned_role as "assignedRole",
    ${alias}.escalation_code as "escalationCode", ${alias}.escalation_reference as "escalationReference",
    ${alias}.escalated_at as "escalatedAt", ${alias}.resolved_by_user_id as "resolvedByUserId",
    ${alias}.resolution_code as "resolutionCode", ${alias}.resolution_reference as "resolutionReference",
    ${alias}.resolved_at as "resolvedAt", ${alias}.created_at as "createdAt", ${alias}.updated_at as "updatedAt"`;
}

function toQueueRow(row: QueueRow): OpsRoutingQueueRow {
  return {
    outboxId: row.outboxId, groupId: row.groupId, schoolId: row.schoolId, schoolNameEn: row.schoolNameEn,
    admissionRouteKey: row.admissionRouteKey, externalChannelType: row.externalChannelType,
    memberCount: row.memberCount, attemptCount: row.attemptCount, outcome: row.outcome,
    errorCode: row.errorCode, quarantinedAt: row.quarantinedAt, retryEligible: row.retryEligible,
    review: row.reviewId ? toReview(row as ReviewRow) : null,
  };
}

function toReview(row: ReviewRow): OpsRoutingReview {
  return { ...row };
}

function corrupt() {
  return serviceUnavailable("Official submission routing state requires reconciliation.");
}
