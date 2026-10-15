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
const run = "work/catalog-official/2026-10-15T04-21-08-816Z";
const candidatePath = resolve(root, "seeds/catalog.shu-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.shu-language-spring-2027.validation.json");
const programSlug = "shanghai-university-iclts-international-chinese-language-education-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; byteLength: number; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "shu-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "cb9703d6835e09db3391b4d8beedb5ab820a8484b9000a3277a48334731951c4";
if (!source || source.status !== 200 || source.contentType !== "application/pdf" || source.byteLength !== 1_691_575 || source.sha256 !== expectedSha256) {
  throw new Error("Shanghai University Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Shanghai University evidence artifact hash mismatch.");

const dependency = await json<Dependency>("seeds/catalog.shu-complete-batch-01.approved.local.json");
const city = dependency.cities.find((row) => row.slug === "shanghai");
const schoolBase = dependency.schools.find((row) => row.slug === "shanghai-university");
if (!city || !schoolBase) throw new Error("Shanghai city or clean official Shanghai University school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: page 3, scholarship categories include a March 2027 one-semester non-degree route`,
    deadlineSummary: `${source.id}: page 8, application deadline for March 2027 entry`,
  },
};
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — International Chinese Language Education, One-Semester Study (Spring 2027)",
  nameZh: "国际中文教师奖学金国际中文教育方向一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "International Chinese Language Education",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 and an HSKK score are required.",
  scholarshipText: "The scholarship covers tuition, accommodation, RMB 2,500 monthly living allowance and comprehensive medical insurance. The guide states RMB 700/month off-campus accommodation allowance when approved and RMB 400 medical insurance for a one-semester student.",
  applicationUrl: "https://www.chinese.cn/",
  applicationNote: "Non-degree applicants apply through the International Chinese Language Teachers Scholarship section of the CLEC website, submit the required materials and track the review result online.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Language Education"],
  displayGroup: "shu-non-degree-chinese-language",
  displayGroupLabel: "SHU Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: pages 3-4, one-semester International Chinese Language Education route and March 2027 entry`,
    nameZh: `${source.id}: pages 3-4, official Chinese route name with intake qualifier`,
    degreeLevel: `${source.id}: pages 3-4, one-semester study route with five-month duration`,
    durationMonths: `${source.id}: pages 3-4, Supporting Category item 4`,
    subjectArea: `${source.id}: page 4, Supporting Category item 4`,
    teachingLanguage: `${source.id}: page 4, HSK and HSKK entry conditions`,
    hskRequirement: `${source.id}: page 4, Supporting Category item 4`,
    scholarshipText: `${source.id}: pages 10-11, Appendix 1 coverage and standards`,
    applicationUrl: `${source.id}: page 7, Application Procedures`,
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
    intakeTerm: "pages 3-4, Supporting Category item 4: March 2027 entry",
    intakeYear: "pages 3-4, Supporting Category item 4: March 2027 entry",
    deadlineDate: "page 8, Application Deadlines item 4: October 31 for March 2027 entry, Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Shanghai University Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, explicit deadline, language thresholds, application materials, application process and benefit amounts from the registered official Shanghai University PDF",
    unresolved: ["The official guide says the passport must expire after March 1, 2026; this published date appears earlier than the March 2027 intake and is preserved without correction or inference."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
