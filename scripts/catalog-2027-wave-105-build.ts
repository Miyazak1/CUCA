import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T04-03-46-001Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { generatedAt: string; sources: ManifestSource[] };
const sourceId = "imu-international-chinese-language-teachers-scholarship-spring-2027";
const expectedSha256 = "f377315f738cdedf7126b18a74791eb5d991aa1d4952958124f05f76d8dcdf60";
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error(`Missing locked official evidence ${sourceId} at ${expectedSha256}.`);
const artifact = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== expectedSha256) throw new Error(`Evidence hash mismatch: ${sourceId}.`);
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "inner-mongolia-university";
const citySlug = "hohhot";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Inner Mongolia University is already present in the 100-school base.");
if (dependency.cities?.some((row) => row.slug === citySlug)) throw new Error("Hohhot is already present in the 100-school base; remove the new city record before rebuilding.");

const city = {
  slug: citySlug,
  nameEn: "Hohhot",
  nameZh: "呼和浩特",
  province: "Inner Mongolia Autonomous Region",
  region: "North China",
  tags: ["Inner Mongolia", "regional-capital"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official scholarship guide contact address; standardized English city name",
    nameZh: "official scholarship guide contact address",
    province: "official scholarship guide contact address",
    region: "CUAC geographic taxonomy derived from the verified provincial location",
    tags: "CUAC geographic classification",
  },
};

const school = {
  slug: schoolSlug,
  nameEn: "Inner Mongolia University",
  nameZh: "内蒙古大学",
  citySlug,
  schoolType: "Public university",
  region: "Hohhot, Inner Mongolia, North China",
  applicationLevel: "One-semester non-degree study; other levels are not established by this source",
  languageOfInstruction: "Chinese",
  languageRequirement: "Spring 2027 one-semester routes in International Chinese Education, Chinese Language and Literature, Chinese History and Chinese Philosophy require HSK Level 3 score 180 plus an HSKK result. Traditional Chinese Medicine and Taiji Culture require an HSK result; HSKK is preferred.",
  hskRequirement: "HSK Level 3 score 180 plus HSKK for the published language and humanities directions; an HSK result for Traditional Chinese Medicine and Taiji Culture, with HSKK preferred.",
  deadlineSummary: "Spring 2027 scholarship applications close October 31, 2026 (Beijing Time).",
  tuitionSummary: "The Spring 2027 full scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance; the source does not publish monetary amounts.",
  websiteUrl: "https://iec.imu.edu.cn/",
  admissionsUrl: sourceFields.sourceUrl,
  subjectTags: ["International Chinese Education", "Chinese Language and Literature", "Chinese History", "Chinese Philosophy", "Traditional Chinese Medicine", "Taiji Culture"],
  languageTags: ["Chinese", "HSK 3", "HSKK"],
  campusHighlights: ["Spring 2027 one-semester scholarship route", "International Education College in Hohhot"],
  contactNotes: "International Education College, Inner Mongolia University North Campus, 235 Daxue West Road, Saihan District, Hohhot; iec@imu.edu.cn; +86-471-4994983.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official scholarship guide host identity; standardized English university name",
    nameZh: "official scholarship guide title and accepting-institution instructions",
    citySlug: "official scholarship guide contact address",
    schoolType: "official institutional identity",
    region: "official contact address plus CUAC geographic taxonomy",
    applicationLevel: "official scholarship guide, one-semester study category",
    languageOfInstruction: "official program directions and HSK/HSKK requirements",
    languageRequirement: "official scholarship guide, admission categories and conditions",
    hskRequirement: "official scholarship guide, admission categories and conditions",
    deadlineSummary: "official scholarship guide, application period",
    tuitionSummary: "official scholarship guide, scholarship coverage",
    admissionsUrl: "captured official scholarship guide",
    subjectTags: "official scholarship guide, one-semester study directions",
    contactNotes: "official scholarship guide contact section",
  },
};

const programSlug = `${schoolSlug}-one-semester-chinese-and-culture`;
const program = {
  slug: programSlug,
  schoolSlug,
  citySlug,
  nameEn: "One-semester Chinese Language, Education and Culture Study",
  nameZh: "一学期研修生",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Language and Culture",
  subjectArea: "International Chinese Education; Chinese Language and Literature; Chinese History; Chinese Philosophy; Traditional Chinese Medicine; Taiji Culture",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 plus HSKK for International Chinese Education, Chinese Language and Literature, Chinese History and Chinese Philosophy. Traditional Chinese Medicine and Taiji Culture require an HSK result; HSKK is preferred.",
  tuitionText: "Tuition is covered for scholarship recipients; a self-funded tuition amount is not published in the captured source.",
  scholarshipText: "The International Chinese Language Teachers Scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance. Monetary amounts are not published in this source.",
  applicationUrl: "https://www.chinese.cn",
  applicationNote: "Apply through the International Chinese Language Teachers Scholarship section, select a recommending institution and choose Inner Mongolia University as the host institution.",
  hasScholarship: true,
  badgeText: "Spring 2027",
  displayTuition: "Full scholarship route",
  displaySubjects: ["Chinese Education", "Chinese Literature", "Chinese History", "Chinese Philosophy", "Traditional Chinese Medicine", "Taiji Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "translated from the official one-semester study category and listed directions",
    nameZh: "official scholarship guide category",
    degreeLevel: "official one-semester non-degree study category",
    durationMonths: "official scholarship guide, five-month funding duration",
    subjectArea: "official scholarship guide, one-semester directions",
    teachingLanguage: "official Chinese-language study scope and HSK/HSKK conditions",
    hskRequirement: "official scholarship guide, one-semester admission conditions",
    tuitionText: "official scholarship coverage; self-funded fee is not stated",
    scholarshipText: "official scholarship guide, scholarship coverage",
    applicationUrl: "official scholarship guide, application process",
    applicationNote: "official scholarship guide, application process",
  },
};

const programIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "Spring 2027 applications close October 31, 2026 (Beijing Time); the five-month route begins in March 2027.",
  applicationRound: "Inner Mongolia University Spring 2027 International Chinese Language Teachers Scholarship",
  status: "open" as const,
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official scholarship guide, March 2027 entry",
    intakeYear: "official scholarship guide, March 2027 entry",
    deadlineDate: "official scholarship guide, application period; converted from Beijing end-of-day",
    deadlineLabel: "official scholarship guide, application period and study category",
    applicationRound: "official scholarship guide scope",
  },
};

const scholarship = {
  slug: `${schoolSlug}-international-chinese-language-teachers-spring-2027`,
  schoolSlug,
  programSlug,
  title: "Inner Mongolia University International Chinese Language Teachers Scholarship — Spring 2027",
  nameZh: "内蒙古大学国际中文教师奖学金（2027年春季学期）",
  type: "government",
  typeLabel: "International Chinese Language Teachers Scholarship",
  providerName: "中外语言交流合作中心 / 内蒙古大学",
  providerNameEn: "Center for Language Education and Cooperation / Inner Mongolia University",
  providerLocation: "Hohhot, Inner Mongolia, China",
  fundingLevel: "Full scholarship",
  coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance. The captured university guide does not state monetary amounts.",
  applicableDegree: "One-semester non-degree study",
  applicableProgram: "International Chinese Education, Chinese Language and Literature, Chinese History, Chinese Philosophy, Traditional Chinese Medicine and Taiji Culture directions published for March 2027 entry.",
  amountText: "Full scholarship coverage is stated; stipend, accommodation and insurance amounts are not published in this source.",
  requirementText: "Applicants must be non-Chinese citizens, friendly to China, have no criminal record, be in good physical and mental health, demonstrate good academic conduct, intend to work in Chinese education or related fields, and normally be age 16-35 as of September 1, 2026 (up to 45 for in-service Chinese teachers). Direction-specific HSK/HSKK rules apply.",
  benefitItems: [
    { label: "Tuition", included: true, note: "Covered; amount not stated" },
    { label: "Accommodation", included: true, note: "Covered; arrangement and amount not stated" },
    { label: "Living allowance", included: true, note: "Covered; amount not stated" },
    { label: "Medical insurance", included: true, note: "Comprehensive medical insurance covered; amount not stated" },
  ],
  eligibilityItems: [
    { label: "Nationality", value: "Non-Chinese citizen" },
    { label: "Age", value: "16-35 as of September 1, 2026; up to 45 for in-service Chinese teachers" },
    { label: "Conduct and health", value: "Friendly to China, no criminal record, observes applicable rules, physically and mentally healthy, and demonstrates good academic conduct" },
    { label: "Language and humanities directions", value: "HSK Level 3 score 180 plus an HSKK result" },
    { label: "Traditional Chinese Medicine / Taiji Culture", value: "HSK result required; HSKK preferred" },
  ],
  applicationMaterials: [
    { label: "Identity", value: "Valid passport photo-page scan" },
    { label: "Language", value: "HSK and HSKK score reports valid for two years, as applicable" },
    { label: "Recommendation", value: "Recommendation letter from the head of the recommending institution" },
    { label: "Education", value: "Notarized highest diploma (or expected-graduation certificate) and academic transcript" },
    { label: "Employment", value: "Employment certificate and recommendation letter for in-service Chinese teachers" },
    { label: "Conduct", value: "Criminal-record certificate issued within six months before application" },
    { label: "Minor applicant", value: "China guardian authorization documents for applicants under 18" },
  ],
  applicationSteps: [
    { label: "Step 1", value: "Open the International Chinese Language Teachers Scholarship section at chinese.cn" },
    { label: "Step 2", value: "Select a recommending institution and Inner Mongolia University as the host institution" },
    { label: "Step 3", value: "Upload the required materials and follow application, review and award status online" },
    { label: "Step 4", value: "Submit by October 31, 2026 (Beijing Time) and, if awarded, confirm enrollment formalities with the university" },
  ],
  actionLinks: [{ label: "Official scholarship guide", url: sourceFields.sourceUrl, kind: "official-source" }],
  deadlineDate: "2026-10-31",
  deadlineLabel: "Spring 2027 scholarship applications close October 31, 2026 (Beijing Time).",
  applicationRound: "Spring 2027 one-semester study",
  summary: "Five-month Spring 2027 full scholarship at Inner Mongolia University for eligible Chinese education, humanities, Chinese medicine and Taiji culture study directions.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    title: "official guide title and explicit March 2027 route",
    coverage: "official scholarship guide, scholarship coverage",
    applicableDegree: "official guide, one-semester study category",
    applicableProgram: "official guide, one-semester study directions",
    amountText: "official guide states coverage but no monetary amounts",
    requirementText: "official guide, target applicants and admission conditions",
    benefitItems: "official guide, scholarship coverage",
    eligibilityItems: "official guide, target applicants and admission conditions",
    applicationMaterials: "official guide, application material list",
    applicationSteps: "official guide, application process",
    deadlineDate: "official guide, application period",
    applicationRound: "official guide, March 2027 entry",
    summary: "official guide scope, duration and coverage",
  },
};

const generatedAt = source.fetchedAt ?? manifest.generatedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [programIntake],
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 105 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newCities: 1, newSchools: 1, programs: 1, programIntakes: 1, scholarships: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The captured official source establishes only the Spring 2027 five-month scholarship route. General 2027 undergraduate, master's, doctoral and self-funded admissions remain unresolved and are left blank.",
    "The guide states that tuition, accommodation, living allowance and comprehensive medical insurance are covered, but it does not publish monetary amounts; no amounts are inferred.",
    "The official Northeastern University page exposes explicit Spring 2027 Chinese-language information in indexed content, but deterministic collection fails ERR_TLS_CERT_ALTNAME_INVALID because studyinneu.neu.edu.cn serves a certificate for *.17gz.org. No TLS bypass is used and no candidate is built without a hash-locked snapshot.",
    "China University of Petroleum (Beijing) was rechecked; its current inbound degree guides remain for 2026, and a 2026/2027 result page does not establish a new 2027 intake. No 2026 field is relabeled as 2027.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-105");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 105, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
