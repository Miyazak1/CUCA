import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type CountRow = { metric: string; count: number };
type IssueRow = Record<string, unknown>;

const root = process.cwd();
const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({
  databaseUrl: localDatabaseUrl(state),
  max: 1,
  applicationName: "cuac:catalog-data-integrity-audit",
});

async function rows(sql: string): Promise<IssueRow[]> {
  const result = await pool.query(sql);
  return result.rows;
}

try {
  const generatedAt = new Date().toISOString();
  const entityCounts = await rows(`
    select 'schools_total' metric, count(*)::int count from schools
    union all select 'schools_active', count(*)::int from schools where status = 'active'
    union all select 'schools_verified_active', count(*)::int from schools where status = 'active' and verification_status = 'verified'
    union all select 'schools_public_eligible', count(*)::int from schools where status = 'active' and verification_status in ('verified','stale')
    union all select 'programs_total', count(*)::int from programs
    union all select 'programs_active', count(*)::int from programs where status = 'active'
    union all select 'programs_verified_active', count(*)::int from programs where status = 'active' and verification_status = 'verified'
    union all select 'programs_public_eligible', count(*)::int from programs p join schools s on s.id = p.school_id
      where p.status = 'active' and s.status = 'active'
        and p.verification_status in ('verified','stale')
    union all select 'intakes_total', count(*)::int from program_intakes
    union all select 'scholarships_total', count(*)::int from scholarships
    union all select 'scholarships_active', count(*)::int from scholarships where status = 'active'
    union all select 'scholarships_verified_active', count(*)::int from scholarships where status = 'active' and verification_status = 'verified'
  `) as CountRow[];

  const issues = {
    activeSchoolsMissingCore: await rows(`
      select id, slug, name_en, city, city_zh, city_slug, province, verification_status,
        array_remove(array[
          case when nullif(btrim(name_en), '') is null then 'name_en' end,
          case when city_id is null then 'city_id' end,
          case when nullif(btrim(city_slug), '') is null then 'city_slug' end,
          case when nullif(btrim(admissions_url), '') is null then 'admissions_url' end,
          case when nullif(btrim(source_url), '') is null then 'source_url' end,
          case when nullif(btrim(source_label), '') is null then 'source_label' end,
          case when verification_status = 'verified' and last_verified_at is null then 'last_verified_at' end
        ], null) missing_fields
      from schools
      where status = 'active' and (
        nullif(btrim(name_en), '') is null or city_id is null or nullif(btrim(city_slug), '') is null or
        nullif(btrim(admissions_url), '') is null or nullif(btrim(source_url), '') is null or
        nullif(btrim(source_label), '') is null or (verification_status = 'verified' and last_verified_at is null)
      ) order by slug
    `),
    activeProgramsMissingCore: await rows(`
      select p.id, p.slug, p.name_en, s.slug school_slug, p.degree_level, p.verification_status,
        array_remove(array[
          case when nullif(btrim(p.name_en), '') is null then 'name_en' end,
          case when p.city_id is null and s.city_id is null then 'city_id' end,
          case when nullif(btrim(p.teaching_language), '') is null then 'teaching_language' end,
          case when p.duration_years is null and p.duration_months is null then 'duration' end,
          case when p.tuition_amount is null and nullif(btrim(p.tuition_text), '') is null then 'tuition' end,
          case when nullif(btrim(p.application_url), '') is null and not (
            s.verification_status in ('verified','stale') and nullif(btrim(s.admissions_url), '') is not null
          ) then 'application_url' end,
          case when nullif(btrim(p.source_url), '') is null then 'source_url' end,
          case when nullif(btrim(p.source_label), '') is null then 'source_label' end,
          case when p.verification_status = 'verified' and p.last_verified_at is null then 'last_verified_at' end
        ], null) missing_fields
      from programs p join schools s on s.id = p.school_id
      where p.status = 'active' and (
        nullif(btrim(p.name_en), '') is null or (p.city_id is null and s.city_id is null) or nullif(btrim(p.teaching_language), '') is null or
        (p.duration_years is null and p.duration_months is null) or
        (p.tuition_amount is null and nullif(btrim(p.tuition_text), '') is null) or
        (nullif(btrim(p.application_url), '') is null and not (
          s.verification_status in ('verified','stale') and nullif(btrim(s.admissions_url), '') is not null
        )) or nullif(btrim(p.source_url), '') is null or
        nullif(btrim(p.source_label), '') is null or (p.verification_status = 'verified' and p.last_verified_at is null)
      ) order by s.slug, p.slug
    `),
    activeProgramsUnderInactiveSchool: await rows(`
      select p.id, p.slug, p.name_en, s.slug school_slug, s.status school_status
      from programs p join schools s on s.id = p.school_id
      where p.status = 'active' and s.status <> 'active'
      order by s.slug, p.slug
    `),
    verifiedProgramsUnderUnverifiedSchool: await rows(`
      select p.id, p.slug, p.name_en, p.verification_status, s.slug school_slug, s.verification_status school_verification_status
      from programs p join schools s on s.id = p.school_id
      where p.status = 'active' and s.status = 'active'
        and p.verification_status in ('verified','stale') and s.verification_status not in ('verified','stale')
      order by s.slug, p.slug
    `),
    programCityDiffersFromSchool: await rows(`
      select p.id, p.slug, s.slug school_slug, pc.slug program_city_slug, sc.slug school_city_slug
      from programs p join schools s on s.id = p.school_id
      left join cities pc on pc.id = p.city_id
      left join cities sc on sc.id = s.city_id
      where p.status = 'active' and s.status = 'active' and p.city_id is distinct from s.city_id
      order by s.slug, p.slug
    `),
    activeProgramsWithoutIntake: await rows(`
      select p.id, p.slug, p.name_en, s.slug school_slug, p.degree_level
      from programs p join schools s on s.id = p.school_id
      where p.status = 'active' and not exists (select 1 from program_intakes i where i.program_id = p.id)
      order by s.slug, p.slug
    `),
    openIntakesWithPastDeadline: await rows(`
      select i.id, p.slug program_slug, s.slug school_slug, i.intake_term, i.intake_year,
        i.status, i.open_date, i.deadline_date
      from program_intakes i join programs p on p.id = i.program_id join schools s on s.id = p.school_id
      where i.status = 'open' and i.deadline_date is not null and i.deadline_date < now()
      order by i.deadline_date, s.slug, p.slug
    `),
    invalidIntakeWindows: await rows(`
      select i.id, p.slug program_slug, s.slug school_slug, i.intake_term, i.intake_year,
        i.status, i.open_date, i.deadline_date
      from program_intakes i join programs p on p.id = i.program_id join schools s on s.id = p.school_id
      where i.open_date is not null and i.deadline_date is not null and i.deadline_date < i.open_date
      order by s.slug, p.slug
    `),
    activeScholarshipsMissingCore: await rows(`
      select x.id, x.slug, x.title, s.slug school_slug, x.provider_name, x.provider_name_en, x.verification_status,
        array_remove(array[
          case when nullif(btrim(x.title), '') is null then 'title' end,
          case when nullif(btrim(x.provider_name), '') is null and nullif(btrim(x.provider_name_en), '') is null then 'provider' end,
          case when nullif(btrim(x.funding_level), '') is null then 'funding_level' end,
          case when nullif(btrim(x.coverage), '') is null and jsonb_array_length(x.benefit_items) = 0 then 'coverage' end,
          case when nullif(btrim(x.applicable_degree), '') is null then 'applicable_degree' end,
          case when nullif(btrim(x.source_url), '') is null then 'source_url' end,
          case when nullif(btrim(x.source_label), '') is null then 'source_label' end,
          case when x.verification_status = 'verified' and x.last_verified_at is null then 'last_verified_at' end
        ], null) missing_fields
      from scholarships x left join schools s on s.id = x.school_id
      where x.status = 'active' and (
        nullif(btrim(x.title), '') is null or
        (nullif(btrim(x.provider_name), '') is null and nullif(btrim(x.provider_name_en), '') is null) or
        nullif(btrim(x.funding_level), '') is null or
        (nullif(btrim(x.coverage), '') is null and jsonb_array_length(x.benefit_items) = 0) or
        nullif(btrim(x.applicable_degree), '') is null or nullif(btrim(x.source_url), '') is null or
        nullif(btrim(x.source_label), '') is null or (x.verification_status = 'verified' and x.last_verified_at is null)
      ) order by x.slug
    `),
    scholarshipProgramSchoolMismatch: await rows(`
      select x.id, x.slug scholarship_slug, s.slug scholarship_school_slug,
        p.slug program_slug, ps.slug program_school_slug
      from scholarships x
      join programs p on p.id = x.program_id
      join schools ps on ps.id = p.school_id
      join schools s on s.id = x.school_id
      where x.school_id <> p.school_id
      order by x.slug
    `),
    activeScholarshipsWithPastDeadline: await rows(`
      select id, slug, title, deadline_date, deadline_label, application_round
      from scholarships
      where status = 'active' and deadline_date is not null and deadline_date < now()
      order by deadline_date, slug
    `),
    nonHttpsOfficialUrls: await rows(`
      select 'school' entity_type, id, slug, source_url from schools
      where status = 'active' and source_url is not null and source_url !~ '^https://'
      union all
      select 'program', id, slug, source_url from programs
      where status = 'active' and source_url is not null and source_url !~ '^https://'
      union all
      select 'scholarship', id, slug, source_url from scholarships
      where status = 'active' and source_url is not null and source_url !~ '^https://'
      order by entity_type, slug
    `),
    activeProhibitedAggregatorSources: await rows(`
      select 'school' entity_type, id, slug, source_url, source_label, verification_status from schools
      where status = 'active' and coalesce(source_url, '') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
      union all
      select 'program', id, slug, source_url, source_label, verification_status from programs
      where status = 'active' and coalesce(source_url, '') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
      union all
      select 'scholarship', id, slug, source_url, source_label, verification_status from scholarships
      where status = 'active' and coalesce(source_url, '') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
      order by entity_type, slug
    `),
    publicEligibleProhibitedAggregatorSources: await rows(`
      select 'school' entity_type, id, slug, source_url, source_label, verification_status from schools
      where status = 'active' and verification_status in ('verified','stale')
        and coalesce(source_url, '') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
      union all
      select 'program', p.id, p.slug, p.source_url, p.source_label, p.verification_status from programs p
      join schools s on s.id = p.school_id
      where p.status = 'active' and s.status = 'active' and p.verification_status in ('verified','stale')
        and coalesce(p.source_url, '') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
      union all
      select 'scholarship', id, slug, source_url, source_label, verification_status from scholarships
      where status = 'active' and verification_status = 'verified'
        and coalesce(source_url, '') ~* '(cscapilot\\.com|csca\\.app|wentchina\\.com)'
      order by entity_type, slug
    `),
    possibleDuplicatePrograms: await rows(`
      select s.slug school_slug, lower(regexp_replace(btrim(p.name_en), '\\s+', ' ', 'g')) normalized_name,
        lower(btrim(p.degree_level)) normalized_degree, lower(coalesce(btrim(p.teaching_language), '')) normalized_language,
        coalesce(c.slug, '') city_slug, lower(coalesce(btrim(p.field_category), '')) normalized_field_category,
        lower(coalesce(btrim(p.subject_area), '')) normalized_subject_area,
        count(*)::int duplicate_count, array_agg(p.slug order by p.slug) program_slugs
      from programs p join schools s on s.id = p.school_id left join cities c on c.id = p.city_id
      where p.status = 'active'
      group by s.slug, lower(regexp_replace(btrim(p.name_en), '\\s+', ' ', 'g')),
        lower(btrim(p.degree_level)), lower(coalesce(btrim(p.teaching_language), '')), coalesce(c.slug, ''),
        lower(coalesce(btrim(p.field_category), '')), lower(coalesce(btrim(p.subject_area), ''))
      having count(*) > 1
      order by count(*) desc, s.slug, normalized_name
    `),
  };

  const issueCounts = Object.fromEntries(Object.entries(issues).map(([key, value]) => [key, value.length]));
  const blockingIssueCount = issues.activeProgramsUnderInactiveSchool.length
    + issues.invalidIntakeWindows.length
    + issues.scholarshipProgramSchoolMismatch.length
    + issues.nonHttpsOfficialUrls.length
    + issues.activeProhibitedAggregatorSources.length;
  const report = {
    version: 1,
    generatedAt,
    mode: "read_only",
    publicationAuthorized: false,
    policy: {
      structuralBlockers: ["activeProgramsUnderInactiveSchool", "invalidIntakeWindows", "scholarshipProgramSchoolMismatch", "nonHttpsOfficialUrls", "activeProhibitedAggregatorSources"],
      publicExposureBlockers: ["publicEligibleProhibitedAggregatorSources"],
      remediationCandidates: ["verifiedProgramsUnderUnverifiedSchool", "programCityDiffersFromSchool", "openIntakesWithPastDeadline", "activeScholarshipsWithPastDeadline", "possibleDuplicatePrograms"],
      completenessQueues: ["activeSchoolsMissingCore", "activeProgramsMissingCore", "activeProgramsWithoutIntake", "activeScholarshipsMissingCore"],
      note: "Missing or expired data is not auto-invented. Records require exact official evidence before a correction draft is generated.",
    },
    summary: {
      entities: Object.fromEntries(entityCounts.map(row => [row.metric, Number(row.count)])),
      issueCounts,
      blockingIssueCount,
      publicExposureBlockingIssueCount: issues.publicEligibleProhibitedAggregatorSources.length,
    },
    issues,
  };
  const outputDir = resolve(root, "work/catalog-quality");
  const outputPath = resolve(outputDir, "catalog-data-integrity-audit.json");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, generatedAt, summary: report.summary }, null, 2));
} finally {
  await pool.end();
}
