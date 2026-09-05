import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import type { SqlStudentClient } from "./postgres-repository.ts";
import { ASSESSMENT_FIELDS, MAX_ASSESSMENT_RECORDS, MAX_ASSESSMENT_REVISION, assessmentRecordData, parseUpdateAssessmentRecord,
  toAssessmentRecordDto, validateAssessmentRecord, type AssessmentHistoryDto, type AssessmentMutationResult,
  type AssessmentRecordData, type UpdateAssessmentRecordInput } from "./assessments.ts";

const recordColumns = `r.id, r.assessment_category as "assessmentCategory", r.assessment_name as "assessmentName",
  r.assessment_variant as "assessmentVariant", r.result_status as "resultStatus", r.result_form as "resultForm",
  to_char(r.test_date, 'YYYY-MM-DD') as "testDate", to_char(r.report_date, 'YYYY-MM-DD') as "reportDate", r.components_json as components`;
const conflict = () => new CuacError("CONFLICT", "Assessment history changed or cannot accept this operation. Reload its current version.", 409);
const missing = () => forbidden("Assessment record is not available to this student.");
type StoredRecord = AssessmentRecordData & { id: string; removedAt: Date | null };
const values = (record: AssessmentRecordData) => ASSESSMENT_FIELDS.map(field => field === "components" ? JSON.stringify(record.components) : record[field]);

export class PostgresAssessmentHistory {
  private readonly client: SqlStudentClient;
  constructor(client: SqlStudentClient) { this.client = client; }

  async get(userId: string): Promise<AssessmentHistoryDto> {
    const rows = await this.client.query<{ revision: number; records: StoredRecord[] }>(
      `select coalesce(h.revision, 0) as revision, coalesce((
        select jsonb_agg(to_jsonb(records) - 'createdAt' order by records."createdAt", records.id) from (
          select ${recordColumns}, r.created_at as "createdAt" from student_assessment_records r
          where r.user_id = u.id and r.removed_at is null order by r.created_at, r.id limit $2
        ) records
      ), '[]'::jsonb) as records
      from users u left join student_assessment_histories h on h.user_id = u.id
      where u.id = $1 and u.account_status = 'active'
        and exists (select 1 from user_roles where user_id = u.id and role = 'student' and revoked_at is null)`,
      [userId, MAX_ASSESSMENT_RECORDS + 1],
    );
    if (!rows[0]) throw forbidden("Active student account and role are required.");
    try {
      const { revision, records } = rows[0];
      if (!Number.isInteger(revision) || revision < 0 || revision > MAX_ASSESSMENT_REVISION || !Array.isArray(records)
        || records.length > MAX_ASSESSMENT_RECORDS || (revision === 0 && records.length !== 0)) throw new Error("Invalid collection.");
      return { revision, records: records.map(toAssessmentRecordDto) };
    } catch { throw serviceUnavailable("Assessment history requires reconciliation."); }
  }

  // The transaction factory retains account, role and collection locks through audit/COMMIT.
  private async lock(userId: string, expectedRevision: number, create: boolean): Promise<{ revision: number; created: boolean }> {
    const users = await this.client.query("select id from users where id = $1 and account_status = 'active' for share", [userId]);
    if (!users.length) throw forbidden("Active student account is required.");
    const roles = await this.client.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId]);
    if (!roles.length) throw forbidden("Active student role is required.");
    const rows = await this.client.query<{ revision: number }>("select revision from student_assessment_histories where user_id = $1 for update", [userId]);
    if (rows[0]) return { revision: rows[0].revision, created: false };
    if (!create) throw missing();
    if (expectedRevision !== 0) throw conflict();
    const inserted = await this.client.query<{ revision: number }>(
      "insert into student_assessment_histories (user_id) values ($1) on conflict (user_id) do nothing returning revision", [userId]);
    if (!inserted[0]) throw conflict();
    return { revision: 1, created: true };
  }

  private async advance(userId: string, revision: number) {
    if (revision === MAX_ASSESSMENT_REVISION) throw conflict();
    const rows = await this.client.query("update student_assessment_histories set revision = revision + 1, updated_at = clock_timestamp() where user_id = $1 and revision = $2 returning revision", [userId, revision]);
    if (rows.length !== 1) throw serviceUnavailable("Assessment version could not be updated.");
  }

  async add(userId: string, expectedRevision: number, input: AssessmentRecordData): Promise<AssessmentMutationResult> {
    const record = validateAssessmentRecord(assessmentRecordData(input));
    const state = await this.lock(userId, expectedRevision, true);
    if (!state.created && state.revision !== expectedRevision) throw conflict();
    const counts = await this.client.query<{ count: number }>("select count(*)::int as count from student_assessment_records where user_id = $1 and removed_at is null", [userId]);
    if (counts[0].count >= MAX_ASSESSMENT_RECORDS || (!state.created && state.revision === MAX_ASSESSMENT_REVISION)) throw conflict();
    const rows = await this.client.query<{ id: string }>(
      `insert into student_assessment_records (user_id, assessment_category, assessment_name, assessment_variant, result_status,
        result_form, test_date, report_date, components_json) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) returning id`,
      [userId, ...values(record)],
    );
    if (!rows[0]) throw serviceUnavailable("Assessment record could not be created.");
    if (!state.created) await this.advance(userId, state.revision);
    return { history: await this.get(userId), recordId: rows[0].id, changed: true };
  }

  async update(userId: string, recordId: string, input: UpdateAssessmentRecordInput): Promise<AssessmentMutationResult> {
    const { expectedRevision, ...fields } = parseUpdateAssessmentRecord(input);
    const state = await this.lock(userId, expectedRevision, false);
    const rows = await this.client.query<StoredRecord>(`select ${recordColumns}, r.removed_at as "removedAt" from student_assessment_records r where r.user_id = $1 and r.id = $2 for update`, [userId, recordId]);
    const current = rows[0];
    if (!current) throw missing();
    if (current.removedAt || state.revision !== expectedRevision) throw conflict();
    const currentData = validateAssessmentRecord(assessmentRecordData(current));
    const next = validateAssessmentRecord({ ...currentData, ...fields });
    const changed = ASSESSMENT_FIELDS.some(field => JSON.stringify(next[field]) !== JSON.stringify(currentData[field]));
    if (changed) {
      if (state.revision === MAX_ASSESSMENT_REVISION) throw conflict();
      const updated = await this.client.query(`update student_assessment_records set assessment_category = $3, assessment_name = $4,
        assessment_variant = $5, result_status = $6, result_form = $7, test_date = $8, report_date = $9,
        components_json = $10::jsonb, updated_at = clock_timestamp() where user_id = $1 and id = $2 returning id`, [userId, recordId, ...values(next)]);
      if (updated.length !== 1) throw serviceUnavailable("Assessment record could not be updated.");
      await this.advance(userId, state.revision);
    }
    return { history: await this.get(userId), recordId, changed };
  }

  async remove(userId: string, recordId: string, expectedRevision: number): Promise<AssessmentMutationResult> {
    const state = await this.lock(userId, expectedRevision, false);
    const rows = await this.client.query<{ removedAt: Date | null }>("select removed_at as \"removedAt\" from student_assessment_records where user_id = $1 and id = $2 for update", [userId, recordId]);
    if (!rows[0]) throw missing();
    if (state.revision !== expectedRevision) throw conflict();
    const changed = rows[0].removedAt === null;
    if (changed) {
      if (state.revision === MAX_ASSESSMENT_REVISION) throw conflict();
      const removed = await this.client.query(`update student_assessment_records set assessment_category = null, assessment_name = null,
        assessment_variant = null, result_status = null, result_form = null, test_date = null, report_date = null,
        components_json = null, removed_at = clock_timestamp(), updated_at = clock_timestamp()
        where user_id = $1 and id = $2 returning id`, [userId, recordId]);
      if (removed.length !== 1) throw serviceUnavailable("Assessment record could not be removed.");
      await this.advance(userId, state.revision);
    }
    return { history: await this.get(userId), recordId, changed };
  }
}
