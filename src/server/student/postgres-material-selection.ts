import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import { MATERIAL_VERSION_FIELDS, parseMaterialPreview, type MaterialVersions } from "./application-material-preview.ts";
import { MAX_MATERIAL_SELECTION_BYTES, parseMaterialSelectionUpdate, type MaterialSelection, type MaterialSelectionDto } from "./material-selection.ts";

type Scope = MaterialSelectionDto["target"] & MaterialVersions & { editable: boolean };
type Stored = { revision: number; selection: unknown; applicationSet: number; applicant: number; education: number; assessments: number };
const missing = () => forbidden("Application material selection is not available to this student.");
const conflict = () => new CuacError("CONFLICT", "Application selection or source versions changed. Reload before saving.", 409);
const corrupt = () => serviceUnavailable("Application material selection requires reconciliation.");

export class PostgresMaterialSelection {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  async get(context: RequestContext, applicationSetId: unknown, choiceId: unknown): Promise<MaterialSelectionDto> {
    const args = authorize(context, applicationSetId, choiceId);
    return this.client.transaction(async tx => {
      await tx.query("set transaction isolation level repeatable read, read only", []);
      const scope = await readScope(tx, args);
      const stored = await readStored(tx, args);
      return describe(tx, args[0], scope, stored);
    });
  }

  async put(context: RequestContext, applicationSetId: unknown, choiceId: unknown, value: unknown): Promise<MaterialSelectionDto> {
    const args = authorize(context, applicationSetId, choiceId), input = parseMaterialSelectionUpdate(value);
    const [userId, setId, id] = args;
    return this.client.transaction(async tx => {
      // This order also blocks absent profile creation and serializes choice removal/freeze.
      if (!(await tx.query("select id from users where id = $1 and account_status = 'active' for update", [userId])).length) throw missing();
      if (!(await tx.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId])).length) throw missing();
      if (!(await tx.query("select id from application_sets where user_id = $1 and id = $2 for update", [userId, setId])).length) throw missing();
      if (!(await tx.query("select id from application_choices where user_id = $1 and application_set_id = $2 and id = $3 and removed_at is null for update", args)).length) throw missing();
      await tx.query("select revision from student_applicant_profiles where user_id = $1 for share", [userId]);
      await tx.query("select revision from student_education_histories where user_id = $1 for share", [userId]);
      await tx.query("select revision from student_assessment_histories where user_id = $1 for share", [userId]);
      const scope = await readScope(tx, args), current = await readStored(tx, args, true);
      if (!scope.editable || !scope.programId || !scope.programIntakeId
        || MATERIAL_VERSION_FIELDS.some(field => scope[field] !== input.expectedVersions[field])
        || (current?.revision ?? 0) !== input.expectedRevision) throw conflict();
      const unavailable = await inspectRecords(tx, userId, input.selection, true);
      if (unavailable.educationRecordIds.length || unavailable.assessmentRecordIds.length) throw missing();
      const normalized = current ? normalizeStored(current) : null;
      const changed = !normalized || MATERIAL_VERSION_FIELDS.some(field => normalized.expectedVersions[field] !== scope[field])
        || JSON.stringify(normalized.selection) !== JSON.stringify(input.selection);
      if (changed) {
        if (current?.revision === MAX_APPLICANT_REVISION) throw conflict();
        const rows = await tx.query<{ revision: number }>(`insert into application_material_selections
          (choice_id, application_set_id, user_id, school_id, program_id, program_intake_id, revision,
           source_set_revision, source_applicant_revision, source_education_revision, source_assessment_revision, selection_json)
          values ($3,$2,$1,$4,$5,$6,1,$7,$8,$9,$10,$11::jsonb)
          on conflict (choice_id) do update set revision = application_material_selections.revision + 1,
            source_set_revision = $7, source_applicant_revision = $8, source_education_revision = $9,
            source_assessment_revision = $10, selection_json = $11::jsonb, updated_at = clock_timestamp()
          where application_material_selections.revision = $12
          returning revision`, [...args, scope.schoolId, scope.programId, scope.programIntakeId,
          ...MATERIAL_VERSION_FIELDS.map(field => scope[field]), JSON.stringify(input.selection), input.expectedRevision]);
        if (rows.length !== 1) throw conflict();
        await new PostgresAuditWriter(tx).record(buildAuditEvent(context, { action: "student.material_selection.save",
          resourceType: "application_material_selection", resourceId: id, allowed: true, policyDecisionId: context.policyDecisionId,
          dataClasses: ["student_pii", "education_record"], metadata: { applicationSetId: setId, revision: rows[0].revision,
            applicantFieldCount: input.selection.applicantFields.length, educationRecordCount: input.selection.educationRecordIds.length,
            assessmentRecordCount: input.selection.assessmentRecordIds.length } }));
      }
      return describe(tx, userId, scope, await readStored(tx, args));
    });
  }
}

function authorize(context: RequestContext, setId: unknown, choiceId: unknown): [string, string, string] {
  const decision = evaluatePolicy(context, "student.manage_material_selection", { type: "student", ownerUserId: context.actorUserId,
    dataClasses: ["student_pii", "education_record"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return [inputUuid(context.actorUserId), inputUuid(setId), inputUuid(choiceId)];
}

function versions(row: MaterialVersions): MaterialVersions {
  try { return Object.fromEntries(MATERIAL_VERSION_FIELDS.map(field => [field,
    inputInteger(row[field], field, field === "applicationSet" ? 1 : 0, MAX_APPLICANT_REVISION)])) as MaterialVersions; }
  catch { throw corrupt(); }
}

async function readScope(tx: TransactionalSqlClient, args: [string, string, string]): Promise<Scope> {
  const rows = await tx.query<Scope>(`select a.id as "applicationSetId", c.id as "choiceId", c.school_id as "schoolId",
    c.program_id as "programId", c.program_intake_id as "programIntakeId", a.revision as "applicationSet",
    coalesce(ap.revision,0) as applicant, coalesce(e.revision,0) as education, coalesce(h.revision,0) as assessments,
    (a.status = 'draft' and a.locked_at is null and a.submitted_at is null and c.status = 'draft'
      and not exists (select 1 from school_applications sa where sa.application_choice_id = c.id)) as editable
    from users u join application_sets a on a.user_id = u.id
    join application_choices c on c.application_set_id = a.id and c.user_id = u.id and c.removed_at is null
    left join student_applicant_profiles ap on ap.user_id = u.id
    left join student_education_histories e on e.user_id = u.id
    left join student_assessment_histories h on h.user_id = u.id
    where u.id = $1 and a.id = $2 and c.id = $3 and u.account_status = 'active'
      and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`, args);
  if (!rows.length) throw missing();
  if (rows.length !== 1) throw corrupt();
  const row = rows[0]; versions(row);
  try {
    for (const field of ["applicationSetId", "choiceId", "schoolId"] as const) inputUuid(row[field]);
    for (const field of ["programId", "programIntakeId"] as const) if (row[field] !== null) inputUuid(row[field]);
    if (typeof row.editable !== "boolean" || (row.programIntakeId && !row.programId)) throw new Error("Invalid scope.");
  } catch { throw corrupt(); }
  return row;
}

async function readStored(tx: TransactionalSqlClient, args: [string, string, string], lock = false): Promise<Stored | null> {
  const rows = await tx.query<Stored>(`select revision, source_set_revision as "applicationSet", source_applicant_revision as applicant,
    source_education_revision as education, source_assessment_revision as assessments,
    case when octet_length(selection_json::text) <= $4 then selection_json else null end as selection
    from application_material_selections where user_id = $1 and application_set_id = $2 and choice_id = $3${lock ? " for update" : ""}`,
  [...args, MAX_MATERIAL_SELECTION_BYTES]);
  if (rows.length > 1) throw corrupt();
  if (rows[0]) try { inputInteger(rows[0].revision, "Stored revision", 1, MAX_APPLICANT_REVISION); } catch { throw corrupt(); }
  return rows[0] ?? null;
}

function normalizeStored(row: Stored) {
  try {
    const parsed = parseMaterialPreview({ expectedVersions: versions(row), selection: row.selection });
    if ((!parsed.expectedVersions.education && parsed.selection.educationRecordIds.length)
      || (!parsed.expectedVersions.assessments && parsed.selection.assessmentRecordIds.length)) throw new Error("Invalid stored inventory.");
    return parsed;
  } catch { throw corrupt(); }
}

async function inspectRecords(tx: TransactionalSqlClient, userId: string, selection: MaterialSelection, lock = false) {
  const inspect = async (table: "student_education_records" | "student_assessment_records", ids: string[]) => {
    if (!ids.length) return [];
    const rows = await tx.query<{ id: string; removed: boolean }>(
      `select id, (removed_at is not null) as removed from ${table} where user_id = $1 and id = any($2::uuid[])${lock ? " for share" : ""}`,
      [userId, ids]);
    if (rows.length !== ids.length) { if (lock) throw missing(); else throw corrupt(); }
    return rows.filter(row => row.removed).map(row => row.id).sort();
  };
  return { educationRecordIds: await inspect("student_education_records", selection.educationRecordIds),
    assessmentRecordIds: await inspect("student_assessment_records", selection.assessmentRecordIds) };
}

async function describe(tx: TransactionalSqlClient, userId: string, scope: Scope, stored: Stored | null): Promise<MaterialSelectionDto> {
  const saved = stored ? normalizeStored(stored) : null, currentVersions = versions(scope);
  return { mode: "selection_draft", canSubmit: false, consentRecorded: false,
    target: { applicationSetId: scope.applicationSetId, choiceId: scope.choiceId, schoolId: scope.schoolId,
      programId: scope.programId, programIntakeId: scope.programIntakeId }, revision: stored?.revision ?? 0,
    editable: scope.editable && !!scope.programId && !!scope.programIntakeId, currentVersions,
    savedVersions: saved?.expectedVersions ?? null, selection: saved?.selection ?? null,
    changedSources: saved ? MATERIAL_VERSION_FIELDS.filter(field => saved.expectedVersions[field] !== currentVersions[field]) : [],
    unavailable: saved ? await inspectRecords(tx, userId, saved.selection) : { educationRecordIds: [], assessmentRecordIds: [] } };
}
