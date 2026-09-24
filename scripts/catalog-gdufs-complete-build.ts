import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T11-48-34-180Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.guangzhou-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.gdufs-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.gdufs-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([
  readFile(manifestPath, "utf8"),
  readFile(cityPath, "utf8"),
]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>(
  ((manifest.sources || []) as SourceRecord[]).map((row) => [row.id, row]),
);
const expected = {
  "gdufs-international-degree-admissions-fall-2026": "e56545a3662b45f750bf2a299b2f33cabc7cd49bc8741e11dcce97a8573a4b17",
  "gdufs-undergraduate-program-catalog-2026": "463ca2fd98429f58854004de895e7f4b70fe5143df55e948c1ac6d9347116e32",
  "gdufs-english-undergraduate-programs-current": "b2b151183e0d62d8b7af2f67048ceee143e137dc8db9143eda49494a8682faf1",
  "gdufs-guangdong-government-scholarship-current": "903136c29a4c70b2651d0aa50bbc383ce7a46e144139c05b9c621b6fd4353770",
  "gdufs-international-student-scholarship-current": "5f5105486088f45a658c4a6b61656b4028fbde5ec66bdc19c61134e3b39f53fd",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) {
    throw new Error(`GDUFS evidence mismatch: ${id}`);
  }
}

const admissions = sources.get("gdufs-international-degree-admissions-fall-2026")!;
const catalog = sources.get("gdufs-undergraduate-program-catalog-2026")!;
const english = sources.get("gdufs-english-undergraduate-programs-current")!;
const provincialScholarship = sources.get("gdufs-guangdong-government-scholarship-current")!;
const universityScholarship = sources.get("gdufs-international-student-scholarship-current")!;
const schoolSlug = "guangdong-university-of-foreign-studies";
const citySlug = "guangzhou";

const commonAdmissionsLineage = {
  degreeLevel: "2026 international degree admissions notice: undergraduate section",
  durationYears: "2026 international degree admissions notice: four-year undergraduate duration",
  applicationUrl: "registered 2026 international degree admissions notice",
};
const chineseProgram = (
  slug: string,
  nameEn: string,
  nameZh: string,
  fieldCategory: string,
): CatalogSeedProgram => ({
  slug,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory,
  subjectArea: nameEn,
  teachingLanguage: "Chinese",
  cscaSubjects: ["Chinese for Humanities", "Mathematics"],
  cscaRequirement: "CSCA Chinese for Humanities and Mathematics are required for this Chinese-taught economics or management route.",
  hskRequirement: "HSK Level 5 score 180 or above.",
  applicationUrl: admissions.url,
  applicationNote: "The 2026 international admissions notice directs Chinese-taught applicants to the university's current domestic undergraduate catalog. Tuition is intentionally unresolved because the current fee attachment was not acquired as structured evidence.",
  hasScholarship: true,
  scholarshipText: "The 2026 admissions notice lists the Guangdong Government scholarship and GDUFS scholarship for eligible applicants.",
  status: "draft",
  sourceUrl: catalog.url,
  sourceLabel: catalog.label,
  sourceSha256: catalog.sha256,
  capturedAt: catalog.fetchedAt,
  sourceFieldLineage: {
    nameEn: "editorial English rendering of the exact Chinese major in the current undergraduate catalog; requires review",
    nameZh: "current undergraduate program catalog",
    teachingLanguage: `2026 international admissions notice ${admissions.sha256}: Chinese-taught route`,
    cscaSubjects: `2026 international admissions notice ${admissions.sha256}: CSCA rules for Chinese-taught humanities routes`,
    hskRequirement: `2026 international admissions notice ${admissions.sha256}: Chinese-taught undergraduate language requirement`,
    ...commonAdmissionsLineage,
  },
});

const englishProgram = (
  slug: string,
  nameEn: string,
  nameZh: string,
  fieldCategory: string,
): CatalogSeedProgram => ({
  slug,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory,
  subjectArea: nameEn,
  teachingLanguage: "English",
  cscaSubjects: ["Mathematics"],
  cscaRequirement: "CSCA Mathematics is required; English-taught applicants do not take the CSCA Chinese subject.",
  englishRequirement: "TOEFL 70 or IELTS 5.5 or above; applicants without either may take the university's entrance assessment, and applicants from countries where English is an official language may be exempt from the written English test but still require an interview.",
  tuitionAmount: 33800,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 33,800/year; the program page separately lists a CNY 500 application fee and CNY 800/year insurance.",
  applicationUrl: admissions.url,
  applicationNote: "Current English-taught undergraduate route linked by the Fall 2026 international degree admissions notice.",
  hasScholarship: true,
  scholarshipText: "The 2026 admissions notice lists the Guangdong Government scholarship and GDUFS scholarship for eligible applicants.",
  status: "draft",
  sourceUrl: english.url,
  sourceLabel: english.label,
  sourceSha256: english.sha256,
  capturedAt: english.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official English-taught undergraduate program page",
    nameZh: "official Chinese program title",
    teachingLanguage: "official English-taught undergraduate program page",
    cscaSubjects: `2026 international admissions notice ${admissions.sha256}: CSCA rules for English-taught undergraduate routes`,
    englishRequirement: "official English-taught undergraduate program page and 2026 admissions notice",
    tuitionAmount: "official English-taught undergraduate program page",
    ...commonAdmissionsLineage,
  },
});

const programs: CatalogSeedProgram[] = [
  chineseProgram(`${schoolSlug}-business-administration`, "Business Administration", "工商管理", "Business Administration"),
  chineseProgram(`${schoolSlug}-international-economics-and-trade`, "International Economics and Trade", "国际经济与贸易", "Economics"),
  englishProgram(`${schoolSlug}-international-business`, "International Business", "国际商务", "Business"),
  englishProgram(`${schoolSlug}-international-economics-and-trade-english-taught`, "International Economics and Trade (English-taught)", "国际经济与贸易（全英授课）", "Economics"),
  englishProgram(`${schoolSlug}-marketing-english-taught`, "Marketing (English-taught)", "市场营销（全英授课）", "Marketing"),
];

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  openDate: "2026-03-01T00:00:00.000Z",
  deadlineDate: "2026-06-20T15:59:59.000Z",
  deadlineLabel: "June 20, 2026",
  applicationRound: "Fall 2026 international degree admission",
  status: "closed" as const,
  sourceUrl: admissions.url,
  sourceLabel: admissions.label,
  sourceSha256: admissions.sha256,
  capturedAt: admissions.fetchedAt,
  sourceFieldLineage: {
    openDate: "2026 admissions notice: application period",
    deadlineDate: "2026 admissions notice: application period",
    intakeYear: "2026 admissions notice title",
  },
}));

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "gdufs-guangdong-government-outstanding-international-student-scholarship",
    schoolSlug,
    title: "Guangdong Government Outstanding International Student Scholarship at GDUFS",
    nameZh: "广东省政府来粤留学生奖学金",
    type: "government",
    typeLabel: "Guangdong Government Outstanding International Student Scholarship",
    providerName: "广东省政府 / 广东外语外贸大学",
    providerNameEn: "Guangdong Provincial Government / Guangdong University of Foreign Studies",
    providerLocation: "Guangzhou, Guangdong, China",
    fundingLevel: "Partial",
    coverage: "One-time award: CNY 10,000 for undergraduate, CNY 20,000 for master's and CNY 30,000 for doctoral recipients.",
    applicableDegree: "Undergraduate, Master, Doctoral",
    applicableProgram: "Eligible new or current international degree students at GDUFS.",
    amountText: "Undergraduate CNY 10,000; master's CNY 20,000; doctoral CNY 30,000 as a one-time award.",
    deadlineDate: "2026-06-30",
    deadlineLabel: "June 30, 2026",
    applicationRound: "2026 annual application window",
    targetCountries: [],
    targetRegions: [],
    benefitItems: [{ label: "One-time award", included: true, note: "Amount varies by degree level" }],
    eligibilityItems: [
      { label: "Applicant type", value: "Eligible new or current international undergraduate, master's or doctoral student" },
      { label: "Academic standing", value: "Excellent academic and conduct record" },
      { label: "Other funding", value: "Must not hold a Chinese Government or another scholarship in the same application year" },
    ],
    applicationMaterials: [{ label: "Scholarship application form" }, { label: "Supporting materials required by the form" }],
    applicationSteps: [
      { label: "Step 1", value: "Complete the appropriate new-student or current-student application form" },
      { label: "Step 2", value: "Submit during the annual May 1-June 30 window" },
      { label: "Step 3", value: "University review and provincial final review" },
    ],
    actionLinks: [{ label: provincialScholarship.label, url: provincialScholarship.url, kind: "official-source" }],
    summary: "Closed 2026 annual provincial scholarship route for eligible new and current GDUFS degree students.",
    status: "draft",
    sourceUrl: provincialScholarship.url,
    sourceLabel: provincialScholarship.label,
    sourceSha256: provincialScholarship.sha256,
    capturedAt: provincialScholarship.fetchedAt,
    sourceFieldLineage: {
      title: "official scholarship page title",
      coverage: "official scholarship award amount section",
      applicableDegree: "official applicant-scope section",
      deadlineDate: "official annual application procedure",
      eligibilityItems: "official eligibility section",
      applicationSteps: "official application procedure",
    },
  },
  {
    slug: "gdufs-outstanding-new-degree-student-scholarship",
    schoolSlug,
    title: "GDUFS Outstanding New Degree Student Scholarship",
    nameZh: "广东外语外贸大学优秀学历留学生新生奖学金",
    type: "university",
    typeLabel: "GDUFS International Student Scholarship",
    providerName: "广东外语外贸大学",
    providerNameEn: "Guangdong University of Foreign Studies",
    providerLocation: "Guangzhou, Guangdong, China",
    fundingLevel: "Full or partial tuition",
    coverage: "Full award waives first-year tuition; half award waives 50% of first-year tuition.",
    applicableDegree: "Undergraduate, Master, Doctoral",
    applicableProgram: "Eligible new international degree students admitted to GDUFS.",
    amountText: "100% or 50% of first-year tuition.",
    deadlineDate: "2026-06-30",
    deadlineLabel: "June 30, 2026",
    applicationRound: "2026 annual new-student scholarship window",
    targetCountries: [],
    targetRegions: [],
    benefitItems: [{ label: "First-year tuition", included: true, note: "Full waiver or 50% waiver" }],
    eligibilityItems: [
      { label: "Applicant type", value: "New international degree student" },
      { label: "Academic standing", value: "Excellent prior academic and conduct record" },
      { label: "Language", value: "Meet the selected program's HSK or TOEFL requirement" },
      { label: "Other funding", value: "Must not hold a Chinese Government or another scholarship" },
    ],
    applicationMaterials: [{ label: "Scholarship application form" }, { label: "Complete degree-application materials" }, { label: "Recommendation letter" }],
    applicationSteps: [
      { label: "Step 1", value: "Complete the degree application and scholarship form" },
      { label: "Step 2", value: "Submit the form, full application materials and recommendation letter during May 1-June 30" },
      { label: "Step 3", value: "University comprehensive assessment and result publication by the end of August" },
    ],
    actionLinks: [{ label: universityScholarship.label, url: universityScholarship.url, kind: "official-source" }],
    summary: "Closed 2026 university scholarship route offering a full or half first-year tuition waiver to selected new degree students.",
    status: "draft",
    sourceUrl: universityScholarship.url,
    sourceLabel: universityScholarship.label,
    sourceSha256: universityScholarship.sha256,
    capturedAt: universityScholarship.fetchedAt,
    sourceFieldLineage: {
      title: "official scholarship category title",
      fundingLevel: "official award-standard section",
      coverage: "official award-standard section",
      applicableDegree: "new degree-student category",
      deadlineDate: "official annual application procedure",
      eligibilityItems: "official eligibility section",
      applicationMaterials: "official application procedure",
      applicationSteps: "official application procedure",
    },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Guangdong University of Foreign Studies",
    nameZh: "广东外语外贸大学",
    citySlug,
    schoolType: "Public",
    region: "Guangzhou, Guangdong, South China",
    applicationLevel: "Undergraduate, Master and Doctoral",
    languageOfInstruction: "Chinese and English",
    languageRequirement: "Chinese-taught undergraduate applicants require HSK Level 5 score 180 or above; English-taught undergraduate applicants require TOEFL 70 or IELTS 5.5 or the university's entrance assessment.",
    hskRequirement: "HSK Level 5 score 180 or above for Chinese-taught undergraduate routes.",
    englishRequirement: "TOEFL 70 or IELTS 5.5 or above for English-taught undergraduate routes, subject to published exemptions and entrance assessment.",
    deadlineSummary: "The reviewed Fall 2026 degree and annual scholarship application windows are closed. No 2027 degree intake has been published in the acquired sources.",
    tuitionSummary: "The reviewed English-taught undergraduate routes publish CNY 33,800/year. Current Chinese-taught tuition remains unresolved pending structured evidence from the official fee attachment.",
    applicationFee: "CNY 500 for the reviewed English-taught undergraduate routes; other route fees remain unresolved.",
    websiteUrl: "https://www.gdufs.edu.cn/",
    admissionsUrl: admissions.url,
    cscaRequired: true,
    cscaRequirement: "All undergraduate applicants take CSCA Mathematics. Chinese-taught applicants also take the applicable Chinese subject; English-taught applicants do not take CSCA Chinese.",
    cscaSubjects: ["Chinese for Humanities", "Mathematics"],
    subjectTags: ["Languages", "Business", "Economics", "Management", "International Studies"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Foreign languages and international studies focus", "Chinese- and English-taught degree routes", "Guangzhou campuses"],
    status: "draft",
    sourceUrl: admissions.url,
    sourceLabel: admissions.label,
    sourceSha256: admissions.sha256,
    capturedAt: admissions.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official university identity",
      nameZh: "2026 admissions notice title and footer",
      citySlug: "official contact address",
      applicationLevel: "2026 admissions notice degree sections",
      languageOfInstruction: "2026 admissions notice and linked program pages",
      languageRequirement: `2026 admissions notice plus English program page ${english.sha256}`,
      deadlineSummary: `2026 admissions notice plus scholarship sources ${provincialScholarship.sha256} and ${universityScholarship.sha256}`,
      tuitionSummary: `English program page ${english.sha256}; Chinese tuition explicitly unresolved`,
      applicationFee: `English program page ${english.sha256}`,
      admissionsUrl: "registered official 2026 admissions notice",
      cscaRequirement: "2026 admissions notice CSCA section",
    },
  }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "All five records remain draft-only and no database or publication authorization is granted.",
      "The three prohibited legacy program identities have exact official replacements: Chinese-taught Business Administration, Chinese-taught International Economics and Trade, and English-taught International Business.",
      "The two additional English-taught routes are included because the current official page explicitly names them and the Fall 2026 notice links that page.",
      "Current Chinese-taught tuition is left unresolved because the fee attachment is image-based and was not registered as structured evidence.",
      "Every 2026 intake and scholarship window is closed; no 2027 dates are inferred.",
      "The two scholarship records represent new-applicant categories and do not include current-student-only awards.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
