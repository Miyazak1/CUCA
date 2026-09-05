import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText } from "../shared/input.ts";

export const MAX_REQUIREMENT_DOCUMENT_BYTES = 65_536;
export const REQUIREMENT_CATEGORIES = ["education", "language", "academic_results", "documents", "identity", "application_policy", "other"] as const;
export const REQUIREMENT_STAGES = ["preparation", "submission", "enrollment"] as const;

export type RequirementSource = { key: string; url: string; title: string; capturedAt: string; contentSha256: string };
export type RequirementItem = {
  key: string;
  category: typeof REQUIREMENT_CATEGORIES[number];
  stage: typeof REQUIREMENT_STAGES[number];
  level: "required" | "conditional" | "recommended";
  appliesTo: string;
  ruleText: string;
  evidenceType: "self_report" | "document" | "official_result" | "school_review";
  references: { sourceKey: string; locator: string }[];
};
export type RequirementDocument = {
  schemaVersion: 1;
  language: "en" | "zh";
  coverage: "partial" | "complete";
  sources: RequirementSource[];
  requirements: RequirementItem[];
};
export type PublicProgramRequirementsDto = {
  programId: string; programIntakeId: string; publicationRevision: number;
  versionId: string; version: number; contentSha256: string;
  reviewedAt: string; effectiveFrom: string; reviewDueAt: string;
  assessmentMode: "information_only";
  document: RequirementDocument;
};

function text(value: unknown, name: string, max: number): string {
  const result = inputText(value, name, max);
  if (Array.from(value as string).some(character => {
    const code = character.codePointAt(0)!;
    return code < 32 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff);
  })) throw badRequest(`${name} must be valid single-line text.`);
  return result;
}

function key(value: unknown, name: string): string {
  const result = text(value, name, 64);
  if (!/^[a-z][a-z0-9_-]*$/.test(result)) throw badRequest(`${name} must be a lowercase reference key.`);
  return result;
}

function list(value: unknown, name: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) throw badRequest(`${name} must contain 1 to ${max} items.`);
  return value;
}

export function requirementDigest(document: RequirementDocument): string {
  return createHash("sha256").update(JSON.stringify(parseRequirementDocument(document))).digest("hex");
}

export function parseRequirementDocument(value: unknown): RequirementDocument {
  const input = inputRecord(value, ["schemaVersion", "language", "coverage", "sources", "requirements"]);
  inputInteger(input.schemaVersion, "schemaVersion", 1, 1);
  const sourceKeys = new Set<string>();
  const sources = list(input.sources, "sources", 12).map(value => {
    const source = inputRecord(value, ["key", "url", "title", "capturedAt", "contentSha256"]);
    const sourceKey = key(source.key, "source.key");
    if (sourceKeys.has(sourceKey)) throw badRequest("Source keys must be unique.");
    sourceKeys.add(sourceKey);
    const urlText = text(source.url, "source.url", 2048);
    let url: URL;
    try { url = new URL(urlText); } catch { throw badRequest("Source URL must be a public HTTPS citation."); }
    if (url.protocol !== "https:" || url.username || url.password || url.port || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)
      || /(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(url.hostname)
      || [...url.searchParams.keys()].some(name => /token|secret|password|session|authorization|signature/i.test(name))) {
      throw badRequest("Source URL must be a public HTTPS citation.");
    }
    const capturedAt = text(source.capturedAt, "source.capturedAt", 24);
    const timestamp = new Date(capturedAt);
    if (!Number.isFinite(timestamp.valueOf()) || timestamp.toISOString() !== capturedAt) throw badRequest("Source capture time must be a canonical UTC timestamp.");
    const contentSha256 = text(source.contentSha256, "source.contentSha256", 64);
    if (!/^[a-f0-9]{64}$/.test(contentSha256)) throw badRequest("Source digest must be lowercase SHA-256.");
    return { key: sourceKey, url: url.href, title: text(source.title, "source.title", 200), capturedAt, contentSha256 };
  });
  const itemKeys = new Set<string>();
  const requirements = list(input.requirements, "requirements", 60).map(value => {
    const item = inputRecord(value, ["key", "category", "stage", "level", "appliesTo", "ruleText", "evidenceType", "references"]);
    const itemKey = key(item.key, "requirement.key");
    if (itemKeys.has(itemKey)) throw badRequest("Requirement keys must be unique.");
    itemKeys.add(itemKey);
    const referenceKeys = new Set<string>();
    const references = list(item.references, "references", 5).map(value => {
      const reference = inputRecord(value, ["sourceKey", "locator"]);
      const sourceKey = key(reference.sourceKey, "reference.sourceKey");
      if (!sourceKeys.has(sourceKey) || referenceKeys.has(sourceKey)) throw badRequest("Every requirement reference must identify a unique included source.");
      referenceKeys.add(sourceKey);
      return { sourceKey, locator: text(reference.locator, "reference.locator", 200) };
    });
    return { key: itemKey, category: inputEnum(item.category, "category", REQUIREMENT_CATEGORIES),
      stage: inputEnum(item.stage, "stage", REQUIREMENT_STAGES),
      level: inputEnum(item.level, "level", ["required", "conditional", "recommended"] as const),
      appliesTo: text(item.appliesTo, "appliesTo", 500), ruleText: text(item.ruleText, "ruleText", 2000),
      evidenceType: inputEnum(item.evidenceType, "evidenceType", ["self_report", "document", "official_result", "school_review"] as const), references };
  });
  const document: RequirementDocument = { schemaVersion: 1,
    language: inputEnum(input.language, "language", ["en", "zh"] as const),
    coverage: inputEnum(input.coverage, "coverage", ["partial", "complete"] as const), sources, requirements };
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > MAX_REQUIREMENT_DOCUMENT_BYTES) throw badRequest("Requirement document is too large.");
  return document;
}
