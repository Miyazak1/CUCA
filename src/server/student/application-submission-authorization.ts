import { createHash } from "node:crypto";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import { noticeScope, noticeSha256, type NoticeLocale } from "../notices/document.ts";
import {
  MAX_OFFICIAL_SUBMISSION_POLICY_VERSION,
  officialSubmissionPolicyKey,
  officialSubmissionPolicySha256,
} from "../submission-policy/official-submission-policy.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import { MATERIAL_VERSION_FIELDS, parseMaterialPreview, type MaterialVersions } from "./application-material-preview.ts";
import type { MaterialSelection } from "./material-selection.ts";

export const APPLICATION_AUTHORIZATION_CONFIRMATION = "share_selected_application_materials_with_target_school" as const;
export const APPLICATION_AUTHORIZATION_STATUSES = ["active", "withdrawn", "superseded"] as const;
export const APPLICATION_AUTHORIZATION_FORMAT_V1 = "cuac.application-submission-authorization.v1" as const;
export const APPLICATION_AUTHORIZATION_FORMAT_V2 = "cuac.application-submission-authorization.v2" as const;
export const APPLICATION_AUTHORIZATION_FORMATS = [APPLICATION_AUTHORIZATION_FORMAT_V1, APPLICATION_AUTHORIZATION_FORMAT_V2] as const;
export type ApplicationAuthorizationStatus = typeof APPLICATION_AUTHORIZATION_STATUSES[number];

export type ApplicationAuthorizationInput = {
  locale: NoticeLocale;
  expectedMaterialSelectionRevision: number;
  expectedVersions: MaterialVersions;
  expectedNotice: { versionId: string; publicationRevision: number; contentSha256: string };
  expectedPolicy: { admissionRouteKey: string; versionId: string; publicationRevision: number; documentSha256: string };
  materialContentSha256: string;
  confirmation: typeof APPLICATION_AUTHORIZATION_CONFIRMATION;
};
export type ApplicationAuthorizationCommandInput = ApplicationAuthorizationInput & {
  applicationSetId: string;
  applicationChoiceId: string;
};

export function parseApplicationAuthorizationInput(value: unknown): ApplicationAuthorizationInput {
  const input = inputRecord(value, ["locale", "expectedMaterialSelectionRevision", "expectedVersions", "expectedNotice",
    "expectedPolicy", "materialContentSha256", "confirmation"]);
  const scope = noticeScope("application_disclosure", input.locale);
  const versions = inputRecord(input.expectedVersions, MATERIAL_VERSION_FIELDS);
  const notice = inputRecord(input.expectedNotice, ["versionId", "publicationRevision", "contentSha256"]);
  const policy = inputRecord(input.expectedPolicy, ["admissionRouteKey", "versionId", "publicationRevision", "documentSha256"]);
  return {
    locale: scope.locale,
    expectedMaterialSelectionRevision: inputInteger(input.expectedMaterialSelectionRevision,
      "expectedMaterialSelectionRevision", 1, MAX_APPLICANT_REVISION),
    expectedVersions: Object.fromEntries(MATERIAL_VERSION_FIELDS.map(field => [field,
      inputInteger(versions[field], field, field === "applicationSet" ? 1 : 0, MAX_APPLICANT_REVISION)])) as MaterialVersions,
    expectedNotice: { versionId: inputUuid(notice.versionId, "Notice version id"),
      publicationRevision: inputInteger(notice.publicationRevision, "Notice publication revision", 1, MAX_APPLICANT_REVISION),
      contentSha256: noticeSha256(notice.contentSha256) },
    expectedPolicy: {
      admissionRouteKey: officialSubmissionPolicyKey(policy.admissionRouteKey, "Admission route key"),
      versionId: inputUuid(policy.versionId, "Policy version id"),
      publicationRevision: inputInteger(policy.publicationRevision, "Policy publication revision", 1,
        MAX_OFFICIAL_SUBMISSION_POLICY_VERSION),
      documentSha256: officialSubmissionPolicySha256(policy.documentSha256, "Policy document digest"),
    },
    materialContentSha256: noticeSha256(input.materialContentSha256),
    confirmation: inputEnum(input.confirmation, "Authorization confirmation", [APPLICATION_AUTHORIZATION_CONFIRMATION]),
  };
}

export function parseApplicationAuthorizationWithdrawal(value: unknown): { authorizationId: string } {
  const input = inputRecord(value, ["authorizationId"]);
  return { authorizationId: inputUuid(input.authorizationId, "authorizationId") };
}

export type ApplicationAuthorizationBinding = {
  userId: string;
  applicationSetId: string;
  applicationChoiceId: string;
  schoolId: string;
  programId: string;
  programIntakeId: string;
  materialSelectionRevision: number;
  sourceVersions: MaterialVersions;
  selection: MaterialSelection;
  materialContentSha256: string;
  notice: { scopeKey: string; locale: NoticeLocale; versionId: string; publicationRevision: number; contentSha256: string };
  policy: { admissionRouteKey: string; versionId: string; publicationRevision: number; documentSha256: string;
    targetSetSha256: string; approvalSha256: string };
};

export function applicationAuthorizationDigests(binding: ApplicationAuthorizationBinding) {
  try {
    const [userId, applicationSetId, applicationChoiceId, schoolId, programId, programIntakeId, noticeVersionId,
      policyVersionId] =
      [binding.userId, binding.applicationSetId, binding.applicationChoiceId, binding.schoolId,
        binding.programId, binding.programIntakeId, binding.notice.versionId, binding.policy.versionId].map(id => inputUuid(id));
    inputInteger(binding.materialSelectionRevision, "Material selection revision", 1, MAX_APPLICANT_REVISION);
    const normalized = parseMaterialPreview({ expectedVersions: binding.sourceVersions, selection: binding.selection });
    const scope = noticeScope("application_disclosure", binding.notice.locale);
    if (scope.scopeKey !== binding.notice.scopeKey) throw new Error("Wrong notice scope.");
    const publicationRevision = inputInteger(binding.notice.publicationRevision, "Notice publication revision", 1, MAX_APPLICANT_REVISION);
    const noticeContentSha256 = noticeSha256(binding.notice.contentSha256);
    const materialContentSha256 = noticeSha256(binding.materialContentSha256);
    const admissionRouteKey = officialSubmissionPolicyKey(binding.policy.admissionRouteKey, "Admission route key");
    const policyPublicationRevision = inputInteger(binding.policy.publicationRevision, "Policy publication revision", 1,
      MAX_OFFICIAL_SUBMISSION_POLICY_VERSION);
    const policyDocumentSha256 = officialSubmissionPolicySha256(binding.policy.documentSha256, "Policy document digest");
    const policyTargetSetSha256 = officialSubmissionPolicySha256(binding.policy.targetSetSha256, "Policy target-set digest");
    const policyApprovalSha256 = officialSubmissionPolicySha256(binding.policy.approvalSha256, "Policy approval digest");
    const selection = normalized.selection;
    const selectionSha256 = sha256(JSON.stringify(selection));
    const envelope = { format: APPLICATION_AUTHORIZATION_FORMAT_V2,
      purpose: "application_submission" as const, recipient: { type: "school" as const, schoolId },
      target: { applicationSetId, applicationChoiceId, programId, programIntakeId, admissionRouteKey },
      material: { selectionRevision: binding.materialSelectionRevision, sourceVersions: normalized.expectedVersions,
        selectionSha256, contentSha256: materialContentSha256 },
      notice: { scopeKey: scope.scopeKey, locale: scope.locale, versionId: noticeVersionId,
        publicationRevision, contentSha256: noticeContentSha256 },
      policy: { versionId: policyVersionId, publicationRevision: policyPublicationRevision,
        documentSha256: policyDocumentSha256, targetSetSha256: policyTargetSetSha256,
        approvalSha256: policyApprovalSha256 } };
    return { selection, selectionSha256, scopeSha256: sha256(JSON.stringify({ userId, ...envelope })) };
  } catch { throw serviceUnavailable("Application authorization scope requires reconciliation."); }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function requireApplicationAuthorizationQuery(url: string): void {
  if ([...new URL(url).searchParams].length) throw badRequest("Application authorizations do not accept query parameters.");
}
