import { buildAuditEvent } from "../audit/audit.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { noticeScope, noticeSha256, parseNoticeDocument, type NoticeLocale } from "../notices/document.ts";
import {
  MAX_OFFICIAL_SUBMISSION_POLICY_VERSION,
  officialSubmissionPolicyKey,
  officialSubmissionPolicySha256,
} from "../submission-policy/official-submission-policy.ts";
import {
  getLockedPublishedOfficialSubmissionPolicy,
  getPublishedOfficialSubmissionPolicyBinding,
  type PublishedOfficialSubmissionPolicyBinding,
} from "../submission-policy/postgres-reader.ts";
import { parseApplicationIdempotencyKey } from "./application-commands.ts";
import { PostgresApplicationCommands } from "./postgres-application-commands.ts";
import { buildMaterialPreview, MATERIAL_VERSION_FIELDS, parseMaterialPreview, type MaterialVersions } from "./application-material-preview.ts";
import { loadMaterialPreviewRecords } from "./postgres-application-material-preview.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import {
  APPLICATION_AUTHORIZATION_STATUSES,
  APPLICATION_AUTHORIZATION_FORMATS,
  APPLICATION_AUTHORIZATION_FORMAT_V1,
  APPLICATION_AUTHORIZATION_FORMAT_V2,
  applicationAuthorizationDigests,
  parseApplicationAuthorizationInput,
  parseApplicationAuthorizationWithdrawal,
  type ApplicationAuthorizationCommandInput,
  type ApplicationAuthorizationInput,
  type ApplicationAuthorizationStatus,
} from "./application-submission-authorization.ts";
import type { MaterialSelection } from "./material-selection.ts";

type SetRow = { revision: number; status: string; lockedAt: Date | null; submittedAt: Date | null };
type ChoiceRow = { schoolId: string; programId: string | null; programIntakeId: string | null; admissionRouteKey: string | null;
  status: string; removedAt: Date | null };
type TargetRow = { schoolStatus: string; programStatus: string; intakeStatus: string; opensAt: Date | null; deadlineAt: Date | null };
type ProfileRow = { revision: number; fullName: string | null; contactEmail: string | null; citizenshipCountry: string | null };
type SelectionRow = { revision: number; applicationSet: number; applicant: number; education: number; assessments: number; selection: unknown };
type NoticeRow = { versionId: string; version: number; publicationRevision: number; publicationStatus: string; publishedContentSha256: string;
  versionContentSha256: string; content: unknown; reviewStatus: string; reviewedAt: Date | null; effectiveFrom: Date | null; reviewDueAt: Date | null };
type AuthorizationRow = {
  id: string; userId: string; applicationSetId: string; applicationChoiceId: string; schoolId: string; programId: string; programIntakeId: string;
  authorizationFormat: string; admissionRouteKey: string | null; policyVersionId: string | null;
  policyPublicationRevision: number | null; policyDocumentSha256: string | null; policyTargetSetSha256: string | null;
  policyApprovalSha256: string | null;
  materialSelectionRevision: number; applicationSet: number; applicant: number; education: number; assessments: number;
  selectionSha256: string; materialContentSha256: string; noticeScopeKey: string; noticeLocale: string; noticeVersionId: string;
  noticePublicationRevision: number; noticeContentSha256: string; confirmationMethod: string; scopeSha256: string;
  status: string; confirmedAt: Date; endedAt: Date | null; endReason: string | null;
  checkedAt: Date; choiceCurrent: boolean; routeCurrent: boolean; selectionCurrent: boolean; sourcesCurrent: boolean;
  noticeCurrent: boolean; policyCurrent: boolean;
  targetAvailable: boolean; windowOpen: boolean; noSchoolApplication: boolean;
};

const missing = () => forbidden("Application submission authorization is not available to this student.");
const conflict = () => new CuacError("CONFLICT", "Application authorization inputs changed. Reload and review again.", 409);
const corrupt = () => serviceUnavailable("Application submission authorization requires reconciliation.");

export class PostgresApplicationSubmissionAuthorization {
  private readonly client: TransactionalSqlClient;
  constructor(client: TransactionalSqlClient) { this.client = client; }

  async get(context: RequestContext, applicationSetId: unknown, choiceId: unknown) {
    const [userId, setId, id] = authorize(context, applicationSetId, choiceId);
    return this.client.transaction(async tx => {
      await tx.query("set transaction isolation level repeatable read, read only", []);
      await requireOwnerScope(tx, userId, setId, id);
      const latest = await tx.query<{ id: string }>(`select id from application_submission_authorizations
        where user_id = $1 and application_set_id = $2 and application_choice_id = $3
        order by confirmed_at desc, id desc limit 1`, [userId, setId, id]);
      return latest[0] ? readApplicationSubmissionAuthorization(tx, userId, setId, id, latest[0].id) : null;
    });
  }

  async record(context: RequestContext, applicationSetId: unknown, choiceId: unknown, value: unknown, idempotencyKey: unknown) {
    const [userId, setId, id] = authorize(context, applicationSetId, choiceId);
    const input = parseApplicationAuthorizationInput(value), key = parseApplicationIdempotencyKey(idempotencyKey);
    const commandInput: ApplicationAuthorizationCommandInput = { ...input, applicationSetId: setId, applicationChoiceId: id };
    return this.client.transaction(async tx => {
      const audit = new PostgresAuditWriter(tx), commands = new PostgresApplicationCommands(tx, audit);
      return commands.execute(context, "application_authorization.record", commandInput, key,
        () => recordAuthorization(tx, audit, context, userId, setId, id, input),
        authorizationId => readApplicationSubmissionAuthorization(tx, userId, setId, id, authorizationId));
    });
  }

  async withdraw(context: RequestContext, applicationSetId: unknown, choiceId: unknown, value: unknown) {
    const [userId, setId, id] = authorize(context, applicationSetId, choiceId);
    const { authorizationId } = parseApplicationAuthorizationWithdrawal(value);
    return this.client.transaction(async tx => {
      await lockAuthorityAndChoice(tx, userId, setId, id, false);
      const rows = await tx.query<{ status: string }>(`select status from application_submission_authorizations
        where id = $4 and user_id = $1 and application_set_id = $2 and application_choice_id = $3 for update`,
      [userId, setId, id, authorizationId]);
      if (rows.length !== 1) throw missing();
      const status = inputEnum(rows[0].status, "Authorization status", APPLICATION_AUTHORIZATION_STATUSES);
      if (status !== "active") return readApplicationSubmissionAuthorization(tx, userId, setId, id, authorizationId);
      if ((await tx.query("select id from school_applications where application_choice_id = $1 for share", [id])).length) {
        throw new CuacError("CONFLICT", "Submitted application data requires the dedicated rights-request process.", 409);
      }
      const now = await databaseNow(tx);
      const changed = await tx.query(`update application_submission_authorizations set status = 'withdrawn', ended_at = $2,
        end_reason = 'student_withdrawal', updated_at = $2 where id = $1 and status = 'active' returning id`, [authorizationId, now]);
      if (changed.length !== 1) throw conflict();
      await new PostgresAuditWriter(tx).record(buildAuditEvent(context, { action: "student.application_submission_authorization.withdraw",
        resourceType: "application_submission_authorization", resourceId: authorizationId, allowed: true,
        policyDecisionId: context.policyDecisionId, dataClasses: ["student_pii", "education_record"],
        metadata: { applicationSetId: setId, applicationChoiceId: id } }));
      return readApplicationSubmissionAuthorization(tx, userId, setId, id, authorizationId);
    });
  }
}

function authorize(context: RequestContext, setId: unknown, choiceId: unknown): [string, string, string] {
  const decision = evaluatePolicy(context, "student.manage_submission_authorization", { type: "student",
    ownerUserId: context.actorUserId, dataClasses: ["student_pii", "education_record"] });
  if (!decision.allowed) throw forbidden(decision.reason);
  return [inputUuid(context.actorUserId), inputUuid(setId, "applicationSetId"), inputUuid(choiceId, "choiceId")];
}

async function requireOwnerScope(tx: TransactionalSqlClient, userId: string, setId: string, choiceId: string) {
  const rows = await tx.query(`select c.id from users u join application_sets a on a.user_id = u.id
    join application_choices c on c.application_set_id = a.id and c.user_id = u.id
    where u.id = $1 and a.id = $2 and c.id = $3 and u.account_status = 'active'
      and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`,
  [userId, setId, choiceId]);
  if (rows.length !== 1) throw missing();
}

async function lockAuthorityAndChoice(tx: TransactionalSqlClient, userId: string, setId: string, choiceId: string, requireDraft: boolean) {
  if ((await tx.query("select id from users where id = $1 and account_status = 'active' for update", [userId])).length !== 1) throw missing();
  if ((await tx.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId])).length !== 1) throw missing();
  const sets = await tx.query<SetRow>(`select revision, status, locked_at as "lockedAt", submitted_at as "submittedAt"
    from application_sets where id = $1 and user_id = $2 for update`, [setId, userId]);
  const choices = await tx.query<ChoiceRow>(`select school_id as "schoolId", program_id as "programId", program_intake_id as "programIntakeId",
    admission_route_key as "admissionRouteKey", status, removed_at as "removedAt"
    from application_choices where id = $1 and application_set_id = $2 and user_id = $3 for update`,
  [choiceId, setId, userId]);
  if (sets.length !== 1 || choices.length !== 1) throw missing();
  const set = sets[0], choice = choices[0];
  try { inputInteger(set.revision, "Application set revision", 1, MAX_APPLICANT_REVISION); inputUuid(choice.schoolId); }
  catch { throw corrupt(); }
  if (requireDraft && (set.status !== "draft" || set.lockedAt !== null || set.submittedAt !== null
    || choice.status !== "draft" || choice.removedAt !== null || !choice.programId || !choice.programIntakeId)) throw conflict();
  return { set, choice };
}

async function recordAuthorization(tx: TransactionalSqlClient, audit: PostgresAuditWriter, context: RequestContext,
  userId: string, setId: string, choiceId: string, input: ApplicationAuthorizationInput) {
  const { set, choice } = await lockAuthorityAndChoice(tx, userId, setId, choiceId, true);
  const programId = inputUuid(choice.programId), programIntakeId = inputUuid(choice.programIntakeId), schoolId = inputUuid(choice.schoolId);
  if (choice.admissionRouteKey === null) throw conflict();
  let admissionRouteKey: string;
  try { admissionRouteKey = officialSubmissionPolicyKey(choice.admissionRouteKey, "Admission route key"); }
  catch { throw corrupt(); }
  if (admissionRouteKey !== input.expectedPolicy.admissionRouteKey) throw conflict();
  if ((await tx.query("select id from school_applications where application_choice_id = $1 for share", [choiceId])).length) throw conflict();

  const targetRows = await tx.query<TargetRow>(`select s.status as "schoolStatus", p.status as "programStatus", pi.status as "intakeStatus",
    pi.open_date as "opensAt", pi.deadline_date as "deadlineAt" from schools s
    join programs p on p.school_id = s.id and p.id = $2 join program_intakes pi on pi.program_id = p.id and pi.id = $3
    where s.id = $1 for share of s, p, pi`, [schoolId, programId, programIntakeId]);
  if (targetRows.length !== 1) throw conflict();
  const target = targetRows[0], now = await databaseNow(tx);
  if (target.schoolStatus !== "active" || target.programStatus !== "active" || target.intakeStatus !== "open"
    || !validDate(target.opensAt) || !validDate(target.deadlineAt) || target.opensAt >= target.deadlineAt
    || now < target.opensAt || now >= target.deadlineAt) throw conflict();

  const policy = await getLockedPublishedOfficialSubmissionPolicy(tx, programId, programIntakeId, admissionRouteKey, now);
  if (!policy || !matchesExpectedPolicy(policy, input.expectedPolicy)) throw conflict();

  const selections = await tx.query<SelectionRow>(`select revision, source_set_revision as "applicationSet",
    source_applicant_revision as applicant, source_education_revision as education, source_assessment_revision as assessments,
    selection_json as selection from application_material_selections where choice_id = $1 and application_set_id = $2 and user_id = $3 for share`,
  [choiceId, setId, userId]);
  if (selections.length !== 1) throw conflict();
  const stored = selections[0];
  const storedVersions = versions(stored), parsed = parseStoredMaterialSelection(storedVersions, stored.selection);
  if (stored.revision !== input.expectedMaterialSelectionRevision || set.revision !== input.expectedVersions.applicationSet
    || MATERIAL_VERSION_FIELDS.some(field => storedVersions[field] !== input.expectedVersions[field])) throw conflict();

  const profiles = await tx.query<ProfileRow>(`select revision, full_name as "fullName", contact_email as "contactEmail",
    citizenship_country as "citizenshipCountry" from student_applicant_profiles where user_id = $1 for share`, [userId]);
  const educationHeaders = await tx.query<{ revision: number }>("select revision from student_education_histories where user_id = $1 for share", [userId]);
  const assessmentHeaders = await tx.query<{ revision: number }>("select revision from student_assessment_histories where user_id = $1 for share", [userId]);
  const currentVersions: MaterialVersions = { applicationSet: set.revision, applicant: profiles[0]?.revision ?? 0,
    education: educationHeaders[0]?.revision ?? 0, assessments: assessmentHeaders[0]?.revision ?? 0 };
  if (MATERIAL_VERSION_FIELDS.some(field => currentVersions[field] !== input.expectedVersions[field])) throw conflict();
  await lockSelectedRecords(tx, userId, parsed.selection);
  const { education, assessments } = await loadMaterialPreviewRecords(tx, userId, parsed.selection);
  const preview = buildMaterialPreview(userId, { applicationSetId: setId, choiceId, schoolId, programId, programIntakeId }, now,
    { expectedVersions: currentVersions, selection: parsed.selection }, { applicant: profiles[0] ?? {
      fullName: null, contactEmail: null, citizenshipCountry: null }, education, assessments });
  if (preview.contentSha256 !== input.materialContentSha256) throw conflict();

  const notice = await lockNotice(tx, input.locale, now, parsed.selection);
  if (!notice || notice.versionId !== input.expectedNotice.versionId || notice.publicationRevision !== input.expectedNotice.publicationRevision
    || notice.publishedContentSha256 !== input.expectedNotice.contentSha256) throw conflict();
  const scope = noticeScope("application_disclosure", input.locale);
  const digests = applicationAuthorizationDigests({ userId, applicationSetId: setId, applicationChoiceId: choiceId,
    schoolId, programId, programIntakeId, materialSelectionRevision: stored.revision, sourceVersions: currentVersions,
    selection: parsed.selection, materialContentSha256: preview.contentSha256,
    notice: { scopeKey: scope.scopeKey, locale: scope.locale, versionId: notice.versionId,
      publicationRevision: notice.publicationRevision, contentSha256: notice.publishedContentSha256 },
    policy: { admissionRouteKey, versionId: policy.versionId, publicationRevision: policy.publicationRevision,
      documentSha256: policy.documentSha256, targetSetSha256: policy.targetSetSha256,
      approvalSha256: policy.approvalSha256 } });

  const active = await tx.query<{ id: string; scopeSha256: string }>(`select id, scope_sha256 as "scopeSha256"
    from application_submission_authorizations where application_choice_id = $1 and status = 'active' for update`, [choiceId]);
  if (active.length > 1) throw corrupt();
  if (active[0]?.scopeSha256 === digests.scopeSha256) return readApplicationSubmissionAuthorization(tx, userId, setId, choiceId, active[0].id);
  if (active[0]) {
    const ended = await tx.query(`update application_submission_authorizations set status = 'superseded', ended_at = $2,
      end_reason = 'reauthorized', updated_at = $2 where id = $1 and status = 'active' returning id`, [active[0].id, now]);
    if (ended.length !== 1) throw conflict();
  }
  if (typeof context.requestId !== "string" || context.requestId.length < 1 || context.requestId.length > 128) throw corrupt();
  const inserted = await tx.query<{ id: string }>(`insert into application_submission_authorizations
    (user_id, application_set_id, application_choice_id, school_id, program_id, program_intake_id,
     authorization_format, admission_route_key, policy_version_id, policy_publication_revision,
     policy_document_sha256, policy_target_set_sha256, policy_approval_sha256,
     material_selection_revision, source_set_revision, source_applicant_revision, source_education_revision, source_assessment_revision,
     selection_json, selection_sha256, material_content_sha256, notice_scope_key, notice_locale, notice_version_id,
     notice_publication_revision, notice_content_sha256, scope_sha256, confirmed_request_id, confirmed_at, created_at, updated_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$29,$29)
    returning id`,
  [userId, setId, choiceId, schoolId, programId, programIntakeId, APPLICATION_AUTHORIZATION_FORMAT_V2,
    admissionRouteKey, policy.versionId, policy.publicationRevision, policy.documentSha256, policy.targetSetSha256,
    policy.approvalSha256, stored.revision, currentVersions.applicationSet, currentVersions.applicant,
    currentVersions.education, currentVersions.assessments, JSON.stringify(digests.selection), digests.selectionSha256,
    preview.contentSha256, scope.scopeKey, scope.locale, notice.versionId, notice.publicationRevision,
    notice.publishedContentSha256, digests.scopeSha256, context.requestId, now]);
  if (inserted.length !== 1) throw corrupt();
  await audit.record(buildAuditEvent(context, { action: "student.application_submission_authorization.record",
    resourceType: "application_submission_authorization", resourceId: inserted[0].id, allowed: true,
    policyDecisionId: context.policyDecisionId, dataClasses: ["student_pii", "education_record"],
    metadata: { applicationSetId: setId, applicationChoiceId: choiceId, materialSelectionRevision: stored.revision,
      applicantFieldCount: parsed.selection.applicantFields.length, educationRecordCount: parsed.selection.educationRecordIds.length,
      assessmentRecordCount: parsed.selection.assessmentRecordIds.length, noticeVersionId: notice.versionId,
      noticePublicationRevision: notice.publicationRevision, admissionRouteKey, policyVersionId: policy.versionId,
      policyPublicationRevision: policy.publicationRevision } }));
  return readApplicationSubmissionAuthorization(tx, userId, setId, choiceId, inserted[0].id);
}

async function lockNotice(tx: TransactionalSqlClient, locale: NoticeLocale, at: Date, selection: MaterialSelection): Promise<NoticeRow | null> {
  const scope = noticeScope("application_disclosure", locale);
  const rows = await tx.query<NoticeRow>(`select pub.version_id as "versionId", v.version,
    pub.revision as "publicationRevision", pub.status as "publicationStatus", pub.content_sha256 as "publishedContentSha256",
    v.content_sha256 as "versionContentSha256", v.content_json as content, v.review_status as "reviewStatus", v.reviewed_at as "reviewedAt",
    v.effective_from as "effectiveFrom", v.review_due_at as "reviewDueAt"
    from privacy_notice_publications pub join privacy_notice_versions v on v.id = pub.version_id and v.scope_key = pub.scope_key
    where pub.scope_key = $1 for share of pub, v`, [scope.scopeKey]);
  if (!rows[0]) return null;
  const row = rows[0];
  try { inputUuid(row.versionId); inputInteger(row.version, "Notice version", 1, MAX_APPLICANT_REVISION);
    inputInteger(row.publicationRevision, "Notice publication revision", 1, MAX_APPLICANT_REVISION);
    noticeSha256(row.publishedContentSha256); noticeSha256(row.versionContentSha256); }
  catch { throw corrupt(); }
  if (row.publicationStatus !== "active" || row.reviewStatus !== "approved"
    || row.publishedContentSha256 !== row.versionContentSha256 || !validDate(row.reviewedAt)
    || !validDate(row.effectiveFrom) || !validDate(row.reviewDueAt)
    || row.reviewedAt > at || row.effectiveFrom > at || row.reviewDueAt <= at) return null;
  let document;
  try { document = parseNoticeDocument(row.content, scope); } catch { throw corrupt(); }
  const required = ["application_choices", ...(selection.applicantFields.length ? ["applicant_basics"] : []),
    ...(selection.educationRecordIds.length ? ["education_history"] : []),
    ...(selection.assessmentRecordIds.length ? ["assessment_results"] : [])];
  if (required.some(category => !document.coveredData.includes(category as typeof document.coveredData[number]))) return null;
  return row;
}

function matchesExpectedPolicy(policy: PublishedOfficialSubmissionPolicyBinding,
  expected: ApplicationAuthorizationInput["expectedPolicy"]): boolean {
  return policy.admissionRouteKey === expected.admissionRouteKey && policy.versionId === expected.versionId
    && policy.publicationRevision === expected.publicationRevision && policy.documentSha256 === expected.documentSha256;
}

async function lockSelectedRecords(tx: TransactionalSqlClient, userId: string, selection: MaterialSelection) {
  for (const [table, ids] of [["student_education_records", selection.educationRecordIds],
    ["student_assessment_records", selection.assessmentRecordIds]] as const) {
    if (!ids.length) continue;
    const rows = await tx.query<{ id: string }>(`select id from ${table} where user_id = $1 and id = any($2::uuid[])
      and removed_at is null for share`, [userId, ids]);
    if (rows.length !== ids.length) throw conflict();
  }
}

function versions(row: Pick<SelectionRow, "applicationSet" | "applicant" | "education" | "assessments">): MaterialVersions {
  try { return Object.fromEntries(MATERIAL_VERSION_FIELDS.map(field => [field,
    inputInteger(row[field], field, field === "applicationSet" ? 1 : 0, MAX_APPLICANT_REVISION)])) as MaterialVersions; }
  catch { throw corrupt(); }
}

function parseStoredMaterialSelection(expectedVersions: MaterialVersions, selection: unknown) {
  try { return parseMaterialPreview({ expectedVersions, selection }); }
  catch { throw corrupt(); }
}

async function databaseNow(tx: TransactionalSqlClient) {
  const rows = await tx.query<{ now: Date }>("select date_trunc('milliseconds', clock_timestamp()) as now", []);
  if (rows.length !== 1 || !validDate(rows[0].now)) throw corrupt();
  return rows[0].now;
}

function validDate(value: Date | null): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

const authorizationColumns = `auth.id, auth.user_id as "userId", auth.application_set_id as "applicationSetId",
  auth.application_choice_id as "applicationChoiceId", auth.school_id as "schoolId", auth.program_id as "programId",
  auth.program_intake_id as "programIntakeId", auth.authorization_format as "authorizationFormat",
  auth.admission_route_key as "admissionRouteKey", auth.policy_version_id as "policyVersionId",
  auth.policy_publication_revision as "policyPublicationRevision", auth.policy_document_sha256 as "policyDocumentSha256",
  auth.policy_target_set_sha256 as "policyTargetSetSha256", auth.policy_approval_sha256 as "policyApprovalSha256",
  auth.material_selection_revision as "materialSelectionRevision",
  auth.source_set_revision as "applicationSet", auth.source_applicant_revision as applicant,
  auth.source_education_revision as education, auth.source_assessment_revision as assessments,
  auth.selection_sha256 as "selectionSha256", auth.material_content_sha256 as "materialContentSha256",
  auth.notice_scope_key as "noticeScopeKey", auth.notice_locale as "noticeLocale", auth.notice_version_id as "noticeVersionId",
  auth.notice_publication_revision as "noticePublicationRevision", auth.notice_content_sha256 as "noticeContentSha256",
  auth.confirmation_method as "confirmationMethod", auth.scope_sha256 as "scopeSha256", auth.status,
  auth.confirmed_at as "confirmedAt", auth.ended_at as "endedAt", auth.end_reason as "endReason"`;

export async function readApplicationSubmissionAuthorization(tx: TransactionalSqlClient, userId: string, setId: string,
  choiceId: string, authorizationId: string) {
  const rows = await tx.query<AuthorizationRow>(`select ${authorizationColumns},
    date_trunc('milliseconds', statement_timestamp()) as "checkedAt",
    (c.removed_at is null and c.status = 'draft' and a.status = 'draft' and a.locked_at is null and a.submitted_at is null
      and c.school_id = auth.school_id and c.program_id = auth.program_id and c.program_intake_id = auth.program_intake_id) as "choiceCurrent",
    (auth.authorization_format = '${APPLICATION_AUTHORIZATION_FORMAT_V2}' and c.admission_route_key = auth.admission_route_key) as "routeCurrent",
    (ms.revision = auth.material_selection_revision and ms.source_set_revision = auth.source_set_revision
      and ms.source_applicant_revision = auth.source_applicant_revision and ms.source_education_revision = auth.source_education_revision
      and ms.source_assessment_revision = auth.source_assessment_revision and ms.selection_json = auth.selection_json) as "selectionCurrent",
    (a.revision = auth.source_set_revision and coalesce(ap.revision,0) = auth.source_applicant_revision
      and coalesce(e.revision,0) = auth.source_education_revision and coalesce(h.revision,0) = auth.source_assessment_revision) as "sourcesCurrent",
    (pub.status = 'active' and pub.version_id = auth.notice_version_id and pub.revision = auth.notice_publication_revision
      and pub.content_sha256 = auth.notice_content_sha256 and v.review_status = 'approved'
      and v.content_sha256 = auth.notice_content_sha256 and v.effective_from <= statement_timestamp()
      and v.review_due_at > statement_timestamp()) as "noticeCurrent",
    (s.status = 'active' and p.status = 'active' and pi.status = 'open') as "targetAvailable",
    (pi.open_date is not null and pi.deadline_date is not null and pi.open_date < pi.deadline_date
      and pi.open_date <= statement_timestamp() and pi.deadline_date > statement_timestamp()) as "windowOpen",
    not exists (select 1 from school_applications sa where sa.application_choice_id = auth.application_choice_id) as "noSchoolApplication"
    from application_submission_authorizations auth
    join application_sets a on a.id = auth.application_set_id and a.user_id = auth.user_id
    join application_choices c on c.id = auth.application_choice_id and c.application_set_id = auth.application_set_id and c.user_id = auth.user_id
    left join application_material_selections ms on ms.choice_id = auth.application_choice_id and ms.user_id = auth.user_id
    left join student_applicant_profiles ap on ap.user_id = auth.user_id
    left join student_education_histories e on e.user_id = auth.user_id
    left join student_assessment_histories h on h.user_id = auth.user_id
    join schools s on s.id = auth.school_id join programs p on p.id = auth.program_id and p.school_id = s.id
    join program_intakes pi on pi.id = auth.program_intake_id and pi.program_id = p.id
    left join privacy_notice_publications pub on pub.scope_key = auth.notice_scope_key
    left join privacy_notice_versions v on v.id = pub.version_id and v.scope_key = pub.scope_key
    where auth.id = $4 and auth.user_id = $1 and auth.application_set_id = $2 and auth.application_choice_id = $3`,
  [userId, setId, choiceId, authorizationId]);
  if (rows.length !== 1) throw missing();
  const row = rows[0];
  row.policyCurrent = false;
  if (row.authorizationFormat === APPLICATION_AUTHORIZATION_FORMAT_V2 && typeof row.admissionRouteKey === "string"
    && typeof row.policyVersionId === "string" && typeof row.policyPublicationRevision === "number"
    && typeof row.policyDocumentSha256 === "string" && typeof row.policyTargetSetSha256 === "string"
    && typeof row.policyApprovalSha256 === "string" && validDate(row.checkedAt)) {
    const policy = await getPublishedOfficialSubmissionPolicyBinding(tx, row.programId, row.programIntakeId,
      row.admissionRouteKey, row.checkedAt);
    row.policyCurrent = policy !== null && matchesStoredPolicy(policy, row);
  }
  return authorizationDto(row);
}

function matchesStoredPolicy(policy: PublishedOfficialSubmissionPolicyBinding, row: AuthorizationRow): boolean {
  return policy.schoolId === row.schoolId && policy.programId === row.programId && policy.programIntakeId === row.programIntakeId
    && policy.admissionRouteKey === row.admissionRouteKey && policy.versionId === row.policyVersionId
    && policy.publicationRevision === row.policyPublicationRevision && policy.documentSha256 === row.policyDocumentSha256
    && policy.targetSetSha256 === row.policyTargetSetSha256 && policy.approvalSha256 === row.policyApprovalSha256;
}

function authorizationDto(row: AuthorizationRow) {
  try {
    for (const id of [row.id, row.userId, row.applicationSetId, row.applicationChoiceId, row.schoolId,
      row.programId, row.programIntakeId, row.noticeVersionId]) inputUuid(id);
    inputInteger(row.materialSelectionRevision, "Material selection revision", 1, MAX_APPLICANT_REVISION);
    const sourceVersions = versions(row);
    inputInteger(row.noticePublicationRevision, "Notice publication revision", 1, MAX_APPLICANT_REVISION);
    for (const digest of [row.selectionSha256, row.materialContentSha256, row.noticeContentSha256, row.scopeSha256]) noticeSha256(digest);
    const notice = noticeScope("application_disclosure", row.noticeLocale);
    const authorizationFormat = inputEnum(row.authorizationFormat, "Authorization format", APPLICATION_AUTHORIZATION_FORMATS);
    let officialSubmissionPolicy = null;
    if (authorizationFormat === APPLICATION_AUTHORIZATION_FORMAT_V1) {
      if ([row.admissionRouteKey, row.policyVersionId, row.policyPublicationRevision, row.policyDocumentSha256,
        row.policyTargetSetSha256, row.policyApprovalSha256].some(value => value !== null)) throw new Error("Invalid legacy policy binding.");
    } else {
      const admissionRouteKey = officialSubmissionPolicyKey(row.admissionRouteKey, "Admission route key");
      const versionId = inputUuid(row.policyVersionId, "Policy version id");
      const publicationRevision = inputInteger(row.policyPublicationRevision, "Policy publication revision", 1,
        MAX_OFFICIAL_SUBMISSION_POLICY_VERSION);
      const documentSha256 = officialSubmissionPolicySha256(row.policyDocumentSha256, "Policy document digest");
      officialSubmissionPolicy = { admissionRouteKey, versionId, publicationRevision, documentSha256 };
      officialSubmissionPolicySha256(row.policyTargetSetSha256, "Policy target-set digest");
      officialSubmissionPolicySha256(row.policyApprovalSha256, "Policy approval digest");
    }
    if (notice.scopeKey !== row.noticeScopeKey || row.confirmationMethod !== "authenticated_explicit_action"
      || !validDate(row.confirmedAt) || (row.endedAt !== null && !validDate(row.endedAt))) throw new Error("Invalid authorization.");
    const status = inputEnum(row.status, "Authorization status", APPLICATION_AUTHORIZATION_STATUSES);
    const lifecycleValid = status === "active" ? row.endedAt === null && row.endReason === null
      : status === "withdrawn" ? row.endedAt !== null && ["student_withdrawal", "choice_removed"].includes(row.endReason ?? "")
      : row.endedAt !== null && row.endReason === "reauthorized";
    if (!lifecycleValid || row.endedAt && row.confirmedAt > row.endedAt) throw new Error("Invalid lifecycle.");
    const reasons = freshnessReasons(row, status);
    return { id: row.id, status, canSubmit: false as const,
      target: { applicationSetId: row.applicationSetId, choiceId: row.applicationChoiceId, schoolId: row.schoolId,
        programId: row.programId, programIntakeId: row.programIntakeId },
      material: { selectionRevision: row.materialSelectionRevision, sourceVersions,
        selectionSha256: row.selectionSha256, contentSha256: row.materialContentSha256 },
      notice: { noticeKey: "application_disclosure" as const, locale: notice.locale, versionId: row.noticeVersionId,
        publicationRevision: row.noticePublicationRevision, contentSha256: row.noticeContentSha256 },
      officialSubmissionPolicy,
      confirmation: { format: authorizationFormat, method: "authenticated_explicit_action" as const, scopeSha256: row.scopeSha256,
        confirmedAt: row.confirmedAt.toISOString() },
      endedAt: row.endedAt?.toISOString() ?? null, endReason: row.endReason,
      freshness: { current: reasons.length === 0, reasons } };
  } catch { throw corrupt(); }
}

function freshnessReasons(row: AuthorizationRow, status: ApplicationAuthorizationStatus) {
  const reasons: string[] = [];
  if (status !== "active") reasons.push("AUTHORIZATION_NOT_ACTIVE");
  if (row.authorizationFormat !== APPLICATION_AUTHORIZATION_FORMAT_V2) reasons.push("AUTHORIZATION_FORMAT_LEGACY");
  if (row.choiceCurrent !== true) reasons.push("CHOICE_CHANGED");
  if (row.authorizationFormat === APPLICATION_AUTHORIZATION_FORMAT_V2 && row.routeCurrent !== true) reasons.push("ADMISSION_ROUTE_CHANGED");
  if (row.selectionCurrent !== true) reasons.push("MATERIAL_SELECTION_CHANGED");
  if (row.sourcesCurrent !== true) reasons.push("SOURCE_VERSIONS_CHANGED");
  if (row.noticeCurrent !== true) reasons.push("NOTICE_CHANGED");
  if (row.authorizationFormat === APPLICATION_AUTHORIZATION_FORMAT_V2 && row.policyCurrent !== true) reasons.push("OFFICIAL_SUBMISSION_POLICY_CHANGED");
  if (row.targetAvailable !== true) reasons.push("TARGET_UNAVAILABLE");
  if (row.windowOpen !== true) reasons.push("WINDOW_NOT_OPEN");
  if (row.noSchoolApplication !== true) reasons.push("SCHOOL_APPLICATION_EXISTS");
  return reasons;
}
