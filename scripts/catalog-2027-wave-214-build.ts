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

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-27T05-13-17-258Z";
const sourceId = "nenu-international-chinese-teachers-scholarship-spring-2027";
const expectedSha256 = "fb2654777cb4acf91432d56eec23ce54ed2e62a9eeb78eb45d794b88e7028d7e";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Northeast Normal University March 2027 scholarship source.");
const evidence = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(evidence).digest("hex") !== expectedSha256) throw new Error("NENU evidence hash mismatch.");
const visibleText = evidence.toString("utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();
for (const fragment of [
  "2027年3月入学",
  "资助期限为5个月",
  "HSK(四级)180分",
  "2026年10月20日",
  "2026年10月31日",
  "2500元人民币/月",
  "一学期研修生为400元人民币/人",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected NENU evidence fragment missing: ${fragment}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-119.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "changchun");
const baseSchool = prior.schools?.find((row) => row.slug === "northeast-normal-university");
if (!city || !baseSchool) throw new Error("Wave 119 Northeast Normal University dependencies are missing.");
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const school = {
  ...baseSchool,
  applicationLevel: "Master and doctoral routes remain documented by the closed 2026 cycle. A separate non-degree one-semester scholarship route is explicitly published for March 2027 entry.",
  languageOfInstruction: "Chinese for the March 2027 International Chinese Language Teachers Scholarship route; Chinese and English remain documented for the older graduate catalog.",
  languageRequirement: "The March 2027 one-semester scholarship route requires HSK Level 4 with at least 180 and an HSKK result. Older degree-route requirements remain scoped to the closed 2026 cycle.",
  hskRequirement: "HSK Level 4 score 180 or above plus an HSKK result for the March 2027 one-semester route.",
  deadlineSummary: "For March 2027 entry, the required NENU application closed October 20, 2026 and the scholarship portal closes October 31, 2026. General Fall 2027 degree deadlines remain unpublished.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "March 2027 one-semester Chinese-language scholarship route"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official March 2027 one-semester scholarship category plus preserved older degree scope",
    languageOfInstruction: "official scholarship direction and Chinese-language test requirements",
    languageRequirement: "official HSK and HSKK eligibility",
    hskRequirement: "official scholarship eligibility",
    deadlineSummary: "official two-stage applicant deadlines with explicit general-degree limitation",
    admissionsUrl: "registered official NENU scholarship notice",
    campusHighlights: "official March 2027 route",
  },
};

const program: CatalogSeedProgram = {
  slug: "northeast-normal-university-international-chinese-language-teachers-one-semester-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship One-semester Study - Spring 2027",
  nameZh: "东北师范大学国际中文教师奖学金一学期研修项目（2027年3月入学）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language and culture",
  subjectArea: "International Chinese Language Education; Chinese Language and Literature; Chinese History; Chinese Philosophy",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 4 score 180 or above and an HSKK result.",
  tuitionText: "Tuition is fully covered by the scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "Full tuition, free double-room accommodation or an approved CNY 700/month off-campus allowance, CNY 2,500/month living allowance, and CNY 400 one-semester medical insurance.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Applicants had to complete the NENU system by October 20, 2026 and the International Chinese Language Teachers Scholarship portal by October 31, 2026. The first required step had already closed at source capture, so the route is not presented as open to new applicants.",
  hasScholarship: true,
  badgeText: "March 2027 scholarship route",
  displaySubjects: ["International Chinese Language Education", "Chinese Language and Literature", "Chinese History", "Chinese Philosophy"],
  displayGroup: "Non-degree",
  displayGroupLabel: "One-semester scholarship programs",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official scholarship category, duration and entry month",
    nameZh: "official notice title",
    degreeLevel: "official one-semester non-degree study category",
    durationMonths: "official five-month funding period",
    fieldCategory: "CUAC grouping of the four official study directions",
    subjectArea: "official four study directions",
    teachingLanguage: "official Chinese proficiency requirements and program scope",
    hskRequirement: "official scholarship eligibility",
    tuitionText: "official tuition coverage; self-funded amount absent",
    scholarshipText: "official funding appendix",
    applicationUrl: "registered official university notice",
    applicationNote: "official sequential application deadlines compared with capture time",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-20T15:59:59.000Z",
  deadlineLabel: "NENU system: October 20, 2026; scholarship portal: October 31, 2026 (Beijing Time). Both submissions were required.",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship one-semester study",
  status: "closed",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official March 2027 entry",
    intakeYear: "official March 2027 entry",
    deadlineDate: "earliest mandatory applicant deadline converted from Beijing end-of-day",
    deadlineLabel: "official university-system and scholarship-portal deadlines",
    applicationRound: "official notice title and intake",
    status: "earliest mandatory applicant deadline compared with source capture time",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "northeast-normal-university-international-chinese-language-teachers-scholarship-spring-2027",
  schoolSlug: school.slug,
  title: "Northeast Normal University International Chinese Language Teachers Scholarship - Spring 2027 One-semester Study",
  nameZh: "东北师范大学国际中文教师奖学金一学期研修项目（2027年3月入学）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "教育部中外语言交流合作中心 / 东北师范大学",
  providerNameEn: "Center for Language Education and Cooperation / Northeast Normal University",
  providerLocation: "Changchun, Jilin, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance for five months.",
  applicableDegree: "Non-degree one-semester study",
  applicableProgram: "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy, entering March 2027.",
  amountText: "CNY 2,500/month living allowance; free double room or approved CNY 700/month off-campus accommodation allowance; CNY 400 medical insurance for the semester.",
  requirementText: "Non-Chinese citizen, age 16-35 as of September 1, 2026 (up to 45 for in-service Chinese teachers), in good physical and mental health, committed to Chinese-language education or related work, with HSK Level 4 score 180 or above and an HSKK result. The same scholarship category generally does not admit applicants funded under it within the previous three years.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "Free double room or approved CNY 700/month off-campus allowance" },
    { label: "Living allowance", included: true, note: "CNY 2,500/month" },
    { label: "Medical insurance", included: true, note: "CNY 400 for one semester" },
  ],
  eligibilityItems: [
    { label: "Age", value: "16-35 as of September 1, 2026; up to 45 for in-service Chinese teachers" },
    { label: "Language", value: "HSK Level 4 score 180 or above plus an HSKK result" },
    { label: "Study directions", value: "International Chinese Language Education, Chinese Language and Literature, Chinese History, or Chinese Philosophy" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Passport photo page" },
    { label: "Language", value: "Valid HSK and HSKK score reports" },
    { label: "Recommendation", value: "Recommendation letter from the recommending institution" },
    { label: "Health", value: "Foreigner Physical Examination Form completed as required" },
    { label: "Conduct", value: "Valid non-criminal record, normally issued within six months before submission" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Complete the Northeast Normal University international student application by October 20, 2026" },
    { label: "Step 2", value: "Complete the International Chinese Language Teachers Scholarship application by October 31, 2026" },
    { label: "Step 3", value: "Complete university review and interview if invited; final award decisions are made through centralized expert review" },
  ],
  actionLinks: [{ label: "Official NENU scholarship notice", url: source.finalUrl ?? source.url, kind: "official-source" }],
  deadlineDate: "2026-10-20",
  deadlineLabel: "NENU application closed October 20, 2026; scholarship application closed October 31, 2026.",
  applicationRound: "March 2027 one-semester study",
  summary: "Five-month full scholarship for four named Chinese-language and culture study directions at Northeast Normal University.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official notice title",
    typeLabel: "official scholarship name",
    coverage: "official funding appendix",
    applicableDegree: "official one-semester study category",
    applicableProgram: "official study directions and entry month",
    amountText: "official funding appendix",
    requirementText: "official eligibility and miscellaneous conditions",
    benefitItems: "official funding appendix",
    eligibilityItems: "official eligibility section",
    applicationMaterials: "official materials appendix; personal contact details excluded",
    applicationSteps: "official application process; personal contact details excluded",
    actionLinks: "registered official university source",
    deadlineDate: "earliest mandatory applicant deadline",
    deadlineLabel: "official sequential applicant deadlines",
    applicationRound: "official entry month and category",
    summary: "official route scope, duration and funding",
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
if (!validation.ok) throw new Error(`Wave 214 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 48, schoolSlugs: [school.slug], newSchools: 0, programs: 1, programIntakes: 1, scholarships: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "This is a non-degree scholarship route and does not establish general Fall 2027 bachelor's, master's or doctoral admissions.",
    "The NENU application deadline preceded the scholarship-portal deadline and had passed at capture time; the route is marked closed to new applicants.",
    "The notice publishes no self-funded tuition amount and no exact registration date; those fields remain absent.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Staff names, telephone numbers, email addresses and applicant identifiers are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-214");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 214, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
