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
const run = "work/catalog-official/2026-10-15T07-22-20-665Z";
const candidatePath = resolve(root, "seeds/catalog.bnu-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.bnu-language-spring-2027.validation.json");
const programSlug = "beijing-normal-university-iclts-international-chinese-language-education-zhuhai-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "bnu-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "6c0063849bde8b5e40acb0d04fe60b1ff0a436de332beaab038953f82e24adce";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Beijing Normal University Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Beijing Normal University evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /一学期研修生 2026年9月、2027年3月入学，资助期限为5个月/,
  /汉语国际教育方向（北师大珠海校区培养）/,
  /HSK（四级）180分、具有HSKK成绩/,
  /2027年3月入学: 学生申请截止日期为10月31日/,
  /申请者须了解目标接收院校的具体招生条件及报名截止时间，按照相关规定提交申请材料/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected Beijing Normal University evidence pattern missing: ${pattern}`);

const dependency = await json<Dependency>("seeds/catalog.bnu-school-program-batch-01.approved.local.json");
const schoolCity = dependency.cities.find((row) => row.slug === "beijing");
const city = dependency.cities.find((row) => row.slug === "zhuhai");
const schoolBase = dependency.schools.find((row) => row.slug === "beijing-normal-university");
if (!schoolCity || !city || !schoolBase) throw new Error("Beijing, Zhuhai or official Beijing Normal University school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester International Chinese Language Education route at the Zhuhai campus for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: March 2027 one-semester non-degree scholarship route`,
    deadlineSummary: `${source.id}: section III, March 2027 student deadline`,
  },
};
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — International Chinese Language Education, One-Semester Study (Zhuhai Campus, Spring 2027)",
  nameZh: "国际中文教师奖学金汉语国际教育方向一学期研修项目（珠海校区，2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "International Chinese Language Education",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 4 score 180 and an HSKK score are required.",
  scholarshipText: "International Chinese Language Teachers Scholarship route. The captured BNU guide does not state benefit categories or monetary amounts.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Apply through the International Chinese Language Teachers Scholarship section of the CLEC website, submit the required materials, track the review, and confirm study-in-China procedures with BNU if selected.",
  hasScholarship: true,
  badgeText: "Spring 2027 · Zhuhai campus",
  displaySubjects: ["Chinese Language", "International Chinese Language Education"],
  displayGroup: "bnu-zhuhai-non-degree-chinese-language",
  displayGroupLabel: "BNU Zhuhai Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: section II, one-semester International Chinese Language Education route at Zhuhai campus`,
    nameZh: `${source.id}: official Chinese route name with campus and intake qualifier`,
    degreeLevel: `${source.id}: one-semester study with five-month duration`,
    durationMonths: `${source.id}: section II, item 5`,
    subjectArea: `${source.id}: section II, item 5(1)`,
    teachingLanguage: `${source.id}: HSK and HSKK conditions`,
    hskRequirement: `${source.id}: section II, item 5(1)`,
    scholarshipText: `${source.id}: no benefit or monetary standard stated on the captured page`,
    applicationUrl: `${source.id}: section III, Application Process`,
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (Beijing Time)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester study at BNU Zhuhai campus",
  status: "open",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "section II, item 5: March 2027 entry",
    intakeYear: "section II, item 5: March 2027 entry",
    deadlineDate: "section III: student application deadline October 31 for March 2027 entry, Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [schoolCity, city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Beijing Normal University Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Zhuhai campus, Spring 2027 availability, explicit deadline, language thresholds and application process from the registered official BNU guide",
    unresolved: [
      "The captured BNU page instructs applicants to follow BNU-specific material requirements but does not list those materials.",
      "The captured BNU page does not state benefit categories or monetary amounts.",
    ],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
