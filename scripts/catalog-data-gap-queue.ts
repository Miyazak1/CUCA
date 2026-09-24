import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type Row = Record<string, unknown>;
type RegistryRow = { id: string; label: string; schoolSlug?: string; sourceRole: string };
const root = process.cwd();
const audit = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-data-integrity-audit.json"), "utf8"));
const coverage = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-official-draft-coverage.json"), "utf8"));
const registry = JSON.parse(await readFile(resolve(root, "catalog-sources/official-sources.json"), "utf8"));
const exemptions = JSON.parse(await readFile(resolve(root, "catalog-sources/official-completeness-exemptions.json"), "utf8"));
const sourceSetExemptions = new Map<string, Row>((exemptions.sourceSetRules || []).map((rule: Row) => [String(rule.schoolSlug), rule]));
const coveredSchoolSlugs = new Set<string>((coverage.coveredSchoolSlugs || []).map(String));
const actionableBySchool = new Map<string, number>();
for (const row of coverage.actionableMissingRecords || []) actionableBySchool.set(String(row.schoolSlug), (actionableBySchool.get(String(row.schoolSlug)) || 0) + 1);
const deferredBySchool = new Map<string, number>();
for (const row of coverage.deferredRecords || []) deferredBySchool.set(String(row.schoolSlug), (deferredBySchool.get(String(row.schoolSlug)) || 0) + 1);
const acquiredIds = new Set<string>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(root, "work/catalog-official", entry.name, "manifest.json"), "utf8"));
    for (const source of manifest.sources || []) acquiredIds.add(String(source.id));
  } catch { /* Ignore incomplete acquisition directories. */ }
}
const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-data-gap-queue" });
const result = await pool.query(`
  select s.slug, s.name_en,
    count(distinct p.id) filter (where p.status='active')::int active_programs,
    count(distinct p.id) filter (where p.status='active' and not exists (select 1 from program_intakes i where i.program_id=p.id))::int programs_without_intake,
    count(distinct x.id) filter (where x.status='active')::int active_scholarships,
    count(distinct x.id) filter (where x.status='active' and x.deadline_date is not null and x.deadline_date < now())::int scholarships_past_deadline
  from schools s
  left join programs p on p.school_id=s.id
  left join scholarships x on x.school_id=s.id
  where s.status='active' and s.slug !~ '^local-'
  group by s.id, s.slug, s.name_en
  order by s.slug
`);
await pool.end();

const missingSchool = new Map(audit.issues.activeSchoolsMissingCore.map((row: Row) => [row.slug, row]));
const missingPrograms = new Map<string, number>();
for (const row of audit.issues.activeProgramsMissingCore as Row[]) missingPrograms.set(String(row.school_slug), (missingPrograms.get(String(row.school_slug)) || 0) + 1);
const missingScholarships = new Map<string, number>();
let providerScholarshipGaps = 0;
for (const row of audit.issues.activeScholarshipsMissingCore as Row[]) {
  if (row.school_slug) missingScholarships.set(String(row.school_slug), (missingScholarships.get(String(row.school_slug)) || 0) + 1);
  else providerScholarshipGaps += 1;
}
const sourceBySchool = new Map<string, RegistryRow[]>();
for (const source of registry.sources as RegistryRow[]) {
  if (!source.schoolSlug) continue;
  const list = sourceBySchool.get(source.schoolSlug) || [];
  list.push(source);
  sourceBySchool.set(source.schoolSlug, list);
}

const schools = result.rows.map((row: Row) => {
  const slug = String(row.slug);
  const sources = sourceBySchool.get(slug) || [];
  const acquired = sources.filter(source => acquiredIds.has(source.id));
  const currentCycle = sources.filter(source => /2026\s*[-/]\s*2027|2026-2027|2026\/2027|2027/i.test(source.label));
  const missingSchoolRow = missingSchool.get(slug) as Row | undefined;
  const schoolMissingFields = (missingSchoolRow?.missing_fields as string[] | undefined) || [];
  const programGaps = missingPrograms.get(slug) || 0;
  const scholarshipGaps = missingScholarships.get(slug) || 0;
  const programsWithoutIntake = Number(row.programs_without_intake);
  const pastDeadline = Number(row.scholarships_past_deadline);
  const officialDraftActionableRecords = actionableBySchool.get(slug) || 0;
  const officialDraftDeferredRecords = deferredBySchool.get(slug) || 0;
  const sourceSetExemption = sourceSetExemptions.get(slug);
  const priorityScore = programsWithoutIntake * 3 + programGaps + scholarshipGaps * 2 + pastDeadline * 2 + schoolMissingFields.length * 20;
  let nextAction = "monitor_next_cycle";
  if (priorityScore > 0 && officialDraftActionableRecords > 0 && acquired.length) nextAction = "extract_existing_official_evidence";
  if (priorityScore > 0 && !acquired.length && sources.length) nextAction = sourceSetExemption ? "deferred_external_source_blocker" : "acquire_registered_official_sources";
  if (priorityScore > 0 && !sources.length) nextAction = "register_exact_official_sources";
  if (priorityScore > 0 && acquired.length && officialDraftActionableRecords === 0) nextAction = "await_review_or_database_remediation";
  return {
    slug,
    nameEn: row.name_en,
    activePrograms: Number(row.active_programs),
    programsMissingCore: programGaps,
    programsWithoutIntake,
    activeScholarships: Number(row.active_scholarships),
    scholarshipsMissingCore: scholarshipGaps,
    scholarshipsPastDeadline: pastDeadline,
    schoolMissingFields,
    registeredOfficialSources: sources.length,
    acquiredOfficialSources: acquired.length,
    registeredCurrentCycleSources: currentCycle.length,
    officialDraftCovered: coveredSchoolSlugs.has(slug),
    officialDraftActionableRecords,
    officialDraftDeferredRecords,
    ...(sourceSetExemption ? { sourceSetDeferment: { id: sourceSetExemption.id, reasonCode: sourceSetExemption.reasonCode, reason: sourceSetExemption.reason } } : {}),
    priorityScore,
    nextAction,
  };
}).sort((a: Row, b: Row) => Number(b.priorityScore) - Number(a.priorityScore) || String(a.slug).localeCompare(String(b.slug)));

for (const [schoolSlug, rule] of sourceSetExemptions) {
  const school = schools.find((row: Row) => row.slug === schoolSlug) as Row | undefined;
  if (!school || Number(school.registeredOfficialSources) < 1 || Number(school.acquiredOfficialSources) !== 0 || school.nextAction !== "deferred_external_source_blocker") {
    throw new Error(`External source-set deferment ${String(rule.id)} no longer matches ${schoolSlug}. Re-review it instead of silently retaining the deferment.`);
  }
}

const generatedAt = new Date().toISOString();
const unclassifiedProductionSchools = schools.filter((row: Row) => !row.officialDraftCovered && !row.sourceSetDeferment);
const completionGatePassed = Number(coverage.summary.blockingCoreRecords) === 0
  && unclassifiedProductionSchools.length === 0
  && schools.filter((row: Row) => row.nextAction === "acquire_registered_official_sources").length === 0
  && schools.filter((row: Row) => row.nextAction === "register_exact_official_sources").length === 0;
const report = {
  version: 2,
  generatedAt,
  status: "unreviewed_draft",
  publicationAuthorized: false,
  summary: {
    schoolCount: schools.length,
    classifiedProductionSchools: schools.length - unclassifiedProductionSchools.length,
    unclassifiedProductionSchools: unclassifiedProductionSchools.length,
    completionGatePassed,
    databaseSchoolsWithGaps: schools.filter((row: Row) => Number(row.priorityScore) > 0).length,
    officialDraftActionableRecords: coverage.summary.actionableCoreRecords,
    officialDraftDeferredRecords: coverage.summary.deferredExternalBlockerRecords,
    schoolsReadyForExistingEvidenceExtraction: schools.filter((row: Row) => row.nextAction === "extract_existing_official_evidence").length,
    schoolsNeedingRegisteredAcquisition: schools.filter((row: Row) => row.nextAction === "acquire_registered_official_sources").length,
    schoolsDeferredExternalSourceBlocker: schools.filter((row: Row) => row.nextAction === "deferred_external_source_blocker").length,
    schoolsAwaitingReviewOrDatabaseRemediation: schools.filter((row: Row) => row.nextAction === "await_review_or_database_remediation").length,
    schoolsNeedingSourceRegistration: schools.filter((row: Row) => row.nextAction === "register_exact_official_sources").length,
    providerLevelScholarshipGaps: providerScholarshipGaps,
  },
  schools,
  unclassifiedProductionSchoolQueue: unclassifiedProductionSchools,
  providerLevelScholarshipQueue: {
    incompleteRecords: providerScholarshipGaps,
    nextAction: "group_by_provider_and_register_exact_official_sources",
  },
};
const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-data-gap-queue.draft.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary, topPriorities: schools.slice(0, 15).map((row: Row) => ({ slug: row.slug, priorityScore: row.priorityScore, nextAction: row.nextAction })) }, null, 2));
