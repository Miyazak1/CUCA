import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type { OpsDataRightsOutcome, OpsDataRightsQueueRow, OpsDataRightsRepository, OpsDataRightsReview } from "./service.ts";

const reviewColumns = `r.id as "reviewId",r.revision as "reviewRevision",r.status as "reviewStatus",
 r.assigned_user_id as "assignedUserId",r.assigned_role as "assignedRole",r.escalation_code as "escalationCode",
 r.escalation_reference as "escalationReference",r.escalated_at as "escalatedAt",r.created_at as "reviewCreatedAt",r.updated_at as "reviewUpdatedAt"`;
type Row = Omit<OpsDataRightsQueueRow, "review" | "outcome"> & { reviewId: string | null; reviewRevision: number | null;
  reviewStatus: OpsDataRightsReview["status"] | null; assignedUserId: string | null; assignedRole: "cuac_ops" | "cuac_admin" | null;
  escalationCode: string | null; escalationReference: string | null; escalatedAt: Date | null;
  reviewCreatedAt: Date | null; reviewUpdatedAt: Date | null; outcomeId:string|null;outcomeCode:OpsDataRightsOutcome["outcomeCode"]|null;
  reasonCode:string|null;caseReference:string|null;proposalSha256:string|null;approvalMode:OpsDataRightsOutcome["approvalMode"]|null;
  outcomeStatus:OpsDataRightsOutcome["status"]|null;outcomeRevision:number|null;proposedByUserId:string|null;
  proposedByRole:"cuac_ops"|"cuac_admin"|null;approvedByUserId:string|null;approvedAt:Date|null;outcomeCreatedAt:Date|null;outcomeUpdatedAt:Date|null };
const requestColumns = `q.id as "requestId",q.request_type as "requestType",q.correction_scope as "correctionScope",
 q.preferred_locale as "preferredLocale",q.status,q.revision,q.received_at as "receivedAt",q.updated_at as "updatedAt"`;
const outcomeColumns=`o.id as "outcomeId",o.outcome_code as "outcomeCode",o.reason_code as "reasonCode",o.case_reference as "caseReference",
 o.proposal_sha256 as "proposalSha256",o.approval_mode as "approvalMode",o.status as "outcomeStatus",o.revision as "outcomeRevision",
 o.proposed_by_user_id as "proposedByUserId",o.proposed_by_role as "proposedByRole",o.approved_by_user_id as "approvedByUserId",
 o.approved_at as "approvedAt",o.created_at as "outcomeCreatedAt",o.updated_at as "outcomeUpdatedAt"`;
export class PostgresOpsDataRightsRepository implements OpsDataRightsRepository {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }
  async list(input: Parameters<OpsDataRightsRepository["list"]>[0]) { return this.client.transaction(async tx => {
    if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
    const rows = await tx.query<Row>(`select ${requestColumns},${reviewColumns},${outcomeColumns} from data_rights_requests q
      left join ops_data_rights_reviews r on r.data_rights_request_id=q.id
      left join ops_data_rights_outcomes o on o.data_rights_request_id=q.id
      where q.status in ('received','identity_confirmed','in_progress','escalated')
      order by q.received_at,q.id limit $1`, [input.limit]);
    return { authorized: true, value: rows.map(mapRow) } as const;
  }); }
  async claim(input: Parameters<OpsDataRightsRepository["claim"]>[0]) { return this.client.transaction(async tx => {
    const authority = await lockLiveCuacStaffAuthority(tx, input); if (!authority) return { authorized: false } as const;
    const requests = await tx.query<{ revision: number }>(`update data_rights_requests set status='in_progress',revision=revision+1,
      assigned_user_id=$3,updated_at=clock_timestamp() where id=$1 and revision=$2 and status='received' returning revision`,
    [input.requestId,input.expectedRevision,input.actorUserId]);
    if (!requests[0]) return { authorized: true, value: null } as const;
    await tx.query(`insert into ops_data_rights_reviews
      (data_rights_request_id,source_request_revision,assigned_user_id,assigned_grant_id,assigned_role)
      values ($1,$2,$3,$4,$5)`, [input.requestId,requests[0].revision,input.actorUserId,authority.grantId,input.activeRole]);
    return { authorized: true, value: await this.read(tx,input.requestId) } as const;
  }); }
  async escalate(input: Parameters<OpsDataRightsRepository["escalate"]>[0]) { return this.client.transaction(async tx => {
    const authority = await lockLiveCuacStaffAuthority(tx, input); if (!authority) return { authorized: false } as const;
    const rows = await tx.query(`update ops_data_rights_reviews r set status='escalated',revision=2,escalation_code=$6,
      escalation_reference=$7,escalated_at=clock_timestamp(),updated_at=clock_timestamp()
      from data_rights_requests q where r.data_rights_request_id=$1 and q.id=r.data_rights_request_id
      and q.status='in_progress' and q.revision=$2 and r.revision=$3 and r.status='investigating'
      and r.assigned_user_id=$4 and r.assigned_grant_id=$5 returning r.id`,
    [input.requestId,input.expectedRevision,input.expectedReviewRevision,input.actorUserId,authority.grantId,input.code,input.reference]);
    if (!rows[0]) return { authorized: true, value: null } as const;
    await tx.query(`update data_rights_requests set status='escalated',revision=revision+1,updated_at=clock_timestamp()
      where id=$1 and revision=$2 and status='in_progress'`, [input.requestId,input.expectedRevision]);
    return { authorized: true, value: await this.read(tx,input.requestId) } as const;
  }); }
  async propose(input:Parameters<OpsDataRightsRepository["propose"]>[0]){return this.client.transaction(async tx=>{
    const authority=await lockLiveCuacStaffAuthority(tx,input);if(!authority)return{authorized:false}as const;
    const compatible=`(($8::text='access_ready' and q.request_type='access') or ($8::text='correction_ready' and q.request_type='correction')
      or ($8::text='portable_export_ready' and q.request_type='portable_export') or ($8::text='account_deletion_ready' and q.request_type='account_deletion')
      or $8::text in ('request_denied','retention_exception'))`;
    const rows=await tx.query(`insert into ops_data_rights_outcomes
      (id,data_rights_request_id,review_id,source_request_revision,source_review_revision,outcome_code,reason_code,case_reference,
       proposal_sha256,approval_mode,status,proposed_by_user_id,proposed_by_grant_id,proposed_by_role,
       approved_by_user_id,approved_by_grant_id,approved_by_role,approved_at)
      select $1::uuid,q.id,r.id,q.revision,r.revision,$8::text,$9::text,$10::text,$11::text,$12::text,case when $12::text='dual_control' then 'proposed' else 'approved' end,
       $4::uuid,$5::uuid,$6::text,case when $12::text='dual_control' then null else $4::uuid end,case when $12::text='dual_control' then null else $5::uuid end,
       case when $12::text='dual_control' then null else $6::text end,case when $12::text='dual_control' then null else clock_timestamp() end
      from data_rights_requests q join ops_data_rights_reviews r on r.data_rights_request_id=q.id
      where q.id=$2::uuid and q.revision=$3 and q.status in ('in_progress','escalated') and r.revision=$7
        and r.assigned_user_id=$4::uuid and r.assigned_grant_id=$5::uuid and ${compatible}
      on conflict do nothing returning id`,[input.proposalId,input.requestId,input.expectedRevision,input.actorUserId,authority.grantId,input.activeRole,
      input.expectedReviewRevision,input.outcomeCode,input.reasonCode,input.caseReference,input.proposalSha256,input.approvalMode]);
    if(!rows[0])return{authorized:true,value:null}as const;return{authorized:true,value:await this.read(tx,input.requestId)}as const;
  });}
  async approve(input:Parameters<OpsDataRightsRepository["approve"]>[0]){return this.client.transaction(async tx=>{
    if(input.activeRole!=="cuac_admin")return{authorized:false}as const;
    const authority=await lockLiveCuacStaffAuthority(tx,input);if(!authority)return{authorized:false}as const;
    const rows=await tx.query(`update ops_data_rights_outcomes o set status='approved',revision=2,approved_by_user_id=$4,
      approved_by_grant_id=$5,approved_by_role=$6,approved_at=clock_timestamp(),updated_at=clock_timestamp()
      from data_rights_requests q where o.data_rights_request_id=$1::uuid and q.id=o.data_rights_request_id
      and o.status='proposed' and o.approval_mode='dual_control' and o.revision=$2 and o.proposal_sha256=$3
      and o.proposed_by_user_id<>$4::uuid and q.revision=o.source_request_revision returning o.id`,
    [input.requestId,input.expectedOutcomeRevision,input.expectedProposalSha256,input.actorUserId,authority.grantId,input.activeRole]);
    if(!rows[0])return{authorized:true,value:null}as const;return{authorized:true,value:await this.read(tx,input.requestId)}as const;
  });}
  private async read(tx: TransactionalSqlClient, requestId: string) {
    const rows = await tx.query<Row>(`select ${requestColumns},${reviewColumns},${outcomeColumns} from data_rights_requests q
      left join ops_data_rights_reviews r on r.data_rights_request_id=q.id
      left join ops_data_rights_outcomes o on o.data_rights_request_id=q.id where q.id=$1`, [requestId]); return rows[0] ? mapRow(rows[0]) : null;
  }
}
function mapRow(row: Row): OpsDataRightsQueueRow { return { requestId: row.requestId,requestType: row.requestType,
  correctionScope: row.correctionScope,preferredLocale: row.preferredLocale,status: row.status,revision: row.revision,
  receivedAt: row.receivedAt,updatedAt: row.updatedAt,review: row.reviewId ? { reviewId: row.reviewId,revision: row.reviewRevision!,
    status: row.reviewStatus!,assignedUserId: row.assignedUserId!,assignedRole: row.assignedRole!,escalationCode: row.escalationCode,
    escalationReference: row.escalationReference,escalatedAt: row.escalatedAt,createdAt: row.reviewCreatedAt!,updatedAt: row.reviewUpdatedAt! } : null,
  outcome:row.outcomeId?{outcomeId:row.outcomeId,outcomeCode:row.outcomeCode!,reasonCode:row.reasonCode,
    caseReference:row.caseReference!,proposalSha256:row.proposalSha256!,approvalMode:row.approvalMode!,status:row.outcomeStatus!,
    revision:row.outcomeRevision!,proposedByUserId:row.proposedByUserId!,proposedByRole:row.proposedByRole!,approvedByUserId:row.approvedByUserId,
    approvedAt:row.approvedAt,createdAt:row.outcomeCreatedAt!,updatedAt:row.outcomeUpdatedAt!}:null }; }
