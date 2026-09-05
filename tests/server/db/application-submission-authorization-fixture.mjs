import { createHash, randomUUID } from "node:crypto";
import { PostgresApplicationSubmissionAuthorization } from "../../../src/server/student/postgres-application-submission-authorization.ts";
import { APPLICATION_AUTHORIZATION_CONFIRMATION } from "../../../src/server/student/application-submission-authorization.ts";
import { materialSelectionFixture } from "./material-selection-fixture.mjs";
import { approvePolicy, officialSubmissionPolicyFixture, policyPublishInput } from "./official-submission-policy-fixture.mjs";

export async function applicationSubmissionAuthorizationFixture(pool, existingUserId, options = {}) {
  const f = await materialSelectionFixture(pool, existingUserId, true, options);
  await f.publish();
  if (options.legacyChoiceSchema) return legacyAuthorizationFixture(pool, f);
  const policyFixture = await officialSubmissionPolicyFixture(pool, { schoolId: f.catalog.schoolId,
    targets: [{ programId: f.catalog.programId, programIntakeId: f.catalog.intakeId }] });
  const approvedPolicy = await approvePolicy(policyFixture, randomUUID());
  const policyPublications = await policyFixture.service.publish(policyFixture.reviewer, policyFixture.schoolId, policyFixture.policyKey,
    policyFixture.admissionRouteKey, policyPublishInput(approvedPolicy));
  const currentSet = await f.student.getOwnApplicationSet(f.context, f.set.id);
  await f.student.updateOwnApplicationChoice(f.context, f.set.id, f.choice.id,
    { expectedRevision: currentSet.revision, admissionRouteKey: policyFixture.admissionRouteKey });
  const materialInput = await f.request();
  const savedSelection = await f.selectionPut({ expectedRevision: 0, ...materialInput });
  const preview = await f.preview(materialInput);
  const notice = await f.notices.get();
  if (!notice) throw new Error("Synthetic application disclosure notice was not published.");
  const policy = await policyFixture.getPublished({ programId: f.catalog.programId, programIntakeId: f.catalog.intakeId });
  if (!policy) throw new Error("Synthetic official submission policy was not published.");
  const service = new PostgresApplicationSubmissionAuthorization(f.client);
  const authorizationInput = {
    locale: notice.locale,
    expectedMaterialSelectionRevision: savedSelection.revision,
    expectedVersions: savedSelection.savedVersions,
    expectedNotice: { versionId: notice.versionId, publicationRevision: notice.publicationRevision,
      contentSha256: notice.contentSha256 },
    expectedPolicy: { admissionRouteKey: policy.admissionRouteKey, versionId: policy.versionId,
      publicationRevision: policy.publicationRevision, documentSha256: policy.documentSha256 },
    materialContentSha256: preview.contentSha256,
    confirmation: APPLICATION_AUTHORIZATION_CONFIRMATION,
  };
  return { ...f, service, savedSelection, preview, notice, policyFixture, approvedPolicy, policyPublications, policy, authorizationInput,
    authorizationPath: f.selectionPath.replace("/material-selection", "/submission-authorization"),
    recordAuthorization: (value = authorizationInput, key = randomUUID(), target = {}) => service.record(f.context,
      target.applicationSetId ?? f.set.id, target.choiceId ?? f.choice.id, value, key),
    getAuthorization: (target = {}) => service.get(f.context, target.applicationSetId ?? f.set.id, target.choiceId ?? f.choice.id),
    withdrawAuthorization: (authorizationId, target = {}) => service.withdraw(f.context,
      target.applicationSetId ?? f.set.id, target.choiceId ?? f.choice.id, { authorizationId }) };
}

async function legacyAuthorizationFixture(pool, f) {
  const savedSelection = await f.selectionPut(), preview = await f.preview(), notice = await f.notices.get();
  if (!notice) throw new Error("Synthetic application disclosure notice was not published.");
  const authorizationInput = {
    locale: notice.locale, expectedMaterialSelectionRevision: savedSelection.revision,
    expectedVersions: savedSelection.savedVersions,
    expectedNotice: { versionId: notice.versionId, publicationRevision: notice.publicationRevision,
      contentSha256: notice.contentSha256 }, materialContentSha256: preview.contentSha256,
    confirmation: APPLICATION_AUTHORIZATION_CONFIRMATION,
  };
  const recordAuthorization = async (value = authorizationInput, key = randomUUID()) => {
    const binding = legacyDigests(f, savedSelection, preview, notice), now = new Date();
    const row = (await pool.query(`insert into application_submission_authorizations
      (user_id,application_set_id,application_choice_id,school_id,program_id,program_intake_id,
       material_selection_revision,source_set_revision,source_applicant_revision,source_education_revision,
       source_assessment_revision,selection_json,selection_sha256,material_content_sha256,notice_scope_key,
       notice_locale,notice_version_id,notice_publication_revision,notice_content_sha256,scope_sha256,
       confirmed_request_id,confirmed_at,created_at,updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22,$22)
      returning id,confirmed_at as "confirmedAt"`, [f.userId, f.set.id, f.choice.id, f.catalog.schoolId,
      f.catalog.programId, f.catalog.intakeId, savedSelection.revision, savedSelection.savedVersions.applicationSet,
      savedSelection.savedVersions.applicant, savedSelection.savedVersions.education, savedSelection.savedVersions.assessments,
      JSON.stringify(binding.selection), binding.selectionSha256, preview.contentSha256, `application_disclosure:${notice.locale}`,
      notice.locale, notice.versionId, notice.publicationRevision, notice.contentSha256, binding.scopeSha256, key, now])).rows[0];
    return { id: row.id, status: "active", canSubmit: false,
      target: { applicationSetId: f.set.id, choiceId: f.choice.id, schoolId: f.catalog.schoolId,
        programId: f.catalog.programId, programIntakeId: f.catalog.intakeId },
      material: { selectionRevision: savedSelection.revision, sourceVersions: savedSelection.savedVersions,
        selectionSha256: binding.selectionSha256, contentSha256: preview.contentSha256 },
      notice: { noticeKey: "application_disclosure", locale: notice.locale, versionId: notice.versionId,
        publicationRevision: notice.publicationRevision, contentSha256: notice.contentSha256 },
      officialSubmissionPolicy: null,
      confirmation: { format: "cuac.application-submission-authorization.v1", method: "authenticated_explicit_action",
        scopeSha256: binding.scopeSha256, confirmedAt: row.confirmedAt.toISOString() },
      endedAt: null, endReason: null, freshness: { current: true, reasons: [] } };
  };
  return { ...f, service: new PostgresApplicationSubmissionAuthorization(f.client), savedSelection, preview, notice,
    authorizationInput, authorizationPath: f.selectionPath.replace("/material-selection", "/submission-authorization"),
    recordAuthorization, getAuthorization: () => { throw new Error("Legacy fixture must be read after migration."); },
    withdrawAuthorization: () => { throw new Error("Legacy fixture must be migrated before withdrawal."); } };
}

function legacyDigests(f, savedSelection, preview, notice) {
  const selection = savedSelection.selection;
  const selectionSha256 = sha256(JSON.stringify(selection));
  const envelope = { format: "cuac.application-submission-authorization.v1", purpose: "application_submission",
    recipient: { type: "school", schoolId: f.catalog.schoolId },
    target: { applicationSetId: f.set.id, applicationChoiceId: f.choice.id,
      programId: f.catalog.programId, programIntakeId: f.catalog.intakeId },
    material: { selectionRevision: savedSelection.revision, sourceVersions: savedSelection.savedVersions,
      selectionSha256, contentSha256: preview.contentSha256 },
    notice: { scopeKey: `application_disclosure:${notice.locale}`, locale: notice.locale, versionId: notice.versionId,
      publicationRevision: notice.publicationRevision, contentSha256: notice.contentSha256 } };
  return { selection, selectionSha256, scopeSha256: sha256(JSON.stringify({ userId: f.userId, ...envelope })) };
}

const sha256 = value => createHash("sha256").update(value).digest("hex");

export async function clearApplicationSubmissionAuthorizations(pool) {
  await pool.query("delete from student_application_command_receipts where operation = 'application_authorization.record'");
  await pool.query("delete from application_submission_authorizations");
}
