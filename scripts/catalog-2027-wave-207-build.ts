import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  byteLength: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-27T03-13-12-364Z";
const sourceId = "snnu-international-chinese-language-teachers-scholarship-march-2027";
const expectedSha256 = "44563b4343e0d702cc8d651fe1206087279104ba4f36195fe986fe3b31365119";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked SNNU March 2027 scholarship source.");
const evidence = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(evidence).digest("hex") !== expectedSha256) throw new Error("SNNU evidence hash mismatch.");
const visibleText = evidence.toString("utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();
for (const fragment of [
  "One-Semester Study Program",
  "The program commences either in September 2026 or March 2027",
  "before 31 October, 2026",
  "minimum score of 180 on the HSK test (Level 3)",
  "an HSKK test score is required",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected SNNU evidence fragment missing: ${fragment}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-128.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "xian");
const baseSchool = prior.schools?.find((row) => row.slug === "shaanxi-normal-university");
if (!city || !baseSchool) throw new Error("Wave 128 SNNU dependencies are missing.");
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const school = {
  ...baseSchool,
  applicationLevel: "The official scholarship guide publishes a non-degree one-semester Chinese-language route for March 2027. General Fall 2027 degree admissions remain unpublished.",
  deadlineSummary: "The March 2027 one-semester International Chinese Language Teachers Scholarship route closes October 31, 2026 Beijing Time. General 2027 degree deadlines remain unresolved.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "March 2027 one-semester Chinese-language scholarship route"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official one-semester scholarship category and March 2027 start",
    deadlineSummary: "official March 2027 application deadline",
    admissionsUrl: "registered official SNNU scholarship guide",
    campusHighlights: "official March 2027 scholarship route",
  },
};

const program: CatalogSeedProgram = {
  slug: "shaanxi-normal-university-iclts-one-semester-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship - One-Semester Study Program (Spring 2027)",
  nameZh: "陕西师范大学国际中文教师奖学金一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 or above, plus an HSKK score.",
  scholarshipText: "International Chinese Language Teachers Scholarship route. The SNNU page does not publish monetary benefit amounts, so financial coverage remains unresolved.",
  applicationUrl: "https://snnu.17gz.org/member/login.do",
  applicationNote: "Applicants must submit in both the International Chinese Language Teachers Scholarship system and the SNNU application system, upload the published documents, and follow the host institution review process.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["International Chinese Language Education", "Chinese Language and Literature", "Chinese History", "Chinese Philosophy"],
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese-language scholarship programs",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official scholarship category and March 2027 start",
    nameZh: "Chinese rendering of the official English route title; pending editorial review",
    degreeLevel: "official one-semester study category",
    durationMonths: "official maximum five-month scholarship duration",
    subjectArea: "official one-semester eligible fields",
    teachingLanguage: "official HSK/HSKK route requirements",
    hskRequirement: "official one-semester eligibility section",
    scholarshipText: "official scholarship identity; source publishes no monetary coverage",
    applicationUrl: "official SNNU application-system link",
    applicationNote: "official application procedure",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "October 31, 2026 (Beijing Time)",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship - one-semester study",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official March 2027 start",
    intakeYear: "official March 2027 start",
    deadlineDate: "official October 31, 2026 applicant deadline converted from Beijing end-of-day",
    deadlineLabel: "official application-deadline section",
    applicationRound: "official scholarship category and start month",
    status: "deadline compared with source capture time",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "shaanxi-normal-university-iclts-one-semester-spring-2027",
  title: "Shaanxi Normal University International Chinese Language Teachers Scholarship - Spring 2027",
  nameZh: "陕西师范大学国际中文教师奖学金一学期研修项目（2027年春季）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心 / 陕西师范大学",
  providerNameEn: "Center for Language Education and Cooperation / Shaanxi Normal University",
  providerLocation: "Xi'an, Shaanxi, China",
  schoolSlug: school.slug,
  programSlug: program.slug,
  fundingLevel: "Scholarship",
  coverage: "The official SNNU page does not publish monetary benefit amounts; coverage remains unresolved.",
  applicableDegree: "Non-degree / One-semester study",
  applicableProgram: "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy.",
  requirementText: "Applicants must be non-Chinese citizens, normally aged 16-35, meet the published conduct and health conditions, hold HSK Level 3 score 180 or above, and provide an HSKK score.",
  applicationMaterials: [
    { label: "Passport", value: "Passport photo-page scan" },
    { label: "Language results", value: "Valid HSK and HSKK score reports" },
    { label: "Recommendation", value: "Reference letter from the head of the recommending institution" },
    { label: "Health", value: "Foreigner Physical Examination Form" },
    { label: "Conduct", value: "Non-criminal record with Chinese translation and notarization where required" },
  ],
  applicationSteps: [
    { label: "Step 1", body: "Submit in the International Chinese Language Teachers Scholarship system." },
    { label: "Step 2", body: "Submit separately in the SNNU international application system." },
    { label: "Step 3", body: "Track recommending-institution and host-institution review results." },
  ],
  actionLinks: [{ label: "Official SNNU guide", url: source.finalUrl ?? source.url, kind: "official-source" }],
  deadlineDate: "2026-10-31",
  deadlineLabel: "Applicant deadline: October 31, 2026 (Beijing Time); institutional review deadline: November 10, 2026.",
  applicationRound: "March 2027 one-semester study",
  summary: "SNNU one-semester Chinese-language scholarship route beginning in March 2027, with a maximum duration of five months.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official scholarship title and March 2027 start",
    fundingLevel: "official scholarship identity; monetary level not published",
    coverage: "official-source limitation",
    applicableDegree: "official one-semester category",
    applicableProgram: "official eligible fields",
    requirementText: "official eligibility and one-semester qualification sections",
    applicationMaterials: "official application-documents section",
    applicationSteps: "official application procedure",
    deadlineDate: "official applicant deadline",
    deadlineLabel: "official applicant and review deadlines",
    applicationRound: "official March 2027 route",
    summary: "official category, start month, and duration",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 64, schoolSlugs: [school.slug], newSchools: 0, programs: 1, programIntakes: 1, scholarships: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, byteLength: source.byteLength, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The source establishes only the March 2027 one-semester scholarship route, not general Fall 2027 degree admissions.",
    "The SNNU page does not publish monetary scholarship coverage, self-funded tuition, or accommodation amounts; those fields remain unresolved.",
    "The Chinese route title is a translation of the official English title and requires editorial review before publication.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Named contacts, personal email addresses, telephone numbers, and applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-207");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 207, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
