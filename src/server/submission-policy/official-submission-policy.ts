import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";

export const MAX_OFFICIAL_SUBMISSION_POLICY_VERSION = 2_147_483_647;
export const MAX_OFFICIAL_SUBMISSION_POLICY_TARGETS = 200;
export const OFFICIAL_SUBMISSION_FORM_MODES = ["one_program_per_form", "multi_program_form"] as const;
export const OFFICIAL_SUBMISSION_ORDERING_MODES = ["none", "ranked"] as const;
export const OFFICIAL_SUBMISSION_CHANNEL_TYPES = ["university_portal", "approved_manual_handoff"] as const;
export const OFFICIAL_SUBMISSION_POLICY_WITHDRAWAL_REASONS = [
  "source_superseded", "source_disputed", "scope_error", "routing_changed", "content_correction", "review_required",
] as const;

export type OfficialSubmissionPolicySource = {
  key: string;
  url: string;
  title: string;
  capturedAt: string;
  contentSha256: string;
};

export type OfficialSubmissionPolicyDocument = {
  schemaVersion: 1;
  admissionRouteKey: string;
  formMode: typeof OFFICIAL_SUBMISSION_FORM_MODES[number];
  maxProgramChoices: number;
  orderingMode: typeof OFFICIAL_SUBMISSION_ORDERING_MODES[number];
  externalChannelType: typeof OFFICIAL_SUBMISSION_CHANNEL_TYPES[number];
  sources: OfficialSubmissionPolicySource[];
};

export type OfficialSubmissionPolicyTarget = { programId: string; programIntakeId: string };
export type OfficialSubmissionPolicySourceCheck = { sourceKey: string; contentSha256: string; officialSourceConfirmed: true };
export type OfficialSubmissionPolicyReviewBinding = {
  versionId: string;
  schoolId: string;
  policyKey: string;
  admissionRouteKey: string;
  documentSha256: string;
  targetSetSha256: string;
  preparedByUserId: string;
  reviewedByUserId: string;
  reviewedAt: string;
  effectiveFrom: string;
  reviewDueAt: string;
};
export type OfficialSubmissionPolicyReviewEvidence = OfficialSubmissionPolicyReviewBinding & {
  schemaVersion: 1;
  scopeConfirmed: true;
  routingConfirmed: true;
  sourceChecks: OfficialSubmissionPolicySourceCheck[];
};

function singleLineText(value: unknown, name: string, max: number): string {
  const result = inputText(value, name, max);
  if (Array.from(result).some(character => {
    const code = character.codePointAt(0)!;
    return code < 32 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029
      || (code >= 0xd800 && code <= 0xdfff);
  })) throw badRequest(`${name} must be valid single-line text.`);
  return result;
}

export function officialSubmissionPolicyKey(value: unknown, name = "Policy key"): string {
  const result = singleLineText(value, name, 64);
  if (!/^[a-z][a-z0-9_-]*$/.test(result)) throw badRequest(`${name} must be a lowercase reference key.`);
  return result;
}

export function officialSubmissionPolicySha256(value: unknown, name = "SHA-256"): string {
  const result = singleLineText(value, name, 64);
  if (!/^[a-f0-9]{64}$/.test(result)) throw badRequest(`${name} must be lowercase SHA-256.`);
  return result;
}

export function officialSubmissionPolicyTimestamp(value: unknown, name = "UTC timestamp"): string {
  const result = singleLineText(value, name, 24), date = new Date(result);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== result) throw badRequest(`${name} must be a canonical UTC timestamp.`);
  return result;
}

export function officialSubmissionPolicyConfirmation(value: unknown): true {
  if (value !== true) throw badRequest("An explicit policy review confirmation is required.");
  return true;
}

function publicSourceUrl(value: unknown): string {
  const source = singleLineText(value, "Source URL", 2048);
  let url: URL;
  try { url = new URL(source); } catch { throw badRequest("Source URL must be a public HTTPS citation."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)
    || /(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(url.hostname)
    || [...url.searchParams.keys()].some(name => /token|secret|password|session|authorization|signature/i.test(name))) {
    throw badRequest("Source URL must be a public HTTPS citation.");
  }
  return url.href;
}

export function parseOfficialSubmissionPolicyDocument(value: unknown, expectedAdmissionRouteKey?: string): OfficialSubmissionPolicyDocument {
  const input = inputRecord(value, ["schemaVersion", "admissionRouteKey", "formMode", "maxProgramChoices", "orderingMode", "externalChannelType", "sources"]);
  inputInteger(input.schemaVersion, "schemaVersion", 1, 1);
  const admissionRouteKey = officialSubmissionPolicyKey(input.admissionRouteKey, "Admission route key");
  if (expectedAdmissionRouteKey !== undefined && admissionRouteKey !== officialSubmissionPolicyKey(expectedAdmissionRouteKey, "Expected admission route key")) {
    throw badRequest("Policy admission route does not match its scope.");
  }
  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 12) throw badRequest("Policy sources must contain 1 to 12 items.");
  const keys = new Set<string>();
  const sources = input.sources.map(value => {
    const source = inputRecord(value, ["key", "url", "title", "capturedAt", "contentSha256"]);
    const key = officialSubmissionPolicyKey(source.key, "Source key");
    if (keys.has(key)) throw badRequest("Policy source keys must be unique.");
    keys.add(key);
    return {
      key,
      url: publicSourceUrl(source.url),
      title: singleLineText(source.title, "Source title", 200),
      capturedAt: officialSubmissionPolicyTimestamp(source.capturedAt, "Source capture time"),
      contentSha256: officialSubmissionPolicySha256(source.contentSha256, "Source digest"),
    };
  });
  const document: OfficialSubmissionPolicyDocument = {
    schemaVersion: 1,
    admissionRouteKey,
    formMode: inputEnum(input.formMode, "Form mode", OFFICIAL_SUBMISSION_FORM_MODES),
    maxProgramChoices: inputInteger(input.maxProgramChoices, "Maximum program choices", 1, 20),
    orderingMode: inputEnum(input.orderingMode, "Ordering mode", OFFICIAL_SUBMISSION_ORDERING_MODES),
    externalChannelType: inputEnum(input.externalChannelType, "External channel type", OFFICIAL_SUBMISSION_CHANNEL_TYPES),
    sources,
  };
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > 32_768) throw badRequest("Official submission policy document is too large.");
  return document;
}

export function officialSubmissionPolicyDocumentDigest(value: OfficialSubmissionPolicyDocument): string {
  return createHash("sha256").update(JSON.stringify(parseOfficialSubmissionPolicyDocument(value))).digest("hex");
}

export function parseOfficialSubmissionPolicyTargets(value: unknown): OfficialSubmissionPolicyTarget[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_OFFICIAL_SUBMISSION_POLICY_TARGETS) {
    throw badRequest(`Policy targets must contain 1 to ${MAX_OFFICIAL_SUBMISSION_POLICY_TARGETS} items.`);
  }
  const intakes = new Set<string>();
  const targets = value.map(value => {
    const target = inputRecord(value, ["programId", "programIntakeId"]);
    const result = { programId: inputUuid(target.programId, "Program id"), programIntakeId: inputUuid(target.programIntakeId, "Program intake id") };
    if (intakes.has(result.programIntakeId)) throw badRequest("Policy program-intake targets must be unique.");
    intakes.add(result.programIntakeId);
    return result;
  });
  return targets.sort((a, b) => a.programIntakeId.localeCompare(b.programIntakeId) || a.programId.localeCompare(b.programId));
}

export function officialSubmissionPolicyTargetSetDigest(
  schoolId: unknown,
  admissionRouteKey: unknown,
  targets: unknown,
): string {
  const canonical = {
    schoolId: inputUuid(schoolId, "School id"),
    admissionRouteKey: officialSubmissionPolicyKey(admissionRouteKey, "Admission route key"),
    targets: parseOfficialSubmissionPolicyTargets(targets),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function parseOfficialSubmissionPolicySourceChecks(value: unknown): OfficialSubmissionPolicySourceCheck[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) throw badRequest("Review every included policy source.");
  const keys = new Set<string>();
  return value.map(value => {
    const input = inputRecord(value, ["sourceKey", "contentSha256", "officialSourceConfirmed"]);
    const sourceKey = officialSubmissionPolicyKey(input.sourceKey, "Source key");
    if (keys.has(sourceKey)) throw badRequest("Policy review source keys must be unique.");
    keys.add(sourceKey);
    return { sourceKey, contentSha256: officialSubmissionPolicySha256(input.contentSha256, "Source digest"),
      officialSourceConfirmed: officialSubmissionPolicyConfirmation(input.officialSourceConfirmed) };
  });
}

function bindSourceChecks(checks: OfficialSubmissionPolicySourceCheck[], document: OfficialSubmissionPolicyDocument) {
  if (checks.length !== document.sources.length) throw badRequest("Review every included policy source.");
  return document.sources.map(source => {
    const check = checks.find(value => value.sourceKey === source.key && value.contentSha256 === source.contentSha256);
    if (!check) throw badRequest("Policy review evidence must match the exact document sources.");
    return check;
  });
}

export function parseOfficialSubmissionPolicyReview(
  value: unknown,
  binding: OfficialSubmissionPolicyReviewBinding,
  document: OfficialSubmissionPolicyDocument,
): OfficialSubmissionPolicyReviewEvidence {
  const input = inputRecord(value, ["schemaVersion", "versionId", "schoolId", "policyKey", "admissionRouteKey", "documentSha256",
    "targetSetSha256", "preparedByUserId", "reviewedByUserId", "reviewedAt", "effectiveFrom", "reviewDueAt", "scopeConfirmed",
    "routingConfirmed", "sourceChecks"]);
  inputInteger(input.schemaVersion, "Review schemaVersion", 1, 1);
  const review: OfficialSubmissionPolicyReviewEvidence = {
    schemaVersion: 1,
    versionId: inputUuid(input.versionId, "Version id"),
    schoolId: inputUuid(input.schoolId, "School id"),
    policyKey: officialSubmissionPolicyKey(input.policyKey),
    admissionRouteKey: officialSubmissionPolicyKey(input.admissionRouteKey, "Admission route key"),
    documentSha256: officialSubmissionPolicySha256(input.documentSha256, "Document digest"),
    targetSetSha256: officialSubmissionPolicySha256(input.targetSetSha256, "Target-set digest"),
    preparedByUserId: inputUuid(input.preparedByUserId, "Preparer id"),
    reviewedByUserId: inputUuid(input.reviewedByUserId, "Reviewer id"),
    reviewedAt: officialSubmissionPolicyTimestamp(input.reviewedAt, "Reviewed at"),
    effectiveFrom: officialSubmissionPolicyTimestamp(input.effectiveFrom, "Effective from"),
    reviewDueAt: officialSubmissionPolicyTimestamp(input.reviewDueAt, "Review due at"),
    scopeConfirmed: officialSubmissionPolicyConfirmation(input.scopeConfirmed),
    routingConfirmed: officialSubmissionPolicyConfirmation(input.routingConfirmed),
    sourceChecks: bindSourceChecks(parseOfficialSubmissionPolicySourceChecks(input.sourceChecks), document),
  };
  for (const key of Object.keys(binding) as (keyof OfficialSubmissionPolicyReviewBinding)[]) {
    if (review[key] !== binding[key]) throw badRequest("Policy review evidence does not match this version.");
  }
  if (review.preparedByUserId === review.reviewedByUserId || review.reviewedAt > review.effectiveFrom
    || review.effectiveFrom >= review.reviewDueAt || document.admissionRouteKey !== review.admissionRouteKey
    || document.sources.some(source => source.capturedAt > review.reviewedAt)) {
    throw badRequest("Policy review identity, route or time scope is invalid.");
  }
  return review;
}

export function officialSubmissionPolicyApprovalDigest(review: OfficialSubmissionPolicyReviewEvidence): string {
  return createHash("sha256").update(JSON.stringify(review)).digest("hex");
}

export type OfficialSubmissionPolicyApprovalRow = {
  versionId: string;
  schoolId: string;
  policyKey: string;
  admissionRouteKey: string;
  documentSha256: string;
  targetSetSha256: string;
  preparedByUserId: string;
  approvedByUserId: string | null;
  reviewedAt: Date | null;
  effectiveFrom: Date | null;
  reviewDueAt: Date | null;
  reviewEvidence: unknown;
};

export function approvedOfficialSubmissionPolicyReview(
  row: OfficialSubmissionPolicyApprovalRow,
  document: OfficialSubmissionPolicyDocument,
): OfficialSubmissionPolicyReviewEvidence {
  if (!row.approvedByUserId || !row.reviewedAt || !row.effectiveFrom || !row.reviewDueAt) throw badRequest("Managed policy review evidence is required.");
  return parseOfficialSubmissionPolicyReview(row.reviewEvidence, {
    versionId: row.versionId,
    schoolId: row.schoolId,
    policyKey: row.policyKey,
    admissionRouteKey: row.admissionRouteKey,
    documentSha256: row.documentSha256,
    targetSetSha256: row.targetSetSha256,
    preparedByUserId: row.preparedByUserId,
    reviewedByUserId: row.approvedByUserId,
    reviewedAt: row.reviewedAt.toISOString(),
    effectiveFrom: row.effectiveFrom.toISOString(),
    reviewDueAt: row.reviewDueAt.toISOString(),
  }, document);
}
