import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type {
  OpsOperationsMetricRow,
  OpsOperationsMonitoringRepository,
  ReadOpsOperationsSummaryResult,
} from "./service.ts";

export class PostgresOpsOperationsMonitoringRepository implements OpsOperationsMonitoringRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async readOperationsSummary(input: {
    actorUserId: string;
    activeRole: "cuac_ops" | "cuac_admin";
  }): Promise<ReadOpsOperationsSummaryResult> {
    return this.client.transaction(async (client) => {
      if (!await lockLiveCuacStaffAuthority(client, input)) return { authorized: false };
      const rows = await client.query<OpsOperationsMetricRow>(OPERATIONS_SUMMARY_SQL, []);
      return { authorized: true, rows };
    });
  }
}

const OPERATIONS_SUMMARY_SQL = `with clock as materialized (
  select clock_timestamp() as generated_at, clock_timestamp() - interval '24 hours' as exception_window_started_at
), metrics as (
  select 1 as ordinal, 'auth_email_delivery'::text as queue_key,
    count(*) filter (where o.status = 'queued' and o.available_at <= c.generated_at)::integer as due_count,
    count(*) filter (where o.status in ('leased','sending') and o.lease_expires_at > c.generated_at)::integer as in_flight_count,
    count(*) filter (where o.status in ('leased','sending') and o.lease_expires_at <= c.generated_at)::integer as expired_lease_count,
    count(*) filter (where o.status in ('failed','uncertain') and o.completed_at >= c.exception_window_started_at)::integer as exceptions_last_24_hours,
    min(o.available_at) filter (where o.status = 'queued' and o.available_at <= c.generated_at) as oldest_due_at
  from auth_email_outbox o cross join clock c
  union all
  select 2, 'notification_delivery',
    count(*) filter (where d.channel in ('email','sms') and d.status = 'queued' and d.available_at <= c.generated_at)::integer,
    count(*) filter (where d.channel in ('email','sms') and d.status in ('leased','sending') and d.lease_expires_at > c.generated_at)::integer,
    count(*) filter (where d.channel in ('email','sms') and d.status in ('leased','sending') and d.lease_expires_at <= c.generated_at)::integer,
    count(*) filter (where d.channel in ('email','sms') and d.status in ('failed','uncertain') and d.completed_at >= c.exception_window_started_at)::integer,
    min(d.available_at) filter (where d.channel in ('email','sms') and d.status = 'queued' and d.available_at <= c.generated_at)
  from notification_deliveries d cross join clock c
  union all
  select 3, 'student_file_processing',
    count(*) filter (where f.status in ('pending_scan','delete_pending') and f.available_at <= c.generated_at)::integer,
    count(*) filter (where f.status in ('scanning','deleting') and f.lease_expires_at > c.generated_at)::integer,
    count(*) filter (where f.status in ('scanning','deleting') and f.lease_expires_at <= c.generated_at)::integer,
    count(*) filter (where f.scan_outcome in ('malware','integrity_mismatch','scan_error') and f.updated_at >= c.exception_window_started_at)::integer,
    min(f.available_at) filter (where f.status in ('pending_scan','delete_pending') and f.available_at <= c.generated_at)
  from student_file_assets f cross join clock c
  union all
  select 4, 'official_submission_delivery',
    count(*) filter (where o.status = 'pending' and o.available_at <= c.generated_at)::integer,
    count(*) filter (where o.status in ('leased','sending') and o.lease_expires_at > c.generated_at)::integer,
    count(*) filter (where o.status in ('leased','sending') and o.lease_expires_at <= c.generated_at)::integer,
    count(*) filter (where o.status = 'quarantined' and o.completed_at >= c.exception_window_started_at)::integer,
    min(o.available_at) filter (where o.status = 'pending' and o.available_at <= c.generated_at)
  from official_submission_outbox o cross join clock c
  union all
  select 5, 'payment_reconciliation',
    count(*) filter (where p.state = 'pending' and p.next_attempt_at <= c.generated_at)::integer,
    0::integer,
    0::integer,
    count(*) filter (where p.state = 'quarantined' and p.quarantined_at >= c.exception_window_started_at)::integer,
    min(p.next_attempt_at) filter (where p.state = 'pending' and p.next_attempt_at <= c.generated_at)
  from payment_provider_events p cross join clock c
)
select m.queue_key as "queueKey", c.generated_at as "generatedAt",
  c.exception_window_started_at as "exceptionWindowStartedAt", m.due_count as "dueCount",
  m.in_flight_count as "inFlightCount", m.expired_lease_count as "expiredLeaseCount",
  m.exceptions_last_24_hours as "exceptionsLast24Hours", m.oldest_due_at as "oldestDueAt"
from metrics m cross join clock c order by m.ordinal`;
