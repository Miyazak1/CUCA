import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputUuid } from "../shared/input.ts";

export const NOTICE_KEYS = ["application_disclosure"] as const;
export const NOTICE_LOCALES = ["en", "zh-CN"] as const;
export const NOTICE_DATA = ["applicant_basics", "education_history", "assessment_results", "application_choices"] as const;
export const NOTICE_SECTIONS = ["controller", "purpose", "processing", "data_categories", "recipients", "retention", "rights", "contact", "applicants"] as const;
export const NOTICE_WITHDRAWAL_REASONS = ["wording_correction", "scope_change", "review_required", "policy_superseded"] as const;
export const MAX_NOTICE_VERSION = 2_147_483_647;
export type NoticeKey = typeof NOTICE_KEYS[number];
export type NoticeLocale = typeof NOTICE_LOCALES[number];
export type NoticeScope = { noticeKey: NoticeKey; locale: NoticeLocale; scopeKey: string };
export type NoticeDocument = {
  schemaVersion: 1; noticeKey: NoticeKey; locale: NoticeLocale; title: string;
  coveredData: (typeof NOTICE_DATA[number])[];
  sections: { key: typeof NOTICE_SECTIONS[number]; heading: string; body: string }[];
};

function text(value: unknown, field: string, max: number, multiline = false): string {
  if (typeof value !== "string" || value.length > max) throw badRequest(`${field} must be bounded plain text.`);
  const normalized = value.replaceAll("\r\n", "\n").trim();
  if (!normalized || /[<>]/u.test(normalized) || Array.from(normalized).some(char => {
    const code = char.codePointAt(0)!;
    return (code < 32 && !(multiline && code === 10)) || (code >= 127 && code <= 159)
      || (code >= 0xd800 && code <= 0xdfff) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  })) throw badRequest(`${field} must contain valid plain text.`);
  return normalized;
}

export function noticeScope(noticeKey: unknown, locale: unknown): NoticeScope {
  const key = inputEnum(noticeKey, "Notice key", NOTICE_KEYS), language = inputEnum(locale, "Notice locale", NOTICE_LOCALES);
  return { noticeKey: key, locale: language, scopeKey: `${key}:${language}` };
}

export function parseNoticeDocument(value: unknown, scope: NoticeScope): NoticeDocument {
  const fields = inputRecord(value, ["schemaVersion", "noticeKey", "locale", "title", "coveredData", "sections"]);
  inputInteger(fields.schemaVersion, "Notice schemaVersion", 1, 1);
  const declared = noticeScope(fields.noticeKey, fields.locale);
  if (declared.scopeKey !== scope.scopeKey) throw badRequest("Notice document scope must match its version.");
  if (!Array.isArray(fields.coveredData) || fields.coveredData.length < 1 || fields.coveredData.length > NOTICE_DATA.length) throw badRequest("Notice data categories are required.");
  const coveredData = Array.from(fields.coveredData, item => inputEnum(item, "Notice data category", NOTICE_DATA));
  if (new Set(coveredData).size !== coveredData.length) throw badRequest("Notice data categories must be unique.");
  if (!Array.isArray(fields.sections) || fields.sections.length !== NOTICE_SECTIONS.length) throw badRequest("Every notice section is required.");
  const sections = Array.from(fields.sections, item => {
    const section = inputRecord(item, ["key", "heading", "body"]);
    return { key: inputEnum(section.key, "Notice section", NOTICE_SECTIONS), heading: text(section.heading, "Notice heading", 120), body: text(section.body, "Notice body", 6000, true) };
  });
  if (new Set(sections.map(section => section.key)).size !== NOTICE_SECTIONS.length) throw badRequest("Notice sections must be unique.");
  const document: NoticeDocument = { schemaVersion: 1, noticeKey: scope.noticeKey, locale: scope.locale,
    title: text(fields.title, "Notice title", 160), coveredData: NOTICE_DATA.filter(key => coveredData.includes(key)), sections };
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > 49_152) throw badRequest("Notice document is too large.");
  return document;
}

export function noticeDigest(value: NoticeDocument | NoticeReviewEvidence): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function noticeSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw badRequest("A lowercase SHA-256 is required.");
  return value;
}

export function noticeTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length !== 24 || !Number.isFinite(new Date(value).valueOf()) || new Date(value).toISOString() !== value) throw badRequest("A canonical UTC timestamp is required.");
  return value;
}

export function noticeConfirmation(value: unknown): true {
  if (value !== true) throw badRequest("Explicit notice review confirmation is required.");
  return true;
}

export function noticeReviewReference(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(value)) throw badRequest("A bounded review reference is required.");
  return value;
}

export type NoticeReviewBinding = {
  versionId: string; scopeKey: string; documentSha256: string; preparedByUserId: string; reviewedByUserId: string;
  reviewedAt: string; effectiveFrom: string; reviewDueAt: string;
};
export type NoticeReviewEvidence = NoticeReviewBinding & {
  schemaVersion: 1; reviewReference: string; scopeConfirmed: true; wordingReviewed: true; publicContentConfirmed: true;
};

export function parseNoticeReview(value: unknown, binding: NoticeReviewBinding): NoticeReviewEvidence {
  const fields = inputRecord(value, ["schemaVersion", "versionId", "scopeKey", "documentSha256", "preparedByUserId", "reviewedByUserId",
    "reviewedAt", "effectiveFrom", "reviewDueAt", "reviewReference", "scopeConfirmed", "wordingReviewed", "publicContentConfirmed"]);
  inputInteger(fields.schemaVersion, "Review schemaVersion", 1, 1);
  const review: NoticeReviewEvidence = { schemaVersion: 1, versionId: inputUuid(fields.versionId), scopeKey: text(fields.scopeKey, "Review scope", 80),
    documentSha256: noticeSha256(fields.documentSha256), preparedByUserId: inputUuid(fields.preparedByUserId), reviewedByUserId: inputUuid(fields.reviewedByUserId),
    reviewedAt: noticeTimestamp(fields.reviewedAt), effectiveFrom: noticeTimestamp(fields.effectiveFrom), reviewDueAt: noticeTimestamp(fields.reviewDueAt),
    reviewReference: noticeReviewReference(fields.reviewReference), scopeConfirmed: noticeConfirmation(fields.scopeConfirmed),
    wordingReviewed: noticeConfirmation(fields.wordingReviewed), publicContentConfirmed: noticeConfirmation(fields.publicContentConfirmed) };
  for (const key of Object.keys(binding) as (keyof NoticeReviewBinding)[]) if (review[key] !== binding[key]) throw badRequest("Notice review binding differs from this version.");
  if (review.preparedByUserId === review.reviewedByUserId || review.reviewedAt > review.effectiveFrom || review.effectiveFrom >= review.reviewDueAt) throw badRequest("Notice review identity or dates are invalid.");
  return review;
}
