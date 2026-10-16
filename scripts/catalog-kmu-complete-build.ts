import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-28-27-238Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.kmu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.kmu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((row) => row.id === "kunming-university-international-student-admissions-pdf-2026");
const expectedSha256 = "740bb23b2054f9f28363ad9be0f2ba27437f5f4a045ce9f5ccb81d2f0058889e";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error("Kunming University official evidence mismatch.");

const schoolSlug = "kunming-university";
const citySlug = "kunming";
const applicationUrl = "https://kmu.at0086.cn/StuApplication/Login.aspx";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Spec = readonly [nameZh: string, nameEn: string, years: number, tuition: number, category: string];
const undergraduate: Spec[] = [
  ["汉语言文学", "Chinese Language and Literature", 4, 9000, "Languages and Literature"],
  ["国际经济与贸易", "International Economics and Trade", 4, 9900, "Economics"],
  ["财务管理", "Financial Management", 4, 9900, "Business"],
  ["会计学", "Accounting", 4, 9900, "Business"],
  ["旅游管理", "Tourism Management", 4, 9900, "Management"],
  ["烹饪与营养教育", "Culinary and Nutrition Education", 4, 9900, "Education"],
  ["酒店管理", "Hospitality Management", 4, 9900, "Management"],
  ["数字人文", "Digital Humanities", 4, 9000, "Humanities"],
  ["计算机科学与技术", "Computer Science and Technology", 4, 9900, "Information Technology"],
  ["物联网工程", "Internet of Things Engineering", 4, 9900, "Information Technology"],
  ["软件工程", "Software Engineering", 4, 9900, "Information Technology"],
  ["特殊教育", "Special Education", 4, 9000, "Education"],
  ["学前教育", "Preschool Education", 4, 9000, "Education"],
  ["小学教育", "Primary Education", 4, 9000, "Education"],
  ["体育教育", "Physical Education", 4, 9000, "Education"],
  ["英语", "English", 4, 9000, "Languages and Literature"],
  ["泰语", "Thai Language", 4, 9000, "Languages and Literature"],
  ["电气工程及其自动化", "Electrical Engineering and Automation", 4, 9900, "Engineering"],
  ["智能制造工程专业", "Intelligent Manufacturing Engineering", 4, 9900, "Engineering"],
  ["机械设计制造及其自动化专业", "Mechanical Design, Manufacturing and Automation", 4, 9900, "Engineering"],
  ["音乐学", "Musicology", 4, 16000, "Arts"],
  ["舞蹈学", "Dance Studies", 4, 16000, "Arts"],
  ["视觉传达设计", "Visual Communication Design", 4, 16000, "Arts"],
  ["环境设计", "Environmental Design", 4, 16000, "Arts"],
  ["服装与服饰设计", "Fashion and Apparel Design", 4, 16000, "Arts"],
  ["美术学", "Fine Arts", 4, 16000, "Arts"],
  ["土木工程", "Civil Engineering", 4, 9900, "Engineering"],
  ["水利水电工程", "Water Resources and Hydropower Engineering", 4, 9900, "Engineering"],
  ["智慧建筑与建造", "Smart Architecture and Construction", 4, 9900, "Engineering"],
  ["智慧农业", "Smart Agriculture", 4, 9900, "Agriculture"],
  ["园艺", "Horticulture", 4, 9900, "Agriculture"],
  ["动物医学", "Veterinary Medicine", 4, 9900, "Medicine"],
  ["生物科学", "Biological Sciences", 4, 9900, "Science"],
  ["植物保护", "Plant Protection", 4, 9900, "Agriculture"],
  ["数学与应用数学", "Mathematics and Applied Mathematics", 4, 9900, "Science"],
  ["应用统计学", "Applied Statistics", 4, 9900, "Science"],
  ["数字经济", "Digital Economy", 4, 9900, "Economics"],
  ["物理学", "Physics", 4, 9900, "Science"],
  ["化学", "Chemistry", 4, 9900, "Science"],
  ["化学工程与工艺", "Chemical Engineering and Technology", 4, 9900, "Engineering"],
  ["临床医学", "Clinical Medicine", 5, 10800, "Medicine"],
  ["药学", "Pharmacy", 4, 10800, "Medicine"],
  ["护理学", "Nursing", 4, 10800, "Medicine"],
  ["医学检验技术", "Medical Laboratory Technology", 4, 9900, "Medicine"],
];
const masters: Spec[] = [
  ["中国语言文学", "Chinese Language and Literature", 3, 11000, "Languages and Literature"],
  ["物理学", "Physics", 3, 11000, "Science"],
  ["数学", "Mathematics", 3, 11000, "Science"],
  ["资源利用与植物保护", "Resource Utilization and Plant Protection", 3, 12000, "Agriculture"],
  ["材料与化工", "Materials and Chemical Engineering", 3, 12000, "Engineering"],
  ["国际商务", "International Business", 3, 13000, "Business"],
  ["小学教育", "Primary Education", 3, 12000, "Education"],
  ["学前教育", "Preschool Education", 3, 12000, "Education"],
  ["体育教学", "Physical Education Teaching", 3, 12000, "Education"],
  ["运动训练", "Sports Training", 3, 12000, "Sports"],
  ["社会体育指导", "Social Sports Guidance", 3, 12000, "Sports"],
  ["电子信息", "Electronic Information", 3, 12000, "Information Technology"],
  ["生物与医药", "Biology and Medicine", 3, 12000, "Medicine"],
  ["旅游管理", "Tourism Management", 3, 12000, "Management"],
  ["翻译", "Translation", 3, 12000, "Languages and Literature"],
  ["智能制造技术", "Intelligent Manufacturing Technology", 3, 12000, "Engineering"],
  ["土木工程", "Civil Engineering", 3, 12000, "Engineering"],
  ["水利工程", "Water Resources Engineering", 3, 12000, "Engineering"],
];

const makePrograms = (specs: Spec[], degreeLevel: "Undergraduate" | "Master"): CatalogSeedProgram[] => specs.map(([nameZh, nameEn, durationYears, tuitionAmount, fieldCategory]) => ({
  slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slugify(nameEn)}`,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel,
  durationYears,
  fieldCategory,
  subjectArea: nameEn,
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 4, minimum score 180; the certificate must be within its two-year validity period.",
  tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
  scholarshipText: "Yunnan Provincial Government and Kunming Municipal Government scholarship routes are listed in the 2026 brochure.",
  applicationUrl,
  applicationNote: "Applicants must also meet any program-specific written-test or interview requirements. English program names are editorial translations of the official Chinese table labels.",
  hasScholarship: true,
  status: "draft",
  ...evidence,
  sourceFieldLineage: {
    nameZh: degreeLevel === "Undergraduate" ? "Appendix 1: undergraduate program catalog" : "Appendix 2: postgraduate program catalog",
    nameEn: "editorial translation of the official Chinese program name",
    degreeLevel: degreeLevel === "Undergraduate" ? "Appendix 1 heading" : "Appendix 2 heading",
    durationYears: "program catalog row",
    teachingLanguage: "program catalog row",
    tuitionText: "program catalog row",
    hskRequirement: "III. Application Conditions / Language Proficiency",
    applicationUrl: "IV. Application Process",
  },
}));
const programs = [...makePrograms(undergraduate, "Undergraduate"), ...makePrograms(masters, "Master")];
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-29T16:00:00.000Z",
  deadlineLabel: "June 30, 2026 at 00:00 Beijing time",
  applicationRound: "2026 international student admissions",
  status: "closed" as const,
  ...evidence,
  sourceFieldLineage: { intakeYear: "brochure title", deadlineDate: "IX. Application Deadline" },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Kunming", nameZh: "昆明", province: "Yunnan", region: "Southwest China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "official university identity", nameZh: "official university identity", province: "official university identity", region: "CUAC geographic taxonomy" } }],
  schools: [{
    slug: schoolSlug,
    nameEn: "Kunming University",
    nameZh: "昆明学院",
    citySlug,
    schoolType: "Public",
    region: "Kunming, Yunnan, Southwest China",
    applicationLevel: "Undergraduate, Master, Preparatory, Non-degree Chinese Language",
    languageOfInstruction: "Chinese for every degree program listed in the 2026 appendices",
    languageRequirement: "HSK Level 4 with at least 180 points for Chinese-taught degree programs; preparatory and Chinese-language applicants have separate entry handling.",
    hskRequirement: "HSK Level 4, minimum score 180, within the two-year certificate validity period.",
    deadlineSummary: "June 30, 2026 at 00:00 Beijing time; the reviewed cycle is closed and no later deadline is inferred.",
    tuitionSummary: "Undergraduate: CNY 9,000-16,000/year by category. Master: CNY 11,000-13,000/year by program. Preparatory/Chinese language: CNY 8,000/year.",
    websiteUrl: "https://www.kmu.edu.cn/",
    admissionsUrl: source.finalUrl,
    subjectTags: ["Humanities", "Business", "Engineering", "Education", "Arts", "Agriculture", "Medicine", "Science"],
    languageTags: ["Chinese", "HSK 4"],
    campusHighlights: ["Kunming location", "44 listed undergraduate programs", "18 listed master's programs"],
    status: "draft",
    ...evidence,
    sourceFieldLineage: { nameEn: "brochure title / editorial English rendering", nameZh: "brochure title", citySlug: "official university identity", schoolType: "official university identity", applicationLevel: "I. Admission Categories", languageRequirement: "III. Application Conditions", deadlineSummary: "IX. Application Deadline", tuitionSummary: "VIII. Fees and Scholarships plus appendices", websiteUrl: "official university domain", admissionsUrl: "registered official PDF" },
  }],
  programs,
  programIntakes,
  scholarships: [],
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
      "All 44 undergraduate and 18 master's rows are transcribed from appendices 1 and 2 of the official 2026 PDF.",
      "English program names are editorial translations; Chinese names, durations, tuition and teaching language are explicit in the official tables.",
      "No unlisted doctoral program, 2027 intake, scholarship amount, or program-specific CSCA subject is inferred.",
      "Personal contact details, bank data and applicant documents are excluded.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
