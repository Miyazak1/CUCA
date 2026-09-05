import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type {
  OpsBillingEscalationCode,
  OpsBillingResolutionCode,
  OpsBillingReviewQueueRow,
  OpsBillingReviewRepository,
  OpsBillingRole,
  OpsPaymentReview,
} from "./service.ts";

type Actor = { actorUserId: string; activeRole: OpsBillingRole };

type ReviewRow = {
  reviewId: string;
  revision: number;
  status: OpsPaymentReview["status"];
  assignedUserId: string;
  assignedRole: OpsBillingRole;
  escalationCode: OpsBillingEscalationCode | null;
  escalationReference: string | null;
  escalatedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionCode: OpsBillingResolutionCode | null;
  resolutionReference: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type QueueRow = Omit<OpsBillingReviewQueueRow, "review"> & ReviewRow & { reviewId: string | null };

const reviewColumns = `
  r.id as "reviewId", r.revision, r.status, r.assigned_user_id as "assignedUserId",
  r.assigned_role as "assignedRole", r.escalation_code as "escalationCode",
  r.escalation_reference as "escalationReference", r.escalated_at as "escalatedAt",
  r.resolved_by_user_id as "resolvedByUserId", r.resolution_code as "resolutionCode",
  r.resolution_reference as "resolutionReference", r.resolved_at as "resolvedAt",
  r.created_at as "createdAt", r.updated_at as "updatedAt"`;

export class PostgresOpsBillingReviewRepository implements OpsBillingReviewRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async listQuarantinedEvents(input: Actor & { beforeEventId: string | null; limit: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      if (input.beforeEventId) {
        const cursor = await tx.query<{ id: string }>(
          "select id from payment_provider_events where id = $1 and state = 'quarantined' for share",
          [input.beforeEventId],
        );
        if (!cursor[0]) return { authorized: true, cursorFound: false, rows: [] as OpsBillingReviewQueueRow[] } as const;
      }
      const rows = await tx.query<QueueRow>(`
        select e.id as "eventId", e.provider, e.provider_event_id as "providerEventId",
          e.event_type as "eventType", e.invoice_id as "invoiceId", e.payment_id as "paymentId",
          e.amount_minor as "amountMinor", e.currency, e.occurred_at as "occurredAt",
          e.received_at as "receivedAt", e.quarantine_reason as "quarantineReason",
          e.quarantined_at as "quarantinedAt", ${reviewColumns}
        from payment_provider_events e
        left join ops_payment_event_reviews r on r.payment_provider_event_id = e.id
        where e.state = 'quarantined'
          and ($1::uuid is null or (e.quarantined_at, e.id) < (
            select c.quarantined_at, c.id from payment_provider_events c where c.id = $1 and c.state = 'quarantined'
          ))
        order by e.quarantined_at desc, e.id desc
        limit $2`, [input.beforeEventId, input.limit]);
      return { authorized: true, cursorFound: true, rows: rows.map(toQueueRow) } as const;
    });
  }

  async claimReview(input: Actor & { eventId: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`
        with database_clock as (
          select date_trunc('milliseconds', clock_timestamp()) as recorded_at
        )
        insert into ops_payment_event_reviews (
          payment_provider_event_id, assigned_user_id, assigned_grant_id, assigned_role, created_at, updated_at
        )
        select e.id, $2, $3, $4, c.recorded_at, c.recorded_at
        from payment_provider_events e cross join database_clock c
        where e.id = $1 and e.state = 'quarantined'
        on conflict (payment_provider_event_id) do nothing
        returning ${returningReviewColumns()}`, [input.eventId, input.actorUserId, authority.grantId, input.activeRole]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async escalateReview(input: Actor & { eventId: string; expectedRevision: number; code: OpsBillingEscalationCode;
    reference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`
        update ops_payment_event_reviews r set
          status = 'escalated', revision = r.revision + 1, escalation_code = $6,
          escalation_reference = $7, escalated_at = date_trunc('milliseconds', clock_timestamp()),
          updated_at = date_trunc('milliseconds', clock_timestamp())
        from payment_provider_events e
        where e.id = $1 and e.state = 'quarantined' and r.payment_provider_event_id = e.id
          and r.revision = $2 and r.status = 'investigating'
          and r.assigned_user_id = $3 and r.assigned_grant_id = $4 and r.assigned_role = $5
        returning ${returningReviewColumns("r")}`,
      [input.eventId, input.expectedRevision, input.actorUserId, authority.grantId, input.activeRole, input.code, input.reference]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }

  async resolveReview(input: Actor & { eventId: string; expectedRevision: number; code: OpsBillingResolutionCode;
    reference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<ReviewRow>(`
        update ops_payment_event_reviews r set
          status = 'resolved_no_change', revision = r.revision + 1,
          resolved_by_user_id = $3, resolved_by_grant_id = $4, resolved_by_role = $5,
          resolution_code = $6, resolution_reference = $7,
          resolved_at = date_trunc('milliseconds', clock_timestamp()),
          updated_at = date_trunc('milliseconds', clock_timestamp())
        from payment_provider_events e
        where e.id = $1 and e.state = 'quarantined' and r.payment_provider_event_id = e.id
          and r.revision = $2 and r.status in ('investigating','escalated')
          and r.assigned_user_id <> $3
        returning ${returningReviewColumns("r")}`,
      [input.eventId, input.expectedRevision, input.actorUserId, authority.grantId, input.activeRole, input.code, input.reference]);
      return { authorized: true, value: rows[0] ? toReview(rows[0]) : null } as const;
    });
  }
}

function returningReviewColumns(alias = "ops_payment_event_reviews"): string {
  return `${alias}.id as "reviewId", ${alias}.revision, ${alias}.status,
    ${alias}.assigned_user_id as "assignedUserId", ${alias}.assigned_role as "assignedRole",
    ${alias}.escalation_code as "escalationCode", ${alias}.escalation_reference as "escalationReference",
    ${alias}.escalated_at as "escalatedAt", ${alias}.resolved_by_user_id as "resolvedByUserId",
    ${alias}.resolution_code as "resolutionCode", ${alias}.resolution_reference as "resolutionReference",
    ${alias}.resolved_at as "resolvedAt", ${alias}.created_at as "createdAt", ${alias}.updated_at as "updatedAt"`;
}

function toQueueRow(row: QueueRow): OpsBillingReviewQueueRow {
  return {
    eventId: row.eventId, provider: row.provider, providerEventId: row.providerEventId, eventType: row.eventType,
    invoiceId: row.invoiceId, paymentId: row.paymentId, amountMinor: row.amountMinor, currency: row.currency,
    occurredAt: row.occurredAt, receivedAt: row.receivedAt, quarantineReason: row.quarantineReason,
    quarantinedAt: row.quarantinedAt, review: row.reviewId ? toReview(row as ReviewRow) : null,
  };
}

function toReview(row: ReviewRow): OpsPaymentReview {
  return { ...row };
}
