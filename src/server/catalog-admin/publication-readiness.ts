export const CATALOG_READINESS_ENTITY_TYPES = ["city", "school", "program", "scholarship"] as const;
export type CatalogReadinessEntityType = (typeof CATALOG_READINESS_ENTITY_TYPES)[number];

export const CATALOG_READINESS_STATES = ["ready", "blocked"] as const;
export type CatalogReadinessState = (typeof CATALOG_READINESS_STATES)[number];

// These predicates are the canonical publication gates. Lifecycle writes and
// the read-only readiness projection must use the same expressions so preview
// results cannot drift from the actual publication command.
export const CITY_PUBLICATION_PREDICATE = `c.status<>'archived'
  and c.source_url~'^https://[^[:space:]]+$' and c.source_label is not null
  and exists(select 1 from catalog_source_evidence ev where ev.entity_type='city' and ev.entity_id=c.id
    and ev.source_url=c.source_url)`;

export const SCHOOL_PUBLICATION_PREDICATE = `s.status<>'archived' and s.school_type is not null
  and s.website_url~'^https://[^[:space:]]+$'
  and (s.admissions_url is null or s.admissions_url~'^https://[^[:space:]]+$')
  and s.source_url~'^https://[^[:space:]]+$' and s.source_label is not null
  and exists(select 1 from cities city_ref where city_ref.id=s.city_id and city_ref.status='active')
  and exists(select 1 from catalog_source_evidence ev where ev.entity_type='school' and ev.entity_id=s.id
    and ev.source_url=s.source_url)`;

export const PROGRAM_PUBLICATION_PREDICATE = `p.status<>'archived' and p.teaching_language is not null
  and p.application_url~'^https://[^[:space:]]+$'
  and p.source_url~'^https://[^[:space:]]+$' and p.source_label is not null
  and exists(select 1 from schools s where s.id=p.school_id and s.status='active')
  and exists(select 1 from cities c where c.id=p.city_id and c.status='active')
  and exists(select 1 from catalog_source_evidence ev where ev.entity_type='program' and ev.entity_id=p.id
    and ev.source_url=p.source_url)`;

export const SCHOLARSHIP_PUBLICATION_PREDICATE = `sc.status<>'archived' and sc.coverage is not null
  and sc.applicable_degree is not null
  and ((sc.deadline_date is not null and sc.deadline_date>clock_timestamp())
    or (sc.deadline_date is null and sc.deadline_label is not null))
  and sc.source_url~'^https://[^[:space:]]+$' and sc.source_label is not null
  and (sc.school_id is null or exists(select 1 from schools s where s.id=sc.school_id and s.status='active'))
  and (sc.program_id is null or exists(select 1 from programs p where p.id=sc.program_id and p.status='active'
    and p.school_id=sc.school_id))
  and exists(select 1 from catalog_source_evidence ev where ev.entity_type='scholarship' and ev.entity_id=sc.id
    and ev.source_url=sc.source_url)`;

export const CATALOG_READINESS_BLOCKING_CODES = [
  "archived", "invalid_source_url", "missing_source_label", "missing_source_evidence",
  "missing_school_type", "invalid_website_url", "invalid_admissions_url", "inactive_city",
  "missing_teaching_language", "invalid_application_url", "inactive_school",
  "missing_coverage", "missing_applicable_degree", "deadline_unavailable", "inactive_program",
] as const;

export const CATALOG_READINESS_WARNING_CODES = [
  "draft_record", "verification_not_current", "review_due", "deadline_expiring_30d", "rolling_deadline_only",
] as const;

export const CATALOG_READINESS_REASON_CODES = [
  ...CATALOG_READINESS_BLOCKING_CODES,
  ...CATALOG_READINESS_WARNING_CODES,
] as const;
