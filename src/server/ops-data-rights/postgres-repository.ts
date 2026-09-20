import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type { OpsDataRightsQueueRow, OpsDataRightsRepository, OpsDataRightsReview } from "./service.ts";

const reviewColumns = `r.id as "reviewId",r.revision as "reviewRevision",r.status as "reviewStatus",
 r.assigned_user_id as "assignedUserId",r.assigned_role as "assignedRole",r.escalation_code as "escalationCode",
 r.escalation_reference as "escalationReference",r.escalated_at as "escalatedAt",r.created_at as "reviewCreatedAt",r.updated_at as "reviewUpdatedAt"`;
type Row = Omit<OpsDataRightsQueueRow, "review"> & { reviewId: string | null; reviewRevision: number | null;
  reviewStatus: OpsDataRightsReview["status"] | null; assignedUserId: string | null; assignedRole: "cuac_ops" | "cuac_admin" | null;
  escalationCode: string | null; escalationReference: string | null; escalatedAt: Date | null;
  reviewCreatedAt: Date | null; reviewUpdatedAt: Date | null };
const requestColumns = `q.id as "requestId",q.request_type as "requestType",q.correction_scope as "correctionScope",
 q.preferred_locale as "preferredLocale",q.status,q.revision,q.received_at as "receivedAt",q.updated_at as "updatedAt"`;
export class PostgresOpsDataRightsRepository implements OpsDataRightsRepository {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }
  async list(input: Parameters<OpsDataRightsRepository["list"]>[0]) { return this.client.transaction(async tx => {
    if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
    const rows = await tx.query<Row>(`select ${requestColumns},${reviewColumns} from data_rights_requests q
      left join ops_data_rights_reviews r on r.data_rights_request_id=q.id
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
  private async read(tx: TransactionalSqlClient, requestId: string) {
    const rows = await tx.query<Row>(`select ${requestColumns},${reviewColumns} from data_rights_requests q
      left join ops_data_rights_reviews r on r.data_rights_request_id=q.id where q.id=$1`, [requestId]); return rows[0] ? mapRow(rows[0]) : null;
  }
}
function mapRow(row: Row): OpsDataRightsQueueRow { return { requestId: row.requestId,requestType: row.requestType,
  correctionScope: row.correctionScope,preferredLocale: row.preferredLocale,status: row.status,revision: row.revision,
  receivedAt: row.receivedAt,updatedAt: row.updatedAt,review: row.reviewId ? { reviewId: row.reviewId,revision: row.reviewRevision!,
    status: row.reviewStatus!,assignedUserId: row.assignedUserId!,assignedRole: row.assignedRole!,escalationCode: row.escalationCode,
    escalationReference: row.escalationReference,escalatedAt: row.escalatedAt,createdAt: row.reviewCreatedAt!,updatedAt: row.reviewUpdatedAt! } : null }; }
