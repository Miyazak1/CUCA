import type {
  CatalogListOptions,
  PublicCityDetailDto,
  PublicCityDto,
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
    const { whereSql, params } = buildPublicSearchWhere("p", ["p.name_en", "p.name_zh", "p.field_category"], options.query);
    const rows = await this.client.query<ProgramProjectionRow>(
      `${programSelectSql}
       ${whereSql}
       order by p.sort_order asc, p.name_en asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );

    return rows.map(toPublicProgramDto);
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
    const { whereSql, params } = buildPublicSearchWhere("s", ["s.name_en", "s.name_zh", "s.city"], options.query);
    const rows = await this.client.query<SchoolProjectionRow>(
      `${schoolSelectSql}
       ${whereSql}
       group by s.id
       order by s.name_en asc
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
       group by s.id
       limit 1`,
      [schoolId],
    );

    return rows[0] ? toPublicSchoolDetailDto(rows[0]) : null;
  }

  async listScholarships(options: CatalogListOptions): Promise<PublicScholarshipDto[]> {
    const { whereSql, params } = buildPublicSearchWhere("sch", ["sch.title", "sch.provider_name"], options.query);
    const rows = await this.client.query<ScholarshipProjectionRow>(
      `${scholarshipSelectSql}
       ${whereSql}
       order by sch.sort_order asc, sch.title asc
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, options.limit ?? 20, options.offset ?? 0],
    );

    return rows.map(toPublicScholarshipDto);
  }

  async getScholarship(scholarshipId: string): Promise<PublicScholarshipDetailDto | null> {
    const rows = await this.client.query<ScholarshipProjectionRow>(
      `${scholarshipSelectSql}
       where sch.id = $1 and sch.status = 'active'
       limit 1`,
      [scholarshipId],
    );

    return rows[0] ? toPublicScholarshipDetailDto(rows[0]) : null;
  }

  async listCities(options: CatalogListOptions): Promise<PublicCityDto[]> {
    const { whereSql, params } = buildPublicSearchWhere("c", ["c.name_en", "c.name_zh", "c.province"], options.query);
    const rows = await this.client.query<CityRow>(
      `${citySelectSql}
       ${whereSql}
       order by c.sort_order asc, c.name_en asc
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
}

function buildPublicSearchWhere(alias: string, columns: readonly string[], query?: string) {
  const clauses = [`${alias}.status = 'active'`];
  const params: unknown[] = [];

  if (query) {
    params.push(`%${query}%`);
    const paramRef = `$${params.length}`;
    clauses.push(`(${columns.map((column) => `${column} ilike ${paramRef}`).join(" or ")})`);
  }

  return {
    whereSql: `where ${clauses.join(" and ")}`,
    params,
  };
}

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
  next_intake.application_round as "applicationRound"
from programs p
join schools s on s.id = p.school_id and s.status = 'active'
left join cities c on c.id = coalesce(p.city_id, s.city_id) and c.status = 'active'
left join lateral (
  select pi.deadline_date, pi.deadline_label, pi.application_round
  from program_intakes pi
  where pi.program_id = p.id and pi.status = 'open'
  order by pi.deadline_date asc nulls last
  limit 1
) next_intake on true`;

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
  count(distinct p.id)::int as "programCount",
  count(distinct p.id) filter (where p.teaching_language = 'english')::int as "englishProgramCount",
  count(distinct sch.id)::int as "scholarshipCount",
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
left join programs p on p.school_id = s.id and p.status = 'active'
left join scholarships sch on sch.school_id = s.id and sch.status = 'active'`;

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
