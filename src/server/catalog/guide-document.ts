import { createHash } from "node:crypto";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputRecord, inputUuid } from "../shared/input.ts";

export const MAX_GUIDE_VERSION = 2_147_483_647;
export const GUIDE_WITHDRAWAL_REASONS = ["content_correction", "source_expired", "policy_change", "guide_superseded"] as const;
export const GUIDE_TRANSLATION_LOCALES = ["vi", "th", "id", "ms", "ar"] as const;
export type GuideTranslationLocale = typeof GUIDE_TRANSLATION_LOCALES[number];

export type GuideTranslation = {
  title: string;
  subtitle: string | null;
  summary: string | null;
  searchTerms: string[];
  sections: Array<{ key: string; heading: string; body: string }>;
};

type GuideDocumentBase = {
  slug: string;
  titleEn: string;
  titleZh: string | null;
  subtitleEn: string | null;
  subtitleZh: string | null;
  summaryEn: string | null;
  summaryZh: string | null;
  href: string;
  searchTerms: string[];
  sections: Array<{ key: string; headingEn: string; headingZh: string | null; bodyEn: string; bodyZh: string | null }>;
  sources: Array<{ url: string; label: string; capturedAt: string }>;
};

export type GuideDocument = GuideDocumentBase & (
  | { schemaVersion: 1 }
  | { schemaVersion: 2; translations: Partial<Record<GuideTranslationLocale, GuideTranslation>> }
);

export type GuideReviewEvidence = {
  schemaVersion: 1; versionId: string; guideId: string; contentSha256: string; preparedByUserId: string;
  reviewedByUserId: string; reviewedAt: string; effectiveFrom: string; reviewDueAt: string; reviewReference: string;
  contentReviewed: true; sourcesVerified: true; publicContentConfirmed: true;
};

function plainText(value: unknown, field: string, max: number, nullable = false, multiline = false): string | null {
  if (nullable && (value === null || value === "")) return null;
  if (typeof value !== "string" || value.length > max) throw badRequest(`${field} must be bounded plain text.`);
  const normalized = value.replaceAll("\r\n", "\n").trim();
  if (!normalized || /[<>]/u.test(normalized) || Array.from(normalized).some(char => {
    const code = char.codePointAt(0)!;
    return (code < 32 && !(multiline && code === 10)) || (code >= 127 && code <= 159)
      || (code >= 0xd800 && code <= 0xdfff) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  })) throw badRequest(`${field} must contain valid plain text.`);
  return normalized;
}

export function parseGuideDocument(value: unknown): GuideDocument {
  const fields = inputRecord(value, ["schemaVersion", "slug", "titleEn", "titleZh", "subtitleEn", "subtitleZh", "summaryEn", "summaryZh", "href", "searchTerms", "sections", "sources", "translations"]);
  const schemaVersion = inputInteger(fields.schemaVersion, "Guide schemaVersion", 1, 2) as 1 | 2;
  if (schemaVersion === 1 && fields.translations !== undefined) throw badRequest("Guide schemaVersion 1 cannot contain translations.");
  const slug = plainText(fields.slug, "Guide slug", 120)!;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw badRequest("Guide slug must use lowercase URL-safe segments.");
  const href = plainText(fields.href, "Guide href", 240)!;
  if (!/^guide(s|-detail)\.html(?:[?#][A-Za-z0-9_.~!$&'()*+,;=:@/?%-]*)?$/.test(href)) throw badRequest("Guide href must stay on an approved guide route.");
  if (!Array.isArray(fields.searchTerms) || fields.searchTerms.length > 30) throw badRequest("Guide search terms must be a bounded list.");
  const searchTerms = fields.searchTerms.map(item => plainText(item, "Guide search term", 80)!).filter((item, index, all) => all.indexOf(item) === index);
  if (!Array.isArray(fields.sections) || fields.sections.length < 1 || fields.sections.length > 20) throw badRequest("Guide sections are required.");
  const sections = fields.sections.map(item => {
    const row = inputRecord(item, ["key", "headingEn", "headingZh", "bodyEn", "bodyZh"]);
    const key = plainText(row.key, "Guide section key", 80)!;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) throw badRequest("Guide section keys must be URL-safe.");
    return { key, headingEn: plainText(row.headingEn, "Guide section heading", 160)!, headingZh: plainText(row.headingZh, "Guide Chinese section heading", 160, true),
      bodyEn: plainText(row.bodyEn, "Guide section body", 6000, false, true)!, bodyZh: plainText(row.bodyZh, "Guide Chinese section body", 6000, true, true) };
  });
  if (new Set(sections.map(section => section.key)).size !== sections.length) throw badRequest("Guide section keys must be unique.");
  if (!Array.isArray(fields.sources) || fields.sources.length < 1 || fields.sources.length > 20) throw badRequest("Guide official sources are required.");
  const sources = fields.sources.map(item => {
    const row = inputRecord(item, ["url", "label", "capturedAt"]);
    const url = plainText(row.url, "Guide source URL", 2048)!;
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw badRequest("Guide source URL is invalid."); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw badRequest("Guide source URL must use HTTP(S) without credentials.");
    return { url: parsed.toString(), label: plainText(row.label, "Guide source label", 160)!, capturedAt: canonicalTimestamp(row.capturedAt, "Guide source capture time") };
  });
  const base: GuideDocumentBase = { slug, titleEn: plainText(fields.titleEn, "Guide English title", 200)!,
    titleZh: plainText(fields.titleZh, "Guide Chinese title", 200, true), subtitleEn: plainText(fields.subtitleEn, "Guide English subtitle", 240, true),
    subtitleZh: plainText(fields.subtitleZh, "Guide Chinese subtitle", 240, true), summaryEn: plainText(fields.summaryEn, "Guide English summary", 1200, true, true),
    summaryZh: plainText(fields.summaryZh, "Guide Chinese summary", 1200, true, true), href, searchTerms, sections, sources };
  let document: GuideDocument;
  if (schemaVersion === 1) document = { schemaVersion: 1, ...base };
  else {
    const translationFields = inputRecord(fields.translations, [...GUIDE_TRANSLATION_LOCALES]);
    const translations: Partial<Record<GuideTranslationLocale, GuideTranslation>> = {};
    for (const locale of GUIDE_TRANSLATION_LOCALES) {
      if (translationFields[locale] === undefined) continue;
      const translated = inputRecord(translationFields[locale], ["title", "subtitle", "summary", "searchTerms", "sections"]);
      if (!Array.isArray(translated.searchTerms) || translated.searchTerms.length > 30) throw badRequest(`Guide ${locale} search terms must be a bounded list.`);
      const localizedSearchTerms = translated.searchTerms.map(item => plainText(item, `Guide ${locale} search term`, 80)!).filter((item, index, all) => all.indexOf(item) === index);
      if (!Array.isArray(translated.sections) || translated.sections.length !== sections.length) throw badRequest(`Guide ${locale} sections must cover every source section.`);
      const localizedSections = translated.sections.map((item, index) => {
        const row = inputRecord(item, ["key", "heading", "body"]);
        const key = plainText(row.key, `Guide ${locale} section key`, 80)!;
        if (key !== sections[index].key) throw badRequest(`Guide ${locale} section keys must match the source order.`);
        return { key, heading: plainText(row.heading, `Guide ${locale} section heading`, 160)!, body: plainText(row.body, `Guide ${locale} section body`, 6000, false, true)! };
      });
      translations[locale] = { title: plainText(translated.title, `Guide ${locale} title`, 200)!,
        subtitle: plainText(translated.subtitle, `Guide ${locale} subtitle`, 240, true),
        summary: plainText(translated.summary, `Guide ${locale} summary`, 1200, true, true),
        searchTerms: localizedSearchTerms, sections: localizedSections };
    }
    if (!Object.keys(translations).length) throw badRequest("Guide schemaVersion 2 requires at least one complete student-language translation.");
    document = { schemaVersion: 2, ...base, translations };
  }
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > 98_304) throw badRequest("Guide document is too large.");
  return document;
}

export function guideDigest(value: GuideDocument | GuideReviewEvidence): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function guideSha256(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw badRequest("A lowercase SHA-256 is required.");
  return value;
}

export function canonicalTimestamp(value: unknown, field = "Guide timestamp"): string {
  if (typeof value !== "string" || value.length !== 24 || !Number.isFinite(new Date(value).valueOf()) || new Date(value).toISOString() !== value) {
    throw badRequest(`${field} must be a canonical UTC timestamp.`);
  }
  return value;
}

export function guideConfirmation(value: unknown): true {
  if (value !== true) throw badRequest("Explicit guide review confirmation is required.");
  return true;
}

export function guideReviewReference(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(value)) throw badRequest("A bounded guide review reference is required.");
  return value;
}

export type GuideVersionRow = {
  versionId: string; guideId: string; version: number; content: unknown; contentSha256: string; preparedByUserId: string;
  reviewStatus: string; approvedByUserId: string | null; reviewedAt: Date | null; effectiveFrom: Date | null;
  reviewDueAt: Date | null; reviewEvidence: unknown; createdAt: Date;
};

export const guideVersionColumns = `v.id as "versionId", v.guide_id as "guideId", v.version, v.content_json as content,
  v.content_sha256 as "contentSha256", v.prepared_by_user_id as "preparedByUserId", v.review_status as "reviewStatus",
  v.approved_by_user_id as "approvedByUserId", v.reviewed_at as "reviewedAt", v.effective_from as "effectiveFrom",
  v.review_due_at as "reviewDueAt", v.review_evidence_json as "reviewEvidence", v.created_at as "createdAt"`;

export function managedGuideVersion(row: GuideVersionRow, guideId: string) {
  try {
    const document = parseGuideDocument(row.content);
    inputUuid(row.versionId); inputUuid(row.preparedByUserId); inputInteger(row.version, "Guide version", 1, MAX_GUIDE_VERSION);
    if (row.guideId !== guideId || guideDigest(document) !== row.contentSha256) throw new Error("Guide content differs from its version.");
    let review: GuideReviewEvidence | null = null;
    if (row.reviewStatus === "approved") {
      if (!row.approvedByUserId || !row.reviewedAt || !row.effectiveFrom || !row.reviewDueAt || row.createdAt > row.reviewedAt) throw new Error("Guide approval is incomplete.");
      review = parseGuideReview(row.reviewEvidence, { versionId: row.versionId, guideId, contentSha256: row.contentSha256,
        preparedByUserId: row.preparedByUserId, reviewedByUserId: row.approvedByUserId, reviewedAt: row.reviewedAt.toISOString(),
        effectiveFrom: row.effectiveFrom.toISOString(), reviewDueAt: row.reviewDueAt.toISOString() });
    } else if (row.reviewStatus !== "draft" || row.approvedByUserId || row.reviewedAt || row.effectiveFrom || row.reviewDueAt || row.reviewEvidence) throw new Error("Guide draft approval fields are invalid.");
    return { versionId: row.versionId, guideId, version: row.version, contentSha256: row.contentSha256, preparedByUserId: row.preparedByUserId,
      status: row.reviewStatus as "draft" | "approved", createdAt: row.createdAt.toISOString(), document, review, approvalSha256: review ? guideDigest(review) : null };
  } catch { throw serviceUnavailable("Guide version requires reconciliation."); }
}

export function parseGuideReview(value: unknown, binding: Omit<GuideReviewEvidence, "schemaVersion" | "reviewReference" | "contentReviewed" | "sourcesVerified" | "publicContentConfirmed">): GuideReviewEvidence {
  const fields = inputRecord(value, ["schemaVersion", "versionId", "guideId", "contentSha256", "preparedByUserId", "reviewedByUserId", "reviewedAt", "effectiveFrom", "reviewDueAt", "reviewReference", "contentReviewed", "sourcesVerified", "publicContentConfirmed"]);
  inputInteger(fields.schemaVersion, "Guide review schemaVersion", 1, 1);
  const review: GuideReviewEvidence = { schemaVersion: 1, versionId: inputUuid(fields.versionId), guideId: inputUuid(fields.guideId),
    contentSha256: guideSha256(fields.contentSha256), preparedByUserId: inputUuid(fields.preparedByUserId), reviewedByUserId: inputUuid(fields.reviewedByUserId),
    reviewedAt: canonicalTimestamp(fields.reviewedAt), effectiveFrom: canonicalTimestamp(fields.effectiveFrom), reviewDueAt: canonicalTimestamp(fields.reviewDueAt),
    reviewReference: guideReviewReference(fields.reviewReference), contentReviewed: guideConfirmation(fields.contentReviewed),
    sourcesVerified: guideConfirmation(fields.sourcesVerified), publicContentConfirmed: guideConfirmation(fields.publicContentConfirmed) };
  for (const key of Object.keys(binding) as Array<keyof typeof binding>) if (review[key] !== binding[key]) throw badRequest("Guide review binding differs from this version.");
  if (review.preparedByUserId === review.reviewedByUserId || review.reviewedAt > review.effectiveFrom || review.effectiveFrom >= review.reviewDueAt) throw badRequest("Guide review identity or dates are invalid.");
  return review;
}
