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
const run = "work/catalog-official/2026-10-15T04-09-30-970Z";
const candidatePath = resolve(root, "seeds/catalog.blcu-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.blcu-language-spring-2027.validation.json");
const programSlug = "beijing-language-and-culture-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "blcu-international-chinese-language-teachers-regular-2026");
const expectedSha256 = "73d71729ddb86f65d8197c8e690ac6ad466c800a1c97f84cfd567bc290e746f8";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("BLCU Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("BLCU evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /一学期研修生 202\s*6 年 9 月、 202\s*7 年 3 月入学，资助期限为 5 个月/,
  /HSK （三级） 180 分，具有 HSKK 成绩/,
  /2026 年 10 月 31 日（ 2027 年 3 月入学）/,
  /护照照片页扫描件/,
  /HSK 、 HSKK 成绩报告（有效期两年）扫描件/,
  /推荐机构负责人的推荐信/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected BLCU evidence pattern missing: ${pattern}`);

const cityDependency = await json<Dependency>("seeds/catalog.beijing-city-rich-batch-01.draft.json");
const schoolDependency = await json<Dependency>("seeds/catalog.blcu-school-undergraduate-cleanup.draft.json");
const city = cityDependency.cities.find((row) => row.slug === "beijing");
const schoolBase = schoolDependency.schools.find((row) => row.slug === "beijing-language-and-culture-university");
if (!city || !schoolBase) throw new Error("Beijing city or clean official BLCU school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: scholarship categories include a March 2027 one-semester non-degree route`,
    deadlineSummary: `${source.id}: section IV, application deadline for March 2027 entry`,
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
  subjectArea: "International Chinese Language Education or Chinese Language and Literature",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 and an HSKK score are required.",
  scholarshipText: "The official BLCU guide states that the scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance; it does not state monetary amounts on this page.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Apply through the International Chinese Language Teachers Scholarship section of the CLEC website, select BLCU as host institution, submit the required materials and track the review result online.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education", "Chinese Language and Literature"],
  displayGroup: "blcu-non-degree-chinese-language",
  displayGroupLabel: "BLCU Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: section II, one-semester study route and March 2027 entry`,
    nameZh: `${source.id}: official Chinese route name with intake qualifier`,
    degreeLevel: `${source.id}: one-semester study route with five-month duration`,
    durationMonths: `${source.id}: section II, item 5`,
    subjectArea: `${source.id}: section II, item 5`,
    teachingLanguage: `${source.id}: HSK and HSKK entry conditions`,
    hskRequirement: `${source.id}: section II, item 5`,
    scholarshipText: `${source.id}: section III, funding coverage and standard`,
    applicationUrl: `${source.id}: section IV, application process`,
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
    intakeTerm: "section II, item 5: March 2027 entry",
    intakeYear: "section II, item 5: March 2027 entry",
    deadlineDate: "section IV: October 31, 2026 for March 2027 entry, Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid BLCU Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, explicit deadline, language thresholds, funding coverage, application process and route-specific materials from the registered official BLCU guide",
    unresolved: ["The official page lists covered benefit categories but does not state their monetary amounts."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
