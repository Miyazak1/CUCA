import { createHash } from "node:crypto";
import { lockLiveCuacStaffAuthority } from "../auth/cuac-staff-authority.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { serviceUnavailable } from "../shared/errors.ts";
import type {
  CatalogAdminRepository,
  CatalogCityDocument,
  CatalogCityRecord,
  CatalogCityRevision,
  CatalogCityStatus,
  CatalogAdminRole,
  CatalogSchoolDocument,
  CatalogSchoolRecord,
  CatalogSchoolRevision,
  CatalogProgramDocument,
  CatalogProgramRecord,
  CatalogProgramRevision,
  CatalogScholarshipDocument,
  CatalogScholarshipRecord,
  CatalogScholarshipRevision,
  CatalogReadinessRecord,
  CatalogReadinessSummary,
  CatalogReleaseManifestRecord,
  CatalogReleaseManifestDetail,
  CatalogReleaseManifestSelection,
  CatalogReleaseManifestItem,
  CatalogReleaseManifestStatus,
} from "./service.ts";
import { validateCatalogCityRecord, validateCatalogSchoolRecord, validateCatalogProgramRecord,
  validateCatalogScholarshipRecord, validateCatalogReadinessRecord } from "./service.ts";
import { CITY_PUBLICATION_PREDICATE, SCHOOL_PUBLICATION_PREDICATE, PROGRAM_PUBLICATION_PREDICATE,
  SCHOLARSHIP_PUBLICATION_PREDICATE, type CatalogReadinessEntityType,
  type CatalogReadinessState } from "./publication-readiness.ts";

type Actor = { actorUserId: string; activeRole: CatalogAdminRole };
type CityRow = CatalogCityRecord;
type SchoolRow = CatalogSchoolRecord;
type ProgramRow = CatalogProgramRecord;
type ScholarshipRow = CatalogScholarshipRecord;

const cityColumns = `
  c.id::text as id,c.slug,c.name_zh as "nameZh",c.name_en as "nameEn",c.region,c.province,
  c.monthly_cost as "monthlyCost",c.monthly_cost_rmb as "monthlyCostRmb",c.cost_level as "costLevel",
  c.density,c.tags,c.content_json as content,c.nearby,c.sort_order as "sortOrder",c.version,c.status,
  c.verification_status as "verificationStatus",c.source_url as "sourceUrl",c.source_label as "sourceLabel",
  c.source_note as "sourceNote",c.verified_by_user_id::text as "verifiedByUserId",
  c.last_verified_at as "lastVerifiedAt",c.next_review_due_at as "nextReviewDueAt",
  c.created_at as "createdAt",c.updated_at as "updatedAt"`;

const schoolColumns = `
  s.id::text as id,s.slug,s.name_zh as "nameZh",s.name_en as "nameEn",s.school_type as "schoolType",
  s.region,s.city_id::text as "cityId",s.city,s.city_zh as "cityZh",s.city_slug as "citySlug",s.province,
  s.region_label as "regionLabel",s.ranking,s.csca_required as "cscaRequired",s.csca_requirement as "cscaRequirement",
  s.csca_subjects as "cscaSubjects",s.application_level as "applicationLevel",
  s.language_of_instruction as "languageOfInstruction",s.language_requirement as "languageRequirement",
  s.hsk_requirement as "hskRequirement",s.english_requirement as "englishRequirement",
  s.deadline_summary as "deadlineSummary",s.tuition_summary as "tuitionSummary",s.application_fee as "applicationFee",
  s.website_url as "websiteUrl",s.admissions_url as "admissionsUrl",s.subject_tags as "subjectTags",s.fit_notes as "fitNotes",
  s.language_tags as "languageTags",s.tuition_band_label as "tuitionBandLabel",s.campus_highlights as "campusHighlights",
  s.contact_notes as "contactNotes",s.quality_score as "qualityScore",s.missing_fields as "missingFields",
  s.completeness_label as "completenessLabel",s.version,s.status,s.verification_status as "verificationStatus",
  s.source_url as "sourceUrl",s.source_label as "sourceLabel",s.source_note as "sourceNote",
  s.verified_by_user_id::text as "verifiedByUserId",s.last_verified_at as "lastVerifiedAt",
  s.next_review_due_at as "nextReviewDueAt",s.created_at as "createdAt",s.updated_at as "updatedAt"`;

const programColumns = `p.id::text as id,p.school_id::text as "schoolId",p.city_id::text as "cityId",p.slug,
  p.name_zh as "nameZh",p.name_en as "nameEn",p.degree_level as "degreeLevel",p.duration_years as "durationYears",
  p.duration_months as "durationMonths",p.field_category as "fieldCategory",p.subject_area as "subjectArea",
  p.teaching_language as "teachingLanguage",p.csca_subjects as "cscaSubjects",p.csca_requirement as "cscaRequirement",
  p.hsk_requirement as "hskRequirement",p.english_requirement as "englishRequirement",p.tuition_amount as "tuitionAmount",
  p.tuition_currency as "tuitionCurrency",p.tuition_period as "tuitionPeriod",p.tuition_text as "tuitionText",
  p.scholarship_text as "scholarshipText",p.application_url as "applicationUrl",p.application_note as "applicationNote",
  p.is_verified as "isVerified",p.has_scholarship as "hasScholarship",p.badge_text as "badgeText",
  p.display_tuition as "displayTuition",p.display_subjects as "displaySubjects",p.display_group as "displayGroup",
  p.display_group_label as "displayGroupLabel",p.sort_order as "sortOrder",p.version,p.status,
  p.verification_status as "verificationStatus",p.source_url as "sourceUrl",p.source_label as "sourceLabel",
  p.source_note as "sourceNote",p.verified_by_user_id::text as "verifiedByUserId",
  p.last_verified_at as "lastVerifiedAt",p.next_review_due_at as "nextReviewDueAt",
  p.created_at as "createdAt",p.updated_at as "updatedAt"`;

const scholarshipColumns = `sc.id::text as id,sc.slug,sc.title,sc.name_zh as "nameZh",sc.type,
  sc.type_label as "typeLabel",sc.funding_level as "fundingLevel",sc.provider_name as "providerName",
  sc.provider_name_en as "providerNameEn",sc.provider_location as "providerLocation",
  sc.school_id::text as "schoolId",sc.program_id::text as "programId",sc.coverage,
  sc.applicable_degree as "applicableDegree",sc.applicable_program as "applicableProgram",
  sc.amount_text as "amountText",sc.requirement_text as "requirementText",sc.body_sections as "bodySections",
  sc.benefit_items as "benefitItems",sc.eligibility_items as "eligibilityItems",
  sc.application_materials as "applicationMaterials",sc.application_steps as "applicationSteps",
  sc.contact_info as "contactInfo",sc.action_links as "actionLinks",sc.deadline_date as "deadlineDate",
  sc.deadline_label as "deadlineLabel",sc.application_round as "applicationRound",
  sc.target_countries as "targetCountries",sc.target_regions as "targetRegions",sc.benefits,sc.tags,sc.summary,
  sc.sort_order as "sortOrder",sc.version,sc.status,sc.verification_status as "verificationStatus",
  sc.source_url as "sourceUrl",sc.source_label as "sourceLabel",sc.source_note as "sourceNote",
  sc.verified_by_user_id::text as "verifiedByUserId",sc.last_verified_at as "lastVerifiedAt",
  sc.next_review_due_at as "nextReviewDueAt",sc.created_at as "createdAt",sc.updated_at as "updatedAt"`;

type ManifestRow = CatalogReleaseManifestRecord;
type ManifestItemRow = Omit<CatalogReleaseManifestItem, "current" | "driftReasons"> & {
  currentEntityType: CatalogReadinessEntityType | null; currentEntityId: string | null; currentSlug: string | null;
  currentLabel: string | null; currentStatus: CatalogCityStatus | null; currentVerificationStatus: string | null;
  currentVersion: number | null; currentReady: boolean | null; currentBlockingReasons: string[] | null;
  currentWarningReasons: string[] | null; currentNextReviewDueAt: Date | null; currentUpdatedAt: Date | null;
};

const catalogReadinessCte = `with readiness as (
  select 'city'::text as entity_type,c.id,c.slug,coalesce(c.name_zh,c.name_en) as label,c.status,
    c.verification_status,c.version,(${CITY_PUBLICATION_PREDICATE}) as ready,
    array_remove(array[
      case when c.status='archived' then 'archived' end,
      case when (c.source_url~'^https://[^[:space:]]+$') is not true then 'invalid_source_url' end,
      case when c.source_label is null then 'missing_source_label' end,
      case when not exists(select 1 from catalog_source_evidence ev where ev.entity_type='city' and ev.entity_id=c.id
        and ev.source_url=c.source_url) then 'missing_source_evidence' end
    ]::text[],null) as blocking_reasons,
    array_remove(array[
      case when c.status='draft' then 'draft_record' end,
      case when c.verification_status<>'verified' then 'verification_not_current' end,
      case when c.status='active' and c.next_review_due_at<=clock_timestamp() then 'review_due' end
    ]::text[],null) as warning_reasons,c.next_review_due_at,c.updated_at from cities c
  union all
  select 'school',s.id,s.slug,coalesce(s.name_zh,s.name_en),s.status,s.verification_status,s.version,
    (${SCHOOL_PUBLICATION_PREDICATE}),
    array_remove(array[
      case when s.status='archived' then 'archived' end,
      case when s.school_type is null then 'missing_school_type' end,
      case when (s.website_url~'^https://[^[:space:]]+$') is not true then 'invalid_website_url' end,
      case when s.admissions_url is not null and not (s.admissions_url~'^https://[^[:space:]]+$') then 'invalid_admissions_url' end,
      case when (s.source_url~'^https://[^[:space:]]+$') is not true then 'invalid_source_url' end,
      case when s.source_label is null then 'missing_source_label' end,
      case when not exists(select 1 from cities c where c.id=s.city_id and c.status='active') then 'inactive_city' end,
      case when not exists(select 1 from catalog_source_evidence ev where ev.entity_type='school' and ev.entity_id=s.id
        and ev.source_url=s.source_url) then 'missing_source_evidence' end
    ]::text[],null),
    array_remove(array[
      case when s.status='draft' then 'draft_record' end,
      case when s.verification_status<>'verified' then 'verification_not_current' end,
      case when s.status='active' and s.next_review_due_at<=clock_timestamp() then 'review_due' end
    ]::text[],null),s.next_review_due_at,s.updated_at from schools s
  union all
  select 'program',p.id,p.slug,coalesce(p.name_zh,p.name_en),p.status,p.verification_status,p.version,
    (${PROGRAM_PUBLICATION_PREDICATE}),
    array_remove(array[
      case when p.status='archived' then 'archived' end,
      case when p.teaching_language is null then 'missing_teaching_language' end,
      case when (p.application_url~'^https://[^[:space:]]+$') is not true then 'invalid_application_url' end,
      case when (p.source_url~'^https://[^[:space:]]+$') is not true then 'invalid_source_url' end,
      case when p.source_label is null then 'missing_source_label' end,
      case when not exists(select 1 from schools s where s.id=p.school_id and s.status='active') then 'inactive_school' end,
      case when not exists(select 1 from cities c where c.id=p.city_id and c.status='active') then 'inactive_city' end,
      case when not exists(select 1 from catalog_source_evidence ev where ev.entity_type='program' and ev.entity_id=p.id
        and ev.source_url=p.source_url) then 'missing_source_evidence' end
    ]::text[],null),
    array_remove(array[
      case when p.status='draft' then 'draft_record' end,
      case when p.verification_status<>'verified' then 'verification_not_current' end,
      case when p.status='active' and p.next_review_due_at<=clock_timestamp() then 'review_due' end
    ]::text[],null),p.next_review_due_at,p.updated_at from programs p
  union all
  select 'scholarship',sc.id,sc.slug,coalesce(sc.name_zh,sc.title),sc.status,sc.verification_status,sc.version,
    (${SCHOLARSHIP_PUBLICATION_PREDICATE}),
    array_remove(array[
      case when sc.status='archived' then 'archived' end,
      case when sc.coverage is null then 'missing_coverage' end,
      case when sc.applicable_degree is null then 'missing_applicable_degree' end,
      case when not ((sc.deadline_date is not null and sc.deadline_date>clock_timestamp())
        or (sc.deadline_date is null and sc.deadline_label is not null)) then 'deadline_unavailable' end,
      case when (sc.source_url~'^https://[^[:space:]]+$') is not true then 'invalid_source_url' end,
      case when sc.source_label is null then 'missing_source_label' end,
      case when sc.school_id is not null and not exists(select 1 from schools s where s.id=sc.school_id and s.status='active')
        then 'inactive_school' end,
      case when sc.program_id is not null and not exists(select 1 from programs p where p.id=sc.program_id
        and p.status='active' and p.school_id=sc.school_id) then 'inactive_program' end,
      case when not exists(select 1 from catalog_source_evidence ev where ev.entity_type='scholarship' and ev.entity_id=sc.id
        and ev.source_url=sc.source_url) then 'missing_source_evidence' end
    ]::text[],null),
    array_remove(array[
      case when sc.status='draft' then 'draft_record' end,
      case when sc.verification_status<>'verified' then 'verification_not_current' end,
      case when sc.status='active' and sc.next_review_due_at<=clock_timestamp() then 'review_due' end,
      case when sc.deadline_date>clock_timestamp() and sc.deadline_date<=clock_timestamp()+interval '30 days'
        then 'deadline_expiring_30d' end,
      case when sc.deadline_date is null and sc.deadline_label is not null then 'rolling_deadline_only' end
    ]::text[],null),sc.next_review_due_at,sc.updated_at from scholarships sc
)`;

export class PostgresCatalogAdminRepository implements CatalogAdminRepository {
  private readonly client: TransactionalSqlClient;

  constructor(client: TransactionalSqlClient) {
    this.client = client;
  }

  async listCities(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const pattern = input.query ? `%${escapeLike(input.query.toLowerCase())}%` : null;
      const where = `where ($1::text is null or c.status = $1)
        and ($2::text is null or lower(c.name_en) like $2 escape '\\' or lower(coalesce(c.name_zh,'')) like $2 escape '\\'
          or lower(c.slug) like $2 escape '\\' or lower(coalesce(c.province,'')) like $2 escape '\\')`;
      const count = await tx.query<{ total: number }>(`select count(*)::int as total from cities c ${where}`,
        [input.status, pattern]);
      const rows = await tx.query<CityRow>(`select ${cityColumns} from cities c ${where}
        order by case c.status when 'active' then 0 when 'draft' then 1 else 2 end,c.sort_order,c.name_en,c.id
        limit $3 offset $4`, [input.status, pattern, input.limit, input.offset]);
      return { authorized: true, value: { items: rows.map(validateCatalogCityRecord), total: count[0]?.total ?? 0 } } as const;
    });
  }

  async getCity(input: Actor & { cityId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<CityRow>(`select ${cityColumns} from cities c where c.id=$1`, [input.cityId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const revisions = await tx.query<CatalogCityRevision>(`select id::text as id,entity_version as "entityVersion",action,
        changed_fields_json as "changedFields",actor_user_id::text as "actorUserId",created_at as "createdAt"
        from catalog_entity_revisions where entity_type='city' and entity_id=$1
        order by entity_version desc limit 50`, [input.cityId]);
      return { authorized: true, value: { city: validateCatalogCityRecord(rows[0]), revisions } } as const;
    });
  }

  async createCity(input: Actor & { city: CatalogCityDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const c = input.city;
      const rows = await tx.query<CityRow>(`insert into cities (
        slug,name_zh,name_en,region,province,monthly_cost,monthly_cost_rmb,cost_level,density,tags,content_json,nearby,
        sort_order,version,status,verification_status,source_url,source_label,source_note,source_field_lineage_json
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,1,'draft','unverified',$14,$15,$16,$17::jsonb)
      on conflict (slug) do nothing returning ${returningCityColumns()}`,
      cityParams(c));
      if (!rows[0]) return { authorized: true, value: null } as const;
      const city = validateCatalogCityRecord(rows[0]);
      const evidenceId = await insertEvidence(tx, city.id, c, input.actorUserId);
      await insertRevision(tx, city, "created", editableFieldNames, evidenceId, input.actorUserId);
      return { authorized: true, value: city } as const;
    });
  }

  async updateCity(input: Actor & { cityId: string; expectedVersion: number; city: CatalogCityDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const beforeRows = await tx.query<CityRow>(`select ${cityColumns} from cities c where c.id=$1 for update`, [input.cityId]);
      const before = beforeRows[0];
      if (!before || before.version !== input.expectedVersion) return { authorized: true, value: null } as const;
      const c = input.city;
      const rows = await tx.query<CityRow>(`update cities c set slug=$2,name_zh=$3,name_en=$4,region=$5,province=$6,
        monthly_cost=$7,monthly_cost_rmb=$8,cost_level=$9,density=$10,tags=$11::jsonb,content_json=$12::jsonb,
        nearby=$13::jsonb,sort_order=$14,source_url=$15,source_label=$16,source_note=$17,
        source_field_lineage_json=$18::jsonb,version=c.version+1,verification_status='unverified',verified_by_user_id=null,
        last_verified_at=null,next_review_due_at=null,status=case when c.status='active' then 'draft' else c.status end,
        updated_at=clock_timestamp()
        where c.id=$1 and c.version=$19 and not exists(select 1 from cities other where other.slug=$2 and other.id<>$1)
        returning ${returningCityColumns("c")}`,
      [input.cityId, ...cityParams(c), input.expectedVersion]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const city = validateCatalogCityRecord(rows[0]);
      const changed = changedFields(before, city);
      const evidenceId = await insertEvidence(tx, city.id, c, input.actorUserId);
      await insertRevision(tx, city, "updated", changed, evidenceId, input.actorUserId);
      return { authorized: true, value: city } as const;
    });
  }

  async publishCity(input: Actor & { cityId: string; expectedVersion: number; reviewDueAt: Date }) {
    return this.lifecycle(input, "published", `status='active',verification_status='verified',verified_by_user_id=$3,
      last_verified_at=clock_timestamp(),next_review_due_at=$4`, [input.actorUserId, input.reviewDueAt],
    CITY_PUBLICATION_PREDICATE);
  }

  async archiveCity(input: Actor & { cityId: string; expectedVersion: number }) {
    return this.lifecycle(input, "archived", "status='archived'", [], `status<>'archived'
      and not exists(select 1 from schools s where s.city_id=c.id and s.status<>'archived')
      and not exists(select 1 from programs p where p.city_id=c.id and p.status<>'archived')`);
  }

  async restoreCity(input: Actor & { cityId: string; expectedVersion: number }) {
    return this.lifecycle(input, "restored", `status='draft',verification_status='unverified',verified_by_user_id=null,
      last_verified_at=null,next_review_due_at=null`, [], "status='archived'");
  }

  private async lifecycle(input: Actor & { cityId: string; expectedVersion: number },
    action: CatalogCityRevision["action"], assignments: string, extraParams: unknown[], predicate: string) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const params: unknown[] = [input.cityId, input.expectedVersion, ...extraParams];
      const rows = await tx.query<CityRow>(`update cities c set ${assignments},version=c.version+1,updated_at=clock_timestamp()
        where c.id=$1 and c.version=$2 and ${predicate} returning ${returningCityColumns("c")}`, params);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const city = validateCatalogCityRecord(rows[0]);
      const evidence = await tx.query<{ id: string }>(`select id::text as id from catalog_source_evidence
        where entity_type='city' and entity_id=$1 order by captured_at desc,id desc limit 1`, [input.cityId]);
      await insertRevision(tx, city, action, ["status", "verificationStatus"], evidence[0]?.id ?? null, input.actorUserId);
      return { authorized: true, value: city } as const;
    });
  }

  async listSchools(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const pattern = input.query ? `%${escapeLike(input.query.toLowerCase())}%` : null;
      const where = `where ($1::text is null or s.status=$1) and ($2::text is null
        or lower(s.name_en) like $2 escape '\\' or lower(coalesce(s.name_zh,'')) like $2 escape '\\'
        or lower(s.slug) like $2 escape '\\' or lower(coalesce(s.city,'')) like $2 escape '\\'
        or lower(coalesce(s.province,'')) like $2 escape '\\')`;
      const count = await tx.query<{ total: number }>(`select count(*)::int as total from schools s ${where}`,
        [input.status, pattern]);
      const rows = await tx.query<SchoolRow>(`select ${schoolColumns} from schools s ${where}
        order by case s.status when 'active' then 0 when 'draft' then 1 else 2 end,s.name_en,s.id limit $3 offset $4`,
      [input.status, pattern, input.limit, input.offset]);
      return { authorized: true, value: { items: rows.map(validateCatalogSchoolRecord), total: count[0]?.total ?? 0 } } as const;
    });
  }

  async getSchool(input: Actor & { schoolId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<SchoolRow>(`select ${schoolColumns} from schools s where s.id=$1`, [input.schoolId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const revisions = await tx.query<CatalogSchoolRevision>(`select id::text as id,entity_version as "entityVersion",action,
        changed_fields_json as "changedFields",actor_user_id::text as "actorUserId",created_at as "createdAt"
        from catalog_entity_revisions where entity_type='school' and entity_id=$1
        order by entity_version desc limit 50`, [input.schoolId]);
      return { authorized: true, value: { school: validateCatalogSchoolRecord(rows[0]), revisions } } as const;
    });
  }

  async createSchool(input: Actor & { school: CatalogSchoolDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const s = input.school;
      const rows = await tx.query<SchoolRow>(`insert into schools (
        slug,name_zh,name_en,school_type,region,city_id,city,city_zh,city_slug,province,region_label,ranking,
        csca_required,csca_requirement,csca_subjects,application_level,language_of_instruction,language_requirement,
        hsk_requirement,english_requirement,deadline_summary,tuition_summary,application_fee,website_url,admissions_url,
        subject_tags,fit_notes,language_tags,tuition_band_label,campus_highlights,contact_notes,quality_score,missing_fields,
        completeness_label,source_url,source_label,source_note,source_field_lineage_json,version,status,verification_status
      ) select $1,$2,$3,$4,$5,$6,city_ref.name_en,city_ref.name_zh,city_ref.slug,city_ref.province,$7,$8,$9,$10,$11::jsonb,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24::jsonb,$25,$26::jsonb,$27,$28,$29::jsonb,
        $30,$31,$32,$33,$34::jsonb,1,'draft','unverified' from cities city_ref
        where city_ref.id=$6 and city_ref.status<>'archived'
        on conflict (slug) do nothing returning ${returningSchoolColumns()}`, schoolParams(s));
      if (!rows[0]) return { authorized: true, value: null } as const;
      const school = validateCatalogSchoolRecord(rows[0]);
      const evidenceId = await insertSchoolEvidence(tx, school.id, s, input.actorUserId);
      await insertSchoolRevision(tx, school, "created", schoolEditableFieldNames, evidenceId, input.actorUserId);
      return { authorized: true, value: school } as const;
    });
  }

  async updateSchool(input: Actor & { schoolId: string; expectedVersion: number; school: CatalogSchoolDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const beforeRows = await tx.query<SchoolRow>(`select ${schoolColumns} from schools s where s.id=$1 for update`, [input.schoolId]);
      const before = beforeRows[0];
      if (!before || before.version !== input.expectedVersion || before.status === "archived") {
        return { authorized: true, value: null } as const;
      }
      const s = input.school;
      const rows = await tx.query<SchoolRow>(`update schools s set slug=$2,name_zh=$3,name_en=$4,school_type=$5,region=$6,
        city_id=$7,city=city_ref.name_en,city_zh=city_ref.name_zh,city_slug=city_ref.slug,province=city_ref.province,
        region_label=$8,ranking=$9,csca_required=$10,csca_requirement=$11,csca_subjects=$12::jsonb,
        application_level=$13,language_of_instruction=$14,language_requirement=$15,hsk_requirement=$16,
        english_requirement=$17,deadline_summary=$18,tuition_summary=$19,application_fee=$20,website_url=$21,
        admissions_url=$22,subject_tags=$23::jsonb,fit_notes=$24,language_tags=$25::jsonb,tuition_band_label=$26,
        campus_highlights=$27::jsonb,contact_notes=$28,quality_score=$29,missing_fields=$30::jsonb,
        completeness_label=$31,source_url=$32,source_label=$33,source_note=$34,source_field_lineage_json=$35::jsonb,
        version=s.version+1,verification_status='unverified',verified_by_user_id=null,
        last_verified_at=null,next_review_due_at=null,status=case when s.status='active' then 'draft' else s.status end,
        updated_at=clock_timestamp()
        from cities city_ref where s.id=$1 and s.version=$36 and city_ref.id=$7 and city_ref.status<>'archived'
          and not exists(select 1 from schools other where other.slug=$2 and other.id<>$1)
        returning ${returningSchoolColumns("s")}`, [input.schoolId, ...schoolParams(s), input.expectedVersion]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const school = validateCatalogSchoolRecord(rows[0]);
      const evidenceId = await insertSchoolEvidence(tx, school.id, s, input.actorUserId);
      await insertSchoolRevision(tx, school, "updated", changedSchoolFields(before, school), evidenceId, input.actorUserId);
      return { authorized: true, value: school } as const;
    });
  }

  async publishSchool(input: Actor & { schoolId: string; expectedVersion: number; reviewDueAt: Date }) {
    return this.schoolLifecycle(input, "published", `status='active',verification_status='verified',verified_by_user_id=$3,
      last_verified_at=clock_timestamp(),next_review_due_at=$4`, [input.actorUserId, input.reviewDueAt],
    SCHOOL_PUBLICATION_PREDICATE);
  }

  async archiveSchool(input: Actor & { schoolId: string; expectedVersion: number }) {
    return this.schoolLifecycle(input, "archived", "status='archived'", [], `status<>'archived'
      and not exists(select 1 from programs p where p.school_id=s.id and p.status<>'archived')
      and not exists(select 1 from scholarships sc where sc.school_id=s.id and sc.status<>'archived')
      and not exists(select 1 from school_staff_memberships m where m.school_id=s.id and m.status='active' and m.removed_at is null)
      and not exists(select 1 from school_applications a where a.school_id=s.id and a.status<>'archived')`);
  }

  async restoreSchool(input: Actor & { schoolId: string; expectedVersion: number }) {
    return this.schoolLifecycle(input, "restored", `status='draft',verification_status='unverified',verified_by_user_id=null,
      last_verified_at=null,next_review_due_at=null`, [], "status='archived'");
  }

  private async schoolLifecycle(input: Actor & { schoolId: string; expectedVersion: number },
    action: CatalogSchoolRevision["action"], assignments: string, extraParams: unknown[], predicate: string) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<SchoolRow>(`update schools s set ${assignments},version=s.version+1,updated_at=clock_timestamp()
        where s.id=$1 and s.version=$2 and ${predicate} returning ${returningSchoolColumns("s")}`,
      [input.schoolId, input.expectedVersion, ...extraParams]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const school = validateCatalogSchoolRecord(rows[0]);
      const evidence = await tx.query<{ id: string }>(`select id::text as id from catalog_source_evidence
        where entity_type='school' and entity_id=$1 order by captured_at desc,id desc limit 1`, [input.schoolId]);
      await insertSchoolRevision(tx, school, action, ["status", "verificationStatus"], evidence[0]?.id ?? null, input.actorUserId);
      return { authorized: true, value: school } as const;
    });
  }

  async listPrograms(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const pattern = input.query ? `%${escapeLike(input.query.toLowerCase())}%` : null;
      const where = `where ($1::text is null or p.status=$1) and ($2::text is null
        or lower(p.name_en) like $2 escape '\\' or lower(coalesce(p.name_zh,'')) like $2 escape '\\'
        or lower(p.slug) like $2 escape '\\' or lower(p.degree_level) like $2 escape '\\'
        or lower(coalesce(p.subject_area,'')) like $2 escape '\\')`;
      const count = await tx.query<{ total: number }>(`select count(*)::int as total from programs p ${where}`,
        [input.status, pattern]);
      const rows = await tx.query<ProgramRow>(`select ${programColumns} from programs p ${where}
        order by case p.status when 'active' then 0 when 'draft' then 1 else 2 end,p.sort_order,p.name_en,p.id
        limit $3 offset $4`, [input.status, pattern, input.limit, input.offset]);
      return { authorized: true, value: { items: rows.map(validateCatalogProgramRecord), total: count[0]?.total ?? 0 } } as const;
    });
  }

  async getProgram(input: Actor & { programId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<ProgramRow>(`select ${programColumns} from programs p where p.id=$1`, [input.programId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const revisions = await tx.query<CatalogProgramRevision>(`select id::text as id,entity_version as "entityVersion",action,
        changed_fields_json as "changedFields",actor_user_id::text as "actorUserId",created_at as "createdAt"
        from catalog_entity_revisions where entity_type='program' and entity_id=$1
        order by entity_version desc limit 50`, [input.programId]);
      const dependencies = await tx.query<{ intakeCount: number; openIntakeCount: number;
        activeRequirementPublicationCount: number; activeScholarshipCount: number; activeApplicationChoiceCount: number }>(`
        select (select count(*)::int from program_intakes i where i.program_id=$1) as "intakeCount",
          (select count(*)::int from program_intakes i where i.program_id=$1 and i.status='open') as "openIntakeCount",
          (select count(*)::int from program_requirement_publications rp join program_intakes i on i.id=rp.program_intake_id
            where i.program_id=$1 and rp.status='active') as "activeRequirementPublicationCount",
          (select count(distinct sc.id)::int from scholarships sc left join program_scholarships ps on ps.scholarship_id=sc.id
            where sc.status<>'archived' and (sc.program_id=$1 or ps.program_id=$1)) as "activeScholarshipCount",
          (select count(*)::int from application_choices ac where ac.program_id=$1 and ac.removed_at is null
            and ac.status<>'removed') as "activeApplicationChoiceCount"`, [input.programId]);
      return { authorized: true, value: { program: validateCatalogProgramRecord(rows[0]), revisions,
        dependencies: dependencies[0]! } } as const;
    });
  }

  async createProgram(input: Actor & { program: CatalogProgramDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const p = input.program;
      const rows = await tx.query<ProgramRow>(`insert into programs (school_id,city_id,slug,name_zh,name_en,degree_level,
        duration_years,duration_months,field_category,subject_area,teaching_language,csca_subjects,csca_requirement,
        hsk_requirement,english_requirement,tuition_amount,tuition_currency,tuition_period,tuition_text,scholarship_text,
        application_url,application_note,has_scholarship,badge_text,display_tuition,display_subjects,display_group,
        display_group_label,sort_order,source_url,source_label,source_note,source_field_lineage_json,version,status,
        verification_status,is_verified,created_by_user_id,updated_by_user_id)
        select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
          $25,$26::jsonb,$27,$28,$29,$30,$31,$32,$33::jsonb,1,'draft','unverified',false,$34,$34
        from schools s,cities c where s.id=$1 and s.status<>'archived' and c.id=$2 and c.status<>'archived'
        on conflict (slug) do nothing returning ${returningProgramColumns()}`, [...programParams(p), input.actorUserId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const program = validateCatalogProgramRecord(rows[0]);
      const evidenceId = await insertProgramEvidence(tx, program.id, p, input.actorUserId);
      await insertProgramRevision(tx, program, "created", programEditableFieldNames, evidenceId, input.actorUserId);
      return { authorized: true, value: program } as const;
    });
  }

  async updateProgram(input: Actor & { programId: string; expectedVersion: number; program: CatalogProgramDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const beforeRows = await tx.query<ProgramRow>(`select ${programColumns} from programs p where p.id=$1 for update`, [input.programId]);
      const before = beforeRows[0];
      if (!before || before.version !== input.expectedVersion || before.status === "archived") {
        return { authorized: true, value: null } as const;
      }
      const p = input.program;
      const rows = await tx.query<ProgramRow>(`update programs p set school_id=$2,city_id=$3,slug=$4,name_zh=$5,name_en=$6,
        degree_level=$7,duration_years=$8,duration_months=$9,field_category=$10,subject_area=$11,teaching_language=$12,
        csca_subjects=$13::jsonb,csca_requirement=$14,hsk_requirement=$15,english_requirement=$16,tuition_amount=$17,
        tuition_currency=$18,tuition_period=$19,tuition_text=$20,scholarship_text=$21,application_url=$22,
        application_note=$23,has_scholarship=$24,badge_text=$25,display_tuition=$26,display_subjects=$27::jsonb,
        display_group=$28,display_group_label=$29,sort_order=$30,source_url=$31,source_label=$32,source_note=$33,
        source_field_lineage_json=$34::jsonb,version=p.version+1,status=case when p.status='active' then 'draft' else p.status end,
        verification_status='unverified',is_verified=false,verified_by_user_id=null,last_verified_at=null,
        next_review_due_at=null,updated_by_user_id=$36,updated_at=clock_timestamp()
        from schools s,cities c where p.id=$1 and p.version=$35 and s.id=$2 and s.status<>'archived'
          and c.id=$3 and c.status<>'archived' and not exists(select 1 from programs other where other.slug=$4 and other.id<>$1)
        returning ${returningProgramColumns("p")}`, [input.programId, ...programParams(p), input.expectedVersion, input.actorUserId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const program = validateCatalogProgramRecord(rows[0]);
      const evidenceId = await insertProgramEvidence(tx, program.id, p, input.actorUserId);
      await insertProgramRevision(tx, program, "updated", changedProgramFields(before, program), evidenceId, input.actorUserId);
      return { authorized: true, value: program } as const;
    });
  }

  async publishProgram(input: Actor & { programId: string; expectedVersion: number; reviewDueAt: Date }) {
    return this.programLifecycle(input, "published", `status='active',verification_status='verified',is_verified=true,
      verified_by_user_id=$3,last_verified_at=clock_timestamp(),next_review_due_at=$4`, [input.actorUserId,input.reviewDueAt],
      PROGRAM_PUBLICATION_PREDICATE);
  }

  async archiveProgram(input: Actor & { programId: string; expectedVersion: number }) {
    return this.programLifecycle(input, "archived", "status='archived',is_verified=false", [], `status<>'archived'
      and not exists(select 1 from program_intakes i where i.program_id=p.id and i.status='open')
      and not exists(select 1 from program_requirement_publications rp join program_intakes i on i.id=rp.program_intake_id
        where i.program_id=p.id and rp.status='active')
      and not exists(select 1 from scholarships sc left join program_scholarships ps on ps.scholarship_id=sc.id
        where sc.status<>'archived' and (sc.program_id=p.id or ps.program_id=p.id))
      and not exists(select 1 from application_choices ac where ac.program_id=p.id and ac.removed_at is null
        and ac.status<>'removed')`);
  }

  async restoreProgram(input: Actor & { programId: string; expectedVersion: number }) {
    return this.programLifecycle(input, "restored", `status='draft',verification_status='unverified',is_verified=false,
      verified_by_user_id=null,last_verified_at=null,next_review_due_at=null`, [], "status='archived'");
  }

  private async programLifecycle(input: Actor & { programId: string; expectedVersion: number },
    action: CatalogProgramRevision["action"], assignments: string, extraParams: unknown[], predicate: string) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<ProgramRow>(`update programs p set ${assignments},version=p.version+1,
        updated_by_user_id=$${3 + extraParams.length},updated_at=clock_timestamp()
        where p.id=$1 and p.version=$2 and ${predicate} returning ${returningProgramColumns("p")}`,
      [input.programId,input.expectedVersion,...extraParams,input.actorUserId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const program = validateCatalogProgramRecord(rows[0]);
      const evidence = await tx.query<{ id: string }>(`select id::text as id from catalog_source_evidence
        where entity_type='program' and entity_id=$1 order by captured_at desc,id desc limit 1`, [input.programId]);
      await insertProgramRevision(tx, program, action, ["status","verificationStatus","isVerified"],
        evidence[0]?.id ?? null, input.actorUserId);
      return { authorized: true, value: program } as const;
    });
  }

  async listScholarships(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const pattern = input.query ? `%${escapeLike(input.query.toLowerCase())}%` : null;
      const where = `where ($1::text is null or sc.status=$1) and ($2::text is null
        or lower(sc.title) like $2 escape '\\' or lower(coalesce(sc.name_zh,'')) like $2 escape '\\'
        or lower(sc.slug) like $2 escape '\\' or lower(coalesce(sc.provider_name,'')) like $2 escape '\\'
        or lower(coalesce(sc.funding_level,'')) like $2 escape '\\')`;
      const count = await tx.query<{ total: number }>(`select count(*)::int as total from scholarships sc ${where}`,
        [input.status,pattern]);
      const rows = await tx.query<ScholarshipRow>(`select ${scholarshipColumns} from scholarships sc ${where}
        order by case sc.status when 'active' then 0 when 'draft' then 1 else 2 end,sc.sort_order,sc.title,sc.id
        limit $3 offset $4`, [input.status,pattern,input.limit,input.offset]);
      return { authorized: true, value: { items: rows.map(validateCatalogScholarshipRecord), total: count[0]?.total ?? 0 } } as const;
    });
  }

  async getScholarship(input: Actor & { scholarshipId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<ScholarshipRow>(`select ${scholarshipColumns} from scholarships sc where sc.id=$1`, [input.scholarshipId]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const revisions = await tx.query<CatalogScholarshipRevision>(`select id::text as id,entity_version as "entityVersion",action,
        changed_fields_json as "changedFields",actor_user_id::text as "actorUserId",created_at as "createdAt"
        from catalog_entity_revisions where entity_type='scholarship' and entity_id=$1
        order by entity_version desc limit 50`, [input.scholarshipId]);
      const dependencies = await tx.query<{ activeApplicationChoiceCount: number; linkedProgramCount: number }>(`
        select (select count(*)::int from application_choices ac where ac.scholarship_id=$1 and ac.removed_at is null
          and ac.status<>'removed') as "activeApplicationChoiceCount",
          (select count(distinct x.program_id)::int from (select program_id from program_scholarships where scholarship_id=$1
            union all select program_id from scholarships where id=$1 and program_id is not null) x) as "linkedProgramCount"`,
      [input.scholarshipId]);
      return { authorized: true, value: { scholarship: validateCatalogScholarshipRecord(rows[0]), revisions,
        dependencies: dependencies[0]! } } as const;
    });
  }

  async createScholarship(input: Actor & { scholarship: CatalogScholarshipDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const sc = input.scholarship;
      const rows = await tx.query<ScholarshipRow>(`insert into scholarships (slug,title,name_zh,type,type_label,funding_level,
        provider_name,provider_name_en,provider_location,school_id,program_id,coverage,applicable_degree,applicable_program,
        amount_text,requirement_text,body_sections,benefit_items,eligibility_items,application_materials,application_steps,
        contact_info,action_links,deadline_date,deadline_label,application_round,target_countries,target_regions,benefits,tags,
        summary,sort_order,source_url,source_label,source_note,source_field_lineage_json,version,status,verification_status)
        select $1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10::uuid,(select p.school_id from programs p where p.id=$11::uuid)),
          $11::uuid,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,
          $24,$25,$26,$27::jsonb,$28::jsonb,$29::jsonb,$30::jsonb,$31,$32,$33,$34,$35,$36::jsonb,1,'draft','unverified'
        where ($10::uuid is null or exists(select 1 from schools s where s.id=$10::uuid and s.status<>'archived'))
          and ($11::uuid is null or exists(select 1 from programs p where p.id=$11::uuid and p.status<>'archived'
            and ($10::uuid is null or p.school_id=$10::uuid)))
        on conflict (slug) do nothing returning ${returningScholarshipColumns()}`, scholarshipParams(sc));
      if (!rows[0]) return { authorized: true, value: null } as const;
      const scholarship = validateCatalogScholarshipRecord(rows[0]);
      const evidenceId = await insertScholarshipEvidence(tx, scholarship.id, sc, input.actorUserId);
      await insertScholarshipRevision(tx, scholarship, "created", scholarshipEditableFieldNames, evidenceId, input.actorUserId);
      return { authorized: true, value: scholarship } as const;
    });
  }

  async updateScholarship(input: Actor & { scholarshipId: string; expectedVersion: number; scholarship: CatalogScholarshipDocument }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const beforeRows = await tx.query<ScholarshipRow>(`select ${scholarshipColumns} from scholarships sc where sc.id=$1 for update`, [input.scholarshipId]);
      const before = beforeRows[0];
      if (!before || before.version !== input.expectedVersion || before.status === "archived") {
        return { authorized: true, value: null } as const;
      }
      const sc = input.scholarship;
      const rows = await tx.query<ScholarshipRow>(`update scholarships sc set slug=$2,title=$3,name_zh=$4,type=$5,
        type_label=$6,funding_level=$7,provider_name=$8,provider_name_en=$9,provider_location=$10,
        school_id=coalesce($11::uuid,(select p.school_id from programs p where p.id=$12::uuid)),program_id=$12::uuid,
        coverage=$13,applicable_degree=$14,applicable_program=$15,amount_text=$16,requirement_text=$17,
        body_sections=$18::jsonb,benefit_items=$19::jsonb,eligibility_items=$20::jsonb,application_materials=$21::jsonb,
        application_steps=$22::jsonb,contact_info=$23::jsonb,action_links=$24::jsonb,deadline_date=$25,deadline_label=$26,
        application_round=$27,target_countries=$28::jsonb,target_regions=$29::jsonb,benefits=$30::jsonb,tags=$31::jsonb,
        summary=$32,sort_order=$33,source_url=$34,source_label=$35,source_note=$36,source_field_lineage_json=$37::jsonb,
        version=sc.version+1,status=case when sc.status='active' then 'draft' else sc.status end,
        verification_status='unverified',verified_by_user_id=null,last_verified_at=null,next_review_due_at=null,
        updated_at=clock_timestamp()
        where sc.id=$1 and sc.version=$38
          and ($11::uuid is null or exists(select 1 from schools s where s.id=$11::uuid and s.status<>'archived'))
          and ($12::uuid is null or exists(select 1 from programs p where p.id=$12::uuid and p.status<>'archived'
            and ($11::uuid is null or p.school_id=$11::uuid)))
          and not exists(select 1 from scholarships other where other.slug=$2 and other.id<>$1)
        returning ${returningScholarshipColumns("sc")}`, [input.scholarshipId,...scholarshipParams(sc),input.expectedVersion]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const scholarship = validateCatalogScholarshipRecord(rows[0]);
      const evidenceId = await insertScholarshipEvidence(tx, scholarship.id, sc, input.actorUserId);
      await insertScholarshipRevision(tx, scholarship, "updated", changedScholarshipFields(before, scholarship), evidenceId, input.actorUserId);
      return { authorized: true, value: scholarship } as const;
    });
  }

  async publishScholarship(input: Actor & { scholarshipId: string; expectedVersion: number; reviewDueAt: Date }) {
    return this.scholarshipLifecycle(input, "published", `status='active',verification_status='verified',
      verified_by_user_id=$3,last_verified_at=clock_timestamp(),next_review_due_at=$4`, [input.actorUserId,input.reviewDueAt],
      SCHOLARSHIP_PUBLICATION_PREDICATE);
  }

  async archiveScholarship(input: Actor & { scholarshipId: string; expectedVersion: number }) {
    return this.scholarshipLifecycle(input, "archived", "status='archived'", [], `status<>'archived'
      and not exists(select 1 from application_choices ac where ac.scholarship_id=sc.id and ac.removed_at is null
        and ac.status<>'removed')`);
  }

  async restoreScholarship(input: Actor & { scholarshipId: string; expectedVersion: number }) {
    return this.scholarshipLifecycle(input, "restored", `status='draft',verification_status='unverified',
      verified_by_user_id=null,last_verified_at=null,next_review_due_at=null`, [], "status='archived'");
  }

  private async scholarshipLifecycle(input: Actor & { scholarshipId: string; expectedVersion: number },
    action: CatalogScholarshipRevision["action"], assignments: string, extraParams: unknown[], predicate: string) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<ScholarshipRow>(`update scholarships sc set ${assignments},version=sc.version+1,
        updated_at=clock_timestamp() where sc.id=$1 and sc.version=$2 and ${predicate}
        returning ${returningScholarshipColumns("sc")}`, [input.scholarshipId,input.expectedVersion,...extraParams]);
      if (!rows[0]) return { authorized: true, value: null } as const;
      const scholarship = validateCatalogScholarshipRecord(rows[0]);
      const evidence = await tx.query<{ id: string }>(`select id::text as id from catalog_source_evidence
        where entity_type='scholarship' and entity_id=$1 order by captured_at desc,id desc limit 1`, [input.scholarshipId]);
      await insertScholarshipRevision(tx, scholarship, action, ["status","verificationStatus"],
        evidence[0]?.id ?? null, input.actorUserId);
      return { authorized: true, value: scholarship } as const;
    });
  }

  async listReadiness(input: Actor & { entityType: CatalogReadinessEntityType | null; status: CatalogCityStatus | null;
    readiness: CatalogReadinessState | null; reason: string | null; query: string | null; limit: number; offset: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const pattern = input.query ? `%${escapeLike(input.query.toLowerCase())}%` : null;
      const params = [input.entityType,input.status,input.readiness,input.reason,pattern,input.limit,input.offset];
      const where = `where ($1::text is null or entity_type=$1) and ($2::text is null or status=$2)
        and ($3::text is null or ($3='ready' and ready) or ($3='blocked' and not ready))
        and ($4::text is null or $4=any(blocking_reasons) or $4=any(warning_reasons))
        and ($5::text is null or lower(label) like $5 escape '\\' or lower(slug) like $5 escape '\\')`;
      const totalRows = await tx.query<{ total: number }>(`${catalogReadinessCte}
        select count(*)::int as total from readiness ${where}`, params.slice(0,5));
      const rows = await tx.query<Record<string, unknown>>(`${catalogReadinessCte}
        select entity_type as "entityType",id::text as "entityId",slug,label,status,
          verification_status as "verificationStatus",version,ready,blocking_reasons as "blockingReasons",
          warning_reasons as "warningReasons",next_review_due_at as "nextReviewDueAt",updated_at as "updatedAt"
        from readiness ${where}
        order by case when ready then 1 else 0 end,cardinality(blocking_reasons) desc,entity_type,label,id
        limit $6 offset $7`, params);
      const byTypeRows = await tx.query<{ entityType: CatalogReadinessEntityType; total: number; ready: number; blocked: number }>(
        `${catalogReadinessCte} select entity_type as "entityType",count(*)::int as total,
          count(*) filter(where ready)::int as ready,count(*) filter(where not ready)::int as blocked
        from readiness group by entity_type order by entity_type`, []);
      const issueRows = await tx.query<{ code: string; count: number }>(`${catalogReadinessCte}
        select code,count(*)::int as count from readiness cross join lateral
          unnest(blocking_reasons||warning_reasons) as code group by code order by count desc,code`, []);
      const byEntityType = Object.fromEntries(["city","school","program","scholarship"].map(entityType =>
        [entityType,{ total: 0, ready: 0, blocked: 0 }])) as CatalogReadinessSummary["byEntityType"];
      for (const row of byTypeRows) byEntityType[row.entityType] = { total: row.total, ready: row.ready, blocked: row.blocked };
      const total = byTypeRows.reduce((sum,row) => sum + row.total,0);
      const ready = byTypeRows.reduce((sum,row) => sum + row.ready,0);
      const summary: CatalogReadinessSummary = { total, ready, blocked: total-ready, byEntityType,
        issueCounts: Object.fromEntries(issueRows.map(row => [row.code,row.count])), generatedAt: new Date() };
      return { authorized: true, value: { items: rows.map(row => validateCatalogReadinessRecord(row as unknown as CatalogReadinessRecord)),
        total: totalRows[0]?.total ?? 0, summary } } as const;
    });
  }

  async getReadiness(input: Actor & { entityType: CatalogReadinessEntityType; entityId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<Record<string, unknown>>(`${catalogReadinessCte}
        select entity_type as "entityType",id::text as "entityId",slug,label,status,
          verification_status as "verificationStatus",version,ready,blocking_reasons as "blockingReasons",
          warning_reasons as "warningReasons",next_review_due_at as "nextReviewDueAt",updated_at as "updatedAt"
        from readiness where entity_type=$1 and id=$2`, [input.entityType,input.entityId]);
      return { authorized: true, value: rows[0]
        ? validateCatalogReadinessRecord(rows[0] as unknown as CatalogReadinessRecord) : null } as const;
    });
  }

  async listReleaseManifests(input: Actor & { status: CatalogReleaseManifestStatus | null; limit: number; offset: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const where = `where ($1::text is null or m.status=$1)`;
      const countRows = await tx.query<{ total: number }>(`select count(*)::int as total
        from catalog_release_manifests m ${where}`, [input.status]);
      const rows = await tx.query<ManifestRow>(`${catalogReadinessCte}
        select m.id::text as id,m.title,m.status,m.version,m.selection_sha256 as "selectionSha256",
          count(i.id)::int as "itemCount",count(i.id) filter(where r.id is null or r.version<>i.entity_version
            or not r.ready or r.warning_reasons is distinct from array(select jsonb_array_elements_text(
              i.readiness_snapshot_json->'warningReasons')))::int as "driftedItemCount",
          m.created_by_user_id::text as "createdByUserId",m.superseded_by_user_id::text as "supersededByUserId",
          m.superseded_at as "supersededAt",m.created_at as "createdAt",m.updated_at as "updatedAt"
        from catalog_release_manifests m left join catalog_release_manifest_items i on i.manifest_id=m.id
        left join readiness r on r.entity_type=i.entity_type and r.id=i.entity_id ${where}
        group by m.id order by m.created_at desc,m.id desc limit $2 offset $3`,
      [input.status,input.limit,input.offset]);
      return { authorized: true, value: { items: rows.map(validateManifestRecord), total: countRows[0]?.total ?? 0 } } as const;
    });
  }

  async getReleaseManifest(input: Actor & { manifestId: string }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      return { authorized: true, value: await loadReleaseManifest(tx, input.manifestId) } as const;
    });
  }

  async createReleaseManifest(input: Actor & { title: string; selections: CatalogReleaseManifestSelection[] }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const selectionJson = JSON.stringify(input.selections.map((item,position) => ({
        entity_type: item.entityType, entity_id: item.entityId, expected_version: item.expectedVersion, position,
      })));
      for (const [entityType,table,alias] of [["city","cities","c"],["school","schools","s"],
        ["program","programs","p"],["scholarship","scholarships","sc"]] as const) {
        await tx.query(`select ${alias}.id from ${table} ${alias} join jsonb_to_recordset($1::jsonb)
          as x(entity_type text,entity_id uuid,expected_version int,position int)
          on x.entity_type=$2 and x.entity_id=${alias}.id for share of ${alias}`, [selectionJson,entityType]);
      }
      const rows = await tx.query<Record<string, unknown>>(`${catalogReadinessCte}, selection as (
          select * from jsonb_to_recordset($1::jsonb)
            as x(entity_type text,entity_id uuid,expected_version int,position int)
        ) select r.entity_type as "entityType",r.id::text as "entityId",r.slug,r.label,r.status,
          r.verification_status as "verificationStatus",r.version,r.ready,
          r.blocking_reasons as "blockingReasons",r.warning_reasons as "warningReasons",
          r.next_review_due_at as "nextReviewDueAt",r.updated_at as "updatedAt",s.expected_version as "expectedVersion",
          s.position from selection s join readiness r on r.entity_type=s.entity_type and r.id=s.entity_id
        order by s.position`, [selectionJson]);
      if (rows.length !== input.selections.length) return { authorized: true, value: null } as const;
      const capturedAt = new Date();
      const snapshots = rows.map(row => {
        const readiness = validateCatalogReadinessRecord(row as unknown as CatalogReadinessRecord);
        if (!readiness.ready || readiness.version !== row.expectedVersion) return null;
        return { position: Number(row.position), readiness,
          snapshot: { ready: true as const, blockingReasons: [] as [], warningReasons: readiness.warningReasons,
            capturedAt: capturedAt.toISOString() } };
      });
      if (snapshots.some(item => item === null)) return { authorized: true, value: null } as const;
      const canonicalSelection = snapshots.map(item => ({ position: item!.position, entityType: item!.readiness.entityType,
        entityId: item!.readiness.entityId, entityVersion: item!.readiness.version, slug: item!.readiness.slug,
        label: item!.readiness.label, readinessSnapshot: item!.snapshot }));
      const selectionSha256 = createHash("sha256").update(JSON.stringify(canonicalSelection)).digest("hex");
      const manifestRows = await tx.query<{ id: string }>(`insert into catalog_release_manifests
        (title,status,version,selection_sha256,created_by_user_id) values ($1,'frozen',1,$2,$3)
        returning id::text as id`, [input.title,selectionSha256,input.actorUserId]);
      const manifestId = manifestRows[0]!.id;
      await tx.query(`insert into catalog_release_manifest_items
        (manifest_id,position,entity_type,entity_id,entity_version,slug,label,readiness_snapshot_json)
        select $1,x.position,x.entity_type,x.entity_id,x.entity_version,x.slug,x.label,x.readiness_snapshot::jsonb
        from jsonb_to_recordset($2::jsonb) as x(position int,entity_type text,entity_id uuid,entity_version int,
          slug text,label text,readiness_snapshot jsonb) order by x.position`, [manifestId,JSON.stringify(canonicalSelection.map(item => ({
          position: item.position, entity_type: item.entityType, entity_id: item.entityId,
          entity_version: item.entityVersion, slug: item.slug, label: item.label, readiness_snapshot: item.readinessSnapshot,
        })))]);
      return { authorized: true, value: await loadReleaseManifest(tx, manifestId) } as const;
    });
  }

  async supersedeReleaseManifest(input: Actor & { manifestId: string; expectedVersion: number }) {
    return this.client.transaction(async tx => {
      if (!await lockLiveCuacStaffAuthority(tx, input)) return { authorized: false } as const;
      const rows = await tx.query<{ id: string }>(`update catalog_release_manifests m set status='superseded',
        version=m.version+1,superseded_by_user_id=$3,superseded_at=clock_timestamp(),updated_at=clock_timestamp()
        where m.id=$1 and m.version=$2 and m.status='frozen'
        returning m.id::text as id`,
      [input.manifestId,input.expectedVersion,input.actorUserId]);
      return { authorized: true, value: rows[0] ? (await loadReleaseManifest(tx, rows[0].id))!.manifest : null } as const;
    });
  }
}

async function loadReleaseManifest(tx: TransactionalSqlClient, manifestId: string): Promise<CatalogReleaseManifestDetail | null> {
  const manifestRows = await tx.query<ManifestRow>(`${catalogReadinessCte}
    select m.id::text as id,m.title,m.status,m.version,m.selection_sha256 as "selectionSha256",
      count(i.id)::int as "itemCount",count(i.id) filter(where r.id is null or r.version<>i.entity_version
        or not r.ready or r.warning_reasons is distinct from array(select jsonb_array_elements_text(
          i.readiness_snapshot_json->'warningReasons')))::int as "driftedItemCount",
      m.created_by_user_id::text as "createdByUserId",m.superseded_by_user_id::text as "supersededByUserId",
      m.superseded_at as "supersededAt",m.created_at as "createdAt",m.updated_at as "updatedAt"
    from catalog_release_manifests m left join catalog_release_manifest_items i on i.manifest_id=m.id
    left join readiness r on r.entity_type=i.entity_type and r.id=i.entity_id where m.id=$1
    group by m.id`, [manifestId]);
  if (!manifestRows[0]) return null;
  const itemRows = await tx.query<ManifestItemRow>(`${catalogReadinessCte}
    select i.id::text as id,i.position,i.entity_type as "entityType",i.entity_id::text as "entityId",
      i.entity_version as "entityVersion",i.slug,i.label,i.readiness_snapshot_json as "readinessSnapshot",
      r.entity_type as "currentEntityType",r.id::text as "currentEntityId",r.slug as "currentSlug",r.label as "currentLabel",
      r.status as "currentStatus",r.verification_status as "currentVerificationStatus",r.version as "currentVersion",
      r.ready as "currentReady",r.blocking_reasons as "currentBlockingReasons",r.warning_reasons as "currentWarningReasons",
      r.next_review_due_at as "currentNextReviewDueAt",r.updated_at as "currentUpdatedAt"
    from catalog_release_manifest_items i left join readiness r on r.entity_type=i.entity_type and r.id=i.entity_id
    where i.manifest_id=$1 order by i.position`, [manifestId]);
  const items = itemRows.map(mapManifestItem);
  const manifest = validateManifestRecord({ ...manifestRows[0], driftedItemCount: items.filter(item => item.driftReasons.length).length });
  return { manifest, items };
}

function mapManifestItem(row: ManifestItemRow): CatalogReleaseManifestItem {
  if (!row || !/^[a-f0-9-]{36}$/i.test(row.id) || !/^[a-f0-9-]{36}$/i.test(row.entityId)
    || !Number.isSafeInteger(row.position) || row.position < 0 || !Number.isSafeInteger(row.entityVersion)
    || !row.readinessSnapshot || row.readinessSnapshot.ready !== true
    || !Array.isArray(row.readinessSnapshot.blockingReasons) || row.readinessSnapshot.blockingReasons.length
    || !Array.isArray(row.readinessSnapshot.warningReasons) || typeof row.readinessSnapshot.capturedAt !== "string") {
    throw serviceUnavailable("Catalog release manifest item data is unavailable.");
  }
  const current = row.currentEntityId ? validateCatalogReadinessRecord({
    entityType: row.currentEntityType!, entityId: row.currentEntityId, slug: row.currentSlug!, label: row.currentLabel!,
    status: row.currentStatus!, verificationStatus: row.currentVerificationStatus as CatalogReadinessRecord["verificationStatus"],
    version: row.currentVersion!, ready: row.currentReady!, blockingReasons: row.currentBlockingReasons ?? [],
    warningReasons: row.currentWarningReasons ?? [], nextReviewDueAt: row.currentNextReviewDueAt,
    updatedAt: row.currentUpdatedAt!,
  }) : null;
  const driftReasons: string[] = [];
  if (!current) driftReasons.push("entity_missing");
  else {
    if (current.version !== row.entityVersion) driftReasons.push("version_changed");
    if (!current.ready) driftReasons.push("readiness_blocked");
    if (JSON.stringify(current.warningReasons) !== JSON.stringify(row.readinessSnapshot.warningReasons)) {
      driftReasons.push("warnings_changed");
    }
  }
  return { id: row.id, position: row.position, entityType: row.entityType, entityId: row.entityId,
    entityVersion: row.entityVersion, slug: row.slug, label: row.label, readinessSnapshot: row.readinessSnapshot,
    current, driftReasons };
}

function validateManifestRecord(value: CatalogReleaseManifestRecord): CatalogReleaseManifestRecord {
  if (!value || !/^[a-f0-9-]{36}$/i.test(value.id) || typeof value.title !== "string"
    || !["frozen","superseded"].includes(value.status) || !Number.isSafeInteger(value.version) || value.version < 1
    || !/^[a-f0-9]{64}$/.test(value.selectionSha256) || !Number.isSafeInteger(value.itemCount) || value.itemCount < 1
    || !Number.isSafeInteger(value.driftedItemCount) || value.driftedItemCount < 0
    || !(value.createdAt instanceof Date) || !(value.updatedAt instanceof Date)
    || !(value.supersededAt === null || value.supersededAt instanceof Date)) {
    throw serviceUnavailable("Catalog release manifest data is unavailable.");
  }
  return value;
}

const editableFieldNames = ["slug", "nameZh", "nameEn", "region", "province", "monthlyCost", "monthlyCostRmb",
  "costLevel", "density", "tags", "content", "nearby", "sortOrder", "sourceUrl", "sourceLabel", "sourceNote"];

function cityParams(city: CatalogCityDocument): unknown[] {
  const lineage = Object.fromEntries(["nameZh", "nameEn", "region", "province", "monthlyCost", "monthlyCostRmb",
    "costLevel", "density", "tags", "content", "nearby"].map(field => [field, city.sourceUrl]));
  return [city.slug,city.nameZh,city.nameEn,city.region,city.province,city.monthlyCost,city.monthlyCostRmb,
    city.costLevel,city.density,JSON.stringify(city.tags),JSON.stringify(city.content),JSON.stringify(city.nearby),
    city.sortOrder,city.sourceUrl,city.sourceLabel,city.sourceNote,JSON.stringify(lineage)];
}

async function insertEvidence(tx: TransactionalSqlClient, cityId: string, city: CatalogCityDocument, actorUserId: string) {
  const rows = await tx.query<{ id: string }>(`insert into catalog_source_evidence (
    entity_type,entity_id,source_url,source_label,captured_by_user_id,evidence_note,source_field_lineage_json,metadata_json
  ) values ('city',$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) returning id::text as id`,
  [cityId,city.sourceUrl,city.sourceLabel,actorUserId,city.sourceNote,JSON.stringify({ sourceUrl: city.sourceUrl }),
    JSON.stringify({ captureMethod: "ops_catalog_admin" })]);
  return rows[0]!.id;
}

async function insertRevision(tx: TransactionalSqlClient, city: CatalogCityRecord, action: CatalogCityRevision["action"],
  changedFields: string[], evidenceId: string | null, actorUserId: string) {
  await tx.query(`insert into catalog_entity_revisions (
    entity_type,entity_id,entity_version,action,snapshot_json,changed_fields_json,source_evidence_id,actor_user_id
  ) values ('city',$1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
  [city.id,city.version,action,JSON.stringify(city),JSON.stringify(changedFields),evidenceId,actorUserId]);
}

function changedFields(before: CatalogCityRecord, after: CatalogCityRecord) {
  return editableFieldNames.filter(field => canonical(before[field as keyof CatalogCityRecord])
    !== canonical(after[field as keyof CatalogCityRecord]));
}

function canonical(value: unknown) {
  return JSON.stringify(value ?? null);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

function returningCityColumns(alias = "cities") {
  return `${alias}.id::text as id,${alias}.slug,${alias}.name_zh as "nameZh",${alias}.name_en as "nameEn",
    ${alias}.region,${alias}.province,${alias}.monthly_cost as "monthlyCost",${alias}.monthly_cost_rmb as "monthlyCostRmb",
    ${alias}.cost_level as "costLevel",${alias}.density,${alias}.tags,${alias}.content_json as content,${alias}.nearby,
    ${alias}.sort_order as "sortOrder",${alias}.version,${alias}.status,${alias}.verification_status as "verificationStatus",
    ${alias}.source_url as "sourceUrl",${alias}.source_label as "sourceLabel",${alias}.source_note as "sourceNote",
    ${alias}.verified_by_user_id::text as "verifiedByUserId",${alias}.last_verified_at as "lastVerifiedAt",
    ${alias}.next_review_due_at as "nextReviewDueAt",${alias}.created_at as "createdAt",${alias}.updated_at as "updatedAt"`;
}

const schoolEditableFieldNames = ["slug","nameZh","nameEn","schoolType","region","cityId","city","cityZh","citySlug",
  "province","regionLabel","ranking","cscaRequired","cscaRequirement","cscaSubjects","applicationLevel",
  "languageOfInstruction","languageRequirement","hskRequirement","englishRequirement","deadlineSummary","tuitionSummary",
  "applicationFee","websiteUrl","admissionsUrl","subjectTags","fitNotes","languageTags","tuitionBandLabel",
  "campusHighlights","contactNotes","qualityScore","missingFields","completenessLabel","sourceUrl","sourceLabel","sourceNote"];

function schoolParams(s: CatalogSchoolDocument): unknown[] {
  const lineage = Object.fromEntries(schoolEditableFieldNames.filter(field => !["slug", "cityId", "city", "cityZh", "citySlug", "province"].includes(field))
    .map(field => [field, s.sourceUrl]));
  Object.assign(lineage, Object.fromEntries(["city", "cityZh", "citySlug", "province"].map(field => [field, `catalog_city:${s.cityId}`])));
  return [s.slug,s.nameZh,s.nameEn,s.schoolType,s.region,s.cityId,s.regionLabel,s.ranking,s.cscaRequired,s.cscaRequirement,
    JSON.stringify(s.cscaSubjects),s.applicationLevel,s.languageOfInstruction,
    s.languageRequirement,s.hskRequirement,s.englishRequirement,s.deadlineSummary,s.tuitionSummary,s.applicationFee,
    s.websiteUrl,s.admissionsUrl,JSON.stringify(s.subjectTags),s.fitNotes,JSON.stringify(s.languageTags),s.tuitionBandLabel,
    JSON.stringify(s.campusHighlights),s.contactNotes,s.qualityScore,JSON.stringify(s.missingFields),s.completenessLabel,
    s.sourceUrl,s.sourceLabel,s.sourceNote,JSON.stringify(lineage)];
}

async function insertSchoolEvidence(tx: TransactionalSqlClient, schoolId: string, school: CatalogSchoolDocument,
  actorUserId: string) {
  const rows = await tx.query<{ id: string }>(`insert into catalog_source_evidence (
    entity_type,entity_id,source_url,source_label,captured_by_user_id,evidence_note,source_field_lineage_json,metadata_json
  ) values ('school',$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) returning id::text as id`,
  [schoolId,school.sourceUrl,school.sourceLabel,actorUserId,school.sourceNote,JSON.stringify({ sourceUrl: school.sourceUrl }),
    JSON.stringify({ captureMethod: "ops_catalog_admin" })]);
  return rows[0]!.id;
}

async function insertSchoolRevision(tx: TransactionalSqlClient, school: CatalogSchoolRecord,
  action: CatalogSchoolRevision["action"], changedFields: string[], evidenceId: string | null, actorUserId: string) {
  await tx.query(`insert into catalog_entity_revisions (
    entity_type,entity_id,entity_version,action,snapshot_json,changed_fields_json,source_evidence_id,actor_user_id
  ) values ('school',$1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
  [school.id,school.version,action,JSON.stringify(school),JSON.stringify(changedFields),evidenceId,actorUserId]);
}

function changedSchoolFields(before: CatalogSchoolRecord, after: CatalogSchoolRecord) {
  return schoolEditableFieldNames.filter(field => canonical(before[field as keyof CatalogSchoolRecord])
    !== canonical(after[field as keyof CatalogSchoolRecord]));
}

function returningSchoolColumns(alias = "schools") {
  return `${alias}.id::text as id,${alias}.slug,${alias}.name_zh as "nameZh",${alias}.name_en as "nameEn",
    ${alias}.school_type as "schoolType",${alias}.region,${alias}.city_id::text as "cityId",${alias}.city,
    ${alias}.city_zh as "cityZh",${alias}.city_slug as "citySlug",${alias}.province,${alias}.region_label as "regionLabel",
    ${alias}.ranking,${alias}.csca_required as "cscaRequired",${alias}.csca_requirement as "cscaRequirement",
    ${alias}.csca_subjects as "cscaSubjects",${alias}.application_level as "applicationLevel",
    ${alias}.language_of_instruction as "languageOfInstruction",${alias}.language_requirement as "languageRequirement",
    ${alias}.hsk_requirement as "hskRequirement",${alias}.english_requirement as "englishRequirement",
    ${alias}.deadline_summary as "deadlineSummary",${alias}.tuition_summary as "tuitionSummary",
    ${alias}.application_fee as "applicationFee",${alias}.website_url as "websiteUrl",${alias}.admissions_url as "admissionsUrl",
    ${alias}.subject_tags as "subjectTags",${alias}.fit_notes as "fitNotes",${alias}.language_tags as "languageTags",
    ${alias}.tuition_band_label as "tuitionBandLabel",${alias}.campus_highlights as "campusHighlights",
    ${alias}.contact_notes as "contactNotes",${alias}.quality_score as "qualityScore",${alias}.missing_fields as "missingFields",
    ${alias}.completeness_label as "completenessLabel",${alias}.version,${alias}.status,
    ${alias}.verification_status as "verificationStatus",${alias}.source_url as "sourceUrl",
    ${alias}.source_label as "sourceLabel",${alias}.source_note as "sourceNote",
    ${alias}.verified_by_user_id::text as "verifiedByUserId",${alias}.last_verified_at as "lastVerifiedAt",
    ${alias}.next_review_due_at as "nextReviewDueAt",${alias}.created_at as "createdAt",${alias}.updated_at as "updatedAt"`;
}

const programEditableFieldNames = ["schoolId","cityId","slug","nameZh","nameEn","degreeLevel","durationYears",
  "durationMonths","fieldCategory","subjectArea","teachingLanguage","cscaSubjects","cscaRequirement","hskRequirement",
  "englishRequirement","tuitionAmount","tuitionCurrency","tuitionPeriod","tuitionText","scholarshipText",
  "applicationUrl","applicationNote","hasScholarship","badgeText","displayTuition","displaySubjects","displayGroup",
  "displayGroupLabel","sortOrder","sourceUrl","sourceLabel","sourceNote"];

function programParams(p: CatalogProgramDocument): unknown[] {
  const lineage = Object.fromEntries(programEditableFieldNames.filter(field => !["schoolId","cityId","slug"].includes(field))
    .map(field => [field,p.sourceUrl]));
  Object.assign(lineage, { schoolId: `catalog_school:${p.schoolId}`, cityId: `catalog_city:${p.cityId}` });
  return [p.schoolId,p.cityId,p.slug,p.nameZh,p.nameEn,p.degreeLevel,p.durationYears,p.durationMonths,p.fieldCategory,
    p.subjectArea,p.teachingLanguage,JSON.stringify(p.cscaSubjects),p.cscaRequirement,p.hskRequirement,p.englishRequirement,
    p.tuitionAmount,p.tuitionCurrency,p.tuitionPeriod,p.tuitionText,p.scholarshipText,p.applicationUrl,p.applicationNote,
    p.hasScholarship,p.badgeText,p.displayTuition,JSON.stringify(p.displaySubjects),p.displayGroup,p.displayGroupLabel,
    p.sortOrder,p.sourceUrl,p.sourceLabel,p.sourceNote,JSON.stringify(lineage)];
}

async function insertProgramEvidence(tx: TransactionalSqlClient, programId: string, program: CatalogProgramDocument,
  actorUserId: string) {
  const rows = await tx.query<{ id: string }>(`insert into catalog_source_evidence (
    entity_type,entity_id,source_url,source_label,captured_by_user_id,evidence_note,source_field_lineage_json,metadata_json
  ) values ('program',$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) returning id::text as id`,
  [programId,program.sourceUrl,program.sourceLabel,actorUserId,program.sourceNote,
    JSON.stringify({ sourceUrl: program.sourceUrl, schoolId: `catalog_school:${program.schoolId}`,
      cityId: `catalog_city:${program.cityId}` }), JSON.stringify({ captureMethod: "ops_catalog_admin" })]);
  return rows[0]!.id;
}

async function insertProgramRevision(tx: TransactionalSqlClient, program: CatalogProgramRecord,
  action: CatalogProgramRevision["action"], changedFields: string[], evidenceId: string | null, actorUserId: string) {
  await tx.query(`insert into catalog_entity_revisions (
    entity_type,entity_id,entity_version,action,snapshot_json,changed_fields_json,source_evidence_id,actor_user_id
  ) values ('program',$1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
  [program.id,program.version,action,JSON.stringify(program),JSON.stringify(changedFields),evidenceId,actorUserId]);
}

function changedProgramFields(before: CatalogProgramRecord, after: CatalogProgramRecord) {
  return programEditableFieldNames.filter(field => canonical(before[field as keyof CatalogProgramRecord])
    !== canonical(after[field as keyof CatalogProgramRecord]));
}

function returningProgramColumns(alias = "programs") {
  return programColumns.replaceAll("p.", `${alias}.`);
}

const scholarshipEditableFieldNames = ["slug","title","nameZh","type","typeLabel","fundingLevel","providerName",
  "providerNameEn","providerLocation","schoolId","programId","coverage","applicableDegree","applicableProgram",
  "amountText","requirementText","bodySections","benefitItems","eligibilityItems","applicationMaterials",
  "applicationSteps","contactInfo","actionLinks","deadlineDate","deadlineLabel","applicationRound","targetCountries",
  "targetRegions","benefits","tags","summary","sortOrder","sourceUrl","sourceLabel","sourceNote"];

function scholarshipParams(sc: CatalogScholarshipDocument): unknown[] {
  const lineage = Object.fromEntries(scholarshipEditableFieldNames.filter(field => !["schoolId","programId","slug"].includes(field))
    .map(field => [field,sc.sourceUrl]));
  if (sc.schoolId) lineage.schoolId = `catalog_school:${sc.schoolId}`;
  if (sc.programId) lineage.programId = `catalog_program:${sc.programId}`;
  return [sc.slug,sc.title,sc.nameZh,sc.type,sc.typeLabel,sc.fundingLevel,sc.providerName,sc.providerNameEn,
    sc.providerLocation,sc.schoolId,sc.programId,sc.coverage,sc.applicableDegree,sc.applicableProgram,sc.amountText,
    sc.requirementText,JSON.stringify(sc.bodySections),JSON.stringify(sc.benefitItems),JSON.stringify(sc.eligibilityItems),
    JSON.stringify(sc.applicationMaterials),JSON.stringify(sc.applicationSteps),JSON.stringify(sc.contactInfo),
    JSON.stringify(sc.actionLinks),sc.deadlineDate,sc.deadlineLabel,sc.applicationRound,JSON.stringify(sc.targetCountries),
    JSON.stringify(sc.targetRegions),JSON.stringify(sc.benefits),JSON.stringify(sc.tags),sc.summary,sc.sortOrder,
    sc.sourceUrl,sc.sourceLabel,sc.sourceNote,JSON.stringify(lineage)];
}

async function insertScholarshipEvidence(tx: TransactionalSqlClient, scholarshipId: string,
  scholarship: CatalogScholarshipDocument, actorUserId: string) {
  const lineage: Record<string,string> = { sourceUrl: scholarship.sourceUrl };
  if (scholarship.schoolId) lineage.schoolId = `catalog_school:${scholarship.schoolId}`;
  if (scholarship.programId) lineage.programId = `catalog_program:${scholarship.programId}`;
  const rows = await tx.query<{ id: string }>(`insert into catalog_source_evidence (
    entity_type,entity_id,source_url,source_label,captured_by_user_id,evidence_note,source_field_lineage_json,metadata_json
  ) values ('scholarship',$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) returning id::text as id`,
  [scholarshipId,scholarship.sourceUrl,scholarship.sourceLabel,actorUserId,scholarship.sourceNote,
    JSON.stringify(lineage),JSON.stringify({ captureMethod: "ops_catalog_admin" })]);
  return rows[0]!.id;
}

async function insertScholarshipRevision(tx: TransactionalSqlClient, scholarship: CatalogScholarshipRecord,
  action: CatalogScholarshipRevision["action"], changedFields: string[], evidenceId: string | null, actorUserId: string) {
  await tx.query(`insert into catalog_entity_revisions (
    entity_type,entity_id,entity_version,action,snapshot_json,changed_fields_json,source_evidence_id,actor_user_id
  ) values ('scholarship',$1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)`,
  [scholarship.id,scholarship.version,action,JSON.stringify(scholarship),JSON.stringify(changedFields),evidenceId,actorUserId]);
}

function changedScholarshipFields(before: CatalogScholarshipRecord, after: CatalogScholarshipRecord) {
  return scholarshipEditableFieldNames.filter(field => canonical(before[field as keyof CatalogScholarshipRecord])
    !== canonical(after[field as keyof CatalogScholarshipRecord]));
}

function returningScholarshipColumns(alias = "scholarships") {
  return scholarshipColumns.replaceAll("sc.", `${alias}.`);
}
