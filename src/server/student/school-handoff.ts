import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputList, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";

export type SchoolHandoffInput = {
  expectedRevision: number;
  choiceIds: string[];
  confirmHandoff: true;
};

export type StudentSchoolProgressItem = {
  schoolApplicationId: string;
  applicationChoiceId: string;
  schoolId: string;
  programId: string | null;
  programIntakeId: string | null;
  status: string;
  schoolRevision: number;
  statusChangedAt: Date;
  submittedAt: Date;
};

type SetRow = { id: string; cuacId: string; revision: number; status: string };
type ChoiceRow = {
  id: string; schoolId: string; programId: string | null; programIntakeId: string | null;
  rankOrder: number; status: string;
};
type ApplicantRow = { revision: number; fullName: string | null; contactEmail: string | null; citizenshipCountry: string | null };
type EducationRow = {
  institutionName: string; institutionCountry: string | null; educationLevel: string;
  qualificationName: string | null; fieldOfStudy: string | null; attendanceStatus: string;
  startYear: number | null; endYear: number | null; expectedCompletionYear: number | null;
};

const conflict = (message: string) => new CuacError("CONFLICT", message, 409);
const notFound = () => new CuacError("NOT_FOUND", "Application set was not found.", 404);

export class PostgresSchoolHandoffService {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async handoff(context: RequestContext, applicationSetId: unknown, value: unknown) {
    const userId = authorizeStudent(context, true);
    const setId = inputUuid(applicationSetId, "applicationSetId");
    const input = parseSchoolHandoffInput(value);
    return this.client.transaction(async tx => {
      const sets = await tx.query<SetRow>(
        `select id, cuac_id as "cuacId", revision, status from application_sets
         where id = $1 and user_id = $2 for update`, [setId, userId],
      );
      const set = sets[0];
      if (!set) throw notFound();

      const existing = await readProgress(tx, userId, setId);
      if (set.status !== "draft") {
        if (existing.length !== input.choiceIds.length
          || !sameIds(existing.map(item => item.applicationChoiceId), input.choiceIds)) {
          throw conflict("The application set was already sent with a different choice list.");
        }
        return receipt(set, existing);
      }
      if (set.revision !== input.expectedRevision) {
        throw conflict("The application set changed. Reload it before sending to schools.");
      }

      const choices = await tx.query<ChoiceRow>(
        `select id, school_id as "schoolId", program_id as "programId",
           program_intake_id as "programIntakeId", rank_order as "rankOrder", status
         from application_choices where application_set_id = $1 and user_id = $2 and removed_at is null
         order by rank_order, id for update`, [setId, userId],
      );
      if (!choices.length || !sameIds(choices.map(choice => choice.id), input.choiceIds)) {
        throw conflict("Send must include every current application choice exactly once.");
      }
      if (choices.some(choice => choice.status !== "draft" || !choice.programId || !choice.programIntakeId)) {
        throw conflict("Every choice must be a current program and intake draft before it can be sent.");
      }

      const applicants = await tx.query<ApplicantRow>(
        `select revision, full_name as "fullName", contact_email as "contactEmail",
           citizenship_country as "citizenshipCountry"
         from student_applicant_profiles where user_id = $1 for share`, [userId],
      );
      const applicant = applicants[0];
      const education = await tx.query<EducationRow>(
        `select institution_name as "institutionName", institution_country as "institutionCountry",
           education_level as "educationLevel", qualification_name as "qualificationName",
           field_of_study as "fieldOfStudy", attendance_status as "attendanceStatus",
           start_year as "startYear", end_year as "endYear", expected_completion_year as "expectedCompletionYear"
         from student_education_records where user_id = $1 and removed_at is null order by created_at, id`, [userId],
      );
      if (!applicant?.fullName || !applicant.contactEmail || !applicant.citizenshipCountry || !education.length) {
        throw conflict("Save applicant details and at least one education record before sending to schools.");
      }

      const visibleProfile = {
        format: "cuac.school-visible-profile.v1",
        fullName: applicant.fullName,
        contactEmail: applicant.contactEmail,
        citizenshipCountry: applicant.citizenshipCountry,
        education: education.map(record => ({ ...record })),
      };
      const created = await tx.query<StudentSchoolProgressItem>(
        `insert into school_applications
           (application_record_format, application_set_id, cuac_id, application_choice_id, student_user_id,
            school_id, program_id, program_intake_id, status, submitted_at, status_changed_at,
            school_visible_profile_json, routing_metadata_json)
         select 'cuac.program-application.v1', $1, $2, c.id, $3, c.school_id, c.program_id,
           c.program_intake_id, 'new', clock_timestamp(), clock_timestamp(), $4::jsonb,
           '{"handoffScope":"school_contact","materialsShared":false,"paymentRequired":false}'::jsonb
         from application_choices c where c.application_set_id = $1 and c.user_id = $3
           and c.removed_at is null and c.id = any($5::uuid[])
         returning id as "schoolApplicationId", application_choice_id as "applicationChoiceId",
           school_id as "schoolId", program_id as "programId", program_intake_id as "programIntakeId",
           status, school_revision as "schoolRevision", status_changed_at as "statusChangedAt",
           submitted_at as "submittedAt"`,
        [setId, set.cuacId, userId, JSON.stringify(visibleProfile), input.choiceIds],
      );
      if (created.length !== choices.length) throw serviceUnavailable("School handoff could not create every program record.");
      await tx.query(
        `insert into school_application_status_events
           (school_application_id, actor_user_id, from_status, to_status, reason, metadata_json)
         select id, $2, null, 'new', 'student_school_handoff',
           '{"handoffScope":"school_contact","materialsShared":false,"paymentRequired":false}'::jsonb
         from school_applications where application_set_id = $1 and student_user_id = $2`, [setId, userId],
      );
      await tx.query(
        `update application_choices set status = 'submitted', updated_at = clock_timestamp()
         where application_set_id = $1 and user_id = $2 and removed_at is null and id = any($3::uuid[])`,
        [setId, userId, input.choiceIds],
      );
      const updatedSets = await tx.query<SetRow>(
        `update application_sets set status = 'submitted', submitted_at = clock_timestamp(),
           locked_at = clock_timestamp(), revision = revision + 1, updated_at = clock_timestamp()
         where id = $1 and user_id = $2 and status = 'draft'
         returning id, cuac_id as "cuacId", revision, status`, [setId, userId],
      );
      const updatedSet = updatedSets[0];
      if (!updatedSet) throw conflict("The application set changed before it could be sent.");
      await new PostgresAuditWriter(tx).record(buildAuditEvent(context, {
        action: "student.school_handoff.create", resourceType: "application_set", resourceId: setId,
        allowed: true, policyDecisionId: context.policyDecisionId,
        dataClasses: ["student_pii", "education_record"],
        metadata: { choiceCount: created.length, handoffScope: "school_contact", materialsShared: false, paymentRequired: false },
      }));
      return receipt(updatedSet, created);
    });
  }

  async getProgress(context: RequestContext, applicationSetId: unknown) {
    const userId = authorizeStudent(context, false);
    const setId = inputUuid(applicationSetId, "applicationSetId");
    const sets = await this.client.query<{ id: string }>(
      "select id from application_sets where id = $1 and user_id = $2", [setId, userId],
    );
    if (!sets[0]) throw notFound();
    return { applicationSetId: setId, items: await readProgress(this.client, userId, setId) };
  }
}

function authorizeStudent(context: RequestContext, requireStepUp: boolean) {
  if (context.activeRole !== "student" || context.selectedSurface !== "student" || context.tenantSchoolId !== null
    || !context.actorUserId || !["session", "step_up"].includes(context.authStrength)) {
    throw forbidden("An authenticated student session is required.");
  }
  if (requireStepUp && context.authStrength !== "step_up") {
    throw forbidden("Confirm your password before sending basic information to schools.");
  }
  return inputUuid(context.actorUserId, "actorUserId");
}

function parseSchoolHandoffInput(value: unknown): SchoolHandoffInput {
  const input = inputRecord(value, ["expectedRevision", "choiceIds", "confirmHandoff"]);
  const expectedRevision = inputInteger(input.expectedRevision, "expectedRevision", 1, 2147483646);
  const choiceIds = inputList(input.choiceIds, "choiceIds", 50, item => inputUuid(item, "choiceId"));
  if (!choiceIds.length) throw badRequest("choiceIds must contain at least one choice.");
  if (input.confirmHandoff !== true) throw badRequest("confirmHandoff must be true.");
  return { expectedRevision, choiceIds, confirmHandoff: true };
}

async function readProgress(client: Pick<TransactionalSqlClient, "query">, userId: string, setId: string) {
  return client.query<StudentSchoolProgressItem>(
    `select id as "schoolApplicationId", application_choice_id as "applicationChoiceId",
       school_id as "schoolId", program_id as "programId", program_intake_id as "programIntakeId",
       status, school_revision as "schoolRevision", status_changed_at as "statusChangedAt",
       submitted_at as "submittedAt"
     from school_applications where application_set_id = $1 and student_user_id = $2
       and application_record_format in ('cuac.program-application.v1','cuac.program-application.v2')
       and submitted_at is not null order by created_at, id`, [setId, userId],
  );
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().every((id, index) => id === [...right].sort()[index]);
}

function receipt(set: SetRow, programApplications: StudentSchoolProgressItem[]) {
  return {
    applicationSetId: set.id,
    cuacId: set.cuacId,
    revision: set.revision,
    status: "accepted" as const,
    handoffScope: "school_contact" as const,
    materialsShared: false,
    paymentRequired: false,
    programApplications,
  };
}
