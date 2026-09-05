import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputUuid } from "../shared/input.ts";
import { noticeScope, type NoticeLocale } from "../notices/document.ts";
import type { PublishedNoticeDto } from "../notices/public-reader.ts";
import type { PublicProgramRequirementsDto } from "../catalog/requirements.ts";
import { officialSubmissionPolicyKey, officialSubmissionPolicySha256, officialSubmissionPolicyTimestamp } from "../submission-policy/official-submission-policy.ts";
import type { PublishedOfficialSubmissionPolicyBinding } from "../submission-policy/postgres-reader.ts";
import { APPLICATION_FEE_ENTITLEMENT_STATUSES, type ApplicationFeeEntitlementEvidence } from "../billing/application-fee-entitlement.ts";
import { APPLICANT_FIELDS, MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import { MAX_EDUCATION_RECORDS } from "./education.ts";
import { MAX_ASSESSMENT_RECORDS } from "./assessments.ts";
import { APPLICATION_AUTHORIZATION_FORMATS, APPLICATION_AUTHORIZATION_FORMAT_V2, APPLICATION_AUTHORIZATION_STATUSES,
  type ApplicationAuthorizationStatus } from "./application-submission-authorization.ts";

export type PreflightTarget = {
  applicationSetId: string; choiceId: string; schoolId: string; programId: string | null; programIntakeId: string | null;
  admissionRouteKey: string | null;
  revision: number; checkedAt: Date; setEditable: boolean; choiceEditable: boolean;
  schoolAvailable: boolean; programAvailable: boolean; intakeAvailable: boolean;
  opensAt: Date | null; deadlineAt: Date | null; scholarshipAvailable: boolean;
  schoolApplicationExists: boolean; otherApplicationExists: boolean;
};
export type PreflightInventory = {
  applicantRevision: number; fullNamePresent: boolean; contactEmailPresent: boolean; citizenshipCountryPresent: boolean;
  educationRevision: number; educationCount: number; assessmentRevision: number; assessmentCount: number;
};
export type PreflightAuthorization = { id: string; status: ApplicationAuthorizationStatus; confirmedAt: Date;
  schoolId: string; programId: string; programIntakeId: string; evidenceCurrent: boolean;
  authorizationFormat: string; admissionRouteKey: string | null; policyVersionId: string | null;
  policyPublicationRevision: number | null; policyDocumentSha256: string | null; policyTargetSetSha256: string | null;
  policyApprovalSha256: string | null };
export type PreflightMaterialSnapshot = { id: string; authorizationId: string; capturedAt: Date;
  schoolId: string; programId: string; programIntakeId: string; evidenceCurrent: boolean };
const platformBlockers = ["SUBMISSION_AUTHORIZATION_UNAVAILABLE", "MATERIAL_SNAPSHOT_UNAVAILABLE", "OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE",
  "BILLING_ENTITLEMENT_UNAVAILABLE", "SUBMISSION_UNAVAILABLE"] as const;
export type PreflightIssue = "APPLICATION_SET_NOT_EDITABLE" | "CHOICE_NOT_EDITABLE" | "SCHOOL_UNAVAILABLE" | "PROGRAM_REQUIRED"
  | "PROGRAM_UNAVAILABLE" | "INTAKE_REQUIRED" | "INTAKE_UNAVAILABLE" | "WINDOW_UNCONFIRMED" | "WINDOW_INVALID"
  | "WINDOW_NOT_OPEN" | "WINDOW_CLOSED" | "SCHOLARSHIP_UNAVAILABLE" | "SCHOOL_APPLICATION_EXISTS"
  | "EXISTING_APPLICATION_REVIEW_REQUIRED" | "ADMISSION_ROUTE_REQUIRED" | "REQUIREMENTS_UNAVAILABLE"
  | "REQUIREMENTS_UNASSESSED" | "NOTICE_UNAVAILABLE";

export function preflightLocale(value: unknown): NoticeLocale { return noticeScope("application_disclosure", value).locale; }
export function parsePreflightQuery(url: string): NoticeLocale {
  const query = new URL(url).searchParams;
  if ([...query.keys()].some(key => key !== "locale") || query.getAll("locale").length !== 1) throw badRequest("One explicit preflight locale is required.");
  return preflightLocale(query.get("locale"));
}
function date(value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("Invalid stored date.");
  return value.toISOString();
}
function collection(revision: number, count: number, max: number) {
  inputInteger(revision, "Revision", 0, MAX_APPLICANT_REVISION); inputInteger(count, "Record count", 0, max);
  if (revision === 0 && count !== 0) throw new Error("Missing collection version.");
  return { revision, recordCount: count };
}

export function buildApplicationPreflight(target: PreflightTarget, inventory: PreflightInventory, locale: NoticeLocale,
  requirements: PublicProgramRequirementsDto | null, notice: PublishedNoticeDto | null,
  authorization: PreflightAuthorization | null = null, snapshot: PreflightMaterialSnapshot | null = null,
  policy: PublishedOfficialSubmissionPolicyBinding | null = null,
  entitlement: ApplicationFeeEntitlementEvidence | null = null) {
  try {
    for (const id of [target.applicationSetId, target.choiceId, target.schoolId]) inputUuid(id);
    for (const id of [target.programId, target.programIntakeId]) if (id !== null) inputUuid(id);
    const admissionRouteKey = target.admissionRouteKey === null ? null
      : officialSubmissionPolicyKey(target.admissionRouteKey, "Admission route key");
    inputInteger(target.revision, "Revision", 1, MAX_APPLICANT_REVISION);
    inputInteger(inventory.applicantRevision, "Revision", 0, MAX_APPLICANT_REVISION);
    const checkedAt = date(target.checkedAt), opensAt = target.opensAt === null ? null : date(target.opensAt);
    const deadlineAt = target.deadlineAt === null ? null : date(target.deadlineAt);
    for (const value of [target.setEditable, target.choiceEditable, target.schoolAvailable, target.programAvailable,
      target.intakeAvailable, target.scholarshipAvailable, target.schoolApplicationExists, target.otherApplicationExists,
      inventory.fullNamePresent, inventory.contactEmailPresent, inventory.citizenshipCountryPresent]) if (typeof value !== "boolean") throw new Error("Invalid stored state.");
    const missingFields = APPLICANT_FIELDS.filter(field => !inventory[`${field}Present`]);
    if (inventory.applicantRevision === 0 && missingFields.length !== APPLICANT_FIELDS.length) throw new Error("Missing applicant version.");
    const issues: PreflightIssue[] = [];
    if (!target.setEditable) issues.push("APPLICATION_SET_NOT_EDITABLE");
    if (!target.choiceEditable) issues.push("CHOICE_NOT_EDITABLE");
    if (!target.schoolAvailable) issues.push("SCHOOL_UNAVAILABLE");
    if (target.programId === null) issues.push("PROGRAM_REQUIRED");
    else if (!target.programAvailable) issues.push("PROGRAM_UNAVAILABLE");
    if (target.programIntakeId === null) issues.push("INTAKE_REQUIRED");
    else if (!target.intakeAvailable) issues.push("INTAKE_UNAVAILABLE");
    if (admissionRouteKey === null) issues.push("ADMISSION_ROUTE_REQUIRED");
    let window: "unavailable" | "unconfirmed" | "invalid" | "not_open" | "closed" | "open" = "unavailable";
    if (target.intakeAvailable) {
      if (opensAt === null || deadlineAt === null) { window = "unconfirmed"; issues.push("WINDOW_UNCONFIRMED"); }
      else if (opensAt >= deadlineAt) { window = "invalid"; issues.push("WINDOW_INVALID"); }
      else if (checkedAt < opensAt) { window = "not_open"; issues.push("WINDOW_NOT_OPEN"); }
      else if (checkedAt >= deadlineAt) { window = "closed"; issues.push("WINDOW_CLOSED"); }
      else window = "open";
    }
    if (!target.scholarshipAvailable) issues.push("SCHOLARSHIP_UNAVAILABLE");
    if (target.schoolApplicationExists) issues.push("SCHOOL_APPLICATION_EXISTS");
    if (target.otherApplicationExists) issues.push("EXISTING_APPLICATION_REVIEW_REQUIRED");
    if (requirements && (requirements.programId !== target.programId || requirements.programIntakeId !== target.programIntakeId
      || !target.intakeAvailable)) throw new Error("Wrong requirement scope.");
    if (notice && (notice.locale !== locale || notice.noticeKey !== "application_disclosure")) throw new Error("Wrong notice scope.");
    let officialSubmissionPolicy = null;
    if (policy) {
      for (const value of [policy.schoolId, policy.programId, policy.programIntakeId, policy.versionId]) inputUuid(value);
      const route = officialSubmissionPolicyKey(policy.admissionRouteKey, "Admission route key");
      if (admissionRouteKey === null || route !== admissionRouteKey || policy.schoolId !== target.schoolId
        || policy.programId !== target.programId || policy.programIntakeId !== target.programIntakeId
        || !target.schoolAvailable || !target.programAvailable || !target.intakeAvailable) throw new Error("Wrong official policy scope.");
      officialSubmissionPolicy = {
        admissionRouteKey: route,
        versionId: policy.versionId,
        version: inputInteger(policy.version, "Policy version", 1, MAX_APPLICANT_REVISION),
        publicationRevision: inputInteger(policy.publicationRevision, "Publication revision", 1, MAX_APPLICANT_REVISION),
        documentSha256: officialSubmissionPolicySha256(policy.documentSha256, "Policy document digest"),
        reviewedAt: officialSubmissionPolicyTimestamp(policy.reviewedAt, "Policy review time"),
        reviewDueAt: officialSubmissionPolicyTimestamp(policy.reviewDueAt, "Policy review due time"),
        rule: {
          formMode: inputEnum(policy.rule.formMode, "Policy form mode", ["one_program_per_form", "multi_program_form"] as const),
          maxProgramChoices: inputInteger(policy.rule.maxProgramChoices, "Maximum program choices", 1, 20),
          orderingMode: inputEnum(policy.rule.orderingMode, "Policy ordering mode", ["none", "ranked"] as const),
          externalChannelType: inputEnum(policy.rule.externalChannelType, "External channel type",
            ["university_portal", "approved_manual_handoff"] as const),
          },
      };
      officialSubmissionPolicySha256(policy.targetSetSha256, "Policy target-set digest");
      officialSubmissionPolicySha256(policy.approvalSha256, "Policy approval digest");
    }
    let submissionAuthorization = null;
    if (authorization) {
      for (const id of [authorization.id, authorization.schoolId, authorization.programId, authorization.programIntakeId]) inputUuid(id);
      const status = inputEnum(authorization.status, "Authorization status", APPLICATION_AUTHORIZATION_STATUSES);
      const format = inputEnum(authorization.authorizationFormat, "Authorization format", APPLICATION_AUTHORIZATION_FORMATS);
      if (!(authorization.confirmedAt instanceof Date) || !Number.isFinite(authorization.confirmedAt.getTime())
        || typeof authorization.evidenceCurrent !== "boolean" || authorization.schoolId !== target.schoolId
        || authorization.programId !== target.programId || authorization.programIntakeId !== target.programIntakeId) throw new Error("Wrong authorization scope.");
      let policyBindingCurrent = false;
      if (format === APPLICATION_AUTHORIZATION_FORMAT_V2) {
        const route = officialSubmissionPolicyKey(authorization.admissionRouteKey, "Authorization admission route key");
        const versionId = inputUuid(authorization.policyVersionId, "Authorization policy version id");
        const publicationRevision = inputInteger(authorization.policyPublicationRevision, "Authorization policy publication revision", 1,
          MAX_APPLICANT_REVISION);
        const documentSha256 = officialSubmissionPolicySha256(authorization.policyDocumentSha256,
          "Authorization policy document digest");
        const targetSetSha256 = officialSubmissionPolicySha256(authorization.policyTargetSetSha256,
          "Authorization policy target-set digest");
        const approvalSha256 = officialSubmissionPolicySha256(authorization.policyApprovalSha256,
          "Authorization policy approval digest");
        policyBindingCurrent = policy !== null && admissionRouteKey !== null && route === admissionRouteKey
          && policy.admissionRouteKey === route && policy.versionId === versionId
          && policy.publicationRevision === publicationRevision && policy.documentSha256 === documentSha256
          && policy.targetSetSha256 === targetSetSha256 && policy.approvalSha256 === approvalSha256;
      } else if ([authorization.admissionRouteKey, authorization.policyVersionId, authorization.policyPublicationRevision,
        authorization.policyDocumentSha256, authorization.policyTargetSetSha256,
        authorization.policyApprovalSha256].some(value => value !== null)) throw new Error("Invalid legacy authorization binding.");
      const current = status === "active" && format === APPLICATION_AUTHORIZATION_FORMAT_V2
        && authorization.evidenceCurrent && policyBindingCurrent && target.setEditable && target.choiceEditable
        && target.schoolAvailable && target.programAvailable && target.intakeAvailable && window === "open"
        && !target.schoolApplicationExists;
      submissionAuthorization = { id: authorization.id, status, format,
        confirmedAt: authorization.confirmedAt.toISOString(), current };
    }
    let materialSnapshot = null;
    if (snapshot) {
      for (const id of [snapshot.id, snapshot.authorizationId, snapshot.schoolId, snapshot.programId, snapshot.programIntakeId]) inputUuid(id);
      if (!(snapshot.capturedAt instanceof Date) || !Number.isFinite(snapshot.capturedAt.getTime())
        || typeof snapshot.evidenceCurrent !== "boolean" || snapshot.schoolId !== target.schoolId
        || snapshot.programId !== target.programId || snapshot.programIntakeId !== target.programIntakeId) throw new Error("Wrong snapshot scope.");
      const current = snapshot.evidenceCurrent && submissionAuthorization?.current === true
        && snapshot.authorizationId === submissionAuthorization.id;
      materialSnapshot = { id: snapshot.id, authorizationId: snapshot.authorizationId,
        capturedAt: snapshot.capturedAt.toISOString(), current };
    }
    let billingEntitlement = null;
    if (entitlement) {
      for (const id of [entitlement.id, entitlement.userId, entitlement.applicationSetId,
        entitlement.applicationChoiceId, entitlement.schoolId, entitlement.programId,
        entitlement.programIntakeId]) inputUuid(id);
      const status = inputEnum(entitlement.status, "Billing entitlement status", APPLICATION_FEE_ENTITLEMENT_STATUSES);
      const route = officialSubmissionPolicyKey(entitlement.admissionRouteKey, "Billing entitlement admission route key");
      if (!(entitlement.grantedAt instanceof Date) || !Number.isFinite(entitlement.grantedAt.getTime())
        || entitlement.expiresAt !== null && (!(entitlement.expiresAt instanceof Date)
          || !Number.isFinite(entitlement.expiresAt.getTime()))
        || typeof entitlement.evidenceCurrent !== "boolean"
        || entitlement.applicationSetId !== target.applicationSetId || entitlement.applicationChoiceId !== target.choiceId
        || entitlement.schoolId !== target.schoolId || entitlement.programId !== target.programId
        || entitlement.programIntakeId !== target.programIntakeId) throw new Error("Wrong billing entitlement scope.");
      const current = status === "active" && entitlement.evidenceCurrent && admissionRouteKey !== null
        && route === admissionRouteKey;
      billingEntitlement = { id: entitlement.id, status, grantedAt: entitlement.grantedAt.toISOString(),
        expiresAt: entitlement.expiresAt?.toISOString() ?? null, current };
    }
    issues.push(requirements ? "REQUIREMENTS_UNASSESSED" : "REQUIREMENTS_UNAVAILABLE");
    if (!notice) issues.push("NOTICE_UNAVAILABLE");
    let blockers = submissionAuthorization?.current ? platformBlockers.filter(code => code !== "SUBMISSION_AUTHORIZATION_UNAVAILABLE")
      : [...platformBlockers];
    if (materialSnapshot?.current) blockers = blockers.filter(code => code !== "MATERIAL_SNAPSHOT_UNAVAILABLE");
    if (officialSubmissionPolicy) blockers = blockers.filter(code => code !== "OFFICIAL_SUBMISSION_POLICY_UNAVAILABLE");
    if (billingEntitlement?.current) blockers = blockers.filter(code => code !== "BILLING_ENTITLEMENT_UNAVAILABLE");
    return {
      applicationSetId: target.applicationSetId, choiceId: target.choiceId, revision: target.revision, checkedAt,
      assessmentMode: "preparation_only" as const, canSubmit: false as const, platformBlockers: blockers, issues,
      target: { schoolId: target.schoolId, programId: target.programId, programIntakeId: target.programIntakeId,
        admissionRouteKey,
        window: { status: window, opensAt: target.intakeAvailable ? opensAt : null, deadlineAt: target.intakeAvailable ? deadlineAt : null } },
      preparation: { applicant: { revision: inventory.applicantRevision, missingFields },
        education: collection(inventory.educationRevision, inventory.educationCount, MAX_EDUCATION_RECORDS),
        assessments: collection(inventory.assessmentRevision, inventory.assessmentCount, MAX_ASSESSMENT_RECORDS) },
      requirements: requirements ? { versionId: requirements.versionId, version: requirements.version,
        publicationRevision: requirements.publicationRevision, contentSha256: requirements.contentSha256,
        language: requirements.document.language, coverage: requirements.document.coverage, assessmentMode: "information_only" as const,
        items: requirements.document.requirements.map(r => ({ key: r.key, category: r.category, stage: r.stage, level: r.level, result: "unassessed" as const })) } : null,
      notice: notice ? { noticeKey: notice.noticeKey, locale: notice.locale, versionId: notice.versionId, version: notice.version,
        publicationRevision: notice.publicationRevision, contentSha256: notice.contentSha256 } : null,
      submissionAuthorization,
      materialSnapshot,
      officialSubmissionPolicy,
      billingEntitlement,
    };
  } catch { throw serviceUnavailable("Application preparation data requires reconciliation."); }
}

export type ApplicationPreflightDto = ReturnType<typeof buildApplicationPreflight>;
