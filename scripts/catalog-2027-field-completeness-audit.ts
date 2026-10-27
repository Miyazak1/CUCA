import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  CatalogSeedBundle,
  CatalogSeedProgramIntake,
  CatalogSeedSource,
} from "../src/server/catalog/seed-contract.ts";

type JsonRecord = Record<string, unknown>;
type Entity = CatalogSeedSource & JsonRecord;

const root = process.cwd();
const coverageAudit = JSON.parse(await readFile(resolve(root, "work/catalog-quality/catalog-2027-coverage-audit.json"), "utf8")) as {
  summary?: { targetSchools?: number; workStates?: Record<string, number> };
  queue?: Array<{ schoolSlug?: string; workState?: string }>;
};
const coverageQueue = coverageAudit.queue ?? [];
const targetSchoolCount = coverageAudit.summary?.targetSchools ?? 0;
const classifiedWorkStates = new Set([
  "current_draft_pending_review",
  "current_source_extraction_needed",
  "current_source_blocked_by_acquisition_limit",
  "discovery_checked_no_explicit_degree_source",
]);
const remainingWork = coverageQueue.filter((row) => !classifiedWorkStates.has(String(row.workState)));
if (targetSchoolCount !== 150 || coverageQueue.length !== 150 || remainingWork.length > 0) {
  throw new Error(`Expected a fully classified 150-school coverage audit; found target=${targetSchoolCount}, queue=${coverageQueue.length}, remaining=${remainingWork.length}.`);
}
const candidateSchoolSlugs = new Set(coverageQueue
  .filter((row) => ["current_draft_pending_review", "current_source_extraction_needed"].includes(String(row.workState)))
  .map((row) => row.schoolSlug)
  .filter((slug): slug is string => Boolean(slug)));
const filePriority = (file: string) => {
  if (file === "catalog.2027-release-candidate.draft.json") return 0;
  if (file === "catalog.2027-release.reviewed.json") return 1;
  if (file === "catalog.current-2027-prerequisites.reviewed.json") return 2;
  const wave = file.match(/wave-(\d+)/i)?.[1];
  return wave ? 1_000 + Number(wave) : 500;
};
const seedFiles = (await readdir(resolve(root, "seeds")))
  .filter((file) => /2027.*\.(?:draft|reviewed)\.json$/i.test(file) || /spring-2027\.draft\.json$/i.test(file))
  .sort((left, right) => filePriority(left) - filePriority(right) || left.localeCompare(right));
const bundles: CatalogSeedBundle[] = [];
for (const file of seedFiles) {
  try {
    bundles.push(JSON.parse(await readFile(resolve(root, "seeds", file), "utf8")) as CatalogSeedBundle);
  } catch {
    // Review metadata and incomplete draft files are not catalog bundles.
  }
}
const schoolBySlug = new Map<string, NonNullable<CatalogSeedBundle["schools"]>[number]>();
const programBySlug = new Map<string, NonNullable<CatalogSeedBundle["programs"]>[number]>();
for (const bundle of bundles) {
  for (const school of bundle.schools ?? []) if (candidateSchoolSlugs.has(school.slug)) schoolBySlug.set(school.slug, school);
  for (const program of bundle.programs ?? []) if (candidateSchoolSlugs.has(program.schoolSlug)) programBySlug.set(program.slug, program);
}
const effectiveSchools = [...schoolBySlug.values()];
const effectiveSchoolSlugs = new Set(effectiveSchools.map((row) => row.slug));
if (effectiveSchools.length !== effectiveSchoolSlugs.size) throw new Error("Effective 2027 school set contains duplicate school slugs.");
const effectivePrograms = [...programBySlug.values()];
const effectiveProgramSlugs = new Set(effectivePrograms.map((row) => row.slug));
const intakeKey = (row: CatalogSeedProgramIntake) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`;
const intakeByKey = new Map<string, CatalogSeedProgramIntake>();
const scholarshipBySlug = new Map<string, NonNullable<CatalogSeedBundle["scholarships"]>[number]>();
for (const bundle of bundles) {
  for (const intake of bundle.programIntakes ?? []) if (intake.intakeYear === 2027 && effectiveProgramSlugs.has(intake.programSlug)) intakeByKey.set(intakeKey(intake), intake);
  for (const scholarship of bundle.scholarships ?? []) {
    if ((scholarship.schoolSlug && candidateSchoolSlugs.has(scholarship.schoolSlug)) || (scholarship.programSlug && effectiveProgramSlugs.has(scholarship.programSlug))) {
      scholarshipBySlug.set(scholarship.slug, scholarship);
    }
  }
}
const effectiveIntakes = [...intakeByKey.values()];
const effectiveScholarships = [...scholarshipBySlug.values()];

const hasValue = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
};
const hasAny = (row: JsonRecord, fields: string[]) => fields.some((field) => hasValue(row[field]));
const missingSourceFields = (row: CatalogSeedSource) => [
  !hasValue(row.sourceUrl) ? "sourceUrl" : null,
  !hasValue(row.sourceLabel) ? "sourceLabel" : null,
  !/^[a-f0-9]{64}$/i.test(String(row.sourceSha256 ?? "")) ? "sourceSha256" : null,
  !hasValue(row.capturedAt) ? "capturedAt" : null,
  !hasValue(row.sourceFieldLineage) ? "sourceFieldLineage" : null,
].filter((value): value is string => Boolean(value));
const ratio = (covered: number, total: number) => total === 0 ? null : Number((covered / total).toFixed(4));
const countCovered = (rows: JsonRecord[], fields: string[]) => rows.filter((row) => hasAny(row, fields)).length;

const orphanIntakes = effectiveIntakes.filter((row) => !effectiveProgramSlugs.has(row.programSlug));
const non2027Intakes = effectiveIntakes.filter((row) => row.intakeYear !== 2027);
const orphanScholarships = effectiveScholarships.filter((row) => row.schoolSlug && !effectiveSchoolSlugs.has(row.schoolSlug));

const rows = effectiveSchools.map((school) => {
  const programs = effectivePrograms.filter((row) => row.schoolSlug === school.slug);
  const programSlugs = new Set(programs.map((row) => row.slug));
  const intakes = effectiveIntakes.filter((row) => programSlugs.has(row.programSlug));
  const scholarships = effectiveScholarships.filter((row) => row.schoolSlug === school.slug || (row.programSlug && programSlugs.has(row.programSlug)));
  const programsWithIntakes = new Set(intakes.map((row) => row.programSlug));
  const programsWithoutIntakes = programs.filter((row) => !programsWithIntakes.has(row.slug));
  const cscaPolicyApplicable = programs.some((row) => /undergraduate|foundation/i.test(String(row.degreeLevel ?? "")));
  const entitySourceProblems = [
    ...([{ kind: "school", slug: school.slug, row: school }] as Array<{ kind: string; slug: string; row: Entity }>),
    ...programs.map((row) => ({ kind: "program", slug: row.slug, row: row as Entity })),
    ...intakes.map((row) => ({ kind: "programIntake", slug: intakeKey(row), row: row as Entity })),
    ...scholarships.map((row) => ({ kind: "scholarship", slug: row.slug, row: row as Entity })),
  ].map(({ kind, slug, row }) => ({ kind, slug, missing: missingSourceFields(row) })).filter((row) => row.missing.length > 0);

  const schoolCoverage = {
    applicationLevel: hasValue(school.applicationLevel),
    deadline: hasValue(school.deadlineSummary),
    tuition: hasValue(school.tuitionSummary),
    applicationFee: hasValue(school.applicationFee),
    languagePolicy: hasAny(school as JsonRecord, ["languageRequirement", "hskRequirement", "englishRequirement"]),
    cscaPolicy: cscaPolicyApplicable
      ? typeof school.cscaRequired === "boolean" || hasAny(school as JsonRecord, ["cscaRequirement", "cscaSubjects"])
      : null,
  };
  const programCoverage = {
    duration: { covered: countCovered(programs as JsonRecord[], ["durationYears", "durationMonths"]), total: programs.length },
    teachingLanguage: { covered: countCovered(programs as JsonRecord[], ["teachingLanguage"]), total: programs.length },
    languageRequirement: { covered: countCovered(programs as JsonRecord[], ["hskRequirement", "englishRequirement"]), total: programs.length },
    tuition: { covered: countCovered(programs as JsonRecord[], ["tuitionAmount", "tuitionText", "displayTuition"]), total: programs.length },
    applicationDetail: { covered: countCovered(programs as JsonRecord[], ["applicationUrl", "applicationNote"]), total: programs.length },
    intake: { covered: programsWithIntakes.size, total: programs.length },
  };
  const intakeCoverage = {
    deadline: { covered: countCovered(intakes as JsonRecord[], ["deadlineDate", "deadlineLabel"]), total: intakes.length },
    applicationRound: { covered: countCovered(intakes as JsonRecord[], ["applicationRound"]), total: intakes.length },
    status: { covered: countCovered(intakes as JsonRecord[], ["status"]), total: intakes.length },
  };
  const scholarshipCoverage = {
    funding: { covered: countCovered(scholarships as JsonRecord[], ["fundingLevel", "coverage", "amountText", "benefitItems", "benefits"]), total: scholarships.length },
    applicability: { covered: countCovered(scholarships as JsonRecord[], ["applicableDegree", "applicableProgram", "programSlug"]), total: scholarships.length },
    requirements: { covered: countCovered(scholarships as JsonRecord[], ["requirementText", "eligibilityItems"]), total: scholarships.length },
    deadline: { covered: countCovered(scholarships as JsonRecord[], ["deadlineDate", "deadlineLabel"]), total: scholarships.length },
  };
  const unresolved = {
    schoolFields: Object.entries(schoolCoverage).filter(([, covered]) => covered === false).map(([field]) => field),
    programRowsWithoutDuration: programs.filter((row) => !hasAny(row as JsonRecord, ["durationYears", "durationMonths"])).map((row) => row.slug),
    programRowsWithoutTeachingLanguage: programs.filter((row) => !hasValue(row.teachingLanguage)).map((row) => row.slug),
    programRowsWithoutLanguageRequirement: programs.filter((row) => !hasAny(row as JsonRecord, ["hskRequirement", "englishRequirement"])).map((row) => row.slug),
    programRowsWithoutTuition: programs.filter((row) => !hasAny(row as JsonRecord, ["tuitionAmount", "tuitionText", "displayTuition"])).map((row) => row.slug),
    programRowsWithoutApplicationDetail: programs.filter((row) => !hasAny(row as JsonRecord, ["applicationUrl", "applicationNote"])).map((row) => row.slug),
    programRowsWithoutIntake: programsWithoutIntakes.map((row) => row.slug),
    intakeRowsWithoutDeadline: intakes.filter((row) => !hasAny(row as JsonRecord, ["deadlineDate", "deadlineLabel"])).map(intakeKey),
    scholarshipRowsWithoutFunding: scholarships.filter((row) => !hasAny(row as JsonRecord, ["fundingLevel", "coverage", "amountText", "benefitItems", "benefits"])).map((row) => row.slug),
    scholarshipRowsWithoutRequirements: scholarships.filter((row) => !hasAny(row as JsonRecord, ["requirementText", "eligibilityItems"])).map((row) => row.slug),
    scholarshipRowsWithoutDeadline: scholarships.filter((row) => !hasAny(row as JsonRecord, ["deadlineDate", "deadlineLabel"])).map((row) => row.slug),
  };
  const unresolvedCount = Object.values(unresolved).reduce((sum, values) => sum + values.length, 0);
  return {
    schoolSlug: school.slug,
    schoolName: school.nameEn,
    source: "2027_draft_union",
    counts: { programs: programs.length, programIntakes: intakes.length, scholarships: scholarships.length },
    integrity: { ok: entitySourceProblems.length === 0, sourceProblems: entitySourceProblems },
    publishedFieldCoverage: {
      school: { ...schoolCoverage, cscaPolicyApplicable },
      programs: Object.fromEntries(Object.entries(programCoverage).map(([key, value]) => [key, { ...value, ratio: ratio(value.covered, value.total) }])),
      programIntakes: Object.fromEntries(Object.entries(intakeCoverage).map(([key, value]) => [key, { ...value, ratio: ratio(value.covered, value.total) }])),
      scholarships: Object.fromEntries(Object.entries(scholarshipCoverage).map(([key, value]) => [key, { ...value, ratio: ratio(value.covered, value.total) }])),
    },
    unresolved,
    unresolvedCount,
  };
}).sort((left, right) => Number(!right.integrity.ok) - Number(!left.integrity.ok) || right.unresolvedCount - left.unresolvedCount || left.schoolSlug.localeCompare(right.schoolSlug));

const missingCandidateSchools = [...candidateSchoolSlugs].filter((slug) => !effectiveSchoolSlugs.has(slug));
const integrityErrors = [
  ...missingCandidateSchools.map((slug) => `Missing school row for classified 2027 draft: ${slug}`),
  ...orphanIntakes.map((row) => `Orphan intake: ${intakeKey(row)}`),
  ...non2027Intakes.map((row) => `Non-2027 intake: ${intakeKey(row)}`),
  ...orphanScholarships.map((row) => `Orphan scholarship: ${row.slug}`),
  ...rows.flatMap((row) => row.integrity.sourceProblems.map((problem) => `${row.schoolSlug} ${problem.kind} ${problem.slug} missing ${problem.missing.join(", ")}`)),
];
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_audit",
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  policy: {
    integrityRule: "Every effective 2027 entity must retain an official source URL, label, SHA-256, capture time and field lineage; intakes and scholarships must reference an included program or school.",
    completenessRule: "A missing optional field is an unresolved evidence gap, not an inferred value or automatic validation failure.",
    cscaRule: "School-level CSCA policy is audited only when the effective 2027 bundle contains an undergraduate or foundation route; null means not applicable to the captured route set.",
    scholarshipRule: "Zero scholarship rows is not an error because a school may publish no applicable 2027 scholarship on the captured official sources.",
  },
  summary: {
    sourceDiscoveryAuditedSchools: targetSchoolCount,
    schools: rows.length,
    candidateSchools: effectiveSchools.length,
    alreadyCurrentSchools: 0,
    schoolsWithoutExplicit2027Route: targetSchoolCount - candidateSchoolSlugs.size,
    programs: effectivePrograms.length,
    programIntakes: effectiveIntakes.length,
    scholarships: effectiveScholarships.length,
    integrityErrors: integrityErrors.length,
    schoolsWithIntegrityErrors: rows.filter((row) => !row.integrity.ok).length,
    schoolsWithUnresolvedFields: rows.filter((row) => row.unresolvedCount > 0).length,
    programsWithoutDuration: rows.reduce((sum, row) => sum + row.unresolved.programRowsWithoutDuration.length, 0),
    programsWithoutIntake: rows.reduce((sum, row) => sum + row.unresolved.programRowsWithoutIntake.length, 0),
    programsWithoutTuition: rows.reduce((sum, row) => sum + row.unresolved.programRowsWithoutTuition.length, 0),
    programsWithoutTeachingLanguage: rows.reduce((sum, row) => sum + row.unresolved.programRowsWithoutTeachingLanguage.length, 0),
    intakesWithoutDeadline: rows.reduce((sum, row) => sum + row.unresolved.intakeRowsWithoutDeadline.length, 0),
  },
  integrityErrors,
  priorityQueue: rows.slice(0, 20).map((row) => ({
    schoolSlug: row.schoolSlug,
    schoolName: row.schoolName,
    integrityOk: row.integrity.ok,
    unresolvedCount: row.unresolvedCount,
    counts: row.counts,
  })),
  schools: rows,
};

const outputDir = resolve(root, "work/catalog-quality");
const outputPath = resolve(outputDir, "catalog-2027-field-completeness-audit.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: integrityErrors.length === 0, outputPath, summary: report.summary, priorityQueue: report.priorityQueue.slice(0, 10) }, null, 2));
if (integrityErrors.length > 0) process.exitCode = 1;
