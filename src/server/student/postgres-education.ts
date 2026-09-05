import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import type { SqlStudentClient } from "./postgres-repository.ts";
import { EDUCATION_FIELDS, MAX_EDUCATION_RECORDS, MAX_EDUCATION_REVISION, toEducationRecordDto, validateEducationRecord,
  type EducationHistoryDto, type EducationMutationResult, type EducationRecordData, type EducationRecordDto, type UpdateEducationRecordInput } from "./education.ts";

const recordColumns = `r.id, r.institution_name as "institutionName", r.institution_country as "institutionCountry",
  r.education_level as "educationLevel", r.qualification_name as "qualificationName", r.field_of_study as "fieldOfStudy",
  r.attendance_status as "attendanceStatus", r.start_year as "startYear", r.end_year as "endYear", r.expected_completion_year as "expectedCompletionYear"`;
const conflict = () => new CuacError("CONFLICT", "Education history changed or cannot accept this operation. Reload its current version.", 409);
const missing = () => forbidden("Education record is not available to this student.");
type StoredRecord = EducationRecordDto & { removedAt: Date | null };

export class PostgresEducationHistory {
  private readonly client: SqlStudentClient;
  constructor(client: SqlStudentClient) { this.client = client; }

  async get(userId: string): Promise<EducationHistoryDto> {
    const rows = await this.client.query<{ revision: number; records: EducationRecordDto[] }>(
      `select coalesce(h.revision, 0) as revision, coalesce((
        select jsonb_agg(to_jsonb(records) - 'createdAt' order by records."createdAt", records.id) from (
          select ${recordColumns}, r.created_at as "createdAt" from student_education_records r
          where r.user_id = u.id and r.removed_at is null order by r.created_at, r.id limit $2
        ) records
      ), '[]'::jsonb) as records
      from users u left join student_education_histories h on h.user_id = u.id
      where u.id = $1 and u.account_status = 'active'
        and exists (select 1 from user_roles where user_id = u.id and role = 'student' and revoked_at is null)`,
      [userId, MAX_EDUCATION_RECORDS + 1],
    );
    if (!rows[0]) throw forbidden("Active student account and role are required.");
    if (rows[0].records.length > MAX_EDUCATION_RECORDS) throw serviceUnavailable("Education history requires reconciliation.");
    return { revision: rows[0].revision, records: rows[0].records.map(toEducationRecordDto) };
  }

  // Every mutation holds the same account, role and collection locks through audit/COMMIT.
  private async lock(userId: string, expectedRevision: number, create: boolean): Promise<{ revision: number; created: boolean }> {
    const users = await this.client.query("select id from users where id = $1 and account_status = 'active' for share", [userId]);
    if (!users.length) throw forbidden("Active student account is required.");
    const roles = await this.client.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId]);
    if (!roles.length) throw forbidden("Active student role is required.");
    const rows = await this.client.query<{ revision: number }>("select revision from student_education_histories where user_id = $1 for update", [userId]);
    if (rows[0]) return { revision: rows[0].revision, created: false };
    if (!create) throw missing();
    if (expectedRevision !== 0) throw conflict();
    const inserted = await this.client.query<{ revision: number }>(
      "insert into student_education_histories (user_id) values ($1) on conflict (user_id) do nothing returning revision", [userId]);
    if (!inserted[0]) throw conflict();
    return { revision: 1, created: true };
  }

  private async advance(userId: string, revision: number) {
    if (revision === MAX_EDUCATION_REVISION) throw conflict();
    const rows = await this.client.query("update student_education_histories set revision = revision + 1, updated_at = clock_timestamp() where user_id = $1 and revision = $2 returning revision", [userId, revision]);
    if (rows.length !== 1) throw serviceUnavailable("Education version could not be updated.");
  }

  async add(userId: string, expectedRevision: number, record: EducationRecordData): Promise<EducationMutationResult> {
    const state = await this.lock(userId, expectedRevision, true);
    if (!state.created && state.revision !== expectedRevision) throw conflict();
    const counts = await this.client.query<{ count: number }>("select count(*)::int as count from student_education_records where user_id = $1 and removed_at is null", [userId]);
    if (counts[0].count >= MAX_EDUCATION_RECORDS || (!state.created && state.revision === MAX_EDUCATION_REVISION)) throw conflict();
    const rows = await this.client.query<{ id: string }>(
      `insert into student_education_records (user_id, institution_name, institution_country, education_level, qualification_name,
       field_of_study, attendance_status, start_year, end_year, expected_completion_year)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [userId, ...EDUCATION_FIELDS.map(field => record[field])],
    );
    if (!rows[0]) throw serviceUnavailable("Education record could not be created.");
    if (!state.created) await this.advance(userId, state.revision);
    return { history: await this.get(userId), recordId: rows[0].id, changed: true };
  }

  async update(userId: string, recordId: string, input: UpdateEducationRecordInput): Promise<EducationMutationResult> {
    const state = await this.lock(userId, input.expectedRevision, false);
    const rows = await this.client.query<StoredRecord>(`select ${recordColumns}, r.removed_at as "removedAt" from student_education_records r where r.user_id = $1 and r.id = $2 for update`, [userId, recordId]);
    const current = rows[0];
    if (!current) throw missing();
    if (current.removedAt || state.revision !== input.expectedRevision) throw conflict();
    const next = validateEducationRecord({ ...toEducationRecordDto(current), ...input });
    const changed = EDUCATION_FIELDS.some(field => next[field] !== current[field]);
    if (changed) {
      if (state.revision === MAX_EDUCATION_REVISION) throw conflict();
      const updated = await this.client.query(`update student_education_records set institution_name = $3, institution_country = $4,
        education_level = $5, qualification_name = $6, field_of_study = $7, attendance_status = $8,
        start_year = $9, end_year = $10, expected_completion_year = $11, updated_at = clock_timestamp()
        where user_id = $1 and id = $2 returning id`, [userId, recordId, ...EDUCATION_FIELDS.map(field => next[field])]);
      if (updated.length !== 1) throw serviceUnavailable("Education record could not be updated.");
      await this.advance(userId, state.revision);
    }
    return { history: await this.get(userId), recordId, changed };
  }

  async remove(userId: string, recordId: string, expectedRevision: number): Promise<EducationMutationResult> {
    const state = await this.lock(userId, expectedRevision, false);
    const rows = await this.client.query<{ removedAt: Date | null }>("select removed_at as \"removedAt\" from student_education_records where user_id = $1 and id = $2 for update", [userId, recordId]);
    if (!rows[0]) throw missing();
    if (state.revision !== expectedRevision) throw conflict();
    const changed = rows[0].removedAt === null;
    if (changed) {
      if (state.revision === MAX_EDUCATION_REVISION) throw conflict();
      const removed = await this.client.query(`update student_education_records set institution_name = null, institution_country = null,
        education_level = null, qualification_name = null, field_of_study = null, attendance_status = null,
        start_year = null, end_year = null, expected_completion_year = null, removed_at = clock_timestamp(), updated_at = clock_timestamp()
        where user_id = $1 and id = $2 returning id`, [userId, recordId]);
      if (removed.length !== 1) throw serviceUnavailable("Education record could not be removed.");
      await this.advance(userId, state.revision);
    }
    return { history: await this.get(userId), recordId, changed };
  }
}
