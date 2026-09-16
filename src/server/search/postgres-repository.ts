import type { SqlCatalogClient } from "../catalog/postgres-repository.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import type { SiteSearchGroup, SiteSearchInput, SiteSearchItem, SiteSearchRepository, SiteSearchType } from "./service.ts";

type SearchRow = {
  type: SiteSearchType;
  id: string;
  slug: string;
  title: string;
  titleZh: string | null;
  subtitle: string | null;
  summary: string | null;
  href: string;
  verificationStatus: string;
  lastVerifiedAt: Date | null;
  total: number | string;
};

export class PostgresSiteSearchRepository implements SiteSearchRepository {
  private readonly client: SqlCatalogClient;

  constructor(client: SqlCatalogClient) {
    this.client = client;
  }

  async getPublicationRevision(): Promise<string> {
    const rows = await this.client.query<{ revision: string | number }>(
      "select revision::text as revision from catalog_publication_revisions where scope_key = 'public_catalog' limit 1",
      [],
    );
    if (!rows[0]?.revision) throw serviceUnavailable("Public catalog revision is not initialized.");
    return String(rows[0].revision);
  }

  async search(input: SiteSearchInput): Promise<SiteSearchGroup[]> {
    const groups = await Promise.all(input.types.map(async (type) => {
      const rows = await this.client.query<SearchRow>(buildSearchStatement(type, input.query), searchParams(input.query, input.limit, input.offset));
      return {
        type,
        total: Number(rows[0]?.total ?? 0),
        nextCursor: null,
        items: rows.map((row): SiteSearchItem => ({
          type: row.type,
          id: row.id,
          slug: row.slug,
          title: row.title,
          titleZh: row.titleZh,
          subtitle: row.subtitle,
          summary: row.summary,
          href: row.href,
          verificationStatus: row.verificationStatus,
          lastVerifiedAt: row.lastVerifiedAt,
          matchedFields: titleMatches(row, input.query) ? ["title"] : ["catalog"],
        })),
      };
    }));
    return groups;
  }
}

function titleMatches(row: Pick<SearchRow, "title" | "titleZh">, query: string): boolean {
  const needle = query.toLocaleLowerCase();
  return needle.length > 0 && [row.title, row.titleZh].some(value => value?.normalize("NFKC").toLocaleLowerCase().includes(needle));
}

function searchParams(query: string, limit: number, offset: number): unknown[] {
  const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return [query.toLocaleLowerCase(), ...tokens.map(token => `%${token}%`), limit, offset];
}

function buildSearchStatement(type: SiteSearchType, query: string): string {
  const tokens = query.split(/\s+/).filter(Boolean);
  const tokenClauses = tokens.map((_, index) => `(search_text like $${index + 2} or related_search_text like $${index + 2})`).join(" and ");
  const limitRef = `$${tokens.length + 2}`;
  const offsetRef = `$${tokens.length + 3}`;
  const candidate = candidateSql(type);
  return `with candidates as (
    ${candidate}
  ), matched as (
    select *, count(*) over() as total,
      case
        when lower(title) = $1 or lower(coalesce(title_zh, '')) = $1 then 0
        when lower(title) like $1 || '%' or lower(coalesce(title_zh, '')) like $1 || '%' then 1
        when lower(title) like '%' || $1 || '%' or lower(coalesce(title_zh, '')) like '%' || $1 || '%' then 2
        else 3
      end as relevance_rank
    from candidates
    ${tokenClauses ? `where ${tokenClauses}` : ""}
  )
  select type, id, slug, title, title_zh as "titleZh", subtitle, summary, href,
    verification_status as "verificationStatus", last_verified_at as "lastVerifiedAt", total
  from matched
  order by relevance_rank asc, verified_rank asc, sort_order asc, title asc, id asc
  limit ${limitRef} offset ${offsetRef}`;
}

function candidateSql(type: SiteSearchType): string {
  switch (type) {
    case "program":
      return `select 'program'::text as type, p.id::text as id, p.slug, p.name_en as title, p.name_zh as title_zh,
        concat_ws(' · ', s.name_en, coalesce(c.name_en, s.city)) as subtitle,
        concat_ws(' · ', p.degree_level, p.teaching_language, p.subject_area) as summary,
        'program-detail.html?program=' || p.id::text as href, p.verification_status,
        p.last_verified_at, p.sort_order,
        case when p.verification_status = 'verified' then 0 else 1 end as verified_rank,
        (coalesce(lower(p.name_en), '') || ' ' || coalesce(lower(p.name_zh), '') || ' ' ||
          coalesce(lower(p.field_category), '') || ' ' || coalesce(lower(p.subject_area), '') || ' ' ||
          coalesce(lower(p.degree_level), '') || ' ' || coalesce(lower(p.teaching_language), '') || ' ' ||
          coalesce(lower(p.scholarship_text), '') || ' ' || coalesce(lower(p.english_requirement), '') || ' ' ||
          coalesce(lower(p.hsk_requirement), '')) as search_text,
        lower(concat_ws(' ', s.name_en, s.name_zh, c.name_en, c.name_zh, s.city, s.city_zh)) as related_search_text
      from programs p
      join schools s on s.id = p.school_id and s.status = 'active'
      left join cities c on c.id = coalesce(p.city_id, s.city_id) and c.status = 'active'
      where p.status = 'active'`;
    case "school":
      return `select 'school'::text as type, s.id::text as id, s.slug, s.name_en as title, s.name_zh as title_zh,
        concat_ws(' · ', coalesce(c.name_en, s.city), s.province) as subtitle,
        concat_ws(' · ', s.school_type, s.language_of_instruction) as summary,
        'university-detail.html?university=' || s.id::text as href, s.verification_status,
        s.last_verified_at, 0 as sort_order,
        case when s.verification_status = 'verified' then 0 else 1 end as verified_rank,
        (coalesce(lower(s.name_en), '') || ' ' || coalesce(lower(s.name_zh), '') || ' ' ||
          coalesce(lower(s.slug), '') || ' ' || coalesce(lower(s.city), '') || ' ' ||
          coalesce(lower(s.city_zh), '') || ' ' || coalesce(lower(s.province), '') || ' ' ||
          coalesce(lower(s.school_type), '') || ' ' || coalesce(lower(s.region), '') || ' ' ||
          lower(s.subject_tags::text) || ' ' || lower(s.language_tags::text)) as search_text,
        coalesce(lower(c.name_en), '') || ' ' || coalesce(lower(c.name_zh), '') as related_search_text
      from schools s
      left join cities c on c.id = s.city_id and c.status = 'active'
      where s.status = 'active'`;
    case "scholarship":
      return `select 'scholarship'::text as type, sch.id::text as id, sch.slug, sch.title,
        sch.name_zh as title_zh, concat_ws(' · ', sch.provider_name, sch.type_label) as subtitle,
        coalesce(sch.summary, concat_ws(' · ', sch.funding_level, sch.coverage)) as summary,
        'scholarship-detail.html?scholarship=' || sch.id::text as href, sch.verification_status,
        sch.last_verified_at, sch.sort_order, 0 as verified_rank,
        (coalesce(lower(sch.title), '') || ' ' || coalesce(lower(sch.name_zh), '') || ' ' ||
          coalesce(lower(sch.provider_name), '') || ' ' || coalesce(lower(sch.provider_name_en), '') || ' ' ||
          coalesce(lower(sch.provider_location), '') || ' ' || coalesce(lower(sch.type), '') || ' ' ||
          coalesce(lower(sch.type_label), '') || ' ' || coalesce(lower(sch.funding_level), '') || ' ' ||
          coalesce(lower(sch.coverage), '') || ' ' || coalesce(lower(sch.applicable_degree), '') || ' ' ||
          coalesce(lower(sch.applicable_program), '') || ' ' || coalesce(lower(sch.summary), '') || ' ' ||
          lower(sch.tags::text)) as search_text,
        ''::text as related_search_text
      from scholarships sch
      where sch.status = 'active' and sch.verification_status = 'verified'`;
    case "city":
      return `select 'city'::text as type, c.id::text as id, c.slug, c.name_en as title, c.name_zh as title_zh,
        c.province as subtitle, concat_ws(' · ', c.monthly_cost, c.cost_level) as summary,
        'city-detail.html?city=' || c.slug as href, c.verification_status,
        c.last_verified_at, c.sort_order,
        case when c.verification_status = 'verified' then 0 else 1 end as verified_rank,
        (coalesce(lower(c.name_en), '') || ' ' || coalesce(lower(c.name_zh), '') || ' ' ||
          coalesce(lower(c.slug), '') || ' ' || coalesce(lower(c.province), '') || ' ' ||
          coalesce(lower(c.region), '') || ' ' || lower(c.tags::text) || ' ' ||
          coalesce(lower(c.content_json->>'summary'), '') || ' ' || coalesce(lower(c.content_json->>'overview'), '')) as search_text,
        ''::text as related_search_text
      from cities c
      where c.status = 'active'`;
    case "guide":
      return `select 'guide'::text as type, g.id::text as id, g.slug, g.title_en as title, g.title_zh,
        g.subtitle_en as subtitle, g.summary_en as summary, g.href, g.verification_status,
        g.updated_at as last_verified_at, g.sort_order,
        case when g.verification_status = 'verified' then 0 else 1 end as verified_rank,
        (coalesce(lower(g.title_en), '') || ' ' || coalesce(lower(g.title_zh), '') || ' ' ||
          coalesce(lower(g.subtitle_en), '') || ' ' || coalesce(lower(g.subtitle_zh), '') || ' ' ||
          coalesce(lower(g.summary_en), '') || ' ' || coalesce(lower(g.summary_zh), '') || ' ' ||
          lower(g.search_terms::text)) as search_text,
        ''::text as related_search_text
      from public_guides g
      where g.status = 'published'`;
  }
}
