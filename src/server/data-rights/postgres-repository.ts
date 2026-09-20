import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type { DataRightsRepository, DataRightsRequestDto } from "./service.ts";

type Row = Omit<DataRightsRequestDto, "requestId" | "receivedAt" | "identityConfirmedAt" | "closedAt" | "updatedAt"> & {
  id: string; receivedAt: Date; identityConfirmedAt: Date | null; closedAt: Date | null; updatedAt: Date;
};
const columns = `id, request_type as "requestType", correction_scope as "correctionScope", preferred_locale as "preferredLocale",
  status, revision, received_at as "receivedAt", identity_confirmed_at as "identityConfirmedAt", closed_at as "closedAt", updated_at as "updatedAt"`;

export class PostgresDataRightsRepository implements DataRightsRepository {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  private async authorize(userId: string): Promise<boolean> {
    const rows = await this.client.query(`select u.id from users u join user_roles r on r.user_id = u.id
      where u.id = $1 and u.account_status = 'active' and r.role = 'student' and r.revoked_at is null
      for share of u, r`, [userId]);
    return rows.length === 1;
  }

  async listOwn(userId: string) {
    if (!await this.authorize(userId)) return { authorized: false, rows: [] };
    const rows = await this.client.query<Row>(`select ${columns} from data_rights_requests where user_id = $1
      order by received_at desc, id desc limit 100`, [userId]);
    return { authorized: true, rows };
  }

  async createOwn(input: Parameters<DataRightsRepository["createOwn"]>[0]) {
    if (!await this.authorize(input.userId)) return { authorized: false, row: null };
    const rows = await this.client.query<Row>(`insert into data_rights_requests
      (id,user_id,subject_reference_hash,request_type,correction_scope,preferred_locale)
      values ($1,$2,$3,$4,$5,$6) on conflict do nothing returning ${columns}`,
    [input.requestId, input.userId, input.subjectReferenceHash, input.requestType, input.correctionScope, input.preferredLocale]);
    return { authorized: true, row: rows[0] ?? null };
  }

  async cancelOwn(input: Parameters<DataRightsRepository["cancelOwn"]>[0]) {
    if (!await this.authorize(input.userId)) return { authorized: false, row: null };
    const rows = await this.client.query<Row>(`update data_rights_requests set status = 'cancelled', revision = revision + 1,
      closed_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = $1 and user_id = $2 and revision = $3 and status = 'received' returning ${columns}`,
    [input.requestId, input.userId, input.expectedRevision]);
    return { authorized: true, row: rows[0] ?? null };
  }
}
