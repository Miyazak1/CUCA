import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-45-30-565Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.just-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.just-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((item) => item.id === "just-international-student-enrollment-guideline-2026");
if (!source || source.status !== 200 || source.sha256 !== "44eec966f49695c778106d317315e371265d8c78833a9d29d5ce5e9ac02288ec") throw new Error("JUST evidence mismatch.");

const schoolSlug = "jiangsu-university-of-science-and-technology";
const citySlug = "zhenjiang";
const applicationUrl = "https://just.17gz.org/";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slug = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Spec = readonly [degreeLevel: "Undergraduate" | "Master" | "Doctorate", nameEn: string, durationYears: number, fieldCategory: string, teachingLanguage?: string];
const specs: Spec[] = [
  ["Undergraduate", "Computer Science and Technology", 4, "Engineering"],
  ["Undergraduate", "Bachelor of Business Administration (BBA)", 4, "Management"],
  ["Master", "Computer Science and Technology", 3, "Engineering"],
  ["Master", "Information and Communication Engineering", 3, "Engineering"],
  ["Master", "Control Science and Engineering", 3, "Engineering"],
  ["Master", "Energy and Power", 2, "Engineering"],
  ["Master", "Naval Architecture and Ocean Engineering", 3, "Engineering"],
  ["Master", "Mechanical Engineering", 3, "Engineering"],
  ["Master", "Master of Business Administration (MBA)", 2, "Management", "Bilingual (English and Chinese)"],
  ["Master", "Enterprise Management", 3, "Management", "Bilingual (English and Chinese)"],
  ["Master", "English Language and Literature", 3, "Literature"],
  ["Master", "Russian Language and Literature", 3, "Literature"],
  ["Master", "Civil Engineering", 3, "Engineering"],
  ["Master", "Chemistry", 3, "Science"],
  ["Master", "Chemical Engineering and Technology", 3, "Engineering"],
  ["Master", "Materials Science and Engineering", 3, "Engineering"],
  ["Master", "Physics", 3, "Science"],
  ["Master", "Food Science and Engineering", 3, "Engineering"],
  ["Master", "Animal Science", 3, "Agriculture"],
  ["Master", "Biology", 3, "Science"],
  ["Doctorate", "Animal Science", 4, "Agriculture"],
  ["Doctorate", "Management Science and Engineering", 4, "Management", "Bilingual (English and Chinese)"],
  ["Doctorate", "Materials Science and Engineering", 4, "Engineering"],
  ["Doctorate", "Naval Architecture and Ocean Engineering", 4, "Engineering"],
  ["Doctorate", "Naval Architecture and Ocean Engineering (Marine Engineering)", 4, "Engineering"],
];

const tuitionByLevel = { Undergraduate: 11250, Master: 20000, Doctorate: 25000 } as const;
const englishRequirementByLevel = {
  Undergraduate: "TOEFL iBT 75 or IELTS 5.5; waived for native English speakers. Non-native English speakers also complete an online interview.",
  Master: "TOEFL iBT 80 or IELTS 6.0; waived for native English speakers. Non-native English speakers also complete an online interview.",
  Doctorate: "TOEFL iBT 80 or IELTS 6.0; waived for native English speakers. Non-native English speakers also complete an online interview.",
} as const;

const programs: CatalogSeedProgram[] = specs.map(([degreeLevel, nameEn, durationYears, fieldCategory, language]) => {
  const teachingLanguage = language ?? "English";
  const tuitionAmount = tuitionByLevel[degreeLevel];
  const isBilingual = teachingLanguage.startsWith("Bilingual");
  return {
    slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slug(nameEn)}`,
    schoolSlug,
    citySlug,
    nameEn,
    degreeLevel,
    durationYears,
    fieldCategory,
    subjectArea: nameEn,
    teachingLanguage,
    englishRequirement: isBilingual ? undefined : englishRequirementByLevel[degreeLevel],
    hskRequirement: isBilingual ? "HSK preferred." : undefined,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/academic year`,
    applicationUrl,
    applicationNote: "Submit exclusively through the JUST Online Application System.",
    hasScholarship: true,
    status: "draft",
    ...evidence,
    sourceFieldLineage: {
      nameEn: "Table 1 Programs and Candidate Seats",
      degreeLevel: "Table 1 section heading",
      durationYears: "Table 1 duration column",
      teachingLanguage: isBilingual ? "Table 1 school note" : "Table 1 and English-taught program requirements",
      ...(isBilingual ? {} : { englishRequirement: "Language Proficiency Requirements" }),
      tuitionText: "Table 2 Fees for International Students",
      applicationUrl: "Application Procedure",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-10T15:59:59.000Z",
  deadlineLabel: "June 10, 2026",
  applicationRound: "2026 international enrollment",
  status: "closed" as const,
  ...evidence,
  sourceFieldLineage: { intakeYear: "guideline title", deadlineDate: "Application Period" },
}));

const scholarshipBase = {
  schoolSlug,
  deadlineLabel: "June 10, 2026 admissions deadline",
  applicationRound: "2026 international enrollment",
  targetCountries: [] as string[],
  targetRegions: [] as string[],
  applicationSteps: [{ label: "Apply", value: "Submit the relevant scholarship and admission applications through the official platforms described in the guideline." }],
  actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" as const }, { label: "JUST Online Application System", url: applicationUrl, kind: "application" as const }],
  status: "draft" as const,
  ...evidence,
};
const scholarships = [
  {
    ...scholarshipBase,
    slug: `${schoolSlug}-jiangsu-provincial-scholarship-2026`,
    title: "Jiangsu Provincial Scholarship at JUST",
    type: "government",
    typeLabel: "Provincial government scholarship",
    providerNameEn: "Jiangsu Provincial Education Department",
    providerLocation: "Jiangsu, China",
    fundingLevel: "Full scholarship route described; award amount not published in the reviewed guide",
    coverage: "The guide states that the provincial full scholarship includes tuition, accommodation, comprehensive insurance and a living allowance; exact award values are not published.",
    applicableDegree: "Degree programs",
    eligibilityItems: [{ label: "Compatibility", value: "The provincial scholarship cannot be combined with scholarships provided by JUST." }],
    summary: "Provincial scholarship route managed by the Jiangsu provincial education department.",
    sourceFieldLineage: { title: "Table 3 Scholarships and Allowance", coverage: "Scholarship notes", deadlineLabel: "Application Period" },
  },
  ...[
    ["bachelor", "JUST Scholarship for Bachelor", "CNY 7,000/year", "Undergraduate"],
    ["master", "JUST Scholarship for Master", "CNY 6,000-9,000/year", "Master"],
    ["phd", "JUST Scholarship for PhD", "CNY 9,000-12,000/year", "Doctorate"],
  ].map(([key, title, amountText, applicableDegree]) => ({
    ...scholarshipBase,
    slug: `${schoolSlug}-just-scholarship-${key}-2026`,
    title,
    type: "university",
    typeLabel: "University scholarship",
    providerNameEn: "Jiangsu University of Science and Technology",
    providerLocation: "Zhenjiang, Jiangsu, China",
    fundingLevel: amountText,
    amountText,
    coverage: "Annual scholarship award; the reviewed guide does not publish itemized coverage.",
    applicableDegree,
    eligibilityItems: [] as Array<{ label: string; value: string }>,
    summary: `${title}: ${amountText}.`,
    sourceFieldLineage: { title: "Table 3 Scholarships and Allowance", amountText: "Table 3 award column", deadlineLabel: "Application Period" },
  })),
  {
    ...scholarshipBase,
    slug: `${schoolSlug}-academic-scholarship-undergraduates-2026`,
    title: "JUST Academic Scholarship for Undergraduates",
    type: "university",
    typeLabel: "Academic merit scholarship",
    providerNameEn: "Jiangsu University of Science and Technology",
    providerLocation: "Zhenjiang, Jiangsu, China",
    fundingLevel: "CNY 2,000-8,000/year by GPA rank",
    amountText: "Top 5%: CNY 8,000/year; top 6%-15%: CNY 6,000/year; top 16%-35%: CNY 4,000/year; top 36%-75%: CNY 2,000/year",
    coverage: "Annual merit award for three years, based on the previous academic year's GPA ranking.",
    applicableDegree: "Undergraduate",
    eligibilityItems: [{ label: "Ranking", value: "Award tier is determined by the previous academic year's GPA ranking." }],
    summary: "Three-year academic merit scholarship for continuing undergraduates.",
    sourceFieldLineage: { title: "Table 3 Scholarships and Allowance", amountText: "Table 3 award tiers", coverage: "Table 3 eligibility note" },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Zhenjiang", nameZh: "镇江", province: "Jiangsu", region: "East China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "institution identity", nameZh: "official institution location", province: "official institution location", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "Jiangsu University of Science and Technology", nameZh: "江苏科技大学", citySlug, schoolType: "Public", region: "Zhenjiang, Jiangsu, East China", applicationLevel: "Undergraduate, Master and Doctorate", languageOfInstruction: "English for the listed international programs; selected management programs are bilingual; Chinese-taught specialties are also available.", languageRequirement: "English routes: TOEFL iBT 75/IELTS 5.5 undergraduate and TOEFL iBT 80/IELTS 6.0 graduate; Chinese routes: recent HSK 4.", hskRequirement: "Recent HSK Level 4 certificate issued within the last two years for Chinese-taught programs.", deadlineSummary: "Applications ran from April 10 to June 10, 2026; the reviewed round is closed.", tuitionSummary: "Undergraduate CNY 11,250/year; master CNY 20,000/year; doctorate CNY 25,000/year.", applicationFee: "CNY 400", websiteUrl: "https://www.just.edu.cn/", admissionsUrl: source.finalUrl, subjectTags: [...new Set(specs.map((item) => item[3]))], languageTags: ["English", "Chinese", "Bilingual", "HSK 4"], campusHighlights: ["Zhenjiang, Jiangsu", "English and Chinese degree routes", "Undergraduate through doctoral study"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "guideline title", nameZh: "official university identity", citySlug: "official institution location", applicationLevel: "Program Types", languageRequirement: "Language Proficiency Requirements", deadlineSummary: "Application Period", tuitionSummary: "Table 2 Fees", applicationFee: "Table 2 Fees", admissionsUrl: "registered official guide" } }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const artifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["All 25 explicitly listed degree rows and durations are transcribed from Table 1.", "The official guide separately states that Chinese-taught specialties are available, but does not enumerate those rows; they are not invented here.", "The reviewed round closed June 10, 2026.", "Scholarship amounts and coverage are recorded only where Table 3 or its notes publish them."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, summary: validation.summary }, null, 2));
