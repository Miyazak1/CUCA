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

const root = process.cwd();
const identityPath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/2026-10-15T08-28-30-939Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.yanshan-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.yanshan-complete-batch-01.validation.json");
const [identityText, manifestText] = await Promise.all([readFile(identityPath, "utf8"), readFile(manifestPath, "utf8")]);
const identity = JSON.parse(identityText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { id: string; label: string; url: string; sha256: string; status: number; fetchedAt: string }[] };
const city = identity.cities?.find((row) => row.slug === "qinhuangdao");
const school = identity.schools?.find((row) => row.slug === "yanshan-university");
if (!city || !school) throw new Error("Missing Qinhuangdao/Yanshan identity dependencies");
const pdf = manifest.sources.find((row) => row.id === "qinhuangdao-ysu-international-admission-guide-pdf-2-2026" && row.status === 200);
const page = manifest.sources.find((row) => row.id === "qinhuangdao-ysu-international-admission-guide-2026" && row.status === 200);
if (!pdf || pdf.sha256 !== "f6517f43679db0bc12fa6e2a523cd7f978f840578383b2106012f921191c48fe"
  || !page || page.sha256 !== "31a32974b3a76ec61d3314104319ec6d4b5ea9da49df220a571b1aaaa505449d") {
  throw new Error("Missing or changed Yanshan English brochure evidence");
}

type ProgramDefinition = {
  slug: string;
  name: string;
  schoolName: string;
  degree: "Undergraduate" | "Master" | "Doctoral" | "Non-degree";
  durationYears: number;
  language: "Chinese" | "English" | "Chinese / English";
  csca?: string[];
  field: string;
};
const u = (slug: string, name: string, schoolName: string, language: "Chinese" | "English", csca: string[], field: string): ProgramDefinition =>
  ({ slug, name, schoolName, degree: "Undergraduate", durationYears: 4, language, csca, field });
const graduate = (degree: "Master" | "Doctoral", suffix: string, name: string, schoolName: string,
  language: ProgramDefinition["language"], field: string): ProgramDefinition => ({
  slug: `official-2026-yanshan-${degree.toLowerCase()}-${suffix}`, name, schoolName, degree,
  durationYears: degree === "Master" ? 3 : 4, language, field,
});
const undergraduate: ProgramDefinition[] = [
  u("yanshan-university-electronic-science-and-technology", "Electronic Science and Technology", "School of Information Science and Engineering (School of Software)", "English", ["Mathematics", "Physics"], "Engineering"),
  u("yanshan-university-economics-and-finance", "Economics and Finance", "School of Economics and Management", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Economics and Management"),
  u("yanshan-university-business-administration", "Business Administration", "School of Economics and Management", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Economics and Management"),
  u("yanshan-university-accounting", "Accounting", "School of Economics and Management", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Economics and Management"),
  u("yanshan-university-tourism-management", "Tourism Management", "School of Economics and Management", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Economics and Management"),
  u("yanshan-university-e-commerce", "E-commerce", "School of Economics and Management", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Economics and Management"),
  u("yanshan-university-industrial-engineering", "Industrial Engineering", "School of Economics and Management", "Chinese", ["Chinese (Humanities)", "Mathematics", "Physics"], "Engineering and Management"),
  u("yanshan-university-japanese", "Japanese", "School of Foreign Studies", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Languages"),
  u("yanshan-university-law", "Law", "School of Humanities and Law (School of Public Administration)", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Law"),
  u("yanshan-university-chinese-language-and-literature", "Chinese Language and Literature", "School of Humanities and Law (School of Public Administration)", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Languages and Literature"),
  u("yanshan-university-teaching-chinese-to-speakers-of-other-languages", "Teaching Chinese to Speakers of Other Languages", "School of Humanities and Law (School of Public Administration)", "Chinese", ["Chinese (Humanities)", "Mathematics"], "Language Education"),
  u("official-2026-yanshan-chemical-engineering-and-technology", "Chemical Engineering and Technology", "School of Environmental and Chemical Engineering", "Chinese", ["Chinese (STEM)", "Mathematics"], "Engineering"),
  u("official-2026-yanshan-petroleum-engineering", "Petroleum Engineering", "School of Vehicle and Energy", "Chinese", ["Chinese (STEM)", "Mathematics", "Physics", "Chemistry"], "Engineering"),
];
const masters: ProgramDefinition[] = [
  graduate("Master", "mechanical-engineering", "Mechanical Engineering", "School of Mechanical Engineering", "Chinese / English", "Engineering"),
  graduate("Master", "materials-physics-and-chemistry", "Materials Physics and Chemistry", "School of Materials Science and Engineering", "Chinese / English", "Materials Science"),
  graduate("Master", "materials-science", "Materials Science", "School of Materials Science and Engineering", "Chinese / English", "Materials Science"),
  graduate("Master", "control-science-and-engineering", "Control Science and Engineering", "School of Electrical Engineering", "Chinese / English", "Engineering"),
  graduate("Master", "electrical-engineering", "Electrical Engineering", "School of Electrical Engineering", "Chinese / English", "Engineering"),
  graduate("Master", "instrument-science-and-technology", "Instrument Science and Technology", "School of Electrical Engineering", "Chinese / English", "Engineering"),
  graduate("Master", "electronic-science-and-technology", "Electronic Science and Technology", "School of Information Science and Engineering (School of Software)", "Chinese / English", "Engineering"),
  graduate("Master", "information-and-communication-engineering", "Information and Communication Engineering", "School of Information Science and Engineering (School of Software)", "Chinese / English", "Engineering"),
  graduate("Master", "computer-science-and-technology", "Computer Science and Technology", "School of Information Science and Engineering (School of Software)", "Chinese / English", "Computer Science"),
  graduate("Master", "mba", "MBA", "School of Economics and Management", "English", "Business Administration"),
  graduate("Master", "applied-economics", "Applied Economics", "School of Economics and Management", "Chinese", "Economics"),
  graduate("Master", "management-science-and-engineering", "Management Science and Engineering", "School of Economics and Management", "Chinese", "Management"),
  graduate("Master", "business-administration-enterprise-management", "Business Administration (Enterprise Management)", "School of Economics and Management", "Chinese", "Business Administration"),
  graduate("Master", "business-administration-accounting", "Business Administration (Accounting)", "School of Economics and Management", "Chinese", "Business Administration"),
  graduate("Master", "business-administration-tourism-management", "Business Administration (Tourism Management)", "School of Economics and Management", "Chinese", "Business Administration"),
  graduate("Master", "english-language-and-literature", "English Language and Literature", "School of Foreign Studies", "Chinese / English", "Languages"),
  graduate("Master", "linguistics-and-applied-linguistics", "Linguistics and Applied Linguistics", "School of Foreign Studies", "Chinese / English", "Languages"),
  graduate("Master", "civil-engineering", "Civil Engineering", "School of Civil Engineering and Mechanics", "Chinese / English", "Engineering"),
  graduate("Master", "mechanics", "Mechanics", "School of Civil Engineering and Mechanics", "Chinese / English", "Mechanics"),
  graduate("Master", "master-of-laws", "Master of Laws", "School of Humanities and Law (School of Public Administration)", "Chinese", "Law"),
  graduate("Master", "juris-master-non-law", "Juris Master (Non-Law)", "School of Humanities and Law (School of Public Administration)", "Chinese", "Law"),
  graduate("Master", "juris-master-law", "Juris Master (Law)", "School of Humanities and Law (School of Public Administration)", "Chinese", "Law"),
  graduate("Master", "international-chinese-language-education", "International Chinese Language Education", "School of Humanities and Law (School of Public Administration)", "Chinese", "Language Education"),
  graduate("Master", "public-management", "Public Management", "School of Humanities and Law (School of Public Administration)", "Chinese", "Public Administration"),
  graduate("Master", "physics", "Physics", "School of Science", "Chinese / English", "Physics"),
  graduate("Master", "chemical-engineering-and-technology", "Chemical Engineering and Technology", "School of Environmental and Chemical Engineering", "Chinese", "Engineering"),
  graduate("Master", "environmental-science-and-engineering", "Environmental Science and Engineering", "School of Environmental and Chemical Engineering", "Chinese", "Environmental Science"),
  graduate("Master", "music", "Music", "School of Arts and Design", "Chinese", "Arts"),
  graduate("Master", "dance", "Dance", "School of Arts and Design", "Chinese", "Arts"),
  graduate("Master", "design", "Design (Industrial Design / Product Design)", "School of Arts and Design", "Chinese / English", "Design"),
  graduate("Master", "vehicle-engineering", "Vehicle Engineering", "School of Vehicle and Energy", "Chinese / English", "Engineering"),
  graduate("Master", "petroleum-and-gas-engineering", "Petroleum and Gas Engineering", "School of Vehicle and Energy", "Chinese", "Engineering"),
  graduate("Master", "physical-education-teaching", "Physical Education Teaching", "School of Physical Education", "Chinese", "Physical Education"),
  graduate("Master", "athletic-training", "Athletic Training", "School of Physical Education", "Chinese", "Physical Education"),
];
const doctorals: ProgramDefinition[] = [
  graduate("Doctoral", "mechanical-engineering", "Mechanical Engineering", "School of Mechanical Engineering", "Chinese / English", "Engineering"),
  graduate("Doctoral", "materials-physics-and-chemistry", "Materials Physics and Chemistry", "School of Materials Science and Engineering", "Chinese / English", "Materials Science"),
  graduate("Doctoral", "materials-science", "Materials Science", "School of Materials Science and Engineering", "Chinese / English", "Materials Science"),
  graduate("Doctoral", "control-science-and-engineering", "Control Science and Engineering", "School of Electrical Engineering", "Chinese / English", "Engineering"),
  graduate("Doctoral", "electrical-engineering", "Electrical Engineering", "School of Electrical Engineering", "Chinese / English", "Engineering"),
  graduate("Doctoral", "electronic-science-and-technology", "Electronic Science and Technology", "School of Information Science and Engineering (School of Software)", "Chinese / English", "Engineering"),
  graduate("Doctoral", "information-and-communication-engineering", "Information and Communication Engineering", "School of Information Science and Engineering (School of Software)", "Chinese / English", "Engineering"),
  graduate("Doctoral", "computer-science-and-technology", "Computer Science and Technology", "School of Information Science and Engineering (School of Software)", "Chinese / English", "Computer Science"),
  graduate("Doctoral", "management-science-and-engineering", "Management Science and Engineering", "School of Economics and Management", "English", "Management"),
  graduate("Doctoral", "business-administration", "Business Administration", "School of Economics and Management", "English", "Business Administration"),
  graduate("Doctoral", "mechanics", "Mechanics", "School of Civil Engineering and Mechanics", "Chinese / English", "Mechanics"),
  graduate("Doctoral", "public-management", "Public Management", "School of Humanities and Law (School of Public Administration)", "Chinese", "Public Administration"),
  graduate("Doctoral", "physics", "Physics", "School of Science", "Chinese / English", "Physics"),
  graduate("Doctoral", "chemical-engineering-and-technology", "Chemical Engineering and Technology", "School of Environmental and Chemical Engineering", "Chinese", "Engineering"),
  graduate("Doctoral", "vehicle-engineering", "Vehicle Engineering", "School of Vehicle and Energy", "Chinese / English", "Engineering"),
];
const languageProgram: ProgramDefinition = {
  slug: "official-2026-yanshan-chinese-language-and-literature-nondegree", name: "Chinese Language and Literature",
  schoolName: "School of International Education", degree: "Non-degree", durationYears: 1, language: "Chinese", field: "Chinese Language",
};
const definitions = [...undergraduate, ...masters, ...doctorals, languageProgram];
if (undergraduate.length !== 13 || masters.length !== 34 || doctorals.length !== 15 || definitions.length !== 63) {
  throw new Error("Unexpected Yanshan complete program set.");
}
const sourceBase = {
  status: "draft" as const,
  sourceUrl: pdf.url,
  sourceLabel: pdf.label,
  sourceSha256: pdf.sha256,
  capturedAt: pdf.fetchedAt,
};
const tuitionFor = (row: ProgramDefinition) => {
  if (row.degree === "Undergraduate") return { amount: 15700, text: "CNY 15,700 per academic year", display: "CNY 15,700/year" };
  if (row.degree === "Master" && row.language === "Chinese") return { amount: 19800, text: "CNY 19,800 per academic year", display: "CNY 19,800/year" };
  if (row.degree === "Master" && row.language === "English") return { amount: 24800, text: "CNY 24,800 per academic year", display: "CNY 24,800/year" };
  if (row.degree === "Master") return { text: "CNY 19,800/year in Chinese or CNY 24,800/year in English", display: "CNY 19,800-24,800/year" };
  if (row.degree === "Doctoral" && row.language === "Chinese") return { amount: 23100, text: "CNY 23,100 per academic year", display: "CNY 23,100/year" };
  if (row.degree === "Doctoral" && row.language === "English") return { amount: 28100, text: "CNY 28,100 per academic year", display: "CNY 28,100/year" };
  if (row.degree === "Doctoral") return { text: "CNY 23,100/year in Chinese or CNY 28,100/year in English", display: "CNY 23,100-28,100/year" };
  return { text: "CNY 7,000 per semester or CNY 14,000 per academic year", display: "CNY 7,000/semester or 14,000/year" };
};
const programs = definitions.map<CatalogSeedProgram>((row) => {
  const tuition = tuitionFor(row);
  const pageNumber = row.degree === "Undergraduate" ? 3 : row.degree === "Master" ? 4 : row.degree === "Doctoral" ? 5 : 6;
  return ({
  slug: row.slug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: row.name,
  degreeLevel: row.degree,
  durationYears: row.durationYears,
  fieldCategory: row.field,
  subjectArea: row.schoolName,
  teachingLanguage: row.language,
  hskRequirement: row.degree !== "Non-degree" && row.language.includes("Chinese") ? "HSK Level 4 for Chinese-taught study" : undefined,
  englishRequirement: row.degree !== "Non-degree" && row.language.includes("English") ? "Academic IELTS 6.0 overall with each band at least 5.5; TOEFL 85 overall with each band at least 20; GRE 300; Duolingo 95; equivalent proof; or English-medium highest qualification." : undefined,
  cscaSubjects: row.csca,
  cscaRequirement: row.csca ? `CSCA required before the program deadline; subjects: ${row.csca.join(", ")}.` : undefined,
  tuitionAmount: tuition.amount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "academic_year",
  tuitionText: tuition.text,
  displayTuition: tuition.display,
  applicationUrl: "https://admission.ysu.edu.cn/",
  applicationNote: row.degree === "Non-degree" ? "The official guide publishes one-semester and one-year Chinese-language study with spring and fall deadlines."
    : `Applicants must meet the published ${row.degree.toLowerCase()} requirements. Fall 2026 degree applications closed June 15, 2026.`,
  displaySubjects: row.csca,
  displayGroup: `2026-international-${row.degree.toLowerCase().replace("non-degree", "language")}`,
  displayGroupLabel: `2026 international ${row.degree === "Non-degree" ? "Chinese-language" : row.degree.toLowerCase()} programs`,
  ...sourceBase,
  sourceFieldLineage: {
    nameEn: `English brochure page ${pageNumber} program table`,
    degreeLevel: `English brochure page ${pageNumber} section heading`,
    durationYears: `English brochure page ${pageNumber} section heading`,
    subjectArea: `English brochure page ${pageNumber} school column`,
    teachingLanguage: `English brochure page ${pageNumber} teaching-language column`,
    hskRequirement: row.degree !== "Non-degree" && row.language.includes("Chinese") ? `English brochure page ${pageNumber} application requirements` : undefined,
    englishRequirement: row.degree !== "Non-degree" && row.language.includes("English") ? `English brochure page ${pageNumber} application requirements` : undefined,
    cscaSubjects: row.csca ? "English brochure page 3 entrance-examination table" : undefined,
    cscaRequirement: row.csca ? "English brochure page 3 application requirements and subject table" : undefined,
    tuitionAmount: tuition.amount === undefined ? undefined : "English brochure page 7 fee table",
    tuitionCurrency: "English brochure page 7 fee table",
    tuitionPeriod: "English brochure page 7 fee table",
    tuitionText: "English brochure page 7 fee table",
    applicationUrl: `English brochure pages ${pageNumber} and 10`,
    applicationNote: `English brochure pages ${pageNumber} and 10`,
  },
  });
});
const degreeIntakes = definitions.filter((row) => row.degree !== "Non-degree").map<CatalogSeedProgramIntake>((row) => ({
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
  capturedAt: pdf.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "derived from fall-semester degree deadline on English brochure page 10",
    intakeYear: "explicit: 2026 brochure",
    deadlineDate: "English brochure page 10 degree-program deadline",
    deadlineLabel: "English brochure page 10; closed derived from capture date",
    applicationRound: "explicit: 2026 brochure context",
    status: "derived: deadline predates evidence capture",
  },
}));
const languageIntakes: CatalogSeedProgramIntake[] = [
  { term: "Spring", deadlineDate: "2025-12-15T00:00:00.000Z", deadlineLabel: "December 15, 2025 — closed",
    deadlineLineage: "derived from the 2026 guide's Spring Semester December 15 deadline" },
  { term: "Fall", deadlineDate: "2026-06-15T00:00:00.000Z", deadlineLabel: "June 15, 2026 — closed",
    deadlineLineage: "2026 guide's Fall Semester June 15 deadline" },
].map((intake) => ({
  programSlug: languageProgram.slug, intakeTerm: intake.term, intakeYear: 2026, deadlineDate: intake.deadlineDate,
  deadlineLabel: intake.deadlineLabel, applicationRound: `Yanshan University 2026 ${intake.term.toLowerCase()} Chinese-language admission`,
  status: "closed", sourceUrl: pdf.url, sourceLabel: pdf.label, sourceSha256: pdf.sha256, capturedAt: pdf.fetchedAt,
  sourceFieldLineage: { intakeTerm: "English brochure page 10 deadline table", intakeYear: "explicit: 2026 guide context",
    deadlineDate: intake.deadlineLineage, deadlineLabel: intake.deadlineLineage, applicationRound: "explicit 2026 guide context",
    status: "derived: deadline predates evidence capture" },
}));
const programIntakes: CatalogSeedProgramIntake[] = [...degreeIntakes, ...languageIntakes];
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
const scholarships: CatalogSeedScholarship[] = [
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

const refreshedSchool = { ...school, sourceUrl: page.url, sourceLabel: page.label, sourceSha256: page.sha256, capturedAt: page.fetchedAt };
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [refreshedSchool], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 63 || validation.summary.programIntakes !== 64 || validation.summary.scholarships !== 7) throw new Error(`Yanshan bundle invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The complete reviewed guide scope contains 13 undergraduate, 34 master's, 15 doctoral and one non-degree Chinese-language program.",
      "All 62 Fall 2026 degree routes are marked closed at the published June 15 deadline; the Chinese-language route has separate Spring and Fall 2026 intake bindings.",
      "The Spring 2026 Chinese-language deadline is recorded as December 15, 2025 by derivation from the guide's 2026 Spring Semester row and remains review-required.",
      "Undergraduate teaching languages and CSCA subjects are transcribed from page 3; graduate language options come from pages 4-5; the language program comes from page 6.",
      "Seven distinct scholarship records preserve the brochure's route and degree distinctions; the master's and doctoral presidential records reuse the two exact legacy slugs.",
      "Scholarship dates governed by CSC or annual evaluation remain descriptive rather than receiving invented dates.",
      "The October 15 refresh preserved the exact official page and PDF hashes, and all ten PDF pages were rendered and visually rechecked.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
