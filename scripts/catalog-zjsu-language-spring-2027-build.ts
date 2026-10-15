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
const run = "work/catalog-official/2026-10-15T05-19-20-347Z";
const candidatePath = resolve(root, "seeds/catalog.zjsu-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.zjsu-language-spring-2027.validation.json");
const programSlug = "zhejiang-gongshang-university-iclts-chinese-language-study-spring-2027";
type Source = { id: string; label: string; url: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const manifest = await json<Manifest>(`${run}/manifest.json`);
const source = manifest.sources.find((row) => row.id === "zjsu-international-chinese-language-teachers-scholarship-2026");
const expectedSha256 = "6471a83e0a0192fdfd7f9a8d0c32e4d20c6a74e293c30615facffed2ebf0fc6d";
if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
  throw new Error("Zhejiang Gongshang University Spring 2027 language evidence mismatch.");
}
const bytes = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error("Zhejiang Gongshang University evidence artifact hash mismatch.");
const visibleText = bytes.toString("utf8").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
for (const pattern of [
  /The program commences either in September 2026 or March 2027/,
  /minimum score of 180 on the HSK test \(Level 3\) and an HSKK test score/,
  /For programs commencing in March 2027\s*:\s*October 31\s*st\s*,\s*2026/,
  /complete the online application simultaneously on the International Chinese Language Teachers Scholarship website and the Application System for International Students of Zhejiang Gongshang University/,
  /Remittance receipt of the application fee/,
]) if (!pattern.test(visibleText)) throw new Error(`Expected Zhejiang Gongshang University evidence pattern missing: ${pattern}`);

const dependency = await json<Dependency>("seeds/catalog.zjsu-safe-new-batch-01.approved.local.json");
const city = dependency.cities.find((row) => row.slug === "hangzhou");
const schoolBase = dependency.schools.find((row) => row.slug === "zhejiang-gongshang-university");
if (!city || !schoolBase) throw new Error("Hangzhou city or clean official Zhejiang Gongshang University school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed International Chinese Language Teachers Scholarship one-semester route for March 2027 closes October 31, 2026 Beijing Time; other route deadlines are separate.",
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${source.id}: Categories and Qualifications include a March 2027 one-semester non-degree route`,
    deadlineSummary: `${source.id}: Online Submission Deadline, March 2027 entry`,
  },
};
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — Chinese Language Study, One-Semester Program (Spring 2027)",
  nameZh: "国际中文教师奖学金汉语研修方向一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "Chinese Language Study",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 and an HSKK score are required.",
  scholarshipText: "The official ZJSU guide states that the scholarship covers tuition, accommodation, living expenses and comprehensive medical insurance; it refers applicants elsewhere for monetary standards.",
  applicationUrl: source.url,
  applicationNote: "Complete applications simultaneously in the International Chinese Language Teachers Scholarship system and the Zhejiang Gongshang University international-student application system before the deadline.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language"],
  displayGroup: "zjsu-non-degree-chinese-language",
  displayGroupLabel: "ZJSU Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${source.id}: Categories and Qualifications, one-semester Chinese-language study route`,
    nameZh: `${source.id}: official route description with March 2027 intake qualifier`,
    degreeLevel: `${source.id}: one-semester study route with five-month duration`,
    durationMonths: `${source.id}: Categories and Qualifications, item 3`,
    subjectArea: `${source.id}: Chinese language study program`,
    teachingLanguage: `${source.id}: HSK and HSKK entry conditions`,
    hskRequirement: `${source.id}: Categories and Qualifications, item 3(1)`,
    scholarshipText: `${source.id}: Funding Content and Standards`,
    applicationUrl: `${source.id}: Application Procedures`,
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (Beijing Time)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester Chinese-language study",
  status: "open",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "Categories and Qualifications, item 3: March 2027 entry",
    intakeYear: "Categories and Qualifications, item 3: March 2027 entry",
    deadlineDate: "Online Submission Deadline item 2: October 31, 2026 for March 2027 entry, Beijing Time",
    status: "derived: deadline is after the 2026-10-15 capture date",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid Zhejiang Gongshang University Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity, Spring 2027 availability, explicit deadline, language thresholds, dual-system procedure, application materials and coverage categories from the registered official ZJSU guide",
    changeReview: {
      priorSha256: "77edca771d2f4ca7c48457c91da63afb6cd2f80992bc47a0cc4986ff5b89be09",
      currentSha256: source.sha256,
      visibleTextEqual: true,
      disposition: "HTML snapshot changed, but normalized visible text remained identical at 7,263 characters.",
    },
    unresolved: [
      "The official page lists covered benefit categories but does not state their monetary amounts.",
      "The official page requires an application-fee remittance receipt but does not state the fee amount.",
    ],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
