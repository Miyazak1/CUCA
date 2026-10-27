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
const run = "2026-10-27T05-21-46-781Z";
const sourceId = "nuist-international-chinese-language-teachers-scholarship-spring-2027";
const expectedSha256 = "b23a9a509936bc1f13d3364b349bf4576ef98cf6784c5511b54d45817472139f";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked NUIST March 2027 scholarship source.");
const evidence = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(evidence).digest("hex") !== expectedSha256) throw new Error("NUIST evidence hash mismatch.");
const visibleText = evidence.toString("utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();
for (const fragment of [
  "2026 International Chinese Language Teachers",
  "September 2026 or March 2027",
  "scholarship duration of up to 5 months",
  "at least 180 on the HSK (Level 3)",
  "tuition fee, accommodation fee, living allowance",
  "October 25",
  "programs commencing in March 2026",
]) if (!visibleText.includes(fragment)) throw new Error(`Expected NUIST evidence fragment missing: ${fragment}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-151.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanjing");
const baseSchool = prior.schools?.find((row) => row.slug === "nanjing-university-of-information-science-and-technology");
if (!city || !baseSchool) throw new Error("Wave 151 NUIST dependencies are missing.");
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const school = {
  ...baseSchool,
  applicationLevel: "The captured 2027 undergraduate catalog publishes 61 four-year September-entry routes. A separate official scholarship page publishes a five-month non-degree one-semester route for March 2027.",
  languageRequirement: "The March 2027 one-semester scholarship route requires HSK Level 3 with at least 180 and an HSKK score. Undergraduate route requirements remain scoped to the separately captured 2027 catalog.",
  hskRequirement: "March 2027 one-semester scholarship route: HSK Level 3 score 180 or above plus an HSKK score.",
  deadlineSummary: "University scholarship and self-sponsored undergraduate applications close April 30, 2027, or earlier if capacity is reached. The scholarship page labels its October 25 deadline as applying to March 2026 despite publishing a March 2027 category, so no March 2027 scholarship deadline is normalized.",
  admissionsUrl: source.finalUrl ?? source.url,
  campusHighlights: [...new Set([...(baseSchool.campusHighlights ?? []), "March 2027 one-semester Chinese-language scholarship route"])],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official March 2027 one-semester scholarship category plus preserved 2027 undergraduate scope",
    languageRequirement: "official HSK and HSKK eligibility",
    hskRequirement: "official scholarship eligibility",
    deadlineSummary: "official undergraduate deadline plus documented scholarship-page date conflict",
    admissionsUrl: "registered official NUIST scholarship page",
    campusHighlights: "official March 2027 route",
  },
};

const program: CatalogSeedProgram = {
  slug: "nanjing-university-of-information-science-and-technology-international-chinese-language-teachers-one-semester-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship One-semester Study - Spring 2027",
  nameZh: "南京信息工程大学国际中文教师奖学金一学期研修项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese language and culture",
  subjectArea: "International Chinese Language Education; Chinese Language and Literature",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 or above and an HSKK score.",
  tuitionText: "Tuition is covered by the scholarship; no self-funded tuition amount is published for this route.",
  scholarshipText: "The scholarship page states that in-person programs cover tuition, accommodation, living allowance and comprehensive medical insurance; it does not publish numeric allowance standards on this page.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official page publishes March 2027 entry but labels its October 25 deadline as applying to March 2026. CUAC therefore leaves the March 2027 deadline and application status unresolved instead of correcting the source by inference.",
  hasScholarship: true,
  badgeText: "March 2027 scholarship route",
  displaySubjects: ["International Chinese Language Education", "Chinese Language and Literature"],
  displayGroup: "Non-degree",
  displayGroupLabel: "One-semester scholarship programs",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official scholarship category, duration and entry month",
    nameZh: "official host institution and scholarship category",
    degreeLevel: "official one-semester study category",
    durationMonths: "official five-month funding period",
    fieldCategory: "CUAC grouping of the official study directions",
    subjectArea: "official one-semester directions",
    teachingLanguage: "official Chinese proficiency requirements and program scope",
    hskRequirement: "official scholarship eligibility",
    tuitionText: "official tuition coverage; self-funded amount absent",
    scholarshipText: "official scholarship coverage section; numeric standards absent",
    applicationUrl: "registered official university page",
    applicationNote: "documented source conflict; no inferred deadline",
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineLabel: "The official page states October 25 for programs commencing in March 2026, which conflicts with its March 2027 route; the March 2027 deadline is unresolved.",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship one-semester study",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official March 2027 entry",
    intakeYear: "official March 2027 entry",
    deadlineLabel: "official page conflict retained verbatim in normalized explanation",
    applicationRound: "official scholarship category and entry month",
  },
};

const scholarship: CatalogSeedScholarship = {
  slug: "nanjing-university-of-information-science-and-technology-international-chinese-language-teachers-scholarship-spring-2027",
  schoolSlug: school.slug,
  programSlug: program.slug,
  title: "NUIST International Chinese Language Teachers Scholarship - Spring 2027 One-semester Study",
  nameZh: "南京信息工程大学国际中文教师奖学金一学期研修项目（2027年春季）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "教育部中外语言交流合作中心 / 南京信息工程大学",
  providerNameEn: "Center for Language Education and Cooperation / Nanjing University of Information Science & Technology",
  providerLocation: "Nanjing, Jiangsu, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance for up to five months.",
  applicableDegree: "Non-degree one-semester study",
  applicableProgram: "International Chinese Language Education or Chinese Language and Literature, entering March 2027.",
  amountText: "The official page does not publish numeric allowance or accommodation standards.",
  requirementText: "Non-Chinese citizen, age 16-35 as of September 1, 2026 (up to 45 for in-service Chinese teachers), in good physical and mental health, committed to Chinese-language education or related work, with HSK Level 3 score 180 or above and an HSKK score.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered" },
    { label: "Accommodation", included: true, note: "Covered; room or cash standard not stated" },
    { label: "Living allowance", included: true, note: "Covered; amount not stated" },
    { label: "Medical insurance", included: true, note: "Covered; amount not stated" },
  ],
  eligibilityItems: [
    { label: "Age", value: "16-35 as of September 1, 2026; up to 45 for in-service Chinese teachers" },
    { label: "Language", value: "HSK Level 3 score 180 or above plus an HSKK score" },
    { label: "Study directions", value: "International Chinese Language Education or Chinese Language and Literature" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Passport photo page" },
    { label: "Language", value: "Valid HSK and HSKK score reports" },
    { label: "Recommendation", value: "Recommendation letter from the recommending institution" },
    { label: "Education", value: "Highest diploma or expected-graduation proof and official transcript" },
    { label: "Health", value: "Foreigner Physical Examination Form valid for six months" },
  ],
  applicationSteps: [
    { label: "Application", value: "Apply through the International Chinese Language Teachers Scholarship platform and follow the host institution's enrollment instructions" },
    { label: "Review", value: "The host and recommending institutions review the application before centralized expert assessment" },
  ],
  actionLinks: [{ label: "Official NUIST scholarship page", url: source.finalUrl ?? source.url, kind: "official-source" }],
  deadlineLabel: "March 2027 deadline unresolved because the official page labels October 25 as the deadline for March 2026.",
  applicationRound: "March 2027 one-semester study",
  summary: "Five-month full scholarship for two published Chinese-language study directions at NUIST.",
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official scholarship name and entry month",
    typeLabel: "official scholarship name",
    coverage: "official scholarship coverage section",
    applicableDegree: "official one-semester study category",
    applicableProgram: "official study directions and entry month",
    amountText: "numeric standards absent from official page",
    requirementText: "official eligibility section",
    benefitItems: "official scholarship coverage section",
    eligibilityItems: "official eligibility section",
    applicationMaterials: "official materials section; personal contact details excluded",
    applicationSteps: "official application process; personal contact details excluded",
    actionLinks: "registered official university source",
    deadlineLabel: "documented source conflict; no inferred date",
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
if (!validation.ok) throw new Error(`Wave 215 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 98, schoolSlugs: [school.slug], newSchools: 0, programs: 1, programIntakes: 1, scholarships: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "This non-degree scholarship route does not establish general Fall 2027 graduate admissions.",
    "The source publishes March 2027 entry but labels its October 25 deadline as applying to March 2026. No deadline date or open/closed status is inferred.",
    "The source publishes no numeric living-allowance, accommodation or insurance amount and no exact registration date; those fields remain absent.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Staff names, telephone numbers, email addresses and applicant identifiers are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-215");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 215, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
