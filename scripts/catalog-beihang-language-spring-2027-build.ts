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
const run = "work/catalog-official/2026-10-15T03-34-12-697Z";
const candidatePath = resolve(root, "seeds/catalog.beihang-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.beihang-language-spring-2027.validation.json");
const programSlug = "beihang-university-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "beihang-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "ae0b491171b41b28531f552b4f284f24cc7a50fb35f483d0eb9a32854826ac9e";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Beihang Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Beihang evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const fragment of [
  "One-Semester Study Program",
  "The program commences either in September 2026 or March 2027, with a scholarship duration of up to five months.",
  "March 2027 admission: Student applications close October 31.",
  "Scanned copy of HSK and HSKK score reports (valid for two years).",
  "Applicants must attend the interview held by Beihang University",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected Beihang evidence fragment missing: ${fragment}`);

const cityDependency = await json<Dependency>("seeds/catalog.beijing-city-rich-batch-01.draft.json");
const schoolDependency = await json<Dependency>("seeds/catalog.beihang-school-program-batch-01.approved.local.json");
const city = cityDependency.cities.find((row) => row.slug === "beijing");
const schoolBase = schoolDependency.schools.find((row) => row.slug === "beihang-university");
if (!city || !schoolBase) throw new Error("Beihang city or school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Bachelor, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; degree-route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: host institution and scholarship categories`,
    deadlineSummary: `${source.id}: Application Procedures, March 2027 admission`,
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
  hskRequirement: "International Chinese Language Education, Chinese Language and Literature, Chinese History or Chinese Philosophy: HSK Level 3 score 180 and an HSKK score. Traditional Chinese Medicine or Taiji Culture: an HSK score is required and HSKK receives priority.",
  scholarshipText: "International Chinese Language Teachers Scholarship route. The captured Beihang guide directs applicants to Beihang for the current coverage and standard and does not state monetary amounts.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Apply in the official scholarship system, select Beihang University as host institution, submit the required materials, and complete the Beihang interview.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education", "Taiji Culture"],
  displayGroup: "beihang-non-degree-chinese-language",
  displayGroupLabel: "Beihang Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: Scholarship Categories and Application Conditions, One-Semester Study Program`,
    nameZh: "derived Chinese rendering of the official English route title; pending editorial review",
    degreeLevel: `${source.id}: one-semester study with scholarship duration up to five months`,
    durationMonths: `${source.id}: One-Semester Study Program`,
    subjectArea: `${source.id}: two One-Semester Study Program track bullets`,
    teachingLanguage: `${source.id}: International Chinese Language Teachers Scholarship purpose and HSK/HSKK conditions`,
    hskRequirement: `${source.id}: Scholarship Categories and Application Conditions, One-Semester Study Program`,
    applicationUrl: `${source.id}: Application Procedures`,
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
    intakeTerm: "Scholarship Categories and Application Conditions, One-Semester Study Program",
    intakeYear: "Application Procedures, March 2027 admission",
    deadlineDate: "derived year: 2026 guide, March 2027 admission closes October 31; pending editorial review",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Beihang Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, language thresholds, application process and materials from the registered official scholarship guide",
    unresolved: ["The Chinese route title and the inferred 2026 deadline year require editorial review before publication.", "The source directs applicants to Beihang for current scholarship coverage and does not publish a monetary standard."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
