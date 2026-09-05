import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { PostgresApplicantProfiles } from "./postgres-applicant-profiles.ts";
import type { ApplicantProfileUpdate } from "./applicant-profile.ts";
import { PostgresEducationHistory } from "./postgres-education.ts";
import type { EducationRecordData, UpdateEducationRecordInput } from "./education.ts";
import { PostgresAssessmentHistory } from "./postgres-assessments.ts";
import type { AssessmentRecordData, UpdateAssessmentRecordInput } from "./assessments.ts";
import type {
  AddApplicationChoiceInput,
  ApplicationChoiceDto,
  ApplicationSetDto,
  CreateApplicationSetInput,
  RemovedApplicationChoiceDto,
  RemovedSavedItemDto,
  ReorderApplicationChoicesInput,
  SavedItemDto,
  SaveItemInput,
  StudentCoreRepository,
  StudentProfileDto,
  StudentProfileUpdate,
  UpdateApplicationChoiceInput,
} from "./service.ts";

export type SqlStudentClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

type StudentProfileRow = {
  id: string;
  userId: string;
  displayName: string | null;
  citizenshipCountry: string | null;
  targetDegreeLevel: string | null;
  targetIntake: string | null;
  preferencesJson: Record<string, unknown>;
  profileCompletionJson: Record<string, unknown>;
};

type SavedItemRow = {
  id: string;
  userId: string;
  entityType: SavedItemDto["entityType"];
  entityId: string;
  notes: string | null;
  createdAt: Date;
  entitySlug: string | null;
  entityNameEn: string | null;
  entityNameZh: string | null;
  entityStatus: string | null;
  entitySourceStatus: string | null;
  entityLastVerifiedAt: Date | null;
};

type ApplicationSetRow = {
  id: string;
  cuacId: string | null;
  userId: string;
  name: string;
  status: string;
  revision: number;
  targetIntake: string | null;
};

type ApplicationChoiceRow = {
  id: string;
  applicationSetId: string;
  userId: string;
  schoolId: string;
  programId: string | null;
  programIntakeId: string | null;
  admissionRouteKey: string | null;
  scholarshipId: string | null;
  rankOrder: number;
  status: string;
  studentNotes: string | null;
};

export class PostgresStudentCoreRepository implements StudentCoreRepository {
  private readonly client: SqlStudentClient;

  constructor(client: SqlStudentClient) {
    this.client = client;
  }

  getEducationHistory(userId: string) { return new PostgresEducationHistory(this.client).get(userId); }
  getAssessmentHistory(userId: string) { return new PostgresAssessmentHistory(this.client).get(userId); }
  addAssessmentRecord(userId: string, expectedRevision: number, record: AssessmentRecordData) { return new PostgresAssessmentHistory(this.client).add(userId, expectedRevision, record); }
  updateAssessmentRecord(userId: string, recordId: string, input: UpdateAssessmentRecordInput) { return new PostgresAssessmentHistory(this.client).update(userId, recordId, input); }
  removeAssessmentRecord(userId: string, recordId: string, expectedRevision: number) { return new PostgresAssessmentHistory(this.client).remove(userId, recordId, expectedRevision); }
  addEducationRecord(userId: string, expectedRevision: number, record: EducationRecordData) { return new PostgresEducationHistory(this.client).add(userId, expectedRevision, record); }
  updateEducationRecord(userId: string, recordId: string, input: UpdateEducationRecordInput) { return new PostgresEducationHistory(this.client).update(userId, recordId, input); }
  removeEducationRecord(userId: string, recordId: string, expectedRevision: number) { return new PostgresEducationHistory(this.client).remove(userId, recordId, expectedRevision); }

  getApplicantProfileByUserId(userId: string) {
    return new PostgresApplicantProfiles(this.client).get(userId);
  }

  updateApplicantProfile(userId: string, input: ApplicantProfileUpdate) {
    return new PostgresApplicantProfiles(this.client).update(userId, input);
  }

  async getProfileByUserId(userId: string): Promise<StudentProfileDto | null> {
    const rows = await this.client.query<StudentProfileRow>(
      `${studentProfileSelectSql}
       where user_id = $1
       limit 1`,
      [userId],
    );

    return rows[0] ? toStudentProfileDto(rows[0]) : null;
  }

  async upsertProfile(userId: string, input: StudentProfileUpdate): Promise<StudentProfileDto> {
    const rows = await this.client.query<StudentProfileRow>(
      `insert into student_profiles (
         user_id, display_name, citizenship_country, target_degree_level, target_intake, preferences_json
       ) values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (user_id) do update set
         display_name = case when $7::boolean then excluded.display_name else student_profiles.display_name end,
         citizenship_country = case when $8::boolean then excluded.citizenship_country else student_profiles.citizenship_country end,
         target_degree_level = case when $9::boolean then excluded.target_degree_level else student_profiles.target_degree_level end,
         target_intake = case when $10::boolean then excluded.target_intake else student_profiles.target_intake end,
         preferences_json = case when $11::boolean then excluded.preferences_json else student_profiles.preferences_json end,
         updated_at = now()
       returning
         id,
         user_id as "userId",
         display_name as "displayName",
         citizenship_country as "citizenshipCountry",
         target_degree_level as "targetDegreeLevel",
         target_intake as "targetIntake",
         preferences_json as "preferencesJson",
         profile_completion_json as "profileCompletionJson"`,
      [
        userId,
        input.displayName ?? null,
        input.citizenshipCountry ?? null,
        input.targetDegreeLevel ?? null,
        input.targetIntake ?? null,
        JSON.stringify(input.preferences ?? {}),
        input.displayName !== undefined,
        input.citizenshipCountry !== undefined,
        input.targetDegreeLevel !== undefined,
        input.targetIntake !== undefined,
        input.preferences !== undefined,
      ],
    );

    return requireRow(rows, "student profile upsert").map(toStudentProfileDto);
  }

  async listSavedItemsByUserId(userId: string): Promise<SavedItemDto[]> {
    const rows = await this.client.query<SavedItemRow>(
      `${savedItemSelectSql}
       where si.user_id = $1 and si.removed_at is null
       order by si.created_at desc`,
      [userId],
    );

    return rows.map(toSavedItemDto);
  }

  async saveItem(userId: string, input: SaveItemInput): Promise<SavedItemDto> {
    const rows = await this.client.query<SavedItemRow>(
      `insert into saved_items (
         user_id, entity_type, entity_id, notes
       ) select $1::uuid, $2::text, $3::uuid, $4::text
       where exists (
         select id from schools where $2 = 'school' and id = $3 and status = 'active'
         union all select id from programs where $2 = 'program' and id = $3 and status = 'active'
         union all select id from scholarships where $2 = 'scholarship' and id = $3 and status = 'active'
         union all select id from cities where $2 = 'city' and id = $3 and status = 'active'
       )
       on conflict (user_id, entity_type, entity_id) where removed_at is null do update set
         notes = excluded.notes
       returning
         id,
         user_id as "userId",
         entity_type as "entityType",
         entity_id as "entityId",
         notes,
         created_at as "createdAt"`,
      [userId, input.entityType, input.entityId, input.notes ?? null],
    );

    if (!rows[0]) throw forbidden("Catalog item is not available.");
    return toSavedItemDto(rows[0]);
  }

  async removeSavedItem(userId: string, savedItemId: string): Promise<RemovedSavedItemDto | null> {
    const rows = await this.client.query<{
      id: string;
      entityType: SavedItemDto["entityType"];
      entityId: string;
      removedAt: Date;
    }>(
      `update saved_items
       set removed_at = now()
       where id = $1::uuid
         and user_id = $2::uuid
         and removed_at is null
       returning id, entity_type as "entityType", entity_id as "entityId", removed_at as "removedAt"`,
      [savedItemId, userId],
    );
    return rows[0] ?? null;
  }

  async listApplicationSetsByUserId(userId: string): Promise<ApplicationSetDto[]> {
    const rows = await this.client.query<ApplicationSetRow>(
      `${applicationSetSelectSql}
       where user_id = $1
       order by updated_at desc`,
      [userId],
    );
    const choices = await this.listChoicesBySetIds(rows.map((row) => row.id), userId);

    return rows.map((row) => toApplicationSetDto(row, choices.get(row.id) ?? []));
  }

  async getApplicationSetById(applicationSetId: string, userId: string): Promise<ApplicationSetDto | null> {
    const rows = await this.client.query<ApplicationSetRow>(
      `${applicationSetSelectSql}
       where id = $1 and user_id = $2
       limit 1`,
      [applicationSetId, userId],
    );

    if (!rows[0]) {
      return null;
    }

    const choices = await this.listChoicesBySetIds([rows[0].id], userId);
    return toApplicationSetDto(rows[0], choices.get(rows[0].id) ?? []);
  }

  async createApplicationSet(userId: string, input: CreateApplicationSetInput): Promise<ApplicationSetDto> {
    const capabilities = await this.client.query<{ supported: boolean }>(
      `select to_regclass('public.application_reference_counters') is not null
         and exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'application_sets' and column_name = 'cuac_id') as supported`,
      [],
    );
    if (!capabilities[0]?.supported) {
      const legacyRows = await this.client.query<ApplicationSetRow>(
        `insert into application_sets (user_id, name, target_intake)
         values ($1, $2, $3)
         returning id, null::text as "cuacId", user_id as "userId", name, status, revision,
           target_intake as "targetIntake"`,
        [userId, input.name, input.targetIntake ?? null],
      );
      return toApplicationSetDto(requireRow(legacyRows, "legacy application set create").value, []);
    }
    const rows = await this.client.query<ApplicationSetRow>(
      `with reference_clock as materialized (
         select extract(year from clock_timestamp() at time zone 'UTC')::integer as reference_year
       ), allocated_reference as (
         insert into application_reference_counters (reference_year, last_issued_sequence)
         select reference_year, 1 from reference_clock
         on conflict (reference_year) do update set
           last_issued_sequence = application_reference_counters.last_issued_sequence + 1,
           updated_at = clock_timestamp()
         where application_reference_counters.last_issued_sequence < 999999
         returning reference_year, last_issued_sequence
       )
       insert into application_sets (
         user_id, name, target_intake, cuac_reference_year, cuac_reference_sequence
       )
       select $1, $2, $3, reference_year, last_issued_sequence from allocated_reference
       returning
         id,
         cuac_id as "cuacId",
         user_id as "userId",
         name,
         status,
         revision,
         target_intake as "targetIntake"`,
      [userId, input.name, input.targetIntake ?? null],
    );

    if (!rows[0]) throw serviceUnavailable("The current CUAC application reference range is exhausted.");
    return toApplicationSetDto(rows[0], []);
  }

  async addApplicationChoice(userId: string, input: AddApplicationChoiceInput): Promise<ApplicationChoiceDto> {
    // Lock the owner-scoped parent and use its post-wait state in the same statement.
    const rows = await this.client.query<{ setEditable: boolean; choice: ApplicationChoiceRow | null }>(
      `with owned_application_set as materialized (
         select id, user_id, (status = 'draft' and locked_at is null and submitted_at is null and revision < 2147483647) as editable
         from application_sets
         where id = $1 and user_id = $2
         for update
       ), created_choice as (
       insert into application_choices (
         application_set_id, user_id, school_id, program_id, scholarship_id, rank_order, student_notes, program_intake_id, admission_route_key
       )
       select a.id, a.user_id, $3::uuid, $4::uuid, $5::uuid, $6::integer, $7::text, $8::uuid, $9::text
       from owned_application_set a
       where a.editable
         and exists (select 1 from schools s where s.id = $3 and s.status = 'active')
         and ($4::uuid is null or exists (
           select 1 from programs p where p.id = $4 and p.school_id = $3 and p.status = 'active'
         ))
         and ($8::uuid is null or exists (
           select 1 from program_intakes pi where pi.id = $8 and pi.program_id = $4 and pi.status = 'open'
             and (pi.deadline_date is null or pi.deadline_date > clock_timestamp())
             and (pi.open_date is null or pi.deadline_date is null or pi.open_date < pi.deadline_date)
           for share
         ))
         and ($5::uuid is null or exists (
           select 1 from scholarships s where s.id = $5 and s.status = 'active'
             and (s.school_id is null or s.school_id = $3)
             and (s.program_id is null or s.program_id = $4)
         ))
         and ($9::text is null or exists (
           select 1 from official_submission_policy_publications pub
           join official_submission_policy_version_targets target on target.policy_version_id = pub.version_id
             and target.program_intake_id = pub.program_intake_id and target.program_id = pub.program_id
             and target.school_id = pub.school_id and target.admission_route_key = pub.admission_route_key
           join official_submission_policy_versions v on v.id = pub.version_id and v.school_id = pub.school_id
             and v.admission_route_key = pub.admission_route_key
           where pub.program_intake_id = $8 and pub.program_id = $4 and pub.school_id = $3
             and pub.admission_route_key = $9 and pub.status = 'active' and v.review_status = 'approved'
             and v.reviewed_at <= statement_timestamp() and v.effective_from <= statement_timestamp()
             and v.review_due_at > statement_timestamp()
           for share of pub
         ))
       returning
         id,
         application_set_id as "applicationSetId",
         user_id as "userId",
         school_id as "schoolId",
         program_id as "programId",
         program_intake_id as "programIntakeId",
         admission_route_key as "admissionRouteKey",
         scholarship_id as "scholarshipId",
         rank_order as "rankOrder",
         status,
         student_notes as "studentNotes"
       ), advanced_set as (
         update application_sets set revision = revision + 1, updated_at = clock_timestamp()
         where id in (select "applicationSetId" from created_choice) returning id
       )
       select a.editable as "setEditable", to_jsonb(c) as choice
       from owned_application_set a left join created_choice c on true`,
      [
        input.applicationSetId,
        userId,
        input.schoolId,
        input.programId ?? null,
        input.scholarshipId ?? null,
        input.rankOrder ?? 0,
        input.studentNotes ?? null,
        input.programIntakeId ?? null,
        input.admissionRouteKey ?? null,
      ],
    ).catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "23505"
        && "constraint" in error && ["application_choices_active_set_program_unique", "application_choices_active_set_program_intake_unique"].includes(String(error.constraint))) {
        throw new CuacError("CONFLICT", "This program and intake selection is already in the application set.", 409);
      }
      throw error;
    });

    const result = rows[0];
    if (result && !result.setEditable) throw new CuacError("CONFLICT", "Application set is not editable. Refresh its current state.", 409);
    if (!result?.choice) throw forbidden("Application set or catalog selection is not available to this student.");
    return toApplicationChoiceDto(result.choice);
  }

  async removeApplicationChoice(userId: string, applicationSetId: string, choiceId: string): Promise<RemovedApplicationChoiceDto & {
    changed: boolean; authorizationWithdrawn: boolean;
  }> {
    const rows = await this.client.query<{ id: string; applicationSetId: string; alreadyRemoved: boolean; changed: boolean;
      authorizationWithdrawn: boolean }>(
      `with owned_application_set as materialized (
         select id, user_id, (status = 'draft' and locked_at is null and submitted_at is null and revision < 2147483647) as editable
         from application_sets where id = $1 and user_id = $2 for update
       ), owned_choice as materialized (
         select c.id, c.application_set_id, c.removed_at,
           (a.editable and c.status = 'draft' and not exists (
             select 1 from school_applications sa where sa.application_choice_id = c.id
           )) as editable
         from application_choices c join owned_application_set a on a.id = c.application_set_id and a.user_id = c.user_id
         where c.id = $3 and c.user_id = $2 for update of c
       ), removed_choice as (
         update application_choices c set status = 'removed', removed_at = clock_timestamp(), updated_at = clock_timestamp(),
           student_notes = null, requirement_snapshot_json = '{}'::jsonb, metadata_json = '{}'::jsonb
         from owned_choice o where c.id = o.id and o.editable and o.removed_at is null
         returning c.id
       ), ended_authorizations as (
         update application_submission_authorizations auth set status = 'withdrawn', ended_at = clock_timestamp(),
           end_reason = 'choice_removed', updated_at = clock_timestamp()
         from removed_choice r where auth.application_choice_id = r.id and auth.user_id = $2
           and auth.application_set_id = $1 and auth.status = 'active' returning auth.id
       ), removed_material_selection as (
         delete from application_material_selections m using removed_choice r
         where m.choice_id = r.id and m.user_id = $2 and m.application_set_id = $1 returning m.choice_id
       ), removal_event as (
         insert into application_choice_status_events (application_choice_id, actor_user_id, from_status, to_status)
         select id, $2::uuid, 'draft', 'removed' from removed_choice returning id
       ), advanced_set as (
         update application_sets set revision = revision + 1, updated_at = clock_timestamp()
         where id = $1 and exists (select 1 from removed_choice) returning id
       )
       select o.id, o.application_set_id as "applicationSetId", (o.removed_at is not null) as "alreadyRemoved",
         exists (select 1 from removed_choice r where r.id = o.id) as changed,
         exists (select 1 from ended_authorizations) as "authorizationWithdrawn"
       from owned_choice o`, [applicationSetId, userId, choiceId],
    );
    const result = rows[0];
    if (!result) throw forbidden("Application choice not found or not available to this student.");
    if (!result.alreadyRemoved && !result.changed) throw new CuacError("CONFLICT", "Only an unsubmitted draft choice can be removed.", 409);
    return { id: result.id, applicationSetId: result.applicationSetId, status: "removed", changed: result.changed,
      authorizationWithdrawn: result.authorizationWithdrawn };
  }

  async updateApplicationChoice(userId: string, applicationSetId: string, choiceId: string, input: UpdateApplicationChoiceInput): Promise<{ changed: boolean }> {
    const rows = await this.client.query<{ editable: boolean; revision: number; selectionValid: boolean; routeValid: boolean; changed: boolean }>(
      `with owned_application_set as materialized (
         select id, user_id, revision,
           (status = 'draft' and locked_at is null and submitted_at is null and revision < 2147483647) as editable
         from application_sets where id = $1 and user_id = $2 for update
       ), owned_choice as materialized (
         select c.id, a.revision,
           (a.editable and c.status = 'draft' and c.removed_at is null and not exists (
             select 1 from school_applications sa where sa.application_choice_id = c.id
           )) as editable,
           (not $7::boolean or $5::uuid is null or exists (
             select 1 from scholarships s where s.id = $5 and s.status = 'active'
               and (s.school_id is null or s.school_id = c.school_id)
               and (s.program_id is null or s.program_id = c.program_id)
           )) as selection_valid,
           (not $10::boolean or $9::text is null or exists (
             select 1 from official_submission_policy_publications pub
             join official_submission_policy_version_targets target on target.policy_version_id = pub.version_id
               and target.program_intake_id = pub.program_intake_id and target.program_id = pub.program_id
               and target.school_id = pub.school_id and target.admission_route_key = pub.admission_route_key
             join official_submission_policy_versions v on v.id = pub.version_id and v.school_id = pub.school_id
               and v.admission_route_key = pub.admission_route_key
             where pub.program_intake_id = c.program_intake_id and pub.program_id = c.program_id
               and pub.school_id = c.school_id and pub.admission_route_key = $9 and pub.status = 'active'
               and v.review_status = 'approved' and v.reviewed_at <= statement_timestamp()
               and v.effective_from <= statement_timestamp() and v.review_due_at > statement_timestamp()
             for share of pub
           )) as route_valid
         from application_choices c join owned_application_set a on a.id = c.application_set_id and a.user_id = c.user_id
         where c.id = $3 and c.user_id = $2 for update of c
       ), updated_choice as (
         update application_choices c set
           admission_route_key = case when $10 then $9::text else c.admission_route_key end,
           scholarship_id = case when $7 then $5::uuid else c.scholarship_id end,
           student_notes = case when $8 then $6::text else c.student_notes end,
           requirement_snapshot_json = case when ($7 and c.scholarship_id is distinct from $5::uuid)
             or ($10 and c.admission_route_key is distinct from $9::text) then '{}'::jsonb else c.requirement_snapshot_json end,
           updated_at = clock_timestamp()
         from owned_choice o
         where c.id = o.id and o.editable and o.revision = $4 and o.selection_valid and o.route_valid
           and (($7 and c.scholarship_id is distinct from $5::uuid) or ($8::boolean and c.student_notes is distinct from $6::text)
             or ($10 and c.admission_route_key is distinct from $9::text))
         returning c.id
       ), advanced_set as (
         update application_sets set revision = revision + 1, updated_at = clock_timestamp()
         where id = $1 and exists (select 1 from updated_choice) returning id
       )
       select o.editable, o.revision, o.selection_valid as "selectionValid", o.route_valid as "routeValid",
         exists (select 1 from updated_choice) as changed
       from owned_choice o`,
      [applicationSetId, userId, choiceId, input.expectedRevision, input.scholarshipId ?? null, input.studentNotes ?? null,
        Object.hasOwn(input, "scholarshipId"), Object.hasOwn(input, "studentNotes"), input.admissionRouteKey ?? null,
        Object.hasOwn(input, "admissionRouteKey")],
    );
    const result = rows[0];
    if (!result) throw forbidden("Application choice not found or not available to this student.");
    if (!result.editable || result.revision !== input.expectedRevision) throw new CuacError("CONFLICT", "Application draft changed or is not editable. Refresh its current state.", 409);
    if (!result.selectionValid) throw forbidden("Scholarship selection is not available for this choice.");
    if (!result.routeValid) throw new CuacError("CONFLICT", "Admission route is not currently available for this program intake.", 409);
    return { changed: result.changed };
  }

  async reorderApplicationChoices(userId: string, applicationSetId: string, input: ReorderApplicationChoicesInput): Promise<{ changed: boolean }> {
    // The parent revision detects concurrent membership changes invisible to this statement's initial snapshot.
    const rows = await this.client.query<{ editable: boolean; revision: number; selectionMatches: boolean; changed: boolean }>(
      `with owned_application_set as materialized (
         select id, user_id, revision,
           (status = 'draft' and locked_at is null and submitted_at is null and revision < 2147483647) as editable
         from application_sets where id = $1 and user_id = $2 for update
       ), active_choices as materialized (
         select c.id, c.rank_order, (c.status = 'draft' and not exists (
           select 1 from school_applications sa where sa.application_choice_id = c.id
         )) as editable
         from application_choices c join owned_application_set a on a.id = c.application_set_id and a.user_id = c.user_id
         where c.user_id = $2 and c.removed_at is null order by c.id for update of c
       ), desired_order as (
         select id, (position - 1)::integer as rank_order from unnest($3::uuid[]) with ordinality as desired(id, position)
       ), checked_set as (
         select a.id, a.revision, (a.editable and not exists (select 1 from active_choices where not editable)) as editable,
           ((select count(*) from active_choices) = cardinality($3::uuid[])
             and (select count(distinct id) from desired_order) = cardinality($3::uuid[])
             and not exists (select 1 from desired_order d where not exists (select 1 from active_choices c where c.id = d.id))) as selection_matches
         from owned_application_set a
       ), updated_choices as (
         update application_choices c set rank_order = d.rank_order, updated_at = clock_timestamp()
         from desired_order d, checked_set a
         where c.id = d.id and c.application_set_id = a.id and c.user_id = $2 and c.removed_at is null
           and a.editable and a.selection_matches and a.revision = $4 and c.rank_order is distinct from d.rank_order
         returning c.id
       ), advanced_set as (
         update application_sets set revision = revision + 1, updated_at = clock_timestamp()
         where id = $1 and exists (select 1 from updated_choices) returning id
       )
       select a.editable, a.revision, a.selection_matches as "selectionMatches", exists (select 1 from updated_choices) as changed
       from checked_set a`, [applicationSetId, userId, input.choiceIds, input.expectedRevision],
    );
    const result = rows[0];
    if (!result) throw forbidden("Application set not found or not available to this student.");
    if (!result.editable || !result.selectionMatches || result.revision !== input.expectedRevision) {
      throw new CuacError("CONFLICT", "Application draft changed or is not editable. Refresh its current state.", 409);
    }
    return { changed: result.changed };
  }

  private async listChoicesBySetIds(applicationSetIds: readonly string[], userId: string): Promise<Map<string, ApplicationChoiceDto[]>> {
    const choicesBySet = new Map<string, ApplicationChoiceDto[]>();

    if (applicationSetIds.length === 0) {
      return choicesBySet;
    }

    const rows = await this.client.query<ApplicationChoiceRow>(
      `${applicationChoiceSelectSql}
       where application_set_id = any($1::uuid[]) and user_id = $2 and removed_at is null
       order by application_set_id asc, rank_order asc, created_at asc`,
      [applicationSetIds, userId],
    );

    for (const row of rows) {
      const choices = choicesBySet.get(row.applicationSetId) ?? [];
      choices.push(toApplicationChoiceDto(row));
      choicesBySet.set(row.applicationSetId, choices);
    }

    return choicesBySet;
  }
}

function toStudentProfileDto(row: StudentProfileRow): StudentProfileDto {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    citizenshipCountry: row.citizenshipCountry,
    targetDegreeLevel: row.targetDegreeLevel,
    targetIntake: row.targetIntake,
    preferences: row.preferencesJson,
    profileCompletion: row.profileCompletionJson,
  };
}

function toSavedItemDto(row: SavedItemRow): SavedItemDto {
  return {
    id: row.id,
    userId: row.userId,
    entityType: row.entityType,
    entityId: row.entityId,
    notes: row.notes,
    createdAt: row.createdAt,
    catalogItem: row.entitySlug && row.entityNameEn && row.entityStatus && row.entitySourceStatus ? {
      id: row.entityId,
      slug: row.entitySlug,
      nameEn: row.entityNameEn,
      nameZh: row.entityNameZh,
      status: row.entityStatus,
      sourceStatus: row.entitySourceStatus,
      lastVerifiedAt: row.entityLastVerifiedAt,
    } : null,
  };
}

function toApplicationSetDto(row: ApplicationSetRow, choices: ApplicationChoiceDto[]): ApplicationSetDto {
  return {
    id: row.id,
    cuacId: row.cuacId,
    userId: row.userId,
    name: row.name,
    status: row.status,
    revision: row.revision,
    targetIntake: row.targetIntake,
    choices,
  };
}

function toApplicationChoiceDto(row: ApplicationChoiceRow): ApplicationChoiceDto {
  return {
    id: row.id,
    applicationSetId: row.applicationSetId,
    userId: row.userId,
    schoolId: row.schoolId,
    programId: row.programId,
    programIntakeId: row.programIntakeId,
    admissionRouteKey: row.admissionRouteKey,
    scholarshipId: row.scholarshipId,
    rankOrder: row.rankOrder,
    status: row.status,
    studentNotes: row.studentNotes,
  };
}

function requireRow<T>(rows: readonly T[], action: string) {
  const value = rows[0];

  if (!value) {
    throw new Error(`PostgreSQL did not return a row for ${action}.`);
  }

  return {
    value,
    map<U>(mapper: (row: T) => U): U {
      return mapper(value);
    },
  };
}

const studentProfileSelectSql = `
select
  id,
  user_id as "userId",
  display_name as "displayName",
  citizenship_country as "citizenshipCountry",
  target_degree_level as "targetDegreeLevel",
  target_intake as "targetIntake",
  preferences_json as "preferencesJson",
  profile_completion_json as "profileCompletionJson"
from student_profiles`;

const savedItemSelectSql = `
select
  si.id,
  si.user_id as "userId",
  si.entity_type as "entityType",
  si.entity_id as "entityId",
  si.notes,
  si.created_at as "createdAt",
  case si.entity_type
    when 'school' then school.slug
    when 'program' then program.slug
    when 'scholarship' then scholarship.slug
    when 'city' then city.slug
  end as "entitySlug",
  case si.entity_type
    when 'school' then school.name_en
    when 'program' then program.name_en
    when 'scholarship' then scholarship.title
    when 'city' then city.name_en
  end as "entityNameEn",
  case si.entity_type
    when 'school' then school.name_zh
    when 'program' then program.name_zh
    when 'scholarship' then scholarship.name_zh
    when 'city' then city.name_zh
  end as "entityNameZh",
  case si.entity_type
    when 'school' then school.status
    when 'program' then program.status
    when 'scholarship' then scholarship.status
    when 'city' then city.status
  end as "entityStatus",
  case
    when coalesce(school.status, program.status, scholarship.status, city.status) = 'draft' then 'draft'
    when coalesce(school.verification_status, program.verification_status,
      scholarship.verification_status, city.verification_status)
      in ('verified', 'stale', 'unverified', 'disputed', 'invalid')
      then coalesce(school.verification_status, program.verification_status,
        scholarship.verification_status, city.verification_status)
    else 'unknown'
  end as "entitySourceStatus",
  case si.entity_type
    when 'school' then school.last_verified_at
    when 'program' then program.last_verified_at
    when 'scholarship' then scholarship.last_verified_at
    when 'city' then city.last_verified_at
  end as "entityLastVerifiedAt"
from saved_items si
left join schools school on si.entity_type = 'school' and school.id = si.entity_id
left join programs program on si.entity_type = 'program' and program.id = si.entity_id
left join scholarships scholarship on si.entity_type = 'scholarship' and scholarship.id = si.entity_id
left join cities city on si.entity_type = 'city' and city.id = si.entity_id`;

const applicationSetSelectSql = `
select
  id,
  to_jsonb(application_sets) ->> 'cuac_id' as "cuacId",
  user_id as "userId",
  name,
  status,
  revision,
  target_intake as "targetIntake"
from application_sets`;

const applicationChoiceSelectSql = `
select
  id,
  application_set_id as "applicationSetId",
  user_id as "userId",
  school_id as "schoolId",
  program_id as "programId",
  program_intake_id as "programIntakeId",
  admission_route_key as "admissionRouteKey",
  scholarship_id as "scholarshipId",
  rank_order as "rankOrder",
  status,
  student_notes as "studentNotes",
  created_at as "createdAt"
from application_choices`;
