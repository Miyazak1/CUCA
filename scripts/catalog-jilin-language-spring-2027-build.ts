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
const run = "work/catalog-official/2026-10-15T07-16-59-018Z";
const candidatePath = resolve(root, "seeds/catalog.jilin-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.jilin-language-spring-2027.validation.json");
const programSlug = "jilin-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "jilin-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "52d85413ac3fd139dd8a3ac90e9fa950ef7dd247755344738a5876824788a692";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Jilin Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Jilin evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /Application Guidelines for Jilin University International Chinese Language Teachers Scholarship 2026/,
  /Scholarship for One-Semester Study Program/,
  /March 2027/,
  /minimum score of 180 on the HSK test \(Level 3\)/,
  /October 31 \(for programs commencing in March 2027\s*\)/,
  /Appendix 2：List of Application Materials/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected Jilin evidence pattern missing: ${pattern}`);

const cityDependency = await json<Dependency>("seeds/catalog.changchun-city-rich-batch-01.draft.json");
const schoolDependency = await json<Dependency>("seeds/catalog.jilin-cleanup.draft.json");
const city = cityDependency.cities.find((row) => row.slug === "changchun");
const schoolBase = schoolDependency.schools.find((row) => row.slug === "jilin-university");
if (!city || !schoolBase) throw new Error("Jilin city or clean official school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: one-semester scholarship route for March 2027`,
    deadlineSummary: `${source.id}: section III, Application Procedures (deadline year derived from the 2026 guide context)`,
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
  subjectArea: "International Chinese Language Education, Chinese Language and Literature, Chinese History, Chinese Philosophy, Traditional Chinese Medicine, or Taiji Culture",
  teachingLanguage: "Chinese",
  hskRequirement: "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy: HSK Level 3 score 180 and an HSKK score. Traditional Chinese Medicine or Taiji Culture: an HSK score is required and an HSKK score receives priority.",
  scholarshipText: "International Chinese Language Teachers Scholarship route. Exact coverage and monetary standards are in an official attachment that currently requires a download captcha and remain unresolved in this automated draft.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Apply in the official scholarship system, select Jilin University as host institution, submit the required materials, track the review, and confirm enrollment procedures with Jilin University if selected.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education", "Taiji Culture"],
  displayGroup: "jilin-non-degree-chinese-language",
  displayGroupLabel: "Jilin Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: section II, One-Semester Study Program`,
    nameZh: "derived Chinese rendering of the official English route title; pending editorial review",
    degreeLevel: `${source.id}: one-semester study with scholarship duration up to five months`,
    durationMonths: `${source.id}: section II, One-Semester Study Program`,
    subjectArea: `${source.id}: section II, One-Semester Study Program tracks 3.1 and 3.2`,
    teachingLanguage: `${source.id}: scholarship purpose and HSK/HSKK conditions`,
    hskRequirement: `${source.id}: section II, One-Semester Study Program tracks 3.1 and 3.2`,
    scholarshipText: `${source.id}: section VII identifies a coverage attachment; attachment access remains unresolved`,
    applicationUrl: `${source.id}: section III, Application Procedures`,
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
    intakeTerm: "section II: commences in March 2027",
    intakeYear: "section II and section III: March 2027",
    deadlineDate: "derived year: the March 2026 guide states October 31 for March 2027 entry; pending editorial review",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Jilin Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, language thresholds and application process from the registered official guide",
    unresolved: [
      "The guide states October 31 for March 2027 entry without repeating the deadline year; 2026 is derived from the guide date and requires editorial review.",
      "The official coverage and application-material attachments require a download captcha. Access controls were not bypassed, so monetary coverage and the complete material list remain unresolved.",
    ],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
