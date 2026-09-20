import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type { AccountDeletionExecution, AccountDeletionExecutionRepository } from "./service.ts";

type Actor = { actorUserId: string; activeRole: "cuac_ops" | "cuac_admin" };
type Row = Omit<AccountDeletionExecution, "blockerCodes" | "latestLegalHoldReview"> & {
  blockerCodes: AccountDeletionExecution["blockerCodes"];
  reviewId: string | null; reviewVersion: number | null; sourceExecutionRevision: number | null;
  legalHoldResult: "clear_candidate" | "blocked" | null;
  legalHoldReasonCode: "no_hold_found" | "legal_hold" | "fraud_or_security" | "financial_record" | null;
  legalHoldCaseReference: string | null; reviewedByUserId: string | null; reviewedAt: Date | null;
};

const projection = `select x.id as "executionId",x.data_rights_request_id as "dataRightsRequestId",
  x.status,x.blocker_codes_json as "blockerCodes",x.revision,x.prepared_at as "preparedAt",x.updated_at as "updatedAt",
  x.quarantined_at as "quarantinedAt",x.purge_after as "purgeAfter",
  h.id as "reviewId",h.version as "reviewVersion",h.source_execution_revision as "sourceExecutionRevision",
  h.result as "legalHoldResult",h.reason_code as "legalHoldReasonCode",h.case_reference as "legalHoldCaseReference",
  h.reviewed_by_user_id as "reviewedByUserId",h.reviewed_at as "reviewedAt"
  from account_deletion_executions x
  left join lateral (select r.* from account_deletion_legal_hold_reviews r where r.execution_id=x.id
    order by r.version desc,r.id desc limit 1) h on true`;

export class PostgresAccountDeletionExecutionRepository implements AccountDeletionExecutionRepository {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  async list(input: Actor & { limit: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<Row>(`${projection}
        where x.status in ('review_required','blocked','quarantined','purge_ready')
        order by x.prepared_at,x.id limit $1`, [input.limit]);
      return { authorized: true, value: rows.map(mapRow) } as const;
    });
  }

  async refresh(input: Actor & { executionId: string; expectedRevision: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const changed = await tx.query<{ id: string }>(`with target as (
          select x.id,x.user_id from account_deletion_executions x
          where x.id=$1 and x.revision=$2 and x.status in ('review_required','blocked') for update
        ), facts as (
          select t.id,to_jsonb(array_remove(array[
            'legal_hold_review_required','backup_tombstone_required',
            case when exists (select 1 from student_file_assets f where f.user_id=t.user_id and f.status<>'deleted')
              then 'private_object_cleanup_required' end,
            case when exists (select 1 from invoices i where i.user_id=t.user_id)
              or exists (select 1 from payments p where p.user_id=t.user_id)
              or exists (select 1 from application_fee_entitlements e where e.user_id=t.user_id)
              then 'financial_record_review_required' end,
            case when exists (select 1 from application_submissions s where s.user_id=t.user_id)
              or exists (select 1 from application_submission_authorizations a where a.user_id=t.user_id)
              or exists (select 1 from application_material_snapshots m where m.user_id=t.user_id)
              then 'application_evidence_review_required' end,
            case when exists (select 1 from school_applications a where a.student_user_id=t.user_id)
              then 'school_handoff_review_required' end,
            case when not exists (select 1 from user_roles r where r.user_id=t.user_id and r.role='student' and r.revoked_at is null)
              or exists (select 1 from user_roles r where r.user_id=t.user_id and r.role<>'student' and r.revoked_at is null)
              then 'privileged_role_review_required' end,
            case when exists (select 1 from student_age_assurances a where a.user_id=t.user_id and a.age_band='under_14')
              then 'minor_evidence_review_required' end
          ]::text[],null)) blockers,
          coalesce((select r.result='blocked' from account_deletion_legal_hold_reviews r
            where r.execution_id=t.id order by r.version desc,r.id desc limit 1),false) legal_blocked
          from target t
        ) update account_deletion_executions x set blocker_codes_json=f.blockers,
          status=case when f.legal_blocked then 'blocked' else 'review_required' end,
          revision=x.revision+1,updated_at=clock_timestamp() from facts f where x.id=f.id returning x.id`,
      [input.executionId, input.expectedRevision]);
      if (changed.length === 0) return { authorized: true, value: null } as const;
      return { authorized: true, value: await load(tx, input.executionId) } as const;
    });
  }

  async recordLegalHoldReview(input: Actor & { executionId: string; reviewId: string; expectedRevision: number;
    result: "clear_candidate" | "blocked"; reasonCode: "no_hold_found" | "legal_hold" | "fraud_or_security" | "financial_record";
    caseReference: string }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<{ id: string }>(`with target as (
          select x.id,x.revision from account_deletion_executions x
          where x.id=$1 and x.revision=$2 and x.status in ('review_required','blocked') for update
        ), inserted as (
          insert into account_deletion_legal_hold_reviews
            (id,execution_id,version,source_execution_revision,result,reason_code,case_reference,
              reviewed_by_user_id,reviewed_by_grant_id,reviewed_by_role)
          select $3,t.id,coalesce((select max(r.version)+1 from account_deletion_legal_hold_reviews r
            where r.execution_id=t.id),1),t.revision,$4,$5,$6,$7,$8,$9 from target t
          on conflict do nothing returning execution_id
        ) update account_deletion_executions x set status=case when $4='blocked' then 'blocked' else 'review_required' end,
          revision=x.revision+1,updated_at=clock_timestamp() from inserted i where x.id=i.execution_id returning x.id`,
      [input.executionId, input.expectedRevision, input.reviewId, input.result, input.reasonCode,
        input.caseReference, input.actorUserId, authority.grantId, input.activeRole]);
      if (rows.length === 0) return { authorized: true, value: null } as const;
      return { authorized: true, value: await load(tx, input.executionId) } as const;
    });
  }

  async quarantine(input: Actor & { executionId: string; quarantineId: string; expectedRevision: number;
    tombstone: { receiptSha256: string; recordedAt: Date } }) {
    return this.client.transaction(async tx => {
      const authority = await lockLiveCuacStaffAuthority(tx, input);
      if (!authority) return { authorized: false } as const;
      const rows = await tx.query<{ id: string }>(`with target as (
          select x.id,x.user_id,x.revision,h.id legal_review_id,clock_timestamp() quarantined_at
          from account_deletion_executions x join users u on u.id=x.user_id and u.account_status='active'
          join lateral (select r.* from account_deletion_legal_hold_reviews r where r.execution_id=x.id
            order by r.version desc,r.id desc limit 1) h on true
          where x.id=$1 and x.revision=$2 and x.status='review_required'
            and jsonb_array_length(x.blocker_codes_json)=2
            and x.blocker_codes_json @> '["legal_hold_review_required","backup_tombstone_required"]'::jsonb
            and h.result='clear_candidate' and h.reason_code='no_hold_found'
            and h.source_execution_revision+1=x.revision
            and $4::timestamptz>=x.prepared_at and $4::timestamptz<=clock_timestamp()
            and not exists (select 1 from account_deletion_quarantine_receipts q where q.execution_id=x.id)
          for update of x,u
        ), revoked as (
          update auth_sessions s set revoked_at=coalesce(s.revoked_at,t.quarantined_at),step_up_expires_at=null
          from target t where s.user_id=t.user_id and s.revoked_at is null returning s.id
        ), disabled as (
          update users u set account_status='deletion_quarantined',updated_at=t.quarantined_at
          from target t cross join (select count(*) from revoked) r where u.id=t.user_id returning t.*
        ), advanced as (
          update account_deletion_executions x set status='quarantined',blocker_codes_json='[]'::jsonb,
            revision=x.revision+1,quarantined_at=d.quarantined_at,purge_after=d.quarantined_at+interval '30 days',
            updated_at=d.quarantined_at from disabled d where x.id=d.id returning x.*,d.legal_review_id
        ), receipt as (
          insert into account_deletion_quarantine_receipts
            (id,execution_id,source_execution_revision,legal_hold_review_id,backup_tombstone_receipt_sha256,
              backup_tombstone_recorded_at,approved_by_user_id,approved_by_grant_id,approved_by_role,
              quarantined_at,purge_after,created_at)
          select $3,a.id,$2,a.legal_review_id,$5,$4,$6,$7,$8,a.quarantined_at,a.purge_after,a.quarantined_at
          from advanced a returning execution_id
        ) select execution_id id from receipt`, [input.executionId, input.expectedRevision, input.quarantineId,
        input.tombstone.recordedAt, input.tombstone.receiptSha256, input.actorUserId, authority.grantId, input.activeRole]);
      if (rows.length === 0) return { authorized: true, value: null } as const;
      return { authorized: true, value: await load(tx, input.executionId) } as const;
    });
  }
}

async function load(client: TransactionalSqlClient, id: string) {
  const rows = await client.query<Row>(`${projection} where x.id=$1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}
function mapRow(row: Row): AccountDeletionExecution {
  return { executionId: row.executionId, dataRightsRequestId: row.dataRightsRequestId, status: row.status,
    blockerCodes: row.blockerCodes, revision: row.revision, preparedAt: row.preparedAt, updatedAt: row.updatedAt,
    quarantinedAt: row.quarantinedAt, purgeAfter: row.purgeAfter,
    latestLegalHoldReview: row.reviewId ? { reviewId: row.reviewId, version: row.reviewVersion!,
      sourceExecutionRevision: row.sourceExecutionRevision!, result: row.legalHoldResult!,
      reasonCode: row.legalHoldReasonCode!, caseReference: row.legalHoldCaseReference!,
      reviewedByUserId: row.reviewedByUserId!, reviewedAt: row.reviewedAt! } : null };
}
