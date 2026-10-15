import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const run = "work/catalog-official/2026-10-15T04-01-01-888Z";
const candidatePath = resolve(root, "seeds/catalog.tju-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.tju-language-spring-2027.validation.json");
const programSlug = "tianjin-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "tju-international-chinese-language-teachers-2026");
const expectedSha256 = "7b93f2d6dbd621f020a71bc865399ad453ec71cced9daabf1c15557b18aecd66";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Tianjin University Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Tianjin University evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /Scholarship for One-Semester Study Program/,
  /maximum of 5 months/,
  /International Chinese language education, Chinese Language & Literature/,
  /Spring Semester: March, 202\s*7/,
  /Spring Semester: 1 st March to 31 th October, 202\s*6/,
  /A scanned copy of the passport photo page/,
  /score reports of the HSK\/HSKK tests \(within the two-year validity\)/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected Tianjin University evidence pattern missing: ${pattern}`);

const dependency = await json<Dependency>("seeds/catalog.tju-cleanup.draft.json");
const city = dependency.cities.find((row) => row.slug === "tianjin");
const schoolBase = dependency.schools.find((row) => row.slug === "tianjin-university");
if (!city || !schoolBase) throw new Error("Tianjin city or clean official school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 accepts applications from March 1 through October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: categories, qualifications and March 2027 one-semester schedule`,
    deadlineSummary: `${source.id}: section V, Application Procedures deadline table`,
  },
};
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — One-Semester Study Program (Spring 2027)",
  nameZh: "国际中文教师奖学金一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "International Chinese Language Education, Chinese Language and Literature, or Taiji Culture",
  teachingLanguage: "Chinese",
  hskRequirement: "International Chinese Language Education or Chinese Language and Literature: HSK Level 3 score 180 and an HSKK score. Taiji Culture: an HSK score is required and applicants who also provide an HSKK score receive priority.",
  scholarshipText: "The official guide covers tuition, double-room accommodation, comprehensive medical insurance and a RMB 2,500 monthly living allowance for one-semester students.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Complete applications in both the International Chinese Language Teachers Scholarship system and the Tianjin University International Student Service System, choosing Tianjin University as host institution.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education", "Taiji Culture"],
  displayGroup: "tianjin-non-degree-chinese-language",
  displayGroupLabel: "Tianjin Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: section II, Scholarship for One-Semester Study Program and section IV Spring 2027 schedule`,
    nameZh: "derived Chinese rendering of the official English route title; pending editorial review",
    degreeLevel: `${source.id}: one-semester study with scholarship duration up to five months`,
    durationMonths: `${source.id}: section II, Scholarship for One-Semester Study Program`,
    subjectArea: `${source.id}: section II, one-semester tracks 3.1 and 3.2`,
    teachingLanguage: `${source.id}: scholarship purpose and HSK/HSKK conditions`,
    hskRequirement: `${source.id}: section II, one-semester tracks 3.1 and 3.2`,
    scholarshipText: `${source.id}: section III, Scholarship Coverage and Standard`,
    applicationUrl: `${source.id}: section V, Application Procedures`,
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (Beijing Time)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester study",
  status: "open",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "section IV: Spring Semester entry in March 2027",
    intakeYear: "section IV: Spring Semester entry in March 2027",
    deadlineDate: "section V deadline table: Spring Semester applications run March 1-October 31, 2026 Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Tianjin University Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 schedule, explicit deadline, language thresholds, coverage, application process and complete material list from the registered official guide",
    unresolved: ["The Chinese route title is a derived translation and requires editorial review before publication."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
