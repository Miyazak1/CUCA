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
const run = "work/catalog-official/2026-10-15T03-42-05-953Z";
const candidatePath = resolve(root, "seeds/catalog.csu-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.csu-language-spring-2027.validation.json");
const programSlug = "central-south-university-iclts-one-semester-chinese-language-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "csu-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "7a48ccdd412b267f15145975ea8eb385a32f83aad7655d233acfaa1441883fb7";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("CSU Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("CSU evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const fragment of [
  "2027 Spring Semester Application Guide for International Chinese Language Teachers Scholarship",
  "Scholarship for One-Semester Study Program (Chinese Language Study)",
  "The program commences in March 2027 and provides a scholarship of a maximum of 5 months.",
  "minimum score of 180 in HSK 3",
  "Students’ applications must be completed before October 31",
  "monthly stipend of 2500 RMB",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected CSU evidence fragment missing: ${fragment}`);

const cityDependency = await json<Dependency>("seeds/catalog.changsha-city-rich-batch-01.draft.json");
const schoolDependency = await json<Dependency>("seeds/catalog.csu-complete-batch-01.approved.local.json");
const city = cityDependency.cities.find((row) => row.slug === "changsha");
const schoolBase = schoolDependency.schools.find((row) => row.slug === "central-south-university");
if (!city || !schoolBase) throw new Error("CSU city or school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: 2027 Spring one-semester scholarship route`,
    deadlineSummary: `${source.id}: section IV, Application Deadlines (deadline year derived from the 2027 Spring guide context)`,
  },
};
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — One-Semester Chinese Language Study (Spring 2027)",
  nameZh: "国际中文教师奖学金一学期中文研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "Chinese Language Study",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score of at least 180 and an HSKK test score are required.",
  scholarshipText: "Full tuition and on-campus accommodation, CNY 2,500 monthly living allowance, and CNY 400 comprehensive medical insurance for the one-semester study period.",
  applicationUrl: "https://intl.csu.edu.cn/index.htm",
  applicationNote: "Apply in both the CSU China International Student Service System and the official International Chinese Language Teachers Scholarship system, then follow CSU's official submission and status instructions.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education"],
  displayGroup: "csu-non-degree-chinese-language",
  displayGroupLabel: "CSU Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: title and section II, Scholarship Qualifications`,
    nameZh: "derived Chinese rendering of the official English route title; pending editorial review",
    degreeLevel: `${source.id}: section II, one-semester study with a maximum scholarship duration of five months`,
    durationMonths: `${source.id}: section II, Scholarship Qualifications`,
    subjectArea: `${source.id}: section II, Chinese Language Study`,
    teachingLanguage: `${source.id}: program identity and HSK/HSKK conditions`,
    hskRequirement: `${source.id}: section II, Scholarship Qualifications`,
    scholarshipText: `${source.id}: section III, Scholarship Coverage and Criteria`,
    applicationUrl: `${source.id}: section V, Online Registration on CSU Application Website`,
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (Beijing Time)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester Chinese language study",
  status: "open",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "section II: commences in March 2027",
    intakeYear: "page title and section II",
    deadlineDate: "derived year: the 2027 Spring guide posted in September 2026 states October 31; pending editorial review",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid CSU Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, language thresholds, scholarship coverage, application process and materials from the registered official CSU guide",
    unresolved: [
      "The registered page changed to a new 2027 Spring guide and therefore requires editorial change review before publication.",
      "The source states October 31 without repeating the year; 2026 is derived from the guide title, post date and March 2027 start and requires editorial review.",
      "The source requires an application or evaluation fee after preliminary review but does not publish its amount on this page.",
    ],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
