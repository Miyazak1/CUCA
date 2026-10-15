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
const run = "work/catalog-official/2026-10-15T05-28-04-209Z";
const candidatePath = resolve(root, "seeds/catalog.zju-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.zju-language-spring-2027.validation.json");
const programSlug = "zhejiang-university-iclts-chinese-language-and-literature-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "zju-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "2b88b8fadfe9f84d079829ae65008ab977a1277672f3fbea4baf4f6b8bae7f4c";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Zhejiang University Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Zhejiang University evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
const compactText = visibleText.replace(/\s+/g, "");
for (const pattern of [
  /一学期研修生（汉语言文学方向）2026年9月、2027年3月入学，资助期限为5个月/,
  /中文水平考试成绩达到HSK（三级）180分，具有HSKK成绩/,
  /2026年10月31日（2027年3月入学，仅限一学期研修生）/,
  /国际中文教师奖学金报名网站.*浙江大学国际学生申请系统/,
  /护照照片页扫描件.*HSK、HSKK成绩报告.*推荐机构负责人的推荐信/,
]) if (!pattern.test(compactText)) throw new Error(`Expected Zhejiang University evidence pattern missing: ${pattern}`);

const dependency = await json<Dependency>("seeds/catalog.zju-complete-batch-01.approved.local.json");
const city = dependency.cities.find((row) => row.slug === "hangzhou");
const schoolBase = dependency.schools.find((row) => row.slug === "zhejiang-university");
if (!city || !schoolBase) throw new Error("Hangzhou city or clean official Zhejiang University school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: scholarship categories include a March 2027 one-semester non-degree route`,
    deadlineSummary: `${source.id}: application procedure and deadline, March 2027 entry`,
  },
};
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — Chinese Language and Literature, One-Semester Program (Spring 2027)",
  nameZh: "国际中文教师奖学金汉语言文学方向一学期研修生（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "Chinese Language and Literature",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score of at least 180 and an HSKK result are required; the official page does not state a minimum HSKK score for this route.",
  scholarshipText: "The official Zhejiang University page states that the scholarship covers tuition, accommodation, living expenses and comprehensive medical insurance; monetary standards are linked elsewhere and are not stated on the captured page.",
  applicationUrl: source.url,
  applicationNote: "Complete applications in both the International Chinese Language Teachers Scholarship system and the Zhejiang University international-student application system before the deadline.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "Chinese Literature"],
  displayGroup: "zju-non-degree-chinese-language",
  displayGroupLabel: "ZJU Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: scholarship category 2, one-semester Chinese Language and Literature route`,
    nameZh: `${source.id}: 一学期研修生（汉语言文学方向）`,
    degreeLevel: `${source.id}: one-semester study route with five-month duration`,
    durationMonths: `${source.id}: scholarship category 2`,
    subjectArea: `${source.id}: 汉语言文学方向`,
    teachingLanguage: `${source.id}: HSK and HSKK entry conditions`,
    hskRequirement: `${source.id}: scholarship category 2`,
    scholarshipText: `${source.id}: scholarship coverage section`,
    applicationUrl: `${source.id}: application procedure and deadline`,
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (end of day, Beijing Time derived)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester Chinese Language and Literature",
  status: "open",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "scholarship category 2: March 2027 entry",
    intakeYear: "scholarship category 2: March 2027 entry",
    deadlineDate: "application deadline item 2: October 31, 2026 for March 2027 entry; end-of-day time is derived in Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Zhejiang University Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, deadline, HSK/HSKK thresholds, dual-system procedure, three principal application materials and scholarship coverage categories from the registered official Zhejiang University page",
    changeReview: {
      priorSha256: source.sha256,
      currentSha256: source.sha256,
      unchanged: true,
      disposition: "The current official HTML snapshot is byte-identical to the registered historical baseline.",
    },
    unresolved: [
      "The official page lists covered benefit categories but refers elsewhere for monetary standards.",
      "The official page does not state a minimum HSKK score for the one-semester route.",
      "The official page states a calendar date but no cutoff time; end of day in Beijing Time is derived for the intake record.",
    ],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
