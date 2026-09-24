import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
type SqlClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Row[]; rowCount?: number | null }> };
type Column = { name: string; cast: "text" | "integer" | "boolean" | "jsonb" | "timestamptz" };

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
export const catalogCandidateSha256 = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

const text = (name: string): Column => ({ name, cast: "text" });
const integer = (name: string): Column => ({ name, cast: "integer" });
const boolean = (name: string): Column => ({ name, cast: "boolean" });
const jsonb = (name: string): Column => ({ name, cast: "jsonb" });
const timestamp = (name: string): Column => ({ name, cast: "timestamptz" });

const fields: Record<string, { table: string; columns: Record<string, Column> }> = {
  school: { table: "schools", columns: {
    nameZh: text("name_zh"), nameEn: text("name_en"), schoolType: text("school_type"), region: text("region"), city: text("city"), cityZh: text("city_zh"), citySlug: text("city_slug"), province: text("province"), regionLabel: text("region_label"), ranking: text("ranking"), cscaRequired: boolean("csca_required"), cscaRequirement: text("csca_requirement"), cscaSubjects: jsonb("csca_subjects"), applicationLevel: text("application_level"), languageOfInstruction: text("language_of_instruction"), languageRequirement: text("language_requirement"), hskRequirement: text("hsk_requirement"), englishRequirement: text("english_requirement"), deadlineSummary: text("deadline_summary"), tuitionSummary: text("tuition_summary"), applicationFee: text("application_fee"), websiteUrl: text("website_url"), admissionsUrl: text("admissions_url"), subjectTags: jsonb("subject_tags"), fitNotes: text("fit_notes"), languageTags: jsonb("language_tags"), tuitionBandLabel: text("tuition_band_label"), campusHighlights: jsonb("campus_highlights"), contactNotes: text("contact_notes"), qualityScore: integer("quality_score"), missingFields: jsonb("missing_fields"), completenessLabel: text("completeness_label"),
  } },
  program: { table: "programs", columns: {
    nameZh: text("name_zh"), nameEn: text("name_en"), degreeLevel: text("degree_level"), durationYears: integer("duration_years"), durationMonths: integer("duration_months"), fieldCategory: text("field_category"), subjectArea: text("subject_area"), teachingLanguage: text("teaching_language"), cscaSubjects: jsonb("csca_subjects"), cscaRequirement: text("csca_requirement"), hskRequirement: text("hsk_requirement"), englishRequirement: text("english_requirement"), tuitionAmount: integer("tuition_amount"), tuitionCurrency: text("tuition_currency"), tuitionPeriod: text("tuition_period"), tuitionText: text("tuition_text"), scholarshipText: text("scholarship_text"), applicationUrl: text("application_url"), applicationNote: text("application_note"), hasScholarship: boolean("has_scholarship"), badgeText: text("badge_text"), displayTuition: text("display_tuition"), displaySubjects: jsonb("display_subjects"), displayGroup: text("display_group"), displayGroupLabel: text("display_group_label"), sortOrder: integer("sort_order"),
  } },
  scholarship: { table: "scholarships", columns: {
    title: text("title"), nameZh: text("name_zh"), type: text("type"), typeLabel: text("type_label"), fundingLevel: text("funding_level"), providerName: text("provider_name"), providerNameEn: text("provider_name_en"), providerLocation: text("provider_location"), coverage: text("coverage"), applicableDegree: text("applicable_degree"), applicableProgram: text("applicable_program"), amountText: text("amount_text"), requirementText: text("requirement_text"), bodySections: jsonb("body_sections"), benefitItems: jsonb("benefit_items"), eligibilityItems: jsonb("eligibility_items"), applicationMaterials: jsonb("application_materials"), applicationSteps: jsonb("application_steps"), contactInfo: jsonb("contact_info"), actionLinks: jsonb("action_links"), deadlineDate: timestamp("deadline_date"), deadlineLabel: text("deadline_label"), applicationRound: text("application_round"), targetCountries: jsonb("target_countries"), targetRegions: jsonb("target_regions"), benefits: jsonb("benefits"), tags: jsonb("tags"), summary: text("summary"), sortOrder: integer("sort_order"), version: integer("version"),
  } },
};

const sqlValue = (column: Column, index: number) => column.cast === "jsonb" ? `$${index}::jsonb`
  : column.cast === "timestamptz" ? `$${index}::timestamptz`
    : column.cast === "integer" ? `$${index}::integer`
      : column.cast === "boolean" ? `$${index}::boolean` : `$${index}::text`;
const parameterValue = (column: Column, value: unknown) => column.cast === "jsonb" ? JSON.stringify(value) : value;

export function validateCatalogReleaseCandidate(candidate: Row) {
  const operations = candidate.operations as Row;
  const preimage = candidate.preimage as Row;
  const fixtures = candidate.rehearsalFixtures as Row;
  const hashes = candidate.hashes as Row;
  const authorization = candidate.authorization as Row;
  const targetGuard = candidate.targetGuard as Row;
  const errors: string[] = [];
  if (candidate.version !== 1 || candidate.status !== "owner_default_accepted_non_public_candidate") errors.push("invalid candidate identity");
  if (authorization?.candidatePreparationAuthorized !== true || authorization?.executionAuthorized !== false
    || authorization?.persistentDatabaseWriteAuthorized !== false || authorization?.publicationAuthorized !== false) errors.push("candidate over-authorizes execution or publication");
  if ((candidate.decision as Row)?.humanReviewCompleted !== false) errors.push("candidate must not claim completed human review");
  if (targetGuard?.configured !== false || Object.entries(targetGuard).some(([key, value]) => key !== "configured" && value !== null)) errors.push("target guard must remain unconfigured");
  if (hashes?.operationsSha256 !== catalogCandidateSha256(operations)) errors.push("operations hash mismatch");
  if (hashes?.preimageSha256 !== catalogCandidateSha256(preimage)) errors.push("preimage hash mismatch");
  if (hashes?.rehearsalFixturesSha256 !== catalogCandidateSha256(fixtures)) errors.push("fixture hash mismatch");
  const summary = candidate.summary as Row;
  if ((operations.fieldOperations as Row[])?.length !== summary.fieldOperations
    || (operations.intakeOperations as Row[])?.length !== summary.intakeOperations
    || (operations.replacements as Row[])?.length !== summary.officialReplacements
    || (operations.quarantines as Row[])?.length !== summary.recoverableArchives) errors.push("operation summary mismatch");
  for (const operation of operations.fieldOperations as Row[]) if (!fields[String(operation.entityType)]?.columns[String(operation.field)]) errors.push(`unsupported field operation ${operation.entityType}:${operation.field}`);
  return { ok: errors.length === 0, errors };
}

export function validateCatalogTargetBinding(candidate: Row, binding: Row) {
  const candidateReport = validateCatalogReleaseCandidate(candidate);
  const errors = [...candidateReport.errors];
  const hashes = candidate.hashes as Row;
  if (binding.version !== 1) errors.push("target binding version must be 1");
  if (binding.environment !== "staging") errors.push("unreviewed candidate may bind only to staging");
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(String(binding.databaseName ?? ""))) errors.push("invalid database name");
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(String(binding.databaseUser ?? ""))) errors.push("invalid database user");
  if (!/^[a-zA-Z0-9.-]{1,253}$/.test(String(binding.databaseHost ?? ""))) errors.push("invalid database host");
  if (!/^[a-f0-9]{64}$/i.test(String(binding.tlsCertificateSha256 ?? ""))) errors.push("TLS certificate SHA-256 is required");
  if (!/^[a-f0-9]{64}$/i.test(String(binding.confirmationTokenSha256 ?? ""))) errors.push("confirmation-token SHA-256 is required");
  if (binding.readinessPlanSha256 !== candidate.readinessPlanSha256
    || binding.operationsSha256 !== hashes.operationsSha256
    || binding.preimageSha256 !== hashes.preimageSha256) errors.push("target binding does not match the candidate hashes");
  if (binding.migrationMode !== "non_public_draft_and_archive_only") errors.push("target binding migration mode is unsafe");
  if (binding.publicationAuthorized !== false) errors.push("target binding must not authorize publication");
  return { ok: errors.length === 0, errors };
}

export async function applyCatalogReleaseCandidateForDisposableRehearsal(client: SqlClient, candidate: Row) {
  const report = validateCatalogReleaseCandidate(candidate);
  if (!report.ok) throw new Error(report.errors.join("; "));
  const operations = candidate.operations as Row;
  let replacementsChanged = 0;
  let fieldsChanged = 0;
  let intakesChanged = 0;
  let archivesChanged = 0;

  for (const item of operations.replacements as Row[]) {
    const entityType = String(item.entityType);
    const definition = fields[entityType];
    if (!definition) throw new Error(`Unsupported replacement entity: ${entityType}`);
    const candidateEvidence = item.candidate as Row;
    const record = candidateEvidence.record as Row;
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [field, column] of Object.entries(definition.columns)) {
      if (!(field in record) || record[field] === null || record[field] === undefined) continue;
      values.push(parameterValue(column, record[field]));
      assignments.push(`${column.name}=${sqlValue(column, values.length)}`);
    }
    values.push(candidateEvidence.sourceUrl); assignments.push(`source_url=$${values.length}::text`);
    values.push(candidateEvidence.sourceLabel); assignments.push(`source_label=$${values.length}::text`);
    values.push(JSON.stringify(record.sourceFieldLineage ?? {})); assignments.push(`source_field_lineage_json=$${values.length}::jsonb`);
    values.push("Owner default acceptance; per-record human review was not completed."); assignments.push(`source_note=$${values.length}::text`);
    assignments.push("status='draft'", "verification_status='unverified'", "verified_by_user_id=null", "last_verified_at=null", "updated_at=now()");
    values.push(item.id, item.slug, item.currentSourceUrl, candidateEvidence.sourceUrl);
    const idIndex = values.length - 3;
    const slugIndex = values.length - 2;
    const oldSourceIndex = values.length - 1;
    const newSourceIndex = values.length;
    const distinct = assignments.filter(value => !value.includes("updated_at=now()") && !value.includes("verified_by_user_id=null") && !value.includes("last_verified_at=null"))
      .map(value => value.split("=")[0]).map(column => `t.${column} is distinct from ${column === "status" ? "'draft'" : column === "verification_status" ? "'unverified'" : assignments.find(a => a.startsWith(`${column}=`))?.slice(column.length + 1)}`).join(" or ");
    const result = await client.query(`update ${definition.table} t set ${assignments.join(",")}
      where t.id=$${idIndex}::uuid and t.slug=$${slugIndex}::text and t.source_url in ($${oldSourceIndex}::text,$${newSourceIndex}::text)
      and (${distinct || "false"})`, values);
    replacementsChanged += result.rowCount ?? 0;
  }

  const grouped = new Map<string, Row[]>();
  for (const operation of operations.fieldOperations as Row[]) {
    const key = `${operation.entityType}:${operation.field}`;
    grouped.set(key, [...(grouped.get(key) ?? []), operation]);
  }
  for (const [key, rows] of grouped) {
    const [entityType, field] = key.split(":");
    const definition = fields[entityType];
    const column = definition.columns[field];
    const payload = rows.map(row => ({ slug: row.entitySlug, value: row.value }));
    const cast = column.cast === "jsonb" ? "x.value" : column.cast === "integer" ? "(x.value #>> '{}')::integer"
      : column.cast === "boolean" ? "(x.value #>> '{}')::boolean" : column.cast === "timestamptz" ? "(x.value #>> '{}')::timestamptz" : "x.value #>> '{}'";
    const blank = column.cast === "text" ? `(t.${column.name} is null or t.${column.name}='')` : `t.${column.name} is null`;
    const stale = await client.query(`select t.slug from ${definition.table} t join jsonb_to_recordset($1::jsonb) x(slug text,value jsonb) on x.slug=t.slug where not (${blank}) and t.${column.name} is distinct from ${cast}`, [JSON.stringify(payload)]);
    if (stale.rows.length) throw new Error(`Stale field operation ${key}:${stale.rows[0].slug}`);
    const result = await client.query(`update ${definition.table} t set ${column.name}=${cast},updated_at=now() from jsonb_to_recordset($1::jsonb) x(slug text,value jsonb) where x.slug=t.slug and ${blank}`, [JSON.stringify(payload)]);
    fieldsChanged += result.rowCount ?? 0;
  }

  const intakePayload = (operations.intakeOperations as Row[]).map(row => ({
    program_slug: row.programSlug, intake_term: row.intakeTerm, intake_year: row.intakeYear,
    deadline_date: row.deadlineDate ?? null, deadline_label: row.deadlineLabel ?? null,
    application_round: row.applicationRound ?? null, status: row.status ?? "open",
  }));
  if (intakePayload.length) {
    const result = await client.query(`insert into program_intakes(program_id,intake_term,intake_year,deadline_date,deadline_label,application_round,status)
      select p.id,x.intake_term,x.intake_year,x.deadline_date,x.deadline_label,x.application_round,x.status
      from jsonb_to_recordset($1::jsonb) x(program_slug text,intake_term text,intake_year integer,deadline_date timestamptz,deadline_label text,application_round text,status text)
      join programs p on p.slug=x.program_slug on conflict(program_id,intake_term,intake_year) do nothing`, [JSON.stringify(intakePayload)]);
    intakesChanged = result.rowCount ?? 0;
  }

  for (const item of operations.quarantines as Row[]) {
    const definition = fields[String(item.entityType)];
    if (!definition) throw new Error(`Unsupported quarantine entity: ${item.entityType}`);
    const result = await client.query(`update ${definition.table} set status='archived',updated_at=now() where id=$1::uuid and slug=$2::text and source_url=$3::text and status is distinct from 'archived'`, [item.id, item.slug, item.currentSourceUrl]);
    archivesChanged += result.rowCount ?? 0;
  }
  return { replacementsChanged, fieldsChanged, intakesChanged, archivesChanged, totalChanged: replacementsChanged + fieldsChanged + intakesChanged + archivesChanged };
}
