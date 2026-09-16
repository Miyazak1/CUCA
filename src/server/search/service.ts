import type { RequestContext } from "../shared/request-context.ts";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { authorizePublicCatalogRead } from "../catalog/service.ts";

export const SITE_SEARCH_TYPES = ["program", "school", "scholarship", "city", "guide"] as const;

export const SITE_SEARCH_SYNONYMS = Object.freeze({
  "ai": "artificial intelligence",
  "cs": "computer science",
  "comp sci": "computer science",
  "undergrad": "undergraduate",
  "bachelors": "bachelor",
  "masters": "master",
  "master's": "master",
} as const);

export type SiteSearchType = (typeof SITE_SEARCH_TYPES)[number];
export type SiteSearchLocale = "en" | "zh";

export type SiteSearchItem = {
  type: SiteSearchType;
  id: string;
  slug: string;
  title: string;
  titleZh: string | null;
  displayTitle?: string;
  alternateTitle?: string | null;
  subtitle: string | null;
  summary: string | null;
  href: string;
  verificationStatus: string;
  lastVerifiedAt: Date | null;
  matchedFields: Array<"title" | "catalog">;
};

export type SiteSearchGroup = {
  type: SiteSearchType;
  total: number;
  items: SiteSearchItem[];
  nextCursor: string | null;
};

export type SiteSearchInput = {
  query: string;
  types: SiteSearchType[];
  limit: number;
  offset: number;
};

export type SiteSearchRequestInput = Partial<Omit<SiteSearchInput, "offset">> & { cursor?: unknown; locale?: unknown };

export type SiteSearchRepository = {
  search(input: SiteSearchInput): Promise<SiteSearchGroup[]>;
  getPublicationRevision?(): Promise<string>;
};

export class SiteSearchService {
  private readonly repository: SiteSearchRepository;

  constructor(repository: SiteSearchRepository) {
    this.repository = repository;
  }

  async search(context: RequestContext, input: SiteSearchRequestInput = {}) {
    authorizePublicCatalogRead(context);
    const query = normalizeSiteSearchQuery(input.query);
    const types = normalizeSiteSearchTypes(input.types);
    const limit = normalizeSiteSearchLimit(input.limit);
    const locale = normalizeSiteSearchLocale(input.locale);
    const interpretedQuery = expandSiteSearchQuery(query);
    const offset = decodeSiteSearchCursor(input.cursor, query, types, locale);
    const { groups, catalogRevision } = await this.readStableSearch({ query: interpretedQuery, types, limit, offset });
    return {
      query,
      locale,
      catalogRevision,
      interpretedQuery: interpretedQuery === query.toLocaleLowerCase() ? null : interpretedQuery,
      groups: groups.map(group => ({
        ...group,
        items: group.items.map(item => ({
          ...item,
          displayTitle: locale === "zh" && item.titleZh?.trim() ? item.titleZh : item.title,
          alternateTitle: locale === "zh" && item.titleZh?.trim() ? item.title : item.titleZh,
        })),
        nextCursor: types.length === 1 && offset + group.items.length < group.total
          ? encodeSiteSearchCursor({ query, type: group.type, locale, offset: offset + group.items.length })
          : null,
      })),
    };
  }

  private async readStableSearch(input: SiteSearchInput): Promise<{ groups: SiteSearchGroup[]; catalogRevision: string }> {
    if (!this.repository.getPublicationRevision) {
      return { groups: await this.repository.search(input), catalogRevision: "unversioned" };
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const before = await this.repository.getPublicationRevision();
      const groups = await this.repository.search(input);
      const after = await this.repository.getPublicationRevision();
      if (before === after) return { groups, catalogRevision: after };
    }
    throw serviceUnavailable("Published catalog changed during search. Retry the request.");
  }
}

export function normalizeSiteSearchQuery(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw badRequest("Search query must be text.");
  const normalized = Array.from(value.normalize("NFKC"), (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
  if (normalized.length > 120) throw badRequest("Search query must be at most 120 characters.");
  return normalized;
}

export function normalizeSiteSearchTypes(value: unknown): SiteSearchType[] {
  if (value == null) return [...SITE_SEARCH_TYPES];
  if (!Array.isArray(value) || value.length === 0) throw badRequest("Search types must contain at least one supported type.");
  const result: SiteSearchType[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !SITE_SEARCH_TYPES.includes(item as SiteSearchType)) {
      throw badRequest("Search type is not supported.");
    }
    if (!result.includes(item as SiteSearchType)) result.push(item as SiteSearchType);
  }
  return result;
}

export function normalizeSiteSearchLimit(value: unknown): number {
  if (value == null) return 8;
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50) {
    throw badRequest("Search limit must be an integer from 1 to 50.");
  }
  return Number(value);
}

export function normalizeSiteSearchLocale(value: unknown): SiteSearchLocale {
  if (value == null || value === "" || value === "en") return "en";
  if (typeof value === "string" && ["zh", "zh-cn"].includes(value.toLocaleLowerCase())) return "zh";
  throw badRequest("Search locale is not supported.");
}

export function expandSiteSearchQuery(query: string): string {
  const normalized = query.toLocaleLowerCase();
  const phrase = SITE_SEARCH_SYNONYMS[normalized as keyof typeof SITE_SEARCH_SYNONYMS];
  if (phrase) return phrase;
  return normalized.split(" ").map(token => SITE_SEARCH_SYNONYMS[token as keyof typeof SITE_SEARCH_SYNONYMS] ?? token).join(" ");
}

export function encodeSiteSearchCursor(input: { query: string; type: SiteSearchType; locale: SiteSearchLocale; offset: number }): string {
  return Buffer.from(JSON.stringify({ v: 2, q: input.query, t: input.type, l: input.locale, o: input.offset }), "utf8").toString("base64url");
}

export function decodeSiteSearchCursor(value: unknown, query: string, types: SiteSearchType[], locale: SiteSearchLocale): number {
  if (value == null || value === "") return 0;
  if (typeof value !== "string" || value.length > 512 || types.length !== 1) throw badRequest("Search cursor is invalid.");
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (cursor.v !== 2 || cursor.q !== query || cursor.t !== types[0] || cursor.l !== locale || !Number.isSafeInteger(cursor.o)
      || Number(cursor.o) < 1 || Number(cursor.o) > 10_000) throw new Error("invalid");
    return Number(cursor.o);
  } catch {
    throw badRequest("Search cursor is invalid.");
  }
}
