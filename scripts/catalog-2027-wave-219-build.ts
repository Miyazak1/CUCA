import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedProgramIntake } from "../src/server/catalog/seed-contract.ts";

type ExtractedProgram = {
  degreeLevel: "Master" | "Doctoral";
  college: string;
  nameZh: string;
  nameEn: string;
  teachingLanguage: "Chinese" | "Chinese and English";
  sourceId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256: string;
  capturedAt: string;
};

type Extraction = {
  version: number;
  sourceRun: string;
  sourceCount: number;
  programCount: number;
  programs: ExtractedProgram[];
};

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const extraction = JSON.parse(await readFile(resolve(root, "catalog-sources/hzau-current-postgraduate-programs.extracted.json"), "utf8")) as Extraction;
if (extraction.version !== 1 || extraction.sourceCount !== 19 || extraction.programCount !== 68 || extraction.programs.length !== 68) {
  throw new Error("Unexpected HZAU postgraduate extraction shape.");
}

const sourceRunRoot = resolve(root, extraction.sourceRun);
const manifest = JSON.parse(await readFile(resolve(sourceRunRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const manifestMap = new Map(manifest.sources.map((source) => [source.id, source]));
for (const program of extraction.programs) {
  const source = manifestMap.get(program.sourceId);
  if (!source || source.status !== 200 || source.sha256 !== program.sourceSha256) throw new Error(`Missing locked HZAU program source: ${program.sourceId}`);
  const artifact = await readFile(resolve(sourceRunRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`HZAU source hash mismatch: ${source.id}`);
}

const applicationRunRoot = resolve(root, "work/catalog-official/2026-10-26T05-48-31-435Z");
const applicationManifest = JSON.parse(await readFile(resolve(applicationRunRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const applicationSource = applicationManifest.sources.find((source) => source.id === "hzau-international-application-current-2027" && source.sha256 === "8e0c7127c26d5fe7d33d5724a64cc3c7a1021a04a18c4e09c02460de84404948");
if (!applicationSource) throw new Error("Missing locked HZAU 2027 application guide.");
const applicationArtifact = await readFile(resolve(applicationRunRoot, applicationSource.artifactPath));
if (createHash("sha256").update(applicationArtifact).digest("hex") !== applicationSource.sha256) throw new Error("HZAU application source hash mismatch.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-117.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "wuhan");
const school = prior.schools?.find((row) => row.slug === "huazhong-agricultural-university");
if (!city || !school || prior.scholarships?.length !== 2) throw new Error("Wave 219 requires the Wave 117 HZAU school, city and scholarship rows.");

const slugify = (value: string) => value
  .normalize("NFKD")
  .replace(/[’']/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .toLowerCase();

const isHumanities = (college: string) => /Economics|Management|Humanities|Social Sciences/i.test(college);
const tuitionText = (program: ExtractedProgram) => {
  if (program.degreeLevel === "Master") {
    return isHumanities(program.college)
      ? "Chinese-medium: CNY 22,000 per academic year; English-medium: CNY 25,000 per academic year."
      : "Chinese-medium: CNY 25,000 per academic year; English-medium: CNY 28,000 per academic year.";
  }
  return isHumanities(program.college)
    ? "Chinese-medium: CNY 28,000 per academic year; English-medium: CNY 32,000 per academic year."
    : "Chinese-medium: CNY 40,000 per academic year; English-medium: CNY 44,000 per academic year.";
};

const programs: CatalogSeedProgram[] = extraction.programs.map((entry) => ({
  slug: `huazhong-agricultural-university-${entry.degreeLevel.toLowerCase()}-${slugify(entry.nameEn)}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: entry.nameEn,
  nameZh: entry.nameZh,
  degreeLevel: entry.degreeLevel,
  fieldCategory: entry.college,
  subjectArea: entry.nameEn,
  teachingLanguage: entry.teachingLanguage,
  hskRequirement: "HSK Level 5 or above is required for Chinese-medium study.",
  ...(entry.teachingLanguage === "Chinese and English" ? { englishRequirement: "HZAU recommends TOEFL, IELTS or another recognized official English test for English-medium study but publishes no numeric cutoff." } : {}),
  tuitionPeriod: "academic year",
  tuitionText: tuitionText(entry),
  scholarshipText: "Eligible applicants may apply for the 2027 Chinese Government Scholarship High-level Postgraduate Program or the HZAU Scholarship; awards remain competitive.",
  applicationUrl: applicationSource.finalUrl ?? applicationSource.url,
  applicationNote: "The official current postgraduate program table lists this major. The 2027 scholarship application window runs from November 1, 2026 through February 21, 2027. An acceptance letter from an HZAU professor is required.",
  hasScholarship: true,
  badgeText: "2027 scholarship route",
  displaySubjects: [entry.nameEn],
  displayGroup: entry.degreeLevel,
  displayGroupLabel: `${entry.degreeLevel} programs`,
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: entry.capturedAt,
  sourceUrl: entry.sourceUrl,
  sourceLabel: entry.sourceLabel,
  sourceSha256: entry.sourceSha256,
  capturedAt: entry.capturedAt,
  sourceFieldLineage: {
    nameEn: "official program table major-name column",
    nameZh: "official program table major-name column",
    degreeLevel: "official program-table section heading",
    fieldCategory: "official college-specific program page",
    subjectArea: "official program table major-name column",
    teachingLanguage: "official index rule: majors marked with an asterisk are Chinese-only; unmarked majors are available in Chinese and English",
    hskRequirement: "official current application guide language-proficiency section",
    ...(entry.teachingLanguage === "Chinese and English" ? { englishRequirement: "official current application guide language-proficiency section" } : {}),
    tuitionText: "official current application guide expense table, mapped by degree level, discipline group and teaching language",
    scholarshipText: "official current application guide and two registered scholarship pages",
    applicationNote: "official current application period and required-documents table",
  },
}));

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-02-21T23:59:59.000Z",
  deadlineLabel: "Scholarship application period: November 1, 2026 to February 21, 2027; no self-funded deadline is published.",
  applicationRound: "2027 postgraduate scholarship cycle",
  sourceUrl: applicationSource.finalUrl ?? applicationSource.url,
  sourceLabel: applicationSource.label,
  sourceSha256: applicationSource.sha256,
  capturedAt: applicationSource.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "official application guide and scholarship cycle imply the 2027 academic-year entry; exact registration date is deferred to the admission notice",
    intakeYear: "official November 2026-February 2027 scholarship application cycle",
    deadlineDate: "official current application-period close date",
    deadlineLabel: "official current application period plus explicit unresolved self-funded deadline",
    applicationRound: "official current Chinese Government Scholarship and HZAU Scholarship routes",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: [...extraction.programs.map((entry) => entry.capturedAt), applicationSource.fetchedAt].sort().at(-1)!,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: prior.scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 219 validation failed:\n${validation.errors.join("\n")}`);

const uniqueProgramSources = [...new Map(extraction.programs.map((program) => [program.sourceId, {
  id: program.sourceId,
  label: program.sourceLabel,
  url: program.sourceUrl,
  fetchedAt: program.capturedAt,
  sha256: program.sourceSha256,
}])).values()];
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 45, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: prior.scholarships.length },
  evidence: [
    { id: applicationSource.id, label: applicationSource.label, url: applicationSource.finalUrl ?? applicationSource.url, fetchedAt: applicationSource.fetchedAt, sha256: applicationSource.sha256 },
    ...uniqueProgramSources,
  ],
  unresolved: [
    "The 68 program rows are current official postgraduate offerings linked from HZAU's international programs index. The official application guide explicitly supplies the 2027 scholarship window, but it does not publish a separate self-funded deadline; no self-funded deadline is inferred.",
    "The program tables do not publish duration. Duration remains absent for every route.",
    "Tuition is published by degree, discipline group and teaching language rather than by individual major. Bilingual routes retain both official prices in tuitionText; no single tuitionAmount is selected.",
    "The official index says asterisked majors are Chinese-only and unmarked majors are available in Chinese and English. The captured tables contain no asterisked major name, so all 68 extracted routes retain the published bilingual availability.",
    "The HZAU Scholarship partial tier still has no published coverage and remains unresolved in the inherited Wave 117 scholarship record.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Supervisor names and personal profile links are not imported. Only public institutional major names, college labels and admission rules are retained." },
};

const stem = resolve(root, "seeds/catalog.2027-wave-219");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 219, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
