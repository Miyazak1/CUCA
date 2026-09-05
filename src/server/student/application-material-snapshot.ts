import { createHash } from "node:crypto";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputRecord, inputUuid } from "../shared/input.ts";
import { noticeSha256 } from "../notices/document.ts";
import {
  buildMaterialPreview,
  MAX_MATERIAL_PREVIEW_BYTES,
  parseMaterialPreview,
  type MaterialPreviewDto,
  type MaterialTarget,
} from "./application-material-preview.ts";

export const APPLICATION_MATERIAL_SNAPSHOT_FORMAT = "cuac.application-material-snapshot.v1" as const;
export const APPLICATION_MATERIAL_SNAPSHOT_SCHEME = "aes-256-gcm-v1" as const;
export const MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES = MAX_MATERIAL_PREVIEW_BYTES + 16 * 1024;

export type ApplicationMaterialSnapshotInput = {
  authorizationId: string;
  expectedAuthorizationScopeSha256: string;
  expectedMaterialContentSha256: string;
};

export type ApplicationMaterialSnapshotCommandInput = ApplicationMaterialSnapshotInput & {
  applicationSetId: string;
  applicationChoiceId: string;
};

export type ApplicationMaterialSnapshotBinding = MaterialTarget & {
  snapshotId: string;
  userId: string;
  authorizationId: string;
  authorizationScopeSha256: string;
  materialContentSha256: string;
  payloadSha256: string;
  payloadFormat: typeof APPLICATION_MATERIAL_SNAPSHOT_FORMAT;
  capturedAt: Date;
};

export type ApplicationMaterialSnapshotPayload = {
  format: typeof APPLICATION_MATERIAL_SNAPSHOT_FORMAT;
  ownerUserId: string;
  authorization: { id: string; scopeSha256: string };
  content: MaterialPreviewDto["content"];
};

export function parseApplicationMaterialSnapshotInput(value: unknown): ApplicationMaterialSnapshotInput {
  const input = inputRecord(value, ["authorizationId", "expectedAuthorizationScopeSha256", "expectedMaterialContentSha256"]);
  return {
    authorizationId: inputUuid(input.authorizationId, "authorizationId"),
    expectedAuthorizationScopeSha256: noticeSha256(input.expectedAuthorizationScopeSha256),
    expectedMaterialContentSha256: noticeSha256(input.expectedMaterialContentSha256),
  };
}

export function requireApplicationMaterialSnapshotQuery(url: string): void {
  if ([...new URL(url).searchParams].length) throw badRequest("Application material snapshots do not accept query parameters.");
}

export function createApplicationMaterialSnapshotPayload(
  ownerUserId: string,
  authorization: { id: string; scopeSha256: string },
  preview: MaterialPreviewDto,
) {
  try {
    const payload: ApplicationMaterialSnapshotPayload = {
      format: APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
      ownerUserId: inputUuid(ownerUserId),
      authorization: { id: inputUuid(authorization.id), scopeSha256: noticeSha256(authorization.scopeSha256) },
      content: preview.content,
    };
    const serialized = JSON.stringify(payload);
    const payloadBytes = Buffer.byteLength(serialized, "utf8");
    if (payloadBytes < 1 || payloadBytes > MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES) throw new Error("Snapshot payload is too large.");
    const payloadSha256 = sha256(serialized);
    parseApplicationMaterialSnapshotPayload(serialized, {
      ownerUserId: payload.ownerUserId,
      authorizationId: payload.authorization.id,
      authorizationScopeSha256: payload.authorization.scopeSha256,
      materialContentSha256: preview.contentSha256,
      payloadSha256,
      target: {
        applicationSetId: payload.content.applicationSetId,
        choiceId: payload.content.choiceId,
        schoolId: payload.content.schoolId,
        programId: payload.content.programId,
        programIntakeId: payload.content.programIntakeId,
      },
    });
    return { payload, serialized, payloadBytes, payloadSha256 };
  } catch {
    throw serviceUnavailable("Application material snapshot payload requires reconciliation.");
  }
}

export function parseApplicationMaterialSnapshotPayload(serialized: string, expected: {
  ownerUserId: string;
  authorizationId: string;
  authorizationScopeSha256: string;
  materialContentSha256: string;
  payloadSha256: string;
  target: MaterialTarget;
}): ApplicationMaterialSnapshotPayload {
  try {
    if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") < 1
      || Buffer.byteLength(serialized, "utf8") > MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES
      || sha256(serialized) !== noticeSha256(expected.payloadSha256)) throw new Error("Invalid payload bytes.");
    const root = inputRecord(JSON.parse(serialized), ["format", "ownerUserId", "authorization", "content"]);
    if (root.format !== APPLICATION_MATERIAL_SNAPSHOT_FORMAT) throw new Error("Invalid payload format.");
    const ownerUserId = inputUuid(root.ownerUserId), authorization = inputRecord(root.authorization, ["id", "scopeSha256"]);
    const authorizationId = inputUuid(authorization.id), authorizationScopeSha256 = noticeSha256(authorization.scopeSha256);
    const content = inputRecord(root.content, ["format", "applicationSetId", "choiceId", "schoolId", "programId",
      "programIntakeId", "sourceVersions", "selection", "materials"]);
    if (content.format !== "cuac.application-material-preview.v1") throw new Error("Invalid material content format.");
    const target: MaterialTarget = {
      applicationSetId: inputUuid(content.applicationSetId),
      choiceId: inputUuid(content.choiceId),
      schoolId: inputUuid(content.schoolId),
      programId: inputUuid(content.programId),
      programIntakeId: inputUuid(content.programIntakeId),
    };
    const request = parseMaterialPreview({ expectedVersions: content.sourceVersions, selection: content.selection });
    const materials = inputRecord(content.materials, ["applicant", "education", "assessments"]);
    const applicant = inputRecord(materials.applicant, request.selection.applicantFields);
    if (!Array.isArray(materials.education) || !Array.isArray(materials.assessments)) throw new Error("Invalid material collections.");
    const rebuilt = buildMaterialPreview(ownerUserId, target, new Date(0), request, {
      applicant,
      education: materials.education as MaterialPreviewDto["content"]["materials"]["education"],
      assessments: materials.assessments as MaterialPreviewDto["content"]["materials"]["assessments"],
    });
    if (JSON.stringify(rebuilt.content) !== JSON.stringify(content)
      || rebuilt.contentSha256 !== noticeSha256(expected.materialContentSha256)
      || ownerUserId !== inputUuid(expected.ownerUserId)
      || authorizationId !== inputUuid(expected.authorizationId)
      || authorizationScopeSha256 !== noticeSha256(expected.authorizationScopeSha256)
      || Object.keys(target).some(key => target[key as keyof MaterialTarget] !== expected.target[key as keyof MaterialTarget])) {
      throw new Error("Payload binding mismatch.");
    }
    return { format: APPLICATION_MATERIAL_SNAPSHOT_FORMAT, ownerUserId,
      authorization: { id: authorizationId, scopeSha256: authorizationScopeSha256 }, content: rebuilt.content };
  } catch {
    throw serviceUnavailable("Application material snapshot payload requires reconciliation.");
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
