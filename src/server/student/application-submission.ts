import { createHash } from "node:crypto";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputList, inputRecord, inputUuid } from "../shared/input.ts";
import type { PublishedOfficialSubmissionPolicyBinding } from "../submission-policy/postgres-reader.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";

export const APPLICATION_SUBMISSION_FORMAT = "cuac.application-submission.v1" as const;
export const PROGRAM_APPLICATION_FORMAT_V2 = "cuac.program-application.v2" as const;
export const OFFICIAL_SUBMISSION_GROUP_FORMAT = "cuac.official-submission-group.v1" as const;
export const OFFICIAL_SUBMISSION_DISPATCH_FORMAT = "cuac.official-submission-dispatch.v1" as const;
export const MAX_APPLICATION_SUBMISSION_CHOICES = 20;

export type ApplicationSubmissionInput = {
  expectedRevision: number;
  choiceIds: string[];
  confirmSubmission: true;
};

export type ApplicationSubmissionCommandInput = ApplicationSubmissionInput & {
  applicationSetId: string;
};

export type PreparedProgramApplication = {
  schoolApplicationId: string;
  applicationChoiceId: string;
  schoolId: string;
  programId: string;
  programIntakeId: string;
  admissionRouteKey: string;
  authorizationId: string;
  materialSnapshotId: string;
  feeEntitlementId: string;
  rankOrder: number;
  policy: PublishedOfficialSubmissionPolicyBinding;
};

export type OfficialSubmissionMemberPlan = PreparedProgramApplication & {
  memberPosition: number;
  memberManifestSha256: string;
};

export type OfficialSubmissionGroupPlan = {
  id: string;
  groupSequence: number;
  schoolId: string;
  admissionRouteKey: string;
  policy: PublishedOfficialSubmissionPolicyBinding;
  memberCount: number;
  memberManifestSha256: string;
  members: OfficialSubmissionMemberPlan[];
};

export function parseApplicationSubmissionInput(value: unknown): ApplicationSubmissionInput {
  const input = inputRecord(value, ["expectedRevision", "choiceIds", "confirmSubmission"]);
  const choiceIds = inputList(input.choiceIds, "choiceIds", MAX_APPLICATION_SUBMISSION_CHOICES,
    entry => inputUuid(entry, "choiceId")).sort();
  if (!choiceIds.length) throw badRequest("At least one application choice is required.");
  if (input.confirmSubmission !== true) throw badRequest("Explicit application submission confirmation is required.");
  return {
    expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_APPLICANT_REVISION),
    choiceIds,
    confirmSubmission: true,
  };
}

export function buildOfficialSubmissionGroupPlans(
  applicationSubmissionId: string,
  applications: readonly PreparedProgramApplication[],
  createId: () => string,
): OfficialSubmissionGroupPlan[] {
  try {
    const submissionId = inputUuid(applicationSubmissionId, "Application submission id");
    if (!applications.length || applications.length > MAX_APPLICATION_SUBMISSION_CHOICES) throw new Error("Invalid application count.");
    const scopes = new Map<string, PreparedProgramApplication[]>();
    for (const application of applications) {
      validatePreparedApplication(application);
      const key = groupScopeKey(application);
      scopes.set(key, [...(scopes.get(key) ?? []), application]);
    }

    const pending: Array<Omit<OfficialSubmissionGroupPlan, "groupSequence">> = [];
    for (const key of [...scopes.keys()].sort()) {
      const scope = scopes.get(key)!;
      scope.sort((a, b) => a.rankOrder - b.rankOrder || a.applicationChoiceId.localeCompare(b.applicationChoiceId));
      const policy = scope[0].policy;
      const width = policy.rule.formMode === "one_program_per_form" ? 1 : policy.rule.maxProgramChoices;
      for (let offset = 0; offset < scope.length; offset += width) {
        const id = inputUuid(createId(), "Official submission group id");
        const members = scope.slice(offset, offset + width).map((application, index) => {
          const memberPosition = index + 1;
          return { ...application, memberPosition, memberManifestSha256: submissionSha256({
            schemaVersion: 1,
            applicationSubmissionId: submissionId,
            officialSubmissionGroupId: id,
            memberPosition,
            schoolApplicationId: application.schoolApplicationId,
            applicationChoiceId: application.applicationChoiceId,
            schoolId: application.schoolId,
            programId: application.programId,
            programIntakeId: application.programIntakeId,
            admissionRouteKey: application.admissionRouteKey,
            policyVersionId: application.policy.versionId,
            authorizationId: application.authorizationId,
            materialSnapshotId: application.materialSnapshotId,
            feeEntitlementId: application.feeEntitlementId,
          }) };
        });
        pending.push({
          id,
          schoolId: scope[0].schoolId,
          admissionRouteKey: scope[0].admissionRouteKey,
          policy,
          memberCount: members.length,
          memberManifestSha256: submissionSha256({
            schemaVersion: 1,
            applicationSubmissionId: submissionId,
            officialSubmissionGroupId: id,
            schoolId: scope[0].schoolId,
            admissionRouteKey: scope[0].admissionRouteKey,
            policyVersionId: policy.versionId,
            policyDocumentSha256: policy.documentSha256,
            policyTargetSetSha256: policy.targetSetSha256,
            policyApprovalSha256: policy.approvalSha256,
            rule: policy.rule,
            members: members.map(member => ({ position: member.memberPosition, sha256: member.memberManifestSha256 })),
          }),
          members,
        });
      }
    }
    return pending.map((group, index) => ({ ...group, groupSequence: index + 1 }));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) throw error;
    throw serviceUnavailable("Official submission grouping evidence requires reconciliation.");
  }
}

export function submissionSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function groupScopeKey(application: PreparedProgramApplication): string {
  return JSON.stringify({
    schoolId: application.schoolId,
    admissionRouteKey: application.admissionRouteKey,
    policyVersionId: application.policy.versionId,
    policyDocumentSha256: application.policy.documentSha256,
    policyTargetSetSha256: application.policy.targetSetSha256,
    policyApprovalSha256: application.policy.approvalSha256,
    rule: application.policy.rule,
  });
}

function validatePreparedApplication(application: PreparedProgramApplication): void {
  for (const id of [application.schoolApplicationId, application.applicationChoiceId, application.schoolId,
    application.programId, application.programIntakeId, application.authorizationId,
    application.materialSnapshotId, application.feeEntitlementId, application.policy.versionId]) inputUuid(id);
  inputInteger(application.rankOrder, "Application rank", 0, MAX_APPLICANT_REVISION);
  if (application.policy.schoolId !== application.schoolId
    || application.policy.programId !== application.programId
    || application.policy.programIntakeId !== application.programIntakeId
    || application.policy.admissionRouteKey !== application.admissionRouteKey) {
    throw new Error("Policy target mismatch.");
  }
}
