import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import type { EducationRecordDto } from "./education.ts";
import type { AssessmentRecordDto } from "./assessments.ts";
import { buildMaterialPreview, MATERIAL_VERSION_FIELDS, MAX_MATERIAL_PREVIEW_BYTES, parseMaterialPreview,
  type MaterialTarget, type MaterialVersions } from "./application-material-preview.ts";
import type { MaterialSelection } from "./material-selection.ts";

type Scope = Omit<MaterialTarget, "programId" | "programIntakeId"> & {
  programId: string | null; programIntakeId: string | null; checkedAt: Date; editable: boolean;
  applicationSet: number; applicant: number; education: number; assessments: number;
  fullName: string | null; contactEmail: string | null; citizenshipCountry: string | null;
};
const missing = () => forbidden("Application material selection is not available to this student.");
const conflict = () => new CuacError("CONFLICT", "Application material versions or target changed. Reload before reviewing.", 409);

export class PostgresApplicationMaterialPreview {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  async preview(context: RequestContext, applicationSetId: unknown, choiceId: unknown, value: unknown) {
    const decision = evaluatePolicy(context, "student.preview_application_materials", { type: "student", ownerUserId: context.actorUserId,
      dataClasses: ["student_pii", "education_record"] });
    if (!decision.allowed) throw forbidden(decision.reason);
    const userId = inputUuid(context.actorUserId), setId = inputUuid(applicationSetId), id = inputUuid(choiceId), input = parseMaterialPreview(value);
    return this.client.transaction(async tx => {
      await tx.query("set transaction isolation level repeatable read, read only", []);
      const rows = await tx.query<Scope>(`select a.id as "applicationSetId", c.id as "choiceId", c.school_id as "schoolId",
        p.id as "programId", pi.id as "programIntakeId", date_trunc('milliseconds', statement_timestamp()) as "checkedAt",
        (a.status = 'draft' and a.locked_at is null and a.submitted_at is null and c.status = 'draft'
          and not exists (select 1 from school_applications sa where sa.application_choice_id = c.id)) as editable,
        a.revision as "applicationSet", coalesce(ap.revision, 0) as applicant,
        coalesce(e.revision, 0) as education, coalesce(h.revision, 0) as assessments,
        case when 'fullName' = any($4::text[]) then ap.full_name else null end as "fullName",
        case when 'contactEmail' = any($4::text[]) then ap.contact_email else null end as "contactEmail",
        case when 'citizenshipCountry' = any($4::text[]) then ap.citizenship_country else null end as "citizenshipCountry"
        from users u join application_sets a on a.user_id = u.id
        join application_choices c on c.application_set_id = a.id and c.user_id = u.id and c.removed_at is null
        left join programs p on p.id = c.program_id and p.school_id = c.school_id
        left join program_intakes pi on pi.id = c.program_intake_id and pi.program_id = p.id
        left join student_applicant_profiles ap on ap.user_id = u.id
        left join student_education_histories e on e.user_id = u.id
        left join student_assessment_histories h on h.user_id = u.id
        where u.id = $1 and a.id = $2 and c.id = $3 and u.account_status = 'active'
          and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`,
      [userId, setId, id, input.selection.applicantFields]);
      if (!rows.length) throw missing();
      if (rows.length !== 1) throw serviceUnavailable("Application material scope requires reconciliation.");
      const scope = rows[0];
      try {
        for (const field of MATERIAL_VERSION_FIELDS) inputInteger(scope[field], field, field === "applicationSet" ? 1 : 0, MAX_APPLICANT_REVISION);
        if (typeof scope.editable !== "boolean") throw new Error("Invalid stored state.");
      } catch { throw serviceUnavailable("Application material versions require reconciliation."); }
      if (!scope.editable || !scope.programId || !scope.programIntakeId
        || MATERIAL_VERSION_FIELDS.some(field => scope[field] !== input.expectedVersions[field])) throw conflict();
      const { education, assessments } = await loadMaterialPreviewRecords(tx, userId, input.selection);
      return buildMaterialPreview(userId, { applicationSetId: scope.applicationSetId, choiceId: scope.choiceId, schoolId: scope.schoolId,
        programId: scope.programId, programIntakeId: scope.programIntakeId }, scope.checkedAt,
      { ...input, expectedVersions: Object.fromEntries(MATERIAL_VERSION_FIELDS.map(field => [field, scope[field]])) as MaterialVersions },
      { applicant: { fullName: scope.fullName, contactEmail: scope.contactEmail, citizenshipCountry: scope.citizenshipCountry }, education, assessments });
    });
  }
}

export async function loadMaterialPreviewRecords(tx: TransactionalSqlClient, userId: string, selection: MaterialSelection) {
  const load = async <T>(statement: string, ids: string[]): Promise<T[]> => {
    if (!ids.length) return [];
    const result = await tx.query<{ records: T[] | null }>(statement, [userId, ids, MAX_MATERIAL_PREVIEW_BYTES]);
    if (result.length !== 1 || !Array.isArray(result[0].records)) throw serviceUnavailable("Application material records require reconciliation.");
    if (result[0].records.length !== ids.length) throw missing();
    return result[0].records;
  };
  const education = await load<EducationRecordDto>(`with selected as (
    select r.id, r.institution_name as "institutionName", r.institution_country as "institutionCountry", r.education_level as "educationLevel",
      r.qualification_name as "qualificationName", r.field_of_study as "fieldOfStudy", r.attendance_status as "attendanceStatus",
      r.start_year as "startYear", r.end_year as "endYear", r.expected_completion_year as "expectedCompletionYear"
    from student_education_records r where r.user_id = $1 and r.id = any($2::uuid[]) and r.removed_at is null
  ), payload as (select coalesce(jsonb_agg(to_jsonb(selected) order by id), '[]'::jsonb) as records from selected)
  select case when octet_length(records::text) <= $3 then records else null end as records from payload`, selection.educationRecordIds);
  const assessments = await load<AssessmentRecordDto>(`with selected as (
    select r.id, r.assessment_category as "assessmentCategory", r.assessment_name as "assessmentName", r.assessment_variant as "assessmentVariant",
      r.result_status as "resultStatus", r.result_form as "resultForm", to_char(r.test_date, 'YYYY-MM-DD') as "testDate",
      to_char(r.report_date, 'YYYY-MM-DD') as "reportDate", r.components_json as components
    from student_assessment_records r where r.user_id = $1 and r.id = any($2::uuid[]) and r.removed_at is null
  ), payload as (select coalesce(jsonb_agg(to_jsonb(selected) order by id), '[]'::jsonb) as records from selected)
  select case when octet_length(records::text) <= $3 then records else null end as records from payload`, selection.assessmentRecordIds);
  return { education, assessments };
}
