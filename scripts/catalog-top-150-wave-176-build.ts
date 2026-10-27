import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral" | "Non-degree";
type Spec = { name: string; degree: Degree; language: string; years?: number; months?: number };

const root = process.cwd();
const run = "2026-10-26T11-51-24-198Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["csust-international-admission-index-current", "ca18a96d7d22c24b7e764889a0998bdca7afcefc6f645331c5924b598c1add6a"],
  ["csust-international-guide-fall-2026", "12e7c661ab955ab2e08631bcac1c4b235d2ef5e780c8dac6c67a0b6e25aebf64"],
  ["csust-silk-road-cgs-2026-2027", "f08f49d4bf14143f212fa97e5ed3a18cd6993ec69803195ca72b4a93c8c0233f"],
  ["csust-international-chinese-language-teachers-scholarship-2026", "2f5e3ae1bb39b93d276a5a02bd0cd6f93077344645f4c621014edf18c1bd8bfb"],
  ["csust-chinese-plus-scholarship-2026", "8009cc8d7bfd83570e5d0d38ff021314911cac42831f55376032ed5d31240285"],
  ["csust-cgs-high-level-postgraduate-2026-2027", "b6b6992668ccaaef19224fd2c8b8a0f7181ca5c73b7cae7e977db8b855933052"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked CSUST source: ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`CSUST evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const index = sources.get("csust-international-admission-index-current")!;
const guide = sources.get("csust-international-guide-fall-2026")!;
const silkRoad = sources.get("csust-silk-road-cgs-2026-2027")!;
const languageScholarship = sources.get("csust-international-chinese-language-teachers-scholarship-2026")!;
const chinesePlus = sources.get("csust-chinese-plus-scholarship-2026")!;
const highLevel = sources.get("csust-cgs-high-level-postgraduate-2026-2027")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "changsha");
if (!city) throw new Error("Reviewed Changsha dependency missing");

const school = {
  slug: "changsha-university-of-science-and-technology",
  nameEn: "Changsha University of Science and Technology",
  nameZh: "长沙理工大学",
  citySlug: city.slug,
  schoolType: "Public science and engineering university",
  region: "Changsha, Hunan, Central China",
  applicationLevel: "The latest general international guide covers Chinese-language study and bachelor, master and doctoral routes for the closed Fall 2026 cycle. A separate scholarship guide explicitly includes five-month study beginning in March 2027.",
  languageOfInstruction: "Chinese, English, or Chinese/English according to the official route table.",
  languageRequirement: "Closed 2026: Chinese-taught bachelor routes require HSK 4 score 180; Chinese-taught master and doctoral routes require HSK 5 score 180. English-taught routes require TOEFL 68, IELTS 5.5 or Duolingo 85, with the published English-speaking or prior English-medium exemption.",
  hskRequirement: "Closed 2026: HSK 4 score 180 for Chinese-taught bachelor routes; HSK 5 score 180 for Chinese-taught master and doctoral routes.",
  englishRequirement: "Closed 2026: TOEFL 68, IELTS 5.5 or Duolingo 85, with the published English-speaking or prior English-medium exemption.",
  deadlineSummary: "The closed Fall 2026 guide accepted applications until places were filled and did not publish a calendar cutoff. The official scholarship guide explicitly includes March 2027 one-semester study, but prints a deadline after the stated intake; that conflicting date is not normalized.",
  tuitionSummary: "Closed 2026 annual tuition: Chinese-taught bachelor CNY 12,000; English-taught bachelor CNY 16,500; master CNY 19,000; doctoral CNY 23,500; Chinese-language study CNY 16,000.",
  applicationFee: "CNY 500, nonrefundable; annual registration fee CNY 500",
  websiteUrl: "https://www.csust.edu.cn/",
  admissionsUrl: index.finalUrl ?? index.url,
  cscaRequired: true,
  cscaRequirement: "Closed 2026 bachelor applicants were in principle required to submit a CSCA score report. The general guide does not publish route-level subjects; the 2026/2027 Silk Road scholarship specifies Mathematics and Physics for its New Energy Science and Engineering bachelor route.",
  subjectTags: ["Transportation Engineering", "Civil Engineering", "Hydraulic Engineering", "Energy", "Computer Science", "Food Science", "Design"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Closed 2026: CNY 12,000-23,500/year by level and teaching language",
  campusHighlights: ["Official 2026 guide lists 34 international routes", "Current scholarship pages cover degree and language-study awards", "Only the five-month March 2027 scholarship study route is explicitly tied to 2027"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: index.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official English guide title",
    nameZh: "official Chinese admissions index",
    citySlug: "official campus address plus reviewed Changsha dependency",
    schoolType: "official university identity plus CUAC taxonomy",
    region: "official campus address plus CUAC taxonomy",
    applicationLevel: "official Fall 2026 guide and explicit March 2027 scholarship category",
    languageOfInstruction: "official program table",
    languageRequirement: "official Fall 2026 eligibility",
    hskRequirement: "official Fall 2026 eligibility",
    englishRequirement: "official Fall 2026 eligibility",
    deadlineSummary: "official general and scholarship guide wording with conflict left unresolved",
    tuitionSummary: "official Fall 2026 fee table",
    applicationFee: "official Fall 2026 fee table",
    websiteUrl: "official university domain",
    admissionsUrl: "current official admissions index",
    cscaRequired: "official Fall 2026 guide",
    cscaRequirement: "official general guide and route-specific Silk Road scholarship guide",
    subjectTags: "official program table",
    languageTags: "official program table",
    tuitionBandLabel: "official Fall 2026 fee table",
    campusHighlights: "official current admissions index and guides",
  },
};

const specs: Spec[] = [{ name: "Chinese Language Study", degree: "Non-degree", language: "Chinese" }];
const add = (degree: Degree, language: string, years: number, names: string[]) => names.forEach((name) => specs.push({ name, degree, language, years }));
add("Bachelor", "Chinese/English", 4, ["International Economics and Trade", "Port, Waterway and Coastal Engineering", "Hydraulic and Hydroelectric Engineering"]);
add("Bachelor", "English", 4, ["New Energy Science and Engineering", "Road, Bridge and River-Crossing Engineering", "Traffic Engineering", "Computer Science and Technology", "Civil Engineering"]);
add("Bachelor", "Chinese", 4, ["Food Science and Engineering", "Bioengineering"]);
add("Bachelor", "Chinese", 5, ["Architecture"]);
add("Master", "Chinese", 3, ["Finance", "International Business", "Accounting", "MBA", "Food Science and Engineering", "Civil Engineering", "Communication and Media Design", "Spatial and Interaction Design", "Product and Service Design"]);
add("Master", "English", 3, ["Power Engineering and Engineering Thermophysics", "Transportation Engineering", "Software Engineering", "Hydraulic Engineering"]);
add("Master", "Chinese/English", 3, ["International Chinese Language Education", "Electronic Science and Technology", "Information and Communication Engineering", "Physics"]);
add("Doctoral", "Chinese", 5, ["Food Science and Engineering"]);
add("Doctoral", "Chinese", 5, ["Civil Engineering"]);
add("Doctoral", "Chinese/English", 4, ["Electronic Science and Technology", "Physics"]);
add("Doctoral", "English", 4, ["Hydraulic Engineering"]);

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const tuition = (item: Spec) => item.degree === "Non-degree"
  ? "Closed 2026 Chinese-language tuition: CNY 16,000/year; application fee CNY 500 and annual registration fee CNY 500."
  : item.degree === "Bachelor"
    ? item.language === "Chinese"
      ? "Closed 2026 Chinese-taught bachelor tuition: CNY 12,000/year; application fee CNY 500 and annual registration fee CNY 500."
      : item.language === "English"
        ? "Closed 2026 English-taught bachelor tuition: CNY 16,500/year; application fee CNY 500 and annual registration fee CNY 500."
        : "Closed 2026 bachelor fee bands: Chinese-taught CNY 12,000/year or English-taught CNY 16,500/year. The bilingual route is not assigned a single amount by the source; application fee CNY 500 and annual registration fee CNY 500."
    : item.degree === "Master"
      ? "Closed 2026 master tuition: CNY 19,000/year; application fee CNY 500 and annual registration fee CNY 500."
      : "Closed 2026 doctoral tuition: CNY 23,500/year; application fee CNY 500 and annual registration fee CNY 500.";

const programs: CatalogSeedProgram[] = specs.map((item, indexValue) => ({
  slug: `changsha-university-of-science-and-technology-${slugify(item.name)}-${item.degree.toLowerCase()}-${String(indexValue + 1).padStart(3, "0")}-2026`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: item.name,
  degreeLevel: item.degree,
  ...(item.years ? { durationYears: item.years } : {}),
  fieldCategory: item.degree === "Non-degree" ? "Chinese Language" : item.name,
  subjectArea: item.name,
  teachingLanguage: item.language,
  ...(item.degree === "Bachelor" ? { cscaRequirement: "Closed 2026 bachelor applicants were in principle required to submit a CSCA score report; route-level subjects are not published in the general guide." } : {}),
  ...(item.language.includes("Chinese") && item.degree !== "Non-degree" ? { hskRequirement: item.degree === "Bachelor" ? "HSK 4 score 180 or above." : "HSK 5 score 180 or above." } : {}),
  ...(item.language.includes("English") ? { englishRequirement: "TOEFL 68, IELTS 5.5 or Duolingo 85, with the published English-speaking or prior English-medium exemption." } : {}),
  tuitionText: tuition(item),
  applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: "Listed in the official Fall 2026 international guide. Applications were accepted until places were filled; this closed route is not relabeled as 2027.",
  hasScholarship: true,
  scholarshipText: "The official admissions and scholarship pages publish separate conditional, government and language-teacher awards; route-level eligibility must be checked against the relevant guide.",
  badgeText: "Closed Fall 2026 official route",
  displaySubjects: [item.name],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official Fall 2026 program table",
    degreeLevel: "official program grouping",
    ...(item.years ? { durationYears: "official program table" } : {}),
    fieldCategory: "official program identity",
    subjectArea: "official program table",
    teachingLanguage: "official program table",
    ...(item.degree === "Bachelor" ? { cscaRequirement: "official general CSCA statement without inferred subjects" } : {}),
    ...(item.language.includes("Chinese") && item.degree !== "Non-degree" ? { hskRequirement: "official eligibility" } : {}),
    ...(item.language.includes("English") ? { englishRequirement: "official eligibility" } : {}),
    tuitionText: "official fee table with bilingual ambiguity retained",
    applicationUrl: "official Fall 2026 guide",
    applicationNote: "official cycle and deadline wording",
    hasScholarship: "official scholarship section and separate guides",
    scholarshipText: "official award availability with scope limitation",
    badgeText: "official closed-cycle status",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineLabel: "The official Fall 2026 guide accepted applications until all places were filled and did not publish a calendar cutoff; the cycle is closed.",
  applicationRound: "Closed Fall 2026 international admission",
  status: "closed" as const,
  ...sf(guide),
  sourceFieldLineage: { intakeTerm: "official guide title", intakeYear: "official guide title", deadlineLabel: "official until-capacity wording and current closed status", applicationRound: "official guide cycle" },
}));

const springDirections = ["International Chinese Language Education", "Chinese Language and Literature", "Chinese History", "Chinese Philosophy", "Traditional Chinese Medicine", "Tai Chi Culture"];
for (const [indexValue, name] of springDirections.entries()) {
  const program: CatalogSeedProgram = {
    slug: `changsha-university-of-science-and-technology-${slugify(name)}-one-semester-spring-2027-${indexValue + 1}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: `${name} — One Semester`,
    degreeLevel: "Non-degree",
    durationMonths: 5,
    fieldCategory: "Chinese Language and Culture",
    subjectArea: name,
    teachingLanguage: "Chinese",
    hskRequirement: indexValue < 4 ? "HSK 3 score 180 plus an HSKK score." : "An HSK score is required; an HSKK score is preferred.",
    tuitionText: "Tuition is covered for scholarship recipients; the official guide does not publish a self-financed amount for this Spring 2027 route.",
    applicationUrl: languageScholarship.finalUrl ?? languageScholarship.url,
    applicationNote: "The official guide explicitly includes five-month study beginning in March 2027. Its printed application deadline falls after the stated intake and is therefore retained only as an unresolved source conflict, not as a normalized deadline.",
    hasScholarship: true,
    scholarshipText: "Full tuition, accommodation, CNY 2,500 monthly living allowance and comprehensive medical insurance.",
    badgeText: "Explicit Spring 2027 scholarship route; deadline conflict unresolved",
    displaySubjects: [name],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: languageScholarship.fetchedAt,
    ...sf(languageScholarship),
    sourceFieldLineage: { nameEn: "official scholarship study direction translated to English", degreeLevel: "official one-semester category", durationMonths: "official five-month duration", fieldCategory: "official scholarship category", subjectArea: "official study direction", teachingLanguage: "official Chinese-language study", hskRequirement: "official category requirement", tuitionText: "official coverage with unresolved self-funded amount", applicationUrl: "official scholarship guide", applicationNote: "official March 2027 entry plus internally conflicting deadline", hasScholarship: "official scholarship guide", scholarshipText: "official coverage and monthly allowance", badgeText: "official explicit cycle and unresolved deadline conflict" },
  };
  programs.push(program);
  programIntakes.push({
    programSlug: program.slug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    deadlineLabel: "The source prints October 31, 2027 for a March 2027 intake, which is internally inconsistent. No corrected deadline is inferred.",
    applicationRound: "March 2027 International Chinese Language Teachers Scholarship one-semester study",
    status: "closed" as const,
    ...sf(languageScholarship),
    sourceFieldLineage: { intakeTerm: "official March 2027 entry", intakeYear: "official March 2027 entry", deadlineLabel: "verbatim source conflict summarized without correction", applicationRound: "official scholarship category" },
  });
}

const scholarshipBase = { schoolSlug: school.slug, providerNameEn: "Changsha University of Science and Technology", providerLocation: "Changsha, Hunan, China", applicationMaterials: [], applicationSteps: [], status: "active" as const, verificationStatus: "verified" as const };
const scholarshipLineage = { title: "official scholarship guide", coverage: "official coverage section", applicableDegree: "official category", applicableProgram: "official program scope", amountText: "official monetary terms or explicit absence", requirementText: "official eligibility", benefitItems: "official coverage", eligibilityItems: "official eligibility", applicationMaterials: "intentionally excluded", applicationSteps: "intentionally excluded", deadlineLabel: "official deadline or unresolved conflict", applicationRound: "official guide cycle", summary: "official scholarship scope" };
const scholarships = [
  {
    ...scholarshipBase,
    slug: "csust-international-chinese-language-teachers-scholarship-spring-2027",
    title: "International Chinese Language Teachers Scholarship — Spring 2027",
    nameZh: "长沙理工大学国际中文教师奖学金（2027年春季）",
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "教育部中外语言交流合作中心 / 长沙理工大学",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, CNY 2,500 monthly living allowance and comprehensive medical insurance.",
    applicableDegree: "One-semester non-degree study",
    applicableProgram: springDirections.join(", "),
    amountText: "CNY 2,500/month living allowance; tuition, accommodation and comprehensive medical insurance are also covered.",
    requirementText: "Five-month March 2027 study. HSK 3 score 180 plus HSKK for the four language-and-culture directions; HSK plus preferred HSKK for Traditional Chinese Medicine and Tai Chi Culture.",
    benefitItems: [{ label: "Tuition", included: true, note: "Full tuition" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "CNY 2,500/month" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
    eligibilityItems: [{ label: "Entry", value: "March 2027; five months" }, { label: "Deadline conflict", value: "The source prints October 31, 2027, after the stated intake; no corrected date is inferred" }],
    actionLinks: [{ label: "Official scholarship guide", url: languageScholarship.finalUrl ?? languageScholarship.url, kind: "official-source" }],
    deadlineLabel: "The official table prints October 31, 2027 for a March 2027 intake. Because the dates conflict, no normalized deadlineDate is stored.",
    applicationRound: "March 2027 one-semester study",
    summary: "Explicit Spring 2027 full scholarship with an internally conflicting printed deadline.",
    lastVerifiedAt: languageScholarship.fetchedAt,
    ...sf(languageScholarship),
    sourceFieldLineage: scholarshipLineage,
  },
  {
    ...scholarshipBase,
    slug: "csust-silk-road-chinese-government-scholarship-2026-2027",
    title: "Silk Road Chinese Government Scholarship — 2026/2027",
    nameZh: "长沙理工大学2026/2027学年“丝绸之路”中国政府奖学金",
    type: "government",
    typeLabel: "Chinese Government Scholarship — Silk Road Program",
    providerName: "中国政府 / 长沙理工大学",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.",
    applicableDegree: "Bachelor and Master",
    applicableProgram: "New Energy Science and Engineering bachelor study in Chinese; Power Engineering and Engineering Thermophysics master study in Chinese or English.",
    amountText: "The guide confirms a living allowance but does not publish its monetary amount.",
    requirementText: "Applicants from the six named Belt and Road countries; bachelor applicants no older than 25 and master applicants no older than 30. The bachelor route requires CSCA Mathematics and Physics.",
    benefitItems: [{ label: "Tuition", included: true, note: "Covered" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "Amount not published" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
    eligibilityItems: [{ label: "Bachelor CSCA", value: "Mathematics and Physics" }, { label: "Target countries", value: "Malaysia, Vietnam, Kyrgyzstan, Angola, Ethiopia and Tanzania" }],
    actionLinks: [{ label: "Official scholarship guide", url: silkRoad.finalUrl ?? silkRoad.url, kind: "official-source" }],
    deadlineDate: "2026-05-22",
    deadlineLabel: "Applications closed May 22, 2026.",
    applicationRound: "Closed 2026/2027 academic-year scholarship",
    summary: "Full government scholarship for two named bachelor and master routes.",
    lastVerifiedAt: silkRoad.fetchedAt,
    ...sf(silkRoad),
    sourceFieldLineage: { ...scholarshipLineage, deadlineDate: "official deadline" },
  },
  {
    ...scholarshipBase,
    slug: "csust-chinese-plus-international-economics-and-trade-scholarship-2026",
    title: "International Chinese Language Teachers Scholarship — Chinese Plus International Economics and Trade 2026",
    nameZh: "长沙理工大学2026年国际中文教师奖学金“中文+国际经济与贸易”本科项目",
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "教育部中外语言交流合作中心 / 长沙理工大学",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, CNY 2,500 monthly living allowance and comprehensive medical insurance for the four-year bachelor route.",
    applicableDegree: "Bachelor",
    applicableProgram: "Chinese Plus International Economics and Trade, Chinese-taught, four years.",
    amountText: "CNY 2,500/month living allowance plus tuition, accommodation and medical insurance.",
    requirementText: "High-school education, no older than 25, HSK 4 score 210 or above; HSKK is preferred.",
    benefitItems: [{ label: "Tuition", included: true, note: "Covered" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "CNY 2,500/month" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
    eligibilityItems: [{ label: "Language", value: "HSK 4 score 210 or above; HSKK preferred" }, { label: "Duration", value: "Four years" }],
    actionLinks: [{ label: "Official scholarship guide", url: chinesePlus.finalUrl ?? chinesePlus.url, kind: "official-source" }],
    deadlineDate: "2026-05-15",
    deadlineLabel: "Student applications closed May 15, 2026.",
    applicationRound: "Closed Fall 2026 bachelor scholarship",
    summary: "Four-year Chinese-taught bachelor scholarship in International Economics and Trade.",
    lastVerifiedAt: chinesePlus.fetchedAt,
    ...sf(chinesePlus),
    sourceFieldLineage: { ...scholarshipLineage, deadlineDate: "official deadline" },
  },
  {
    ...scholarshipBase,
    slug: "csust-cgs-high-level-postgraduate-2026-2027",
    title: "Chinese Government Scholarship High Level Postgraduate Program — 2026/2027",
    nameZh: "长沙理工大学2026-2027学年中国政府奖学金“高水平研究生”项目",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B",
    providerName: "中国政府 / 长沙理工大学",
    fundingLevel: "Full scholarship",
    coverage: "Registration, tuition and accommodation fee waiver, living allowance and comprehensive medical insurance.",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "Eligible graduate programs are listed in an uncaptured official attachment; no route list is inferred in this candidate.",
    amountText: "The guide confirms a living allowance but does not publish its monetary amount.",
    requirementText: "Bachelor degree and no older than 35 for master study; master degree and no older than 40 for doctoral study. Chinese-taught routes require HSK 4 score 180; English-taught routes require TOEFL 68, IELTS 5.5 or Duolingo 85, subject to the stated exemption.",
    benefitItems: [{ label: "Registration and tuition", included: true, note: "Waived" }, { label: "Accommodation", included: true, note: "Waived" }, { label: "Living allowance", included: true, note: "Amount not published" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
    eligibilityItems: [{ label: "Master", value: "Bachelor degree and no older than 35" }, { label: "Doctoral", value: "Master degree and no older than 40" }],
    actionLinks: [{ label: "Official scholarship guide", url: highLevel.finalUrl ?? highLevel.url, kind: "official-source" }],
    deadlineDate: "2026-02-20",
    deadlineLabel: "Applications closed February 20, 2026.",
    applicationRound: "Closed 2026/2027 academic-year scholarship",
    summary: "Full graduate government scholarship; the official program-list attachment remains uncaptured.",
    lastVerifiedAt: highLevel.fetchedAt,
    ...sf(highLevel),
    sourceFieldLineage: { ...scholarshipLineage, deadlineDate: "official deadline" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: index.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: index.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 135, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The current official admissions index still exposes Fall 2026 as the latest complete general international guide. No complete applicant-facing general 2027 degree guide is published, so no 2026 degree route is relabeled as 2027.",
    "The International Chinese Language Teachers Scholarship guide explicitly includes March 2027 five-month study but prints October 31, 2027 as its application deadline. Because that date is after the stated intake, the conflict is preserved and no corrected deadlineDate is inferred.",
    "The general Fall 2026 guide requires a CSCA report in principle but does not publish route-level subjects. Only Mathematics and Physics for the Silk Road New Energy Science and Engineering scholarship route are explicit.",
    "The high-level postgraduate scholarship program list remains in an uncaptured attachment, so no scholarship-specific graduate route list is inferred.",
    "Application documents, personal contacts, third-party account links and payment instructions are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions or private application materials are present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-176");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 176, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
