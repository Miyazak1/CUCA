import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { APPLICANT_FIELDS, MAX_APPLICANT_REVISION, toApplicantProfileDto, type ApplicantProfileDto, type ApplicantProfileUpdate } from "./applicant-profile.ts";
import type { SqlStudentClient } from "./postgres-repository.ts";

const columns = `p.id, p.user_id as "userId", p.revision, p.full_name as "fullName",
  p.contact_email as "contactEmail", p.citizenship_country as "citizenshipCountry"`;
const conflict = () => new CuacError("CONFLICT", "Applicant profile version changed. Reload before editing.", 409);

export class PostgresApplicantProfiles {
  private readonly client: SqlStudentClient;
  constructor(client: SqlStudentClient) { this.client = client; }

  async get(userId: string): Promise<ApplicantProfileDto | null> {
    // Authority and the optional profile are observed in one statement snapshot.
    const rows = await this.client.query<ApplicantProfileDto>(
      `select ${columns} from users u
       left join student_applicant_profiles p on p.user_id = u.id
       where u.id = $1 and u.account_status = 'active'
         and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`, [userId],
    );
    if (!rows.length) throw forbidden("Active student account and role are required.");
    return rows[0].id ? toApplicantProfileDto(rows[0]) : null;
  }

  // Called only on the production factory's transaction-scoped connection.
  async update(userId: string, input: ApplicantProfileUpdate): Promise<{ profile: ApplicantProfileDto; changed: boolean }> {
    const users = await this.client.query("select id from users where id = $1 and account_status = 'active' for share", [userId]);
    if (!users.length) throw forbidden("Active student account is required.");
    const roles = await this.client.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId]);
    if (!roles.length) throw forbidden("Active student role is required.");
    const rows = await this.client.query<ApplicantProfileDto>(
      `select ${columns} from student_applicant_profiles p where p.user_id = $1 for update`, [userId],
    );
    const current = rows[0];
    if (!current) {
      if (input.expectedRevision !== 0) throw conflict();
      const created = await this.client.query<ApplicantProfileDto>(
        `insert into student_applicant_profiles as p (user_id, full_name, contact_email, citizenship_country)
         values ($1, $2, $3, $4) on conflict (user_id) do nothing returning ${columns}`,
        [userId, input.fullName ?? null, input.contactEmail ?? null, input.citizenshipCountry ?? null],
      );
      if (!created[0]) throw conflict();
      return { profile: toApplicantProfileDto(created[0]), changed: true };
    }
    if (current.revision !== input.expectedRevision) throw conflict();
    if (!APPLICANT_FIELDS.some(field => Object.hasOwn(input, field) && input[field] !== current[field])) {
      return { profile: toApplicantProfileDto(current), changed: false };
    }
    if (current.revision === MAX_APPLICANT_REVISION) throw conflict();
    const updated = await this.client.query<ApplicantProfileDto>(
      `update student_applicant_profiles as p set
       full_name = case when $5::boolean then $2::text else p.full_name end,
       contact_email = case when $6::boolean then $3::text else p.contact_email end,
       citizenship_country = case when $7::boolean then $4::text else p.citizenship_country end,
       revision = p.revision + 1, updated_at = clock_timestamp()
       where p.user_id = $1 and p.revision = $8 returning ${columns}`,
      [userId, input.fullName ?? null, input.contactEmail ?? null, input.citizenshipCountry ?? null,
        Object.hasOwn(input, "fullName"), Object.hasOwn(input, "contactEmail"), Object.hasOwn(input, "citizenshipCountry"), current.revision],
    );
    if (!updated[0]) throw serviceUnavailable("Applicant profile could not be updated.");
    return { profile: toApplicantProfileDto(updated[0]), changed: true };
  }
}
