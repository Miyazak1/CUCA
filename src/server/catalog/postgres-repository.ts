import type {
  CatalogListOptions,
  PublicCityDetailDto,
  PublicCityDto,
  PublicGuideDto,
  PublicProgramDetailDto,
  PublicProgramDto,
  PublicProgramIntakeDto,
  PublicScholarshipDetailDto,
  PublicScholarshipDto,
  PublicSchoolDetailDto,
  PublicSchoolDto,
} from "./dto.ts";
import type { CityRow, ProgramProjectionRow, ScholarshipProjectionRow, SchoolProjectionRow } from "./mappers.ts";
import {
  toPublicCityDetailDto,
  toPublicCityDto,
  toPublicProgramDetailDto,
  toPublicProgramDto,
  toPublicScholarshipDetailDto,
  toPublicScholarshipDto,
  toPublicSchoolDetailDto,
  toPublicSchoolDto,
} from "./mappers.ts";
import type { PublicCatalogRepository } from "./service.ts";
import { getPublishedProgramRequirements } from "./postgres-requirements.ts";

export type SqlCatalogClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

export class PostgresCatalogRepository implements PublicCatalogRepository {
  private readonly client: SqlCatalogClient;

  constructor(client: SqlCatalogClient) {
    this.client = client;
  }

  async listPrograms(options: CatalogListOptions): Promise<PublicProgramDto[]> {
    const { whereSql, orderBySql, params } = buildProgramListQuery(options);
    const rows = await this.client.query<ProgramProjectionRow>(
      `${programSelectSql}
       ${whereSql}
       ${orderBySql}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );

    return rows.map(toPublicProgramDto);
  }

  async countPrograms(options: CatalogListOptions): Promise<number> {
    const { whereSql, params } = buildProgramListQuery(options);
    const rows = await this.client.query<{ total: number | string }>(
      `select count(*)::int as total
       ${programListFromSql}
       ${whereSql}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async getProgram(programId: string): Promise<PublicProgramDetailDto | null> {
    const rows = await this.client.query<ProgramProjectionRow>(
      `${programSelectSql}
       where p.id = $1 and p.status = 'active'
       limit 1`,
      [programId],
    );

    return rows[0] ? toPublicProgramDetailDto(rows[0]) : null;
  }

  async listProgramIntakes(programId: string, options: CatalogListOptions): Promise<PublicProgramIntakeDto[]> {
    const rows = await this.client.query<PublicProgramIntakeDto>(
      `select pi.id, pi.program_id as "programId", pi.intake_term as "intakeTerm", pi.intake_year as "intakeYear",
         pi.open_date as "openDate", pi.deadline_date as "deadlineDate", pi.deadline_label as "deadlineLabel",
         pi.application_round as "applicationRound", pi.status
       from program_intakes pi join programs p on p.id = pi.program_id join schools s on s.id = p.school_id
       where pi.program_id = $1 and p.status = 'active' and s.status = 'active' and pi.status = 'open'
         and (pi.deadline_date is null or pi.deadline_date > clock_timestamp())
         and (pi.open_date is null or pi.deadline_date is null or pi.open_date < pi.deadline_date)
       order by pi.intake_year asc, pi.sort_order asc, pi.intake_term asc, pi.id asc
       limit $2 offset $3`, [programId, options.limit ?? 20, options.offset ?? 0],
    );
    return rows.map(row => ({
      id: row.id, programId: row.programId, intakeTerm: row.intakeTerm, intakeYear: row.intakeYear,
      openDate: row.openDate, deadlineDate: row.deadlineDate, deadlineLabel: row.deadlineLabel,
      applicationRound: row.applicationRound, status: row.status,
    }));
  }

  async listSchools(options: CatalogListOptions): Promise<PublicSchoolDto[]> {
    const { whereSql, params } = buildPublicSearchWhere("s", [
      "s.name_en", "s.name_zh", "s.slug", "s.city", "s.city_zh", "s.province", "s.school_type",
      "s.region", "s.subject_tags::text", "s.language_tags::text",
    ], options.query);
    const rows = await this.client.query<SchoolProjectionRow>(
      `${schoolSelectSql}
       ${whereSql}
       order by s.name_en asc, s.slug asc, s.id asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );

    return rows.map(toPublicSchoolDto);
  }

  async getProgramRequirements(programId: string, intakeId: string) {
    return getPublishedProgramRequirements(this.client, programId, intakeId);
  }

  async getSchool(schoolId: string): Promise<PublicSchoolDetailDto | null> {
    const rows = await this.client.query<SchoolProjectionRow>(
      `${schoolSelectSql}
       where s.id = $1 and s.status = 'active'
       limit 1`,
      [schoolId],
    );

    return rows[0] ? toPublicSchoolDetailDto(rows[0]) : null;
  }

  async listScholarships(options: CatalogListOptions): Promise<PublicScholarshipDto[]> {
    const { whereSql, params } = buildPublicSearchWhere("sch", [
      "sch.title", "sch.name_zh", "sch.provider_name", "sch.provider_name_en", "sch.provider_location",
      "sch.type", "sch.type_label", "sch.funding_level", "sch.coverage", "sch.applicable_degree",
      "sch.applicable_program", "sch.summary", "sch.tags::text",
    ], options.query);
    const rows = await this.client.query<ScholarshipProjectionRow>(
      `${scholarshipSelectSql}
       ${whereSql} and sch.verification_status = 'verified'
       order by sch.sort_order asc, sch.title asc, sch.slug asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );

    return rows.map(toPublicScholarshipDto);
  }

  async getScholarship(scholarshipId: string): Promise<PublicScholarshipDetailDto | null> {
    const rows = await this.client.query<ScholarshipProjectionRow>(
      `${scholarshipSelectSql}
       where sch.id = $1 and sch.status = 'active' and sch.verification_status = 'verified'
       limit 1`,
      [scholarshipId],
    );

    return rows[0] ? toPublicScholarshipDetailDto(rows[0]) : null;
  }

  async listCities(options: CatalogListOptions): Promise<PublicCityDto[]> {
    const { whereSql, params } = buildPublicSearchWhere("c", [
      "c.name_en", "c.name_zh", "c.slug", "c.province", "c.region", "c.tags::text",
      "c.content_json->>'summary'", "c.content_json->>'overview'",
    ], options.query);
    const rows = await this.client.query<CityRow>(
      `${citySelectSql}
       ${whereSql}
       order by c.sort_order asc, c.name_en asc, c.slug asc, c.id asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );

    return rows.map(toPublicCityDto);
  }

  async getCity(citySlug: string): Promise<PublicCityDetailDto | null> {
    const rows = await this.client.query<CityRow>(
      `${citySelectSql}
       where c.slug = $1 and c.status = 'active'
       limit 1`,
      [citySlug],
    );

    return rows[0] ? toPublicCityDetailDto(rows[0]) : null;
  }

  async listGuides(options: CatalogListOptions): Promise<PublicGuideDto[]> {
    const params: unknown[] = [];
    const clauses = ["g.status = 'published'"];
    for (const token of String(options.query || "").trim().split(/\s+/).filter(Boolean)) {
      params.push(`%${token.toLowerCase()}%`);
      clauses.push(`${publicGuideSearchSql} like $${params.length}`);
    }
    return this.client.query<PublicGuideDto>(
      `${publicGuideSelectSql}
       where ${clauses.join(" and ")}
       order by g.sort_order asc, g.title_en asc, g.slug asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );
  }

  async getGuide(guideSlug: string): Promise<PublicGuideDto | null> {
    const rows = await this.client.query<PublicGuideDto>(
      `${publicGuideSelectSql}
       where g.slug = $1 and g.status = 'published'
       limit 1`,
      [guideSlug],
    );
    return rows[0] ?? null;
  }
}

const publicGuideSearchSql = `(coalesce(lower(g.title_en), '') || ' ' || coalesce(lower(g.title_zh), '') || ' ' ||
  coalesce(lower(g.subtitle_en), '') || ' ' || coalesce(lower(g.subtitle_zh), '') || ' ' ||
  coalesce(lower(g.summary_en), '') || ' ' || coalesce(lower(g.summary_zh), '') || ' ' || lower(g.search_terms::text))`;

const publicGuideSelectSql = `select g.id::text as id, g.slug, g.title_en as "titleEn", g.title_zh as "titleZh",
  g.subtitle_en as "subtitleEn", g.subtitle_zh as "subtitleZh", g.summary_en as "summaryEn",
  g.summary_zh as "summaryZh", g.content_json as content, g.href, g.verification_status as "verificationStatus",
  g.sort_order as "sortOrder", g.version, g.published_at as "publishedAt", g.updated_at as "updatedAt"
from public_guides g`;

function buildPublicSearchWhere(alias: string, columns: readonly string[], query?: string) {
  const clauses = [`${alias}.status = 'active'`];
  const params: unknown[] = [];

  if (query) {
    const searchExpression = `(${columns.map((column) => column.endsWith("::text")
      ? `lower(${column})`
      : `coalesce(lower(${column}), '')`).join(" || ' ' || ")})`;
    for (const token of query.trim().split(/\s+/).filter(Boolean)) {
      params.push(`%${token.toLowerCase()}%`);
      const paramRef = `$${params.length}`;
      clauses.push(`${searchExpression} like ${paramRef}`);
    }
  }

  return {
    whereSql: `where ${clauses.join(" and ")}`,
    params,
  };
}

function buildProgramListQuery(options: CatalogListOptions) {
  const clauses = ["p.status = 'active'"];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  for (const token of String(options.query || "").trim().split(/\s+/).filter(Boolean)) {
    const ref = add(`%${token.toLowerCase()}%`);
    clauses.push(`((coalesce(lower(p.name_en), '') || ' ' || coalesce(lower(p.name_zh), '') || ' '
      || coalesce(lower(p.field_category), '') || ' ' || coalesce(lower(p.subject_area), '') || ' '
      || coalesce(lower(p.degree_level), '') || ' ' || coalesce(lower(p.teaching_language), '') || ' '
      || coalesce(lower(p.scholarship_text), '') || ' ' || coalesce(lower(p.english_requirement), '') || ' '
      || coalesce(lower(p.hsk_requirement), '')) like ${ref}
      or s.name_en ilike ${ref} or s.name_zh ilike ${ref} or c.name_en ilike ${ref} or c.name_zh ilike ${ref})`);
  }
  if (options.degree) {
    const degree = options.degree.toLowerCase();
    const accepted = degree === "undergraduate" ? ["undergraduate", "bachelor"]
      : degree === "phd" ? ["phd", "doctoral", "doctorate"]
      : degree === "non-degree" ? ["non-degree", "non degree", "language"]
      : [degree];
    clauses.push(`lower(trim(p.degree_level)) = any(${add(accepted)}::text[])`);
  }
  if (options.subject) {
    const ref = add(`%${options.subject}%`);
    clauses.push(`(p.field_category ilike ${ref} or p.subject_area ilike ${ref} or p.name_en ilike ${ref})`);
  }
  if (options.language) clauses.push(`lower(coalesce(p.teaching_language, '')) like ${add(`%${options.language.toLowerCase()}%`)}`);
  if (options.city) {
    const ref = add(options.city.toLowerCase());
    clauses.push(`(lower(coalesce(c.name_en, '')) = ${ref} or lower(coalesce(c.name_zh, '')) = ${ref}
      or lower(coalesce(c.slug, '')) = ${ref} or lower(coalesce(s.city, '')) = ${ref} or lower(coalesce(s.city_zh, '')) = ${ref})`);
  }
  if (options.school) {
    const ref = add(options.school.toLowerCase());
    clauses.push(`(lower(s.id::text) = ${ref} or lower(s.slug) = ${ref} or lower(s.name_en) = ${ref} or lower(coalesce(s.name_zh, '')) = ${ref})`);
  }
  if (options.scholarship) clauses.push("p.has_scholarship = true");
  if (options.upcomingDeadline) clauses.push("next_intake.deadline_date is not null");
  if (options.intake) clauses.push(`lower(coalesce(next_intake.application_round, '')) like ${add(`%${options.intake.toLowerCase()}%`)}`);
  if (options.languageRequirement) {
    const value = options.languageRequirement.toLowerCase();
    if (value === "no-hsk") clauses.push("lower(coalesce(p.hsk_requirement, '')) like '%no hsk%'");
    if (value === "hsk") clauses.push("lower(coalesce(p.hsk_requirement, '')) like '%hsk%'");
    if (value === "ielts") clauses.push("(lower(coalesce(p.english_requirement, '')) like '%ielts%' or lower(coalesce(p.english_requirement, '')) like '%toefl%')");
    if (value === "flexible") clauses.push("lower(concat_ws(' ', p.english_requirement, p.hsk_requirement)) like '%flexible%'");
  }
  if (options.tuition === "under-25") clauses.push("p.tuition_amount > 0 and p.tuition_amount < 25000");
  if (options.tuition === "25-40") clauses.push("p.tuition_amount between 25000 and 40000");
  if (options.tuition === "40-60") clauses.push("p.tuition_amount > 40000 and p.tuition_amount <= 60000");
  if (options.tuition === "60-plus") clauses.push("p.tuition_amount > 60000");

  const now = "clock_timestamp()";
  if (options.deadline === "urgent") clauses.push(`next_intake.deadline_date between ${now} and ${now} + interval '45 days'`);
  if (options.deadline === "closes-soon") clauses.push(`next_intake.deadline_date > ${now} + interval '45 days' and next_intake.deadline_date <= ${now} + interval '70 days'`);
  if (options.deadline === "open") clauses.push(`(next_intake.deadline_date is null or next_intake.deadline_date > ${now} + interval '70 days')`);
  if (options.deadline === "late") clauses.push("lower(coalesce(next_intake.application_round, '')) like '%late%'");

  const orderBySql = options.sort === "deadline"
    ? "order by next_intake.deadline_date asc nulls last, p.name_en asc, p.id asc"
    : options.sort === "tuition"
      ? "order by p.tuition_amount asc nulls last, p.name_en asc, p.id asc"
      : options.sort === "scholarship"
        ? "order by p.has_scholarship desc, p.sort_order asc, p.name_en asc, p.id asc"
        : "order by (p.verification_status = 'verified') desc, p.has_scholarship desc, p.sort_order asc, p.name_en asc, p.id asc";
  return { whereSql: `where ${clauses.join(" and ")}`, orderBySql, params };
}

const programListFromSql = `
from programs p
join schools s on s.id = p.school_id and s.status = 'active'
left join cities c on c.id = coalesce(p.city_id, s.city_id) and c.status = 'active'
  left join lateral (
  select pi.id, pi.deadline_date, pi.deadline_label, pi.application_round
  from program_intakes pi
  where pi.program_id = p.id and pi.status = 'open'
    and (pi.deadline_date is null or pi.deadline_date > clock_timestamp())
    and (pi.open_date is null or pi.deadline_date is null or pi.open_date < pi.deadline_date)
  order by pi.deadline_date asc nulls last
  limit 1
) next_intake on true
left join lateral (
  select pi.intake_term, pi.intake_year, pi.deadline_date, pi.status
  from program_intakes pi
  where pi.program_id = p.id
  order by pi.intake_year desc, pi.sort_order desc, pi.intake_term desc, pi.id desc
  limit 1
) latest_intake on true`;

const programSelectSql = `
select
  p.id,
  p.school_id as "schoolId",
  p.city_id as "cityId",
  p.slug,
  p.name_zh as "nameZh",
  p.name_en as "nameEn",
  p.degree_level as "degreeLevel",
  p.duration_years as "durationYears",
  p.duration_months as "durationMonths",
  p.field_category as "fieldCategory",
  p.subject_area as "subjectArea",
  p.teaching_language as "teachingLanguage",
  p.csca_subjects as "cscaSubjects",
  p.csca_requirement as "cscaRequirement",
  p.hsk_requirement as "hskRequirement",
  p.english_requirement as "englishRequirement",
  p.tuition_amount as "tuitionAmount",
  p.tuition_currency as "tuitionCurrency",
  p.tuition_period as "tuitionPeriod",
  p.tuition_text as "tuitionText",
  p.scholarship_text as "scholarshipText",
  p.application_url as "applicationUrl",
  p.application_note as "applicationNote",
  p.is_verified as "isVerified",
  p.has_scholarship as "hasScholarship",
  p.badge_text as "badgeText",
  p.display_tuition as "displayTuition",
  p.display_subjects as "displaySubjects",
  p.display_group as "displayGroup",
  p.display_group_label as "displayGroupLabel",
  p.sort_order as "sortOrder",
  p.status,
  p.verification_status as "verificationStatus",
  p.source_url as "sourceUrl",
  p.source_label as "sourceLabel",
  p.source_field_lineage_json as "sourceFieldLineageJson",
  p.last_verified_at as "lastVerifiedAt",
  p.created_at as "createdAt",
  p.updated_at as "updatedAt",
  s.slug as "schoolSlug",
  s.name_zh as "schoolNameZh",
  s.name_en as "schoolNameEn",
  c.slug as "citySlug",
  c.name_zh as "cityNameZh",
  c.name_en as "cityNameEn",
  next_intake.deadline_date as "deadlineDate",
  next_intake.deadline_label as "deadlineLabel",
  next_intake.application_round as "applicationRound",
  case
    when next_intake.id is not null then 'open'
    when latest_intake.intake_year is null then 'not_published'
    when latest_intake.deadline_date is not null and latest_intake.deadline_date <= clock_timestamp() then 'expired'
    else 'closed'
  end as "intakeAvailability",
  latest_intake.intake_term as "latestIntakeTerm",
  latest_intake.intake_year as "latestIntakeYear",
  latest_intake.deadline_date as "latestIntakeDeadlineDate"
${programListFromSql}`;

const schoolSelectSql = `
select
  s.id,
  s.slug,
  s.name_zh as "nameZh",
  s.name_en as "nameEn",
  s.school_type as "schoolType",
  s.region,
  s.city_id as "cityId",
  s.city,
  s.city_zh as "cityZh",
  s.city_slug as "citySlug",
  s.province,
  s.region_label as "regionLabel",
  s.ranking,
  s.csca_required as "cscaRequired",
  s.csca_requirement as "cscaRequirement",
  s.csca_subjects as "cscaSubjects",
  s.application_level as "applicationLevel",
  s.language_of_instruction as "languageOfInstruction",
  s.language_requirement as "languageRequirement",
  s.hsk_requirement as "hskRequirement",
  s.english_requirement as "englishRequirement",
  s.deadline_summary as "deadlineSummary",
  s.tuition_summary as "tuitionSummary",
  s.application_fee as "applicationFee",
  s.website_url as "websiteUrl",
  s.admissions_url as "admissionsUrl",
  s.subject_tags as "subjectTags",
  s.language_tags as "languageTags",
  s.tuition_band_label as "tuitionBandLabel",
  s.campus_highlights as "campusHighlights",
  s.status,
  s.verification_status as "verificationStatus",
  s.source_url as "sourceUrl",
  s.source_label as "sourceLabel",
  s.source_field_lineage_json as "sourceFieldLineageJson",
  s.last_verified_at as "lastVerifiedAt",
  s.created_at as "createdAt",
  s.updated_at as "updatedAt",
  coalesce(program_stats.program_count, 0)::int as "programCount",
  coalesce(program_stats.english_program_count, 0)::int as "englishProgramCount",
  coalesce(scholarship_stats.scholarship_count, 0)::int as "scholarshipCount",
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'programId', deadline.program_id,
      'programNameEn', deadline.program_name_en,
      'intakeId', deadline.intake_id,
      'intakeTerm', deadline.intake_term,
      'intakeYear', deadline.intake_year,
      'deadlineDate', deadline.deadline_date,
      'deadlineLabel', deadline.deadline_label,
      'applicationRound', deadline.application_round
    ) order by deadline.deadline_date asc nulls last, deadline.program_name_en asc)
    from (
      select p2.id as program_id, p2.name_en as program_name_en, pi.id as intake_id,
        pi.intake_term, pi.intake_year, pi.deadline_date, pi.deadline_label, pi.application_round
      from programs p2
      join program_intakes pi on pi.program_id = p2.id and pi.status = 'open'
      where p2.school_id = s.id and p2.status = 'active'
        and (pi.deadline_date is null or pi.deadline_date > clock_timestamp())
      order by pi.deadline_date asc nulls last, p2.name_en asc
      limit 8
    ) deadline
  ), '[]'::jsonb) as "upcomingDeadlines"
from schools s
left join lateral (
  select
    count(*)::int as program_count,
    count(*) filter (where lower(trim(p.teaching_language)) in ('english', 'english-taught', '英文授课'))::int as english_program_count
  from programs p
  where p.school_id = s.id and p.status = 'active'
) program_stats on true
left join lateral (
  select count(*)::int as scholarship_count
  from scholarships sch
  where sch.school_id = s.id and sch.status = 'active' and sch.verification_status = 'verified'
) scholarship_stats on true`;

const scholarshipSelectSql = `
select
  sch.id,
  sch.slug,
  sch.title,
  sch.name_zh as "nameZh",
  sch.type,
  sch.type_label as "typeLabel",
  sch.funding_level as "fundingLevel",
  sch.provider_name as "providerName",
  sch.provider_name_en as "providerNameEn",
  sch.provider_location as "providerLocation",
  sch.school_id as "schoolId",
  sch.program_id as "programId",
  sch.coverage,
  sch.applicable_degree as "applicableDegree",
  sch.applicable_program as "applicableProgram",
  sch.amount_text as "amountText",
  sch.requirement_text as "requirementText",
  sch.body_sections as "bodySections",
  sch.benefit_items as "benefitItems",
  sch.eligibility_items as "eligibilityItems",
  sch.application_materials as "applicationMaterials",
  sch.application_steps as "applicationSteps",
  sch.action_links as "actionLinks",
  sch.deadline_date as "deadlineDate",
  sch.deadline_label as "deadlineLabel",
  sch.application_round as "applicationRound",
  sch.target_countries as "targetCountries",
  sch.target_regions as "targetRegions",
  sch.benefits,
  sch.tags,
  sch.summary,
  sch.sort_order as "sortOrder",
  sch.version,
  sch.status,
  sch.verification_status as "verificationStatus",
  sch.source_url as "sourceUrl",
  sch.source_label as "sourceLabel",
  sch.source_field_lineage_json as "sourceFieldLineageJson",
  sch.last_verified_at as "lastVerifiedAt",
  sch.created_at as "createdAt",
  sch.updated_at as "updatedAt",
  s.slug as "schoolSlug",
  s.name_zh as "schoolNameZh",
  s.name_en as "schoolNameEn",
  p.slug as "programSlug",
  p.name_zh as "programNameZh",
  p.name_en as "programNameEn"
from scholarships sch
left join schools s on s.id = sch.school_id and s.status = 'active'
left join programs p on p.id = sch.program_id and p.status = 'active'`;

const citySelectSql = `
select
  c.id,
  c.slug,
  c.name_zh as "nameZh",
  c.name_en as "nameEn",
  c.region,
  c.province,
  c.monthly_cost as "monthlyCost",
  c.monthly_cost_rmb as "monthlyCostRmb",
  c.cost_level as "costLevel",
  c.density,
  c.tags,
  c.content_json as "contentJson",
  c.nearby,
  c.reference_school_count as "referenceSchoolCount",
  c.reference_program_count as "referenceProgramCount",
  c.reference_english_program_count as "referenceEnglishProgramCount",
  c.reference_scholarship_count as "referenceScholarshipCount",
  c.reference_csca_school_count as "referenceCscaSchoolCount",
  c.sort_order as "sortOrder",
  c.version,
  c.status,
  c.verification_status as "verificationStatus",
  c.source_url as "sourceUrl",
  c.source_label as "sourceLabel",
  c.source_field_lineage_json as "sourceFieldLineageJson",
  c.last_verified_at as "lastVerifiedAt",
  c.created_at as "createdAt",
  c.updated_at as "updatedAt"
from cities c`;
