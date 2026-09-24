import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const identityPath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/yanshan-complete-batch-01-pdfs/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.yanshan-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.yanshan-complete-batch-01.validation.json");
const [identityText, manifestText] = await Promise.all([readFile(identityPath, "utf8"), readFile(manifestPath, "utf8")]);
const identity = JSON.parse(identityText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { id: string; label: string; url: string; sha256: string; status: number }[] };
const city = identity.cities.find((row) => row.slug === "qinhuangdao");
const school = identity.schools.find((row) => row.slug === "yanshan-university");
if (!city || !school) throw new Error("Missing Qinhuangdao/Yanshan identity dependencies");
const pdf = manifest.sources.find((row) => row.id === "qinhuangdao-ysu-international-admission-guide-pdf-2-2026" && row.status === 200);
if (!pdf) throw new Error("Missing successful Yanshan English brochure evidence");

type ProgramDefinition = {
  slug: string;
  name: string;
  schoolName: string;
  language: "Chinese" | "English";
  csca: string[];
  field: string;
};
const definitions: ProgramDefinition[] = [
  { slug: "yanshan-university-electronic-science-and-technology", name: "Electronic Science and Technology", schoolName: "School of Information Science and Engineering (School of Software)", language: "English", csca: ["Mathematics", "Physics"], field: "Engineering" },
  { slug: "yanshan-university-economics-and-finance", name: "Economics and Finance", schoolName: "School of Economics and Management", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Economics and Management" },
  { slug: "yanshan-university-business-administration", name: "Business Administration", schoolName: "School of Economics and Management", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Economics and Management" },
  { slug: "yanshan-university-accounting", name: "Accounting", schoolName: "School of Economics and Management", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Economics and Management" },
  { slug: "yanshan-university-tourism-management", name: "Tourism Management", schoolName: "School of Economics and Management", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Economics and Management" },
  { slug: "yanshan-university-e-commerce", name: "E-commerce", schoolName: "School of Economics and Management", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Economics and Management" },
  { slug: "yanshan-university-industrial-engineering", name: "Industrial Engineering", schoolName: "School of Economics and Management", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics", "Physics"], field: "Engineering and Management" },
  { slug: "yanshan-university-japanese", name: "Japanese", schoolName: "School of Foreign Studies", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Languages" },
  { slug: "yanshan-university-law", name: "Law", schoolName: "School of Humanities and Law (School of Public Administration)", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Law" },
  { slug: "yanshan-university-chinese-language-and-literature", name: "Chinese Language and Literature", schoolName: "School of Humanities and Law (School of Public Administration)", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Languages and Literature" },
  { slug: "yanshan-university-teaching-chinese-to-speakers-of-other-languages", name: "Teaching Chinese to Speakers of Other Languages", schoolName: "School of Humanities and Law (School of Public Administration)", language: "Chinese", csca: ["Chinese (Humanities)", "Mathematics"], field: "Language Education" },
  { slug: "official-2026-yanshan-chemical-engineering-and-technology", name: "Chemical Engineering and Technology", schoolName: "School of Environmental and Chemical Engineering", language: "Chinese", csca: ["Chinese (STEM)", "Mathematics"], field: "Engineering" },
  { slug: "official-2026-yanshan-petroleum-engineering", name: "Petroleum Engineering", schoolName: "School of Vehicle and Energy", language: "Chinese", csca: ["Chinese (STEM)", "Mathematics", "Physics", "Chemistry"], field: "Engineering" },
];
const sourceBase = {
  status: "draft",
  sourceUrl: pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: manifest.generatedAt,
};
const programs = definitions.map((row) => ({
  slug: row.slug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: row.name,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory: row.field,
  subjectArea: row.schoolName,
  teachingLanguage: row.language,
  hskRequirement: row.language === "Chinese" ? "HSK Level 4" : undefined,
  englishRequirement: row.language === "English" ? "Academic IELTS 6.0 overall with each band at least 5.5; TOEFL 85 overall with each band at least 20; GRE 300; Duolingo 95; equivalent proof; or English-medium highest qualification." : undefined,
  cscaSubjects: row.csca,
  cscaRequirement: `CSCA required before the program deadline; subjects: ${row.csca.join(", ")}.`,
  tuitionAmount: 15700,
  tuitionCurrency: "CNY",
  tuitionPeriod: "academic_year",
  tuitionText: "CNY 15,700 per academic year",
  displayTuition: "CNY 15,700/year",
  applicationUrl: "https://admission.ysu.edu.cn/",
  applicationNote: "Applicants must meet the published age, academic, language, financial-support, health, security and CSCA requirements. Fall 2026 degree applications closed June 15, 2026.",
  displaySubjects: row.csca,
  displayGroup: "2026-international-undergraduate",
  displayGroupLabel: "2026 international undergraduate programs",
  ...sourceBase,
  sourceFieldLineage: {
    nameEn: "English brochure page 3 undergraduate program table",
    degreeLevel: "English brochure page 3 section heading",
    durationYears: "English brochure page 3 section heading",
    subjectArea: "English brochure page 3 school column",
    teachingLanguage: "English brochure page 3 teaching-language column",
    hskRequirement: row.language === "Chinese" ? "English brochure page 3 application requirements" : undefined,
    englishRequirement: row.language === "English" ? "English brochure page 3 application requirements" : undefined,
    cscaSubjects: "English brochure page 3 entrance-examination table",
    cscaRequirement: "English brochure page 3 application requirements and subject table",
    tuitionAmount: "English brochure page 7 fee table",
    tuitionCurrency: "English brochure page 7 fee table",
    tuitionPeriod: "English brochure page 7 fee table",
    tuitionText: "English brochure page 7 fee table",
    applicationUrl: "English brochure pages 3 and 10",
    applicationNote: "English brochure pages 3 and 10",
  },
}));
const programIntakes = definitions.map((row) => ({
  programSlug: row.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-15T00:00:00.000Z",
  deadlineLabel: "June 15, 2026 — closed",
  applicationRound: "Yanshan University 2026 international degree admission",
  status: "closed",
  sourceUrl: pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: manifest.generatedAt,
  sourceFieldLineage: {
    intakeTerm: "derived from fall-semester degree deadline on English brochure page 10",
    intakeYear: "explicit: 2026 brochure",
    deadlineDate: "English brochure page 10 degree-program deadline",
    deadlineLabel: "English brochure page 10; closed derived from capture date",
    applicationRound: "explicit: 2026 brochure context",
    status: "derived: deadline predates evidence capture",
  },
}));
const scholarshipBase = {
  schoolSlug: school.slug,
  ...sourceBase,
  providerLocation: "China",
  targetCountries: [],
  targetRegions: [],
  actionLinks: [{ label: pdf.label, url: pdf.url, kind: "official-source" }],
};
const scholarshipLineage = {
  title: "English brochure pages 7-8 scholarship section",
  fundingLevel: "English brochure pages 7-8 scholarship section",
  coverage: "English brochure pages 7-8 scholarship section",
  applicableDegree: "English brochure pages 7-8 scholarship section",
  applicableProgram: "English brochure pages 7-8 scholarship section",
  eligibilityItems: "English brochure page 8 scholarship eligibility",
  applicationSteps: "English brochure page 8 application procedure",
};
const presidential = (slug: string, degree: string, coverage: string, amountText: string, sortOrder: number) => ({
  ...scholarshipBase,
  slug,
  title: `Yanshan University 2026 President Scholarship — ${degree}`,
  nameZh: `燕山大学2026年外国留学生${degree === "Master" ? "硕士" : degree === "Doctoral" ? "博士" : "本科"}奖学金`,
  type: "university",
  typeLabel: "YSU President Scholarship",
  providerName: "燕山大学",
  providerNameEn: "Yanshan University",
  fundingLevel: "Degree-specific university award",
  coverage,
  applicableDegree: degree,
  applicableProgram: `Eligible new Yanshan University ${degree.toLowerCase()} programs`,
  amountText,
  deadlineDate: "2026-05-30",
  deadlineLabel: "May 30, 2026 — closed",
  applicationRound: "2026 YSU President Scholarship",
  benefitItems: [{ label: coverage, included: true }],
  eligibilityItems: [{ label: "Academic and conduct review", value: "Meet YSU international admission requirements and the published degree-specific academic, language or achievement criteria" }],
  applicationMaterials: [{ label: "YSU admission and scholarship materials submitted through the online system" }],
  applicationSteps: [{ label: "Step 1", value: "Apply through the YSU international admission system by May 30" }, { label: "Step 2", value: "Complete university review and annual scholarship assessment" }],
  sourceFieldLineage: { ...scholarshipLineage, deadlineDate: "English brochure page 10 scholarship deadline" },
  summary: `YSU's 2026 president scholarship route for ${degree.toLowerCase()} students.`,
  sortOrder,
});
const scholarships = [
  {
    ...scholarshipBase,
    slug: "official-2026-yanshan-cgs-type-a",
    title: "Yanshan University 2026 Chinese Government Scholarship — Type A Bilateral Program",
    nameZh: "燕山大学2026年中国政府奖学金国别双边项目（A类）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type A",
    providerName: "国家留学基金管理委员会",
    providerNameEn: "China Scholarship Council",
    fundingLevel: "Under the applicable bilateral award",
    coverage: "Coverage follows the applicable CSC bilateral award",
    applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar",
    applicableProgram: "Programs permitted by the applicant's home-country dispatching authority",
    amountText: "The brochure does not publish one universal amount.",
    deadlineLabel: "Subject to the China Scholarship Council and dispatching-authority announcement",
    applicationRound: "2026 Chinese Government Scholarship Type A",
    benefitItems: [{ label: "CSC bilateral award coverage", included: true }],
    eligibilityItems: [{ label: "Route", value: "Apply through the dispatching department in the applicant's home country" }],
    applicationMaterials: [{ label: "Materials required by the dispatching authority and CSC" }],
    applicationSteps: [{ label: "Step 1", value: "Apply through the home-country dispatching department" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "YSU's 2026 Type A bilateral Chinese Government Scholarship route.",
    sortOrder: 10,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-yanshan-cgs-type-b",
    title: "Yanshan University 2026 Chinese Government Scholarship — Type B University Program",
    nameZh: "燕山大学2026年中国政府奖学金高校项目（B类）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B",
    providerName: "国家留学基金管理委员会 / 燕山大学",
    providerNameEn: "China Scholarship Council / Yanshan University",
    fundingLevel: "CSC award",
    coverage: "Coverage follows the applicable CSC university-program award",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "Eligible Yanshan University master's and doctoral programs",
    amountText: "The brochure does not restate fixed benefit amounts.",
    deadlineLabel: "Subject to the China Scholarship Council announcement",
    applicationRound: "2026 Chinese Government Scholarship Type B",
    benefitItems: [{ label: "CSC university-program award", included: true }],
    eligibilityItems: [{ label: "Degree route", value: "Master's or doctoral candidate selected and recommended by YSU" }],
    applicationMaterials: [{ label: "YSU and CSC application materials" }],
    applicationSteps: [{ label: "Step 1", value: "Apply through YSU and the CSC Type B route using YSU agency number 10216" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "YSU's 2026 Type B Chinese Government Scholarship route for graduate applicants.",
    sortOrder: 20,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-yanshan-international-chinese-language-teachers-scholarship",
    title: "Yanshan University 2026 International Chinese Language Teachers Scholarship",
    nameZh: "燕山大学2026年国际中文教师奖学金",
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "中外语言交流合作中心",
    providerNameEn: "Center for Language Education and Cooperation",
    fundingLevel: "Official award",
    coverage: "Coverage follows the International Chinese Language Teachers Scholarship award",
    applicableDegree: "Language student, Master",
    applicableProgram: "Chinese-language study and master's teaching-Chinese-to-speakers-of-other-languages route",
    amountText: "The brochure does not restate fixed benefit amounts.",
    deadlineLabel: "Subject to the Center for Language Education and Cooperation announcement",
    applicationRound: "2026 International Chinese Language Teachers Scholarship",
    benefitItems: [{ label: "Official scholarship coverage", included: true }],
    eligibilityItems: [{ label: "Program scope", value: "Language students and master's applicants in teaching Chinese to speakers of other languages" }],
    applicationMaterials: [{ label: "Materials required by the official scholarship system" }],
    applicationSteps: [{ label: "Step 1", value: "Apply through the official International Chinese Language Teachers Scholarship system" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "YSU's 2026 International Chinese Language Teachers Scholarship route.",
    sortOrder: 30,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-yanshan-hebei-government-scholarship",
    title: "Yanshan University 2026 Hebei Provincial Government Scholarship",
    nameZh: "燕山大学2026年河北省政府奖学金",
    type: "government",
    typeLabel: "Hebei Provincial Government Scholarship",
    providerName: "河北省人民政府",
    providerNameEn: "Hebei Provincial Government",
    fundingLevel: "Annual merit award",
    coverage: "Award and continuation are determined through the university's annual comprehensive evaluation",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Eligible YSU international degree students",
    amountText: "The brochure does not publish a fixed amount.",
    deadlineLabel: "Annual university evaluation; no new-applicant deadline is stated in the brochure",
    applicationRound: "2026 Hebei Provincial Government Scholarship",
    benefitItems: [{ label: "Annual merit-based support under provincial and university rules", included: true }],
    eligibilityItems: [{ label: "Evaluation", value: "Eligible degree students are reviewed comprehensively at the end of each year" }],
    applicationMaterials: [{ label: "Materials required by the annual university review" }],
    applicationSteps: [{ label: "Step 1", value: "Participate in the university's annual comprehensive evaluation" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "YSU's current Hebei provincial merit scholarship for eligible international degree students.",
    sortOrder: 40,
  },
  presidential("official-2026-yanshan-president-undergraduate", "Undergraduate", "Tuition included", "Tuition support; undergraduate scholarship recipients pay accommodation fees.", 50),
  presidential("yanshan-university-74", "Master", "Tuition, school dormitory accommodation and CNY 1,000 monthly allowance for 12 months per year", "Tuition and dormitory plus CNY 1,000/month for 12 months per year.", 60),
  presidential("yanshan-university", "Doctoral", "Tuition, school dormitory accommodation and CNY 2,000 monthly allowance for 12 months per year", "Tuition and dormitory plus CNY 2,000/month for 12 months per year.", 70),
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 13 || validation.summary.programIntakes !== 13 || validation.summary.scholarships !== 7) throw new Error(`Yanshan bundle invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Thirteen undergraduate routes, their teaching languages and CSCA subjects are transcribed from the official English brochure program table.",
      "All Fall 2026 degree routes are marked closed at the published June 15 deadline; no 2027 intake is inferred.",
      "Seven distinct scholarship records preserve the brochure's route and degree distinctions; the master's and doctoral presidential records reuse the two exact legacy slugs.",
      "Scholarship dates governed by CSC or annual evaluation remain descriptive rather than receiving invented dates.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
