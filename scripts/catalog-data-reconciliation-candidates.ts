import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type JsonRecord = Record<string, unknown>;
type Candidate = { value: unknown; file: string; state: "approved_local" | "draft"; sourceUrl: string; sourceSha256: string; capturedAt?: string; lineage?: unknown };

const root = process.cwd();
const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-reconciliation-candidates" });
const isMissing = (value: unknown) => value == null || (typeof value === "string" && !value.trim());
const stable = (value: unknown) => JSON.stringify(value);
const hasEvidence = (row: JsonRecord) => /^https:\/\//.test(String(row.sourceUrl || "")) && /^[a-f0-9]{64}$/.test(String(row.sourceSha256 || ""));

const seedDir = resolve(root, "seeds");
const seedFiles = (await readdir(seedDir, { withFileTypes: true }))
  .filter(entry => entry.isFile() && (entry.name.endsWith(".approved.local.json") || entry.name.endsWith(".draft.json")))
  .map(entry => resolve(seedDir, entry.name));

const collections = {
  schools: new Map<string, JsonRecord[]>(),
  programs: new Map<string, JsonRecord[]>(),
  scholarships: new Map<string, JsonRecord[]>(),
  programIntakes: new Map<string, JsonRecord[]>(),
};

for (const file of seedFiles) {
  const bundle = JSON.parse(await readFile(file, "utf8"));
  const fileName = basename(file);
  const seedState = fileName.endsWith(".approved.local.json") ? "approved_local" : "draft";
  for (const key of ["schools", "programs", "scholarships", "programIntakes"] as const) {
    for (const item of bundle[key] || []) {
      if (!item || typeof item !== "object") continue;
      const row = { ...item, _seedFile: fileName, _seedState: seedState } as JsonRecord;
      const identity = key === "programIntakes" ? String(row.programSlug || "") : String(row.slug || "");
      if (!identity) continue;
      const list = collections[key].get(identity) || [];
      list.push(row);
      collections[key].set(identity, list);
    }
  }
}

const fieldSets = {
  schools: ["citySlug", "websiteUrl", "admissionsUrl", "schoolType", "applicationLevel", "languageOfInstruction", "languageRequirement", "hskRequirement", "englishRequirement", "deadlineSummary", "tuitionSummary", "applicationFee"],
  programs: ["citySlug", "durationYears", "durationMonths", "fieldCategory", "subjectArea", "teachingLanguage", "cscaRequirement", "hskRequirement", "englishRequirement", "tuitionAmount", "tuitionCurrency", "tuitionPeriod", "tuitionText", "applicationUrl", "applicationNote"],
  scholarships: ["providerName", "providerNameEn", "providerLocation", "fundingLevel", "coverage", "applicableDegree", "applicableProgram", "amountText", "requirementText", "deadlineDate", "deadlineLabel", "applicationRound", "summary"],
} as const;

const db = {
  schools: (await pool.query(`select slug, city_slug "citySlug", website_url "websiteUrl", admissions_url "admissionsUrl", school_type "schoolType", application_level "applicationLevel", language_of_instruction "languageOfInstruction", language_requirement "languageRequirement", hsk_requirement "hskRequirement", english_requirement "englishRequirement", deadline_summary "deadlineSummary", tuition_summary "tuitionSummary", application_fee "applicationFee" from schools where status='active'`)).rows,
  programs: (await pool.query(`select p.slug, c.slug "citySlug", p.duration_years "durationYears", p.duration_months "durationMonths", p.field_category "fieldCategory", p.subject_area "subjectArea", p.teaching_language "teachingLanguage", p.csca_requirement "cscaRequirement", p.hsk_requirement "hskRequirement", p.english_requirement "englishRequirement", p.tuition_amount "tuitionAmount", p.tuition_currency "tuitionCurrency", p.tuition_period "tuitionPeriod", p.tuition_text "tuitionText", p.application_url "applicationUrl", p.application_note "applicationNote" from programs p left join cities c on c.id=p.city_id where p.status='active'`)).rows,
  scholarships: (await pool.query(`select slug, provider_name "providerName", provider_name_en "providerNameEn", provider_location "providerLocation", funding_level "fundingLevel", coverage, applicable_degree "applicableDegree", applicable_program "applicableProgram", amount_text "amountText", requirement_text "requirementText", deadline_date "deadlineDate", deadline_label "deadlineLabel", application_round "applicationRound", summary from scholarships where status='active'`)).rows,
};

function candidatesFor(entity: keyof typeof fieldSets, current: JsonRecord) {
  const rows = collections[entity].get(String(current.slug)) || [];
  const fields: Record<string, unknown> = {};
  const conflicts: Record<string, unknown> = {};
  for (const field of fieldSets[entity]) {
    if (!isMissing(current[field])) continue;
    const eligible: Candidate[] = rows.filter(row => !isMissing(row[field]) && hasEvidence(row)).map(row => ({
      value: row[field],
      file: String(row._seedFile),
      state: row._seedState as Candidate["state"],
      sourceUrl: String(row.sourceUrl),
      sourceSha256: String(row.sourceSha256),
      capturedAt: row.capturedAt ? String(row.capturedAt) : undefined,
      lineage: (row.sourceFieldLineage as JsonRecord | undefined)?.[field],
    }));
    const distinct = new Map<string, Candidate>();
    for (const item of eligible) {
      const key = stable(item.value);
      const existing = distinct.get(key);
      if (!existing || (existing.state === "draft" && item.state === "approved_local")) distinct.set(key, item);
    }
    if (distinct.size === 1) fields[field] = [...distinct.values()][0];
    if (distinct.size > 1) conflicts[field] = [...distinct.values()];
  }
  return { fields, conflicts };
}

const reconciliation: Record<string, unknown[]> = { schools: [], programs: [], scholarships: [] };
const conflictRows: Record<string, unknown[]> = { schools: [], programs: [], scholarships: [] };
for (const entity of ["schools", "programs", "scholarships"] as const) {
  for (const current of db[entity] as JsonRecord[]) {
    const { fields, conflicts } = candidatesFor(entity, current);
    if (Object.keys(fields).length) reconciliation[entity].push({ slug: current.slug, fields });
    if (Object.keys(conflicts).length) conflictRows[entity].push({ slug: current.slug, conflicts });
  }
}

const programsWithoutIntakes = new Set((await pool.query(`select p.slug from programs p where p.status='active' and not exists (select 1 from program_intakes i where i.program_id=p.id)`)).rows.map(row => row.slug));
const intakeCandidates: unknown[] = [];
for (const slug of programsWithoutIntakes) {
  const candidates = (collections.programIntakes.get(slug) || []).filter(hasEvidence);
  const unique = new Map<string, JsonRecord>();
  for (const row of candidates) {
    const key = `${String(row.intakeTerm).toLowerCase()}|${row.intakeYear}`;
    const existing = unique.get(key);
    if (!existing || (existing._seedState === "draft" && row._seedState === "approved_local")) unique.set(key, row);
  }
  if (unique.size) intakeCandidates.push({
    programSlug: slug,
    intakes: [...unique.values()].map(row => ({
      intakeTerm: row.intakeTerm, intakeYear: row.intakeYear, openDate: row.openDate, deadlineDate: row.deadlineDate,
      deadlineLabel: row.deadlineLabel, applicationRound: row.applicationRound, status: row.status,
      sourceUrl: row.sourceUrl, sourceLabel: row.sourceLabel, sourceSha256: row.sourceSha256, capturedAt: row.capturedAt,
      sourceFieldLineage: row.sourceFieldLineage, seedFile: row._seedFile, seedState: row._seedState,
    })),
  });
}

const generatedAt = new Date().toISOString();
const report = {
  version: 1,
  generatedAt,
  status: "unreviewed_draft",
  publicationAuthorized: false,
  policy: "Only absent database fields with exactly one evidence-backed value across local seed artifacts are listed as deterministic candidates. Conflicts and all database writes remain deferred.",
  scannedSeedFiles: seedFiles.length,
  summary: {
    schoolRecordsWithSafeCandidates: reconciliation.schools.length,
    programRecordsWithSafeCandidates: reconciliation.programs.length,
    scholarshipRecordsWithSafeCandidates: reconciliation.scholarships.length,
    programsWithoutIntake: programsWithoutIntakes.size,
    programsWithEvidenceBackedIntakeCandidates: intakeCandidates.length,
    schoolConflictRecords: conflictRows.schools.length,
    programConflictRecords: conflictRows.programs.length,
    scholarshipConflictRecords: conflictRows.scholarships.length,
  },
  reconciliation,
  intakeCandidates,
  conflicts: conflictRows,
};
const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-data-reconciliation-candidates.draft.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary, publicationAuthorized: false }, null, 2));
await pool.end();
