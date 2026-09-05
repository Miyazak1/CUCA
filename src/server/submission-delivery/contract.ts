import { createHash } from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import type { ApplicationMaterialSnapshotPayload } from "../student/application-material-snapshot.ts";

export const OFFICIAL_SUBMISSION_PACKAGE_FORMAT = "cuac.official-submission-package.v1" as const;
export const OFFICIAL_SUBMISSION_RECEIPT_FORMAT = "cuac.official-submission-receipt.v1" as const;
export const MAX_OFFICIAL_SUBMISSION_PACKAGE_BYTES = 9 * 1024 * 1024;

const digestPattern = /^[a-f0-9]{64}$/;
const providerPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const receiptPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const routePattern = /^[a-z][a-z0-9_-]{0,63}$/;

export type OfficialSubmissionPackageMember = {
  position: number;
  schoolApplicationId: string;
  programId: string;
  programIntakeId: string;
  materialContentSha256: string;
  content: ApplicationMaterialSnapshotPayload["content"];
};

export type OfficialSubmissionPackage = {
  format: typeof OFFICIAL_SUBMISSION_PACKAGE_FORMAT;
  outboxId: string;
  groupId: string;
  applicationSubmissionId: string;
  schoolId: string;
  admissionRouteKey: string;
  externalChannelType: "university_portal" | "approved_manual_handoff";
  memberManifestSha256: string;
  members: OfficialSubmissionPackageMember[];
};

export type PreparedOfficialSubmissionPackage = {
  payload: OfficialSubmissionPackage;
  serialized: string;
  payloadSha256: string;
};

export type OfficialSubmissionDeliveryResult =
  | { status: "accepted"; providerName: string; payloadSha256: string; receiptId: string; receivedAt: Date }
  | { status: "not_accepted"; providerName: string; payloadSha256: string }
  | { status: "unknown"; providerName: string; payloadSha256: string };

export function createOfficialSubmissionPackage(input: Omit<OfficialSubmissionPackage, "format">): PreparedOfficialSubmissionPackage {
  try {
    for (const id of [input.outboxId, input.groupId, input.applicationSubmissionId, input.schoolId]) inputUuid(id);
    if (!routePattern.test(input.admissionRouteKey)
      || !["university_portal", "approved_manual_handoff"].includes(input.externalChannelType)
      || !digestPattern.test(input.memberManifestSha256)
      || !Array.isArray(input.members) || input.members.length < 1 || input.members.length > 20) throw new Error();
    const seenApplications = new Set<string>();
    const members = input.members.map((member, index) => {
      for (const id of [member.schoolApplicationId, member.programId, member.programIntakeId]) inputUuid(id);
      if (member.position !== index + 1 || seenApplications.has(member.schoolApplicationId)
        || !digestPattern.test(member.materialContentSha256)
        || member.content.schoolId !== input.schoolId
        || member.content.programId !== member.programId
        || member.content.programIntakeId !== member.programIntakeId) throw new Error();
      seenApplications.add(member.schoolApplicationId);
      return {
        position: member.position,
        schoolApplicationId: member.schoolApplicationId,
        programId: member.programId,
        programIntakeId: member.programIntakeId,
        materialContentSha256: member.materialContentSha256,
        content: member.content,
      };
    });
    const payload: OfficialSubmissionPackage = {
      format: OFFICIAL_SUBMISSION_PACKAGE_FORMAT,
      outboxId: input.outboxId,
      groupId: input.groupId,
      applicationSubmissionId: input.applicationSubmissionId,
      schoolId: input.schoolId,
      admissionRouteKey: input.admissionRouteKey,
      externalChannelType: input.externalChannelType,
      memberManifestSha256: input.memberManifestSha256,
      members,
    };
    const serialized = JSON.stringify(payload);
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes < 1 || bytes > MAX_OFFICIAL_SUBMISSION_PACKAGE_BYTES) throw new Error();
    return { payload, serialized, payloadSha256: sha256(serialized) };
  } catch {
    throw serviceUnavailable("Official submission delivery package requires reconciliation.");
  }
}

export function validateOfficialSubmissionProviderName(value: unknown): string {
  if (typeof value !== "string" || !providerPattern.test(value)) throw invalidProvider();
  return value;
}

export function validateOfficialSubmissionDeliveryResult(
  value: OfficialSubmissionDeliveryResult,
  expected: { providerName: string; payloadSha256: string },
): OfficialSubmissionDeliveryResult {
  try {
    const providerName = validateOfficialSubmissionProviderName(value.providerName);
    if (providerName !== expected.providerName || value.payloadSha256 !== expected.payloadSha256
      || !digestPattern.test(value.payloadSha256)) throw new Error();
    if (value.status === "accepted") {
      if (!receiptPattern.test(value.receiptId) || !(value.receivedAt instanceof Date)
        || !Number.isFinite(value.receivedAt.getTime())) throw new Error();
      return { status: "accepted", providerName, payloadSha256: value.payloadSha256,
        receiptId: value.receiptId, receivedAt: value.receivedAt };
    }
    if (value.status === "not_accepted" || value.status === "unknown") {
      return { status: value.status, providerName, payloadSha256: value.payloadSha256 };
    }
    throw new Error();
  } catch {
    throw serviceUnavailable("Official submission provider result is invalid.");
  }
}

export function officialSubmissionProviderIdempotencyKey(groupId: string): string {
  return `official-submission:${inputUuid(groupId)}`;
}

export function officialSubmissionSha256(value: string): string {
  if (typeof value !== "string") throw serviceUnavailable("Official submission digest input is invalid.");
  return sha256(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function invalidProvider() {
  return serviceUnavailable("Official submission delivery provider is not configured correctly.");
}
