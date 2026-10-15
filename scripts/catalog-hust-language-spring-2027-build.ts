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
const run = "work/catalog-official/2026-10-15T04-29-31-490Z";
const candidatePath = resolve(root, "seeds/catalog.hust-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.hust-language-spring-2027.validation.json");
const programSlug = "huazhong-university-of-science-and-technology-iclts-one-semester-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "hust-international-chinese-teachers-scholarship-2026");
const expectedSha256 = "5641c761f60666f4d3d3bec29b97d94e4622357b58ae6930dfc90dd8027ea789";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("HUST Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("HUST evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /The program commences either in September 2026 or March 2027, with a scholarship duration of up to five months/,
  /Applicants must score at least 180 on the HSK \(Level 3\) and possess an HSKK score/,
  /March 2027 admission: Student applications close October 31/,
  /A scanned copy of passport photo page/,
  /Certificate of Non-criminal Record/,
  /admission\.hust\.edu\.cn\/apply/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected HUST evidence pattern missing: ${pattern}`);

const dependency = await json<Dependency>("seeds/catalog.hust-safe-new-batch-01.approved.local.json");
const city = dependency.cities.find((row) => row.slug === "wuhan");
const schoolBase = dependency.schools.find((row) => row.slug === "huazhong-university-of-science-and-technology");
if (!city || !schoolBase) throw new Error("Wuhan city or clean official HUST school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: Scholarship Types and Qualifications include a March 2027 one-semester non-degree route`,
    deadlineSummary: `${source.id}: Application Procedures, March 2027 deadline`,
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
  subjectArea: "Chinese Language Study",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 and an HSKK score are required.",
  scholarshipText: "The official HUST guide states that the scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance; it does not state monetary amounts on this page.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Apply first through the International Chinese Language Teachers Scholarship section of the CLEC website and select HUST, then register in the HUST international-student application system and upload the scholarship application form.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language"],
  displayGroup: "hust-non-degree-chinese-language",
  displayGroupLabel: "HUST Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: Scholarship Types and Qualifications, One-Semester Study Program`,
    nameZh: `${source.id}: scholarship category with March 2027 intake qualifier`,
    degreeLevel: `${source.id}: one-semester study route with five-month duration`,
    durationMonths: `${source.id}: Scholarship Types and Qualifications, item E`,
    subjectArea: `${source.id}: Chinese-language study route`,
    teachingLanguage: `${source.id}: HSK and HSKK entry conditions`,
    hskRequirement: `${source.id}: Scholarship Types and Qualifications, item E`,
    scholarshipText: `${source.id}: Scholarship Coverage and Criteria`,
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
    intakeTerm: "Scholarship Types and Qualifications, item E: March 2027 entry",
    intakeYear: "Scholarship Types and Qualifications, item E: March 2027 entry",
    deadlineDate: "Application Procedures: October 31 for March 2027 entry, Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid HUST Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, explicit deadline, language thresholds, application materials, dual-system application process and coverage categories from the registered official HUST guide",
    unresolved: ["The official page lists covered benefit categories but does not state their monetary amounts."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
