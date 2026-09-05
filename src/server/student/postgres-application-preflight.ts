import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { ApplicationMaterialSnapshotCipher } from "./application-material-snapshot-envelope.ts";
import { readApplicationMaterialSnapshot } from "./postgres-application-material-snapshot.ts";
import { getPublishedProgramRequirements } from "../catalog/postgres-requirements.ts";
import { PostgresNoticeReader } from "../notices/public-reader.ts";
import { getPublishedOfficialSubmissionPolicyBinding } from "../submission-policy/postgres-reader.ts";
import { readCurrentApplicationFeeEntitlement } from "../billing/postgres-application-fee-entitlement.ts";
import { MAX_EDUCATION_RECORDS } from "./education.ts";
import { MAX_ASSESSMENT_RECORDS } from "./assessments.ts";
import { buildApplicationPreflight, preflightLocale, type PreflightAuthorization, type PreflightInventory,
  type PreflightTarget } from "./application-preflight.ts";

export class PostgresApplicationPreflight {
  private readonly client: TransactionalSqlClient;
  private readonly snapshotCipher?: ApplicationMaterialSnapshotCipher;
  constructor(client: TransactionalSqlClient, snapshotCipher?: ApplicationMaterialSnapshotCipher) {
    this.client = client;
    this.snapshotCipher = snapshotCipher;
  }

  async get(context: RequestContext, applicationSetId: unknown, choiceId: unknown, localeValue: unknown) {
    const decision = evaluatePolicy(context, "student.read_application_preflight", { type: "student", ownerUserId: context.actorUserId,
      dataClasses: ["student_pii", "education_record", "public_catalog", "public_notice", "payment_business"] });
    if (!decision.allowed) throw forbidden(decision.reason);
    const userId = inputUuid(context.actorUserId), setId = inputUuid(applicationSetId), id = inputUuid(choiceId), locale = preflightLocale(localeValue);
    return this.client.transaction(async tx => {
      // This standalone read transaction must choose its mode before its first data query.
      await tx.query("set transaction isolation level repeatable read, read only", []);
      const rows = await tx.query<PreflightTarget>(`select a.id as "applicationSetId", c.id as "choiceId", c.school_id as "schoolId",
        c.program_id as "programId", c.program_intake_id as "programIntakeId", c.admission_route_key as "admissionRouteKey",
        a.revision, date_trunc('milliseconds', statement_timestamp()) as "checkedAt",
        (a.status = 'draft' and a.locked_at is null and a.submitted_at is null) as "setEditable",
        (c.status = 'draft') as "choiceEditable", (s.id is not null) as "schoolAvailable",
        (p.id is not null) as "programAvailable", (pi.id is not null) as "intakeAvailable",
        pi.open_date as "opensAt", pi.deadline_date as "deadlineAt",
        (c.scholarship_id is null or exists (select 1 from scholarships sh where sh.id = c.scholarship_id and sh.status = 'active'
          and (sh.deadline_date is null or sh.deadline_date > date_trunc('milliseconds', statement_timestamp()))
          and (sh.school_id is null or sh.school_id = c.school_id) and (sh.program_id is null or sh.program_id = c.program_id))) as "scholarshipAvailable",
        exists (select 1 from school_applications sa where sa.application_choice_id = c.id) as "schoolApplicationExists",
        exists (select 1 from application_choices other_c join school_applications other_sa on other_sa.application_choice_id = other_c.id
          where other_c.user_id = u.id and other_sa.student_user_id = u.id and other_c.application_set_id <> a.id
            and other_c.school_id = c.school_id and other_c.program_id = c.program_id and other_c.program_intake_id = c.program_intake_id) as "otherApplicationExists"
        from users u join application_sets a on a.user_id = u.id
        join application_choices c on c.application_set_id = a.id and c.user_id = u.id and c.removed_at is null
        left join schools s on s.id = c.school_id and s.status = 'active'
        left join programs p on p.id = c.program_id and p.school_id = s.id and p.status = 'active'
        left join program_intakes pi on pi.id = c.program_intake_id and pi.program_id = p.id and pi.status = 'open'
        where u.id = $1 and a.id = $2 and c.id = $3 and u.account_status = 'active'
          and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student' and r.revoked_at is null)`, [userId, setId, id]);
      if (!rows.length) throw forbidden("Application choice is not available to this student.");
      if (rows.length !== 1) throw serviceUnavailable("Application preparation scope requires reconciliation.");
      const target = rows[0];
      const inventory = await tx.query<PreflightInventory>(`select coalesce(p.revision, 0) as "applicantRevision",
        (p.full_name is not null) as "fullNamePresent", (p.contact_email is not null) as "contactEmailPresent",
        (p.citizenship_country is not null) as "citizenshipCountryPresent", coalesce(e.revision, 0) as "educationRevision",
        coalesce(h.revision, 0) as "assessmentRevision",
        (select count(*)::int from (select 1 from student_education_records where user_id = $1 and removed_at is null limit $2) records) as "educationCount",
        (select count(*)::int from (select 1 from student_assessment_records where user_id = $1 and removed_at is null limit $3) records) as "assessmentCount"
        from users u left join student_applicant_profiles p on p.user_id = u.id
        left join student_education_histories e on e.user_id = u.id left join student_assessment_histories h on h.user_id = u.id where u.id = $1`,
      [userId, MAX_EDUCATION_RECORDS + 1, MAX_ASSESSMENT_RECORDS + 1]);
      if (inventory.length !== 1) throw serviceUnavailable("Application preparation inventory requires reconciliation.");
      const requirements = target.intakeAvailable && target.programId && target.programIntakeId
        ? await getPublishedProgramRequirements(tx, target.programId, target.programIntakeId, target.checkedAt) : null;
      const policy = target.intakeAvailable && target.programId && target.programIntakeId && target.admissionRouteKey
        ? await getPublishedOfficialSubmissionPolicyBinding(tx, target.programId, target.programIntakeId,
          target.admissionRouteKey, target.checkedAt) : null;
      const notice = await new PostgresNoticeReader(tx).getPublished({ ...context, purpose: "public_notice_read" }, "application_disclosure", locale, target.checkedAt);
      const authorizations = await tx.query<PreflightAuthorization>(`select auth.id, auth.status, auth.confirmed_at as "confirmedAt",
        auth.school_id as "schoolId", auth.program_id as "programId", auth.program_intake_id as "programIntakeId",
        auth.authorization_format as "authorizationFormat", auth.admission_route_key as "admissionRouteKey",
        auth.policy_version_id as "policyVersionId", auth.policy_publication_revision as "policyPublicationRevision",
        auth.policy_document_sha256 as "policyDocumentSha256", auth.policy_target_set_sha256 as "policyTargetSetSha256",
        auth.policy_approval_sha256 as "policyApprovalSha256",
        (auth.status = 'active' and ms.revision = auth.material_selection_revision
          and ms.source_set_revision = auth.source_set_revision and ms.source_applicant_revision = auth.source_applicant_revision
          and ms.source_education_revision = auth.source_education_revision and ms.source_assessment_revision = auth.source_assessment_revision
          and ms.selection_json = auth.selection_json and a.revision = auth.source_set_revision
          and coalesce(ap.revision,0) = auth.source_applicant_revision and coalesce(e.revision,0) = auth.source_education_revision
          and coalesce(h.revision,0) = auth.source_assessment_revision and auth.notice_locale = $4
          and auth.notice_scope_key = 'application_disclosure:' || $4 and pub.status = 'active'
          and pub.version_id = auth.notice_version_id and pub.revision = auth.notice_publication_revision
          and pub.content_sha256 = auth.notice_content_sha256 and v.review_status = 'approved'
          and v.content_sha256 = auth.notice_content_sha256 and v.reviewed_at <= $5 and v.effective_from <= $5 and v.review_due_at > $5
        ) as "evidenceCurrent"
        from application_submission_authorizations auth
        join application_sets a on a.id = auth.application_set_id and a.user_id = auth.user_id
        join application_choices c on c.id = auth.application_choice_id and c.application_set_id = a.id and c.user_id = auth.user_id
        left join application_material_selections ms on ms.choice_id = auth.application_choice_id and ms.user_id = auth.user_id
        left join student_applicant_profiles ap on ap.user_id = auth.user_id
        left join student_education_histories e on e.user_id = auth.user_id
        left join student_assessment_histories h on h.user_id = auth.user_id
        left join privacy_notice_publications pub on pub.scope_key = auth.notice_scope_key
        left join privacy_notice_versions v on v.id = pub.version_id and v.scope_key = pub.scope_key
        where auth.user_id = $1 and auth.application_set_id = $2 and auth.application_choice_id = $3
        order by auth.confirmed_at desc, auth.id desc limit 1`, [userId, setId, id, locale, target.checkedAt]);
      const snapshotIds = await tx.query<{ id: string }>(`select id from application_material_snapshots
        where user_id = $1 and application_set_id = $2 and application_choice_id = $3
        order by captured_at desc, id desc limit 1`, [userId, setId, id]);
      let snapshot = null;
      if (snapshotIds[0]) {
        if (!this.snapshotCipher) throw serviceUnavailable("Application material snapshot verification is not configured.");
        const value = await readApplicationMaterialSnapshot(tx, this.snapshotCipher, userId, setId, id, snapshotIds[0].id);
        snapshot = { id: value.id, authorizationId: value.authorization.id, capturedAt: new Date(value.capturedAt),
          schoolId: value.target.schoolId, programId: value.target.programId, programIntakeId: value.target.programIntakeId,
          evidenceCurrent: value.freshness.current };
      }
      const entitlement = await readCurrentApplicationFeeEntitlement(tx, userId, setId, id);
      return buildApplicationPreflight(target, inventory[0], locale, requirements, notice,
        authorizations[0] ?? null, snapshot, policy, entitlement);
    });
  }
}
