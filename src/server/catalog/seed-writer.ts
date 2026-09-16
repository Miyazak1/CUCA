import type { SqlCatalogClient } from "./postgres-repository.ts";
import {
  createCatalogSeedImportPlan,
  type CatalogSeedBundle,
  type CatalogSeedImportEntityType,
  type CatalogSeedSource,
} from "./seed-contract.ts";

export type CatalogSeedWriteResult = {
  ok: boolean;
  errors: string[];
  summary: {
    cities: number;
    schools: number;
    programs: number;
    programIntakes: number;
    scholarships: number;
    evidence: number;
  };
  written: {
    entityType: CatalogSeedImportEntityType;
    slug: string;
    id: string;
  }[];
};

export type CatalogSeedWriteOptions = {
  preserveExistingCitySlugs?: readonly string[];
  preserveExistingSchoolSlugs?: readonly string[];
};

export class CatalogSeedWriter {
  private readonly client: SqlCatalogClient;

  constructor(client: SqlCatalogClient) {
    this.client = client;
  }

  async writeBundle(bundle: unknown, options: CatalogSeedWriteOptions = {}): Promise<CatalogSeedWriteResult> {
    const plan = createCatalogSeedImportPlan(bundle);

    if (!plan.ok) {
      return {
        ok: false,
        errors: plan.errors,
        summary: {
          ...plan.summary,
          evidence: 0,
        },
        written: [],
      };
    }

    const seedBundle = bundle as CatalogSeedBundle;
    const preservedCities = new Set(options.preserveExistingCitySlugs ?? []);
    const preservedSchools = new Set(options.preserveExistingSchoolSlugs ?? []);
    const bundleCitySlugs = new Set((seedBundle.cities ?? []).map((city) => city.slug));
    const bundleSchoolSlugs = new Set((seedBundle.schools ?? []).map((school) => school.slug));
    for (const slug of preservedCities) if (!bundleCitySlugs.has(slug)) throw new Error(`Preserved city dependency is not present in the validated bundle: ${slug}`);
    for (const slug of preservedSchools) if (!bundleSchoolSlugs.has(slug)) throw new Error(`Preserved school dependency is not present in the validated bundle: ${slug}`);
    const written: CatalogSeedWriteResult["written"] = [];
    let evidence = 0;

    for (const city of seedBundle.cities ?? []) {
      const preserve = preservedCities.has(city.slug);
      const id = preserve ? await this.requireExistingCity(city.slug) : await this.upsertCity(city);
      if (!preserve) await this.writeSourceEvidence("city", id, city);
      written.push({ entityType: "city", slug: city.slug, id });
      if (!preserve) evidence += 1;
    }

    for (const school of seedBundle.schools ?? []) {
      const preserve = preservedSchools.has(school.slug);
      const id = preserve ? await this.requireExistingSchool(school.slug) : await this.upsertSchool(school);
      if (!preserve) await this.writeSourceEvidence("school", id, school);
      written.push({ entityType: "school", slug: school.slug, id });
      if (!preserve) evidence += 1;
    }

    for (const program of seedBundle.programs ?? []) {
      const id = await this.upsertProgram(program);
      await this.writeSourceEvidence("program", id, program);
      written.push({ entityType: "program", slug: program.slug, id });
      evidence += 1;
    }

    for (const intake of seedBundle.programIntakes ?? []) {
      const id = await this.upsertProgramIntake(intake);
      await this.writeSourceEvidence("programIntake", id, intake);
      const slug = [intake.programSlug, intake.intakeTerm.toLowerCase(), intake.intakeYear].join("-");
      written.push({ entityType: "programIntake", slug, id });
      evidence += 1;
    }

    for (const scholarship of seedBundle.scholarships ?? []) {
      const id = await this.upsertScholarship(scholarship);
      await this.writeSourceEvidence("scholarship", id, scholarship);
      written.push({ entityType: "scholarship", slug: scholarship.slug, id });
      evidence += 1;
    }

    return {
      ok: true,
      errors: [],
      summary: {
        ...plan.summary,
        evidence,
      },
      written,
    };
  }

  private async requireExistingCity(slug: string): Promise<string> {
    const rows = await this.client.query<{ id: string }>("select id from cities where slug = $1", [slug]);
    return requireReturnedId(rows, "city", slug);
  }

  private async requireExistingSchool(slug: string): Promise<string> {
    const rows = await this.client.query<{ id: string }>("select id from schools where slug = $1", [slug]);
    return requireReturnedId(rows, "school", slug);
  }

  private async upsertCity(city: NonNullable<CatalogSeedBundle["cities"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into cities (
         slug, name_zh, name_en, region, province, status, source_url, source_label, source_field_lineage_json
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       on conflict (slug) do update set
         name_zh = excluded.name_zh,
         name_en = excluded.name_en,
         region = excluded.region,
         province = excluded.province,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         updated_at = now()
       returning id`,
      [
        city.slug,
        city.nameZh ?? null,
        city.nameEn,
        city.region ?? null,
        city.province ?? null,
        city.status ?? "draft",
        city.sourceUrl,
        city.sourceLabel,
        JSON.stringify(city.sourceFieldLineage ?? {}),
      ],
    );

    return requireReturnedId(rows, "city", city.slug);
  }

  private async upsertSchool(school: NonNullable<CatalogSeedBundle["schools"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into schools (
         slug, name_zh, name_en, school_type, region, city_id, city_slug, city, city_zh, province, status, source_url, source_label, source_field_lineage_json, verification_status, last_verified_at
       ) values ($1, $2, $3, $4, $5, (select id from cities where slug = $6), $6, (select name_en from cities where slug = $6), (select name_zh from cities where slug = $6), (select province from cities where slug = $6), $7, $8, $9, $10::jsonb, coalesce($11, 'unverified'), $12::timestamptz)
       on conflict (slug) do update set
         name_zh = excluded.name_zh,
         name_en = excluded.name_en,
         school_type = excluded.school_type,
         region = excluded.region,
         city_id = excluded.city_id,
         city_slug = excluded.city_slug,
         city = excluded.city,
         city_zh = excluded.city_zh,
         province = excluded.province,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         verification_status = coalesce($11, schools.verification_status),
         last_verified_at = coalesce($12::timestamptz, schools.last_verified_at),
         updated_at = now()
       returning id`,
      [
        school.slug,
        school.nameZh ?? null,
        school.nameEn,
        school.schoolType ?? null,
        school.region ?? null,
        school.citySlug ?? null,
        school.status ?? "draft",
        school.sourceUrl,
        school.sourceLabel,
        JSON.stringify(school.sourceFieldLineage ?? {}),
        school.verificationStatus ?? null,
        school.lastVerifiedAt ?? null,
      ],
    );

    const id = requireReturnedId(rows, "school", school.slug);
    await this.applySchoolDetails(id, school);
    return id;
  }

  private async upsertProgram(program: NonNullable<CatalogSeedBundle["programs"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into programs (
         slug, school_id, name_zh, name_en, degree_level, teaching_language, tuition_text, status, source_url, source_label, source_field_lineage_json, is_verified, verification_status, last_verified_at
       ) values ($1, (select id from schools where slug = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, coalesce($12::boolean, false), coalesce($13, 'unverified'), $14::timestamptz)
       on conflict (slug) do update set
         school_id = excluded.school_id,
         name_zh = excluded.name_zh,
         name_en = excluded.name_en,
         degree_level = excluded.degree_level,
         teaching_language = excluded.teaching_language,
         tuition_text = excluded.tuition_text,
         status = excluded.status,
         source_url = excluded.source_url,
         source_label = excluded.source_label,
         source_field_lineage_json = excluded.source_field_lineage_json,
         is_verified = case when $13 is null then programs.is_verified else $12::boolean end,
         verification_status = coalesce($13, programs.verification_status),
         last_verified_at = coalesce($14::timestamptz, programs.last_verified_at),
         updated_at = now()
       returning id`,
      [
        program.slug,
        program.schoolSlug,
        program.nameZh ?? null,
        program.nameEn,
        program.degreeLevel,
        program.teachingLanguage ?? null,
        program.tuitionText ?? null,
        program.status ?? "draft",
        program.sourceUrl,
        program.sourceLabel,
        JSON.stringify(program.sourceFieldLineage ?? {}),
        program.verificationStatus === undefined ? null : program.verificationStatus === "verified",
        program.verificationStatus ?? null,
        program.lastVerifiedAt ?? null,
      ],
    );

    const id = requireReturnedId(rows, "program", program.slug);
    await this.applyProgramDetails(id, program);
    return id;
  }

  private async applySchoolDetails(id: string, school: NonNullable<CatalogSeedBundle["schools"]>[number]): Promise<void> {
    const fields = ["applicationLevel", "languageOfInstruction", "languageRequirement", "hskRequirement", "englishRequirement",
      "deadlineSummary", "tuitionSummary", "applicationFee", "websiteUrl", "admissionsUrl", "cscaRequired", "cscaRequirement",
      "cscaSubjects", "subjectTags", "languageTags", "tuitionBandLabel", "campusHighlights", "contactNotes"] as const;
    if (!fields.some(field => school[field] !== undefined)) return;
    await this.client.query(
      `update schools set
         application_level = coalesce($2, application_level),
         language_of_instruction = coalesce($3, language_of_instruction),
         language_requirement = coalesce($4, language_requirement),
         hsk_requirement = coalesce($5, hsk_requirement),
         english_requirement = coalesce($6, english_requirement),
         deadline_summary = coalesce($7, deadline_summary),
         tuition_summary = coalesce($8, tuition_summary),
         application_fee = coalesce($9, application_fee),
         website_url = coalesce($10, website_url),
         admissions_url = coalesce($11, admissions_url),
         csca_required = coalesce($12::boolean, csca_required),
         csca_requirement = coalesce($13, csca_requirement),
         csca_subjects = coalesce($14::jsonb, csca_subjects),
         subject_tags = coalesce($15::jsonb, subject_tags),
         language_tags = coalesce($16::jsonb, language_tags),
         tuition_band_label = coalesce($17, tuition_band_label),
         campus_highlights = coalesce($18::jsonb, campus_highlights),
         contact_notes = coalesce($19, contact_notes),
         updated_at = now()
       where id = $1`,
      [id, school.applicationLevel ?? null, school.languageOfInstruction ?? null, school.languageRequirement ?? null,
        school.hskRequirement ?? null, school.englishRequirement ?? null, school.deadlineSummary ?? null,
        school.tuitionSummary ?? null, school.applicationFee ?? null, school.websiteUrl ?? null, school.admissionsUrl ?? null,
        school.cscaRequired ?? null, school.cscaRequirement ?? null,
        school.cscaSubjects === undefined ? null : JSON.stringify(school.cscaSubjects),
        school.subjectTags === undefined ? null : JSON.stringify(school.subjectTags),
        school.languageTags === undefined ? null : JSON.stringify(school.languageTags),
        school.tuitionBandLabel ?? null,
        school.campusHighlights === undefined ? null : JSON.stringify(school.campusHighlights),
        school.contactNotes ?? null],
    );
  }

  private async applyProgramDetails(id: string, program: NonNullable<CatalogSeedBundle["programs"]>[number]): Promise<void> {
    const fields = ["citySlug", "durationYears", "durationMonths", "fieldCategory", "subjectArea", "cscaSubjects",
      "cscaRequirement", "hskRequirement", "englishRequirement", "tuitionAmount", "tuitionCurrency", "tuitionPeriod",
      "scholarshipText", "applicationUrl", "applicationNote", "hasScholarship", "badgeText", "displayTuition",
      "displaySubjects", "displayGroup", "displayGroupLabel"] as const;
    if (!fields.some(field => program[field] !== undefined)) return;
    await this.client.query(
      `update programs set
         city_id = case when $2::text is null then city_id else (select id from cities where slug = $2) end,
         duration_years = coalesce($3::integer, duration_years),
         duration_months = coalesce($4::integer, duration_months),
         field_category = coalesce($5, field_category),
         subject_area = coalesce($6, subject_area),
         csca_subjects = coalesce($7::jsonb, csca_subjects),
         csca_requirement = coalesce($8, csca_requirement),
         hsk_requirement = coalesce($9, hsk_requirement),
         english_requirement = coalesce($10, english_requirement),
         tuition_amount = coalesce($11::integer, tuition_amount),
         tuition_currency = coalesce($12, tuition_currency),
         tuition_period = coalesce($13, tuition_period),
         scholarship_text = coalesce($14, scholarship_text),
         application_url = coalesce($15, application_url),
         application_note = coalesce($16, application_note),
         has_scholarship = coalesce($17::boolean, has_scholarship),
         badge_text = coalesce($18, badge_text),
         display_tuition = coalesce($19, display_tuition),
         display_subjects = coalesce($20::jsonb, display_subjects),
         display_group = coalesce($21, display_group),
         display_group_label = coalesce($22, display_group_label),
         updated_at = now()
       where id = $1`,
      [id, program.citySlug ?? null, program.durationYears ?? null, program.durationMonths ?? null,
        program.fieldCategory ?? null, program.subjectArea ?? null,
        program.cscaSubjects === undefined ? null : JSON.stringify(program.cscaSubjects),
        program.cscaRequirement ?? null, program.hskRequirement ?? null, program.englishRequirement ?? null,
        program.tuitionAmount ?? null, program.tuitionCurrency ?? null, program.tuitionPeriod ?? null,
        program.scholarshipText ?? null, program.applicationUrl ?? null, program.applicationNote ?? null,
        program.hasScholarship ?? null, program.badgeText ?? null, program.displayTuition ?? null,
        program.displaySubjects === undefined ? null : JSON.stringify(program.displaySubjects),
        program.displayGroup ?? null, program.displayGroupLabel ?? null],
    );
  }

  private async upsertProgramIntake(intake: NonNullable<CatalogSeedBundle["programIntakes"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into program_intakes (
         program_id, intake_term, intake_year, open_date, deadline_date, deadline_label, application_round, status
       ) values ((select id from programs where slug = $1), $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8)
       on conflict (program_id, intake_term, intake_year) do update set
         open_date = excluded.open_date,
         deadline_date = excluded.deadline_date,
         deadline_label = excluded.deadline_label,
         application_round = excluded.application_round,
         status = excluded.status,
         updated_at = now()
       returning id`,
      [intake.programSlug, intake.intakeTerm, intake.intakeYear, intake.openDate ?? null, intake.deadlineDate ?? null,
        intake.deadlineLabel ?? null, intake.applicationRound ?? null, intake.status ?? "closed"],
    );
    return requireReturnedId(rows, "programIntake", [intake.programSlug, intake.intakeTerm, intake.intakeYear].join("-"));
  }

  private async upsertScholarship(scholarship: NonNullable<CatalogSeedBundle["scholarships"]>[number]): Promise<string> {
    const rows = await this.client.query<{ id: string }>(
      `insert into scholarships (
         slug, title, name_zh, school_id, program_id, type, type_label,
         provider_name, provider_name_en, provider_location, funding_level, coverage,
         applicable_degree, applicable_program, amount_text, requirement_text,
         body_sections, benefit_items, eligibility_items, application_materials, application_steps, action_links,
         deadline_date, deadline_label, application_round, target_countries, target_regions, benefits, tags,
         summary, sort_order, status, verification_status, last_verified_at,
         source_url, source_label, source_field_lineage_json
       ) values (
         $1, $2, $3,
         (select id from schools where slug = $4),
         (select id from programs where slug = $5),
         $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         coalesce($17::jsonb, '[]'::jsonb), coalesce($18::jsonb, '[]'::jsonb),
         coalesce($19::jsonb, '[]'::jsonb), coalesce($20::jsonb, '[]'::jsonb),
         coalesce($21::jsonb, '[]'::jsonb), coalesce($22::jsonb, '[]'::jsonb),
         $23::date, $24, $25, coalesce($26::jsonb, '[]'::jsonb), coalesce($27::jsonb, '[]'::jsonb),
         coalesce($28::jsonb, '[]'::jsonb), coalesce($29::jsonb, '[]'::jsonb),
         $30, coalesce($31, 0), coalesce($32, 'draft'), coalesce($33, 'unverified'), $34::timestamptz,
         $35, $36, coalesce($37::jsonb, '{}'::jsonb)
       )
       on conflict (slug) do update set
         title = excluded.title, name_zh = coalesce($3, scholarships.name_zh),
         school_id = coalesce((select id from schools where slug = $4), scholarships.school_id),
         program_id = coalesce((select id from programs where slug = $5), scholarships.program_id),
         type = coalesce($6, scholarships.type), type_label = coalesce($7, scholarships.type_label),
         provider_name = coalesce($8, scholarships.provider_name), provider_name_en = coalesce($9, scholarships.provider_name_en),
         provider_location = coalesce($10, scholarships.provider_location), funding_level = coalesce($11, scholarships.funding_level),
         coverage = coalesce($12, scholarships.coverage), applicable_degree = coalesce($13, scholarships.applicable_degree),
         applicable_program = coalesce($14, scholarships.applicable_program), amount_text = coalesce($15, scholarships.amount_text),
         requirement_text = coalesce($16, scholarships.requirement_text),
         body_sections = coalesce($17::jsonb, scholarships.body_sections), benefit_items = coalesce($18::jsonb, scholarships.benefit_items),
         eligibility_items = coalesce($19::jsonb, scholarships.eligibility_items),
         application_materials = coalesce($20::jsonb, scholarships.application_materials),
         application_steps = coalesce($21::jsonb, scholarships.application_steps),
         action_links = coalesce($22::jsonb, scholarships.action_links),
         deadline_date = coalesce($23::date, scholarships.deadline_date), deadline_label = coalesce($24, scholarships.deadline_label),
         application_round = coalesce($25, scholarships.application_round),
         target_countries = coalesce($26::jsonb, scholarships.target_countries),
         target_regions = coalesce($27::jsonb, scholarships.target_regions),
         benefits = coalesce($28::jsonb, scholarships.benefits), tags = coalesce($29::jsonb, scholarships.tags),
         summary = coalesce($30, scholarships.summary), sort_order = coalesce($31, scholarships.sort_order),
         status = coalesce($32, scholarships.status),
         verification_status = coalesce($33, scholarships.verification_status),
         last_verified_at = coalesce($34::timestamptz, scholarships.last_verified_at),
         source_url = excluded.source_url, source_label = excluded.source_label,
         source_field_lineage_json = coalesce($37::jsonb, scholarships.source_field_lineage_json), updated_at = now()
       returning id`,
      [
        scholarship.slug, scholarship.title, scholarship.nameZh ?? null,
        scholarship.schoolSlug ?? null, scholarship.programSlug ?? null,
        scholarship.type ?? null, scholarship.typeLabel ?? null, scholarship.providerName ?? null,
        scholarship.providerNameEn ?? null, scholarship.providerLocation ?? null, scholarship.fundingLevel ?? null,
        scholarship.coverage ?? null, scholarship.applicableDegree ?? null, scholarship.applicableProgram ?? null,
        scholarship.amountText ?? null, scholarship.requirementText ?? null,
        scholarship.bodySections === undefined ? null : JSON.stringify(scholarship.bodySections),
        scholarship.benefitItems === undefined ? null : JSON.stringify(scholarship.benefitItems),
        scholarship.eligibilityItems === undefined ? null : JSON.stringify(scholarship.eligibilityItems),
        scholarship.applicationMaterials === undefined ? null : JSON.stringify(scholarship.applicationMaterials),
        scholarship.applicationSteps === undefined ? null : JSON.stringify(scholarship.applicationSteps),
        scholarship.actionLinks === undefined ? null : JSON.stringify(scholarship.actionLinks),
        scholarship.deadlineDate ?? null, scholarship.deadlineLabel ?? null, scholarship.applicationRound ?? null,
        scholarship.targetCountries === undefined ? null : JSON.stringify(scholarship.targetCountries),
        scholarship.targetRegions === undefined ? null : JSON.stringify(scholarship.targetRegions),
        scholarship.benefits === undefined ? null : JSON.stringify(scholarship.benefits),
        scholarship.tags === undefined ? null : JSON.stringify(scholarship.tags),
        scholarship.summary ?? null, scholarship.sortOrder ?? null, scholarship.status ?? null,
        scholarship.verificationStatus ?? null, scholarship.lastVerifiedAt ?? null,
        scholarship.sourceUrl, scholarship.sourceLabel,
        scholarship.sourceFieldLineage === undefined ? null : JSON.stringify(scholarship.sourceFieldLineage),
      ],
    );

    return requireReturnedId(rows, "scholarship", scholarship.slug);
  }

  private async writeSourceEvidence(entityType: CatalogSeedImportEntityType, entityId: string, source: CatalogSeedSource): Promise<void> {
    await this.client.query(
      `insert into catalog_source_evidence (
         entity_type, entity_id, source_url, source_label, captured_at, checksum, source_field_lineage_json, metadata_json
       )
       select $1, $2, $3, $4, coalesce($5::timestamptz, now()), $6, $7::jsonb, $8::jsonb
       where not exists (
         select 1
         from catalog_source_evidence
         where entity_type = $1
           and entity_id = $2
           and source_url is not distinct from $3
           and source_label is not distinct from $4
           and checksum is not distinct from $6
       )`,
      [
        entityType,
        entityId,
        source.sourceUrl,
        source.sourceLabel,
        source.capturedAt ?? null,
        source.sourceSha256 ?? null,
        JSON.stringify(source.sourceFieldLineage ?? {}),
        JSON.stringify({ importSource: "catalog_seed_writer_v2" }),
      ],
    );
  }
}

function requireReturnedId(rows: readonly { id: string }[], entityType: CatalogSeedImportEntityType, slug: string): string {
  if (!rows[0]?.id) {
    throw new Error(`Catalog seed upsert did not return an id for ${entityType}:${slug}.`);
  }

  return rows[0].id;
}
