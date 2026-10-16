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
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-23-01-626Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.hutb-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.hutb-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as {
  generatedAt: string;
  sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }>;
};
const source = manifest.sources.find((row) => row.id === "hutb-international-student-enrollment-guide-2026");
const expectedSha256 = "8634506f0b9cdffe244df55da4cbaece551765c0049bf00e2c103b7a3bc33180";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error("HUTB official evidence mismatch.");

const schoolSlug = "hunan-university-of-technology-and-business";
const citySlug = "changsha";
const applicationUrl = "https://hutb.at0086.cn/student";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };

const programs: CatalogSeedProgram[] = [
  {
    slug: `${schoolSlug}-master-international-business`,
    schoolSlug,
    citySlug,
    nameEn: "International Business",
    nameZh: "国际商务",
    degreeLevel: "Master",
    durationYears: 3,
    fieldCategory: "Business",
    subjectArea: "International Business",
    teachingLanguage: "English",
    englishRequirement: "IELTS 5.5, TOEFL 50, an equivalent English certificate, or proof of prior English-medium study for applicants whose official language is not English.",
    tuitionAmount: 24000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 24,000/year",
    scholarshipText: "Hunan provincial and HUTB scholarships are listed in the 2026 guide.",
    applicationUrl,
    applicationNote: "The 2026 guide lists 10-15 seats and requires an interview or professional re-examination after preliminary review.",
    hasScholarship: true,
    status: "draft",
    ...evidence,
    sourceFieldLineage: {
      nameEn: "II. Majors table",
      nameZh: "II. Majors table",
      degreeLevel: "II. Majors table",
      durationYears: "II. Majors table",
      teachingLanguage: "II. Majors table",
      englishRequirement: "III. Application Requirements / English Requirements",
      tuitionText: "V. Fee Structure",
      applicationUrl: "IV. Application Method and Deadline",
    },
  },
  {
    slug: `${schoolSlug}-non-degree-chinese-language`,
    schoolSlug,
    citySlug,
    nameEn: "Chinese Language",
    nameZh: "汉语言进修",
    degreeLevel: "Non-degree",
    durationYears: 1,
    fieldCategory: "Languages and Literature",
    subjectArea: "Chinese Language",
    teachingLanguage: "Chinese and English",
    tuitionAmount: 11000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 11,000/year",
    scholarshipText: "A one-academic-year provincial Belt and Road scholarship and an HUTB scholarship are listed for eligible language students.",
    applicationUrl,
    applicationNote: "The 2026 guide lists 30 seats.",
    hasScholarship: true,
    status: "draft",
    ...evidence,
    sourceFieldLineage: {
      nameEn: "II. Majors table",
      nameZh: "II. Majors table",
      degreeLevel: "II. Majors table",
      durationYears: "II. Majors table",
      teachingLanguage: "II. Majors table",
      tuitionText: "V. Fee Structure",
      applicationUrl: "IV. Application Method and Deadline",
    },
  },
];

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-30T15:59:59.000Z",
  deadlineLabel: "June 30, 2026",
  applicationRound: "2026 fall international admissions",
  status: "closed" as const,
  ...evidence,
  sourceFieldLineage: { intakeTerm: "IV. Application Method and Deadline", intakeYear: "guide title", deadlineDate: "IV. Application Method and Deadline" },
}));

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "hutb-international-students-inclusive-scholarship-2026",
    title: "HUTB International Students Inclusive Scholarship",
    nameZh: "湖南工商大学来华留学生奖学金",
    schoolSlug,
    type: "university",
    typeLabel: "University scholarship",
    providerName: "湖南工商大学",
    providerNameEn: "Hunan University of Technology and Business",
    providerLocation: "Changsha, Hunan, China",
    fundingLevel: "Performance-based award",
    coverage: "Award amount varies by student category and performance.",
    applicableDegree: "Master and non-degree Chinese language students",
    applicableProgram: "International Business and Chinese Language",
    amountText: "Up to CNY 16,800 for postgraduate students and CNY 5,500 for Chinese language students",
    deadlineLabel: "Not published in the reviewed guide",
    applicationRound: "2026 international admissions",
    targetCountries: [],
    targetRegions: [],
    eligibilityItems: [{ label: "Selection", value: "Outstanding enrolled international students are assessed according to their performance." }],
    applicationSteps: [{ label: "Follow-up", value: "Follow the university scholarship notice; the reviewed guide does not publish a separate application procedure." }],
    actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" }],
    summary: "The 2026 admissions guide confirms maximum award amounts for HUTB postgraduate and Chinese language students.",
    status: "draft",
    ...evidence,
    sourceFieldLineage: { title: "VI. Scholarship item 3", fundingLevel: "VI. Scholarship item 3", coverage: "VI. Scholarship item 3", applicableDegree: "VI. Scholarship item 3", amountText: "VI. Scholarship item 3", deadlineLabel: "not published" },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{
    slug: citySlug,
    nameEn: "Changsha",
    nameZh: "长沙",
    province: "Hunan",
    region: "Central China",
    status: "draft",
    verificationStatus: "unverified",
    ...evidence,
    sourceFieldLineage: { nameEn: "VII. Contacts", nameZh: "VII. Contacts", province: "VII. Contacts", region: "CUAC geographic taxonomy" },
  }],
  schools: [{
    slug: schoolSlug,
    nameEn: "Hunan University of Technology and Business",
    nameZh: "湖南工商大学",
    citySlug,
    schoolType: "Public",
    region: "Changsha, Hunan, Central China",
    applicationLevel: "Master, Non-degree",
    languageOfInstruction: "English for International Business; Chinese and English for Chinese Language",
    languageRequirement: "International Business applicants whose official language is not English must provide IELTS 5.5, TOEFL 50, an equivalent certificate, or proof of prior English-medium study.",
    englishRequirement: "IELTS 5.5, TOEFL 50, equivalent English proficiency, or proof of prior English-medium study for the reviewed master's program.",
    deadlineSummary: "June 30, 2026 for fall admission; the reviewed cycle is closed and no later deadline is inferred.",
    tuitionSummary: "International Business: CNY 24,000/year. Chinese Language: CNY 11,000/year. Registration: CNY 500.",
    applicationFee: "CNY 500 registration fee",
    websiteUrl: "https://ev.hutb.edu.cn/",
    admissionsUrl: source.finalUrl,
    subjectTags: ["International Business", "Chinese Language"],
    languageTags: ["English", "Chinese and English"],
    campusHighlights: ["Changsha location", "2026 international student intake", "University and provincial scholarship routes"],
    status: "draft",
    ...evidence,
    sourceFieldLineage: { nameEn: "guide title", nameZh: "guide title", citySlug: "VII. Contacts", schoolType: "I. Introduction", applicationLevel: "II. Majors", languageRequirement: "III. Application Requirements", deadlineSummary: "IV. Application Method and Deadline", tuitionSummary: "V. Fee Structure", websiteUrl: "VII. Contacts", admissionsUrl: "registered official page" },
  }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha256(candidateText),
  manifestSha256: sha256(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Both listed 2026 programs, their stated teaching languages, durations, tuition and deadline are transcribed from the official guide.",
      "The English section contains an apparent 2025 age-date typo; no age cutoff is normalized into catalog fields.",
      "No 2027 intake, CSCA rule, or unstated scholarship application deadline is inferred.",
      "Personal contact details and financial-guarantor documents are excluded.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
