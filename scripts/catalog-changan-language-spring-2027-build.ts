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
const run = "work/catalog-official/2026-10-15T03-49-41-000Z";
const candidatePath = resolve(root, "seeds/catalog.changan-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.changan-language-spring-2027.validation.json");
const programSlug = "chang-an-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "changan-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "44a976211332613aeb3f93c20d73e75d09247af5009779e4ac1cce4463d68728";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Chang'an Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Chang'an evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /2026-2027\s*学年度开始招生/,
  /申请一学期研修生项目者/,
  /2027\s*年\s*3\s*月/,
  /HSK\s*（三级）\s*180\s*分/,
  /缴纳项目报名费\s*600\s*元/,
  /学生申请截止时间为\s*10\s*月\s*31/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected Chang'an evidence pattern missing: ${pattern}`);

const cityDependency = await json<Dependency>("seeds/catalog.xian-city-rich-batch-01.draft.json");
const schoolDependency = await json<Dependency>("seeds/catalog.changan-complete-batch-01.draft.json");
const city = cityDependency.cities.find((row) => row.slug === "xian");
const schoolBase = schoolDependency.schools.find((row) => row.slug === "chang-an-university");
if (!city || !schoolBase) throw new Error("Chang'an city or school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Bachelor, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: one-semester scholarship route for March 2027`,
    deadlineSummary: `${source.id}: section VIII, application deadline (deadline year derived from the 2026–2027 academic-year context)`,
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
  subjectArea: "International Chinese Language Education and Chinese Language and Literature",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score of at least 180 and an HSKK score are required.",
  scholarshipText: "Tuition and on-campus accommodation are waived; a CNY 2,500 monthly living allowance and comprehensive medical insurance are provided. Approved off-campus accommodation receives a CNY 700 monthly subsidy.",
  applicationUrl: "https://is.chd.edu.cn/",
  applicationNote: "Apply in both the official International Chinese Language Teachers Scholarship system and the Chang'an University international student application system, then pay the CNY 600 nonrefundable application fee.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education", "Chinese Language and Literature"],
  displayGroup: "changan-non-degree-chinese-language",
  displayGroupLabel: "Chang'an Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: section III, scholarship categories and application conditions`,
    nameZh: `${source.id}: section III, 一学期研修生项目`,
    degreeLevel: `${source.id}: section II and section III, one-semester non-degree study`,
    durationMonths: `${source.id}: section II, scholarship duration`,
    subjectArea: `${source.id}: section III, one-semester route directions`,
    teachingLanguage: `${source.id}: route identity and HSK/HSKK conditions`,
    hskRequirement: `${source.id}: section III, one-semester route language requirements`,
    scholarshipText: `${source.id}: section II, scholarship content and standard`,
    applicationUrl: `${source.id}: section IV, Chang'an University online application system`,
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
    intakeTerm: "section III: March 2027 entry",
    intakeYear: "section III and section VIII: March 2027 entry",
    deadlineDate: "derived year: the 2026–2027 guide states October 31 for March 2027 entry; pending editorial review",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Chang'an Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, language thresholds, scholarship coverage, fee, application process and materials from the registered official guide",
    resolvedChange: "The raw page hash changed since 2026-09-14, but normalized main article content is identical; the change is consistent with dynamic page metadata such as the visit count.",
    unresolved: [
      "The page title contains the unexplained acronym TFSU even though it is hosted by Chang'an University and the body names Chang'an University; this source inconsistency requires editorial review.",
      "The guide states October 31 for March 2027 entry without repeating the deadline year; 2026 is derived from the 2026–2027 academic-year context and requires editorial review.",
    ],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
