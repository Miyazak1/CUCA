import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  CatalogSeedBundle,
  CatalogSeedProgramIntake,
  CatalogSeedSource,
} from "../src/server/catalog/seed-contract.ts";

type JsonRecord = Record<string, unknown>;
type Entity = CatalogSeedSource & JsonRecord;

const root = process.cwd();
const candidate = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const currentPrerequisites = JSON.parse(await readFile(resolve(root, "seeds/catalog.current-2027-prerequisites.reviewed.json"), "utf8")) as CatalogSeedBundle;
const refreshStatus = JSON.parse(await readFile(resolve(root, "catalog-sources/2027-school-refresh-status.json"), "utf8")) as {
  status?: string;
  schools?: Array<{ schoolSlug?: string }>;
};
const sourceDiscoveryAuditedSchoolSlugs = new Set((refreshStatus.schools ?? []).map((row) => row.schoolSlug).filter((slug): slug is string => Boolean(slug)));
if (refreshStatus.status !== "discovery_audit_complete" || sourceDiscoveryAuditedSchoolSlugs.size !== 100) {
  throw new Error(`Expected a completed 100-school source-discovery audit, found status ${refreshStatus.status ?? "missing"} and ${sourceDiscoveryAuditedSchoolSlugs.size} unique schools.`);
}
const alreadyCurrentSchoolSlugs = new Set([
  "qingdao-university",
  "tianjin-university",
  "zhejiang-university-of-technology",
]);

const candidateSchools = candidate.schools ?? [];
const candidateSchoolSlugs = new Set(candidateSchools.map((row) => row.slug));
const effectiveSchools = [
  ...candidateSchools,
  ...(currentPrerequisites.schools ?? []).filter((row) => alreadyCurrentSchoolSlugs.has(row.slug) && !candidateSchoolSlugs.has(row.slug)),
];
const effectiveSchoolSlugs = new Set(effectiveSchools.map((row) => row.slug));
if (effectiveSchools.length !== effectiveSchoolSlugs.size) throw new Error("Effective 2027 school set contains duplicate school slugs.");

const candidateProgramSlugs = new Set((candidate.programs ?? []).map((row) => row.slug));
const effectivePrograms = [
  ...(candidate.programs ?? []),
  ...(currentPrerequisites.programs ?? []).filter((row) => alreadyCurrentSchoolSlugs.has(row.schoolSlug) && !candidateProgramSlugs.has(row.slug)),
];
const effectiveProgramSlugs = new Set(effectivePrograms.map((row) => row.slug));
const intakeKey = (row: CatalogSeedProgramIntake) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`;
const candidateIntakeKeys = new Set((candidate.programIntakes ?? []).map(intakeKey));
const effectiveIntakes = [
  ...(candidate.programIntakes ?? []),
  ...(currentPrerequisites.programIntakes ?? []).filter((row) => row.intakeYear === 2027 && effectiveProgramSlugs.has(row.programSlug) && !candidateIntakeKeys.has(intakeKey(row))),
];
const candidateScholarshipSlugs = new Set((candidate.scholarships ?? []).map((row) => row.slug));
const effectiveScholarships = [
  ...(candidate.scholarships ?? []),
  ...(currentPrerequisites.scholarships ?? []).filter((row) => row.schoolSlug && alreadyCurrentSchoolSlugs.has(row.schoolSlug) && !candidateScholarshipSlugs.has(row.slug)),
];

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
    source: candidateSchoolSlugs.has(school.slug) ? "2027_release_candidate" : "already_current_baseline",
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

const integrityErrors = [
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
    sourceDiscoveryAuditedSchools: sourceDiscoveryAuditedSchoolSlugs.size,
    schools: rows.length,
    candidateSchools: candidateSchools.length,
    alreadyCurrentSchools: rows.filter((row) => row.source === "already_current_baseline").length,
    schoolsWithoutExplicit2027Route: sourceDiscoveryAuditedSchoolSlugs.size - rows.length,
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
