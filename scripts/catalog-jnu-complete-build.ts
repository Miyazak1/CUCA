import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T11-04-36-785Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.guangzhou-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.jnu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.jnu-complete-batch-01.validation.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const cityBundle = JSON.parse(await readFile(cityPath, "utf8"));
const sources = new Map<string, any>((manifest.sources || []).map((row: any) => [row.id, row]));
const expected = {
  "jnu-international-undergraduate-admissions-2026": "410a58a54a4e30732ac9fdad9433e910386ca269a0b0127b34e0b3fcac2ef62c",
  "jnu-international-graduate-admissions-2026": "88786309243efe9afbd1ec94f3d723ddf6ef4405d024cf3527097de8fa156c73",
  "jnu-cgs-high-level-graduate-2026": "6d41c2e1855773aee18e5ff0101e71bc5669d4411296e3d2fb7703c329ae93a8",
  "jnu-cgs-silk-road-undergraduate-2026": "d87a2eb8ae996554f2ca9059b51b3f3948d891317200c2aa35d9f8832acf22d5",
} as const;
for (const [id, hash] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== hash) throw new Error(`JNU evidence mismatch: ${id}`);
}

const undergraduate = sources.get("jnu-international-undergraduate-admissions-2026");
const graduate = sources.get("jnu-international-graduate-admissions-2026");
const highLevel = sources.get("jnu-cgs-high-level-graduate-2026");
const silkRoad = sources.get("jnu-cgs-silk-road-undergraduate-2026");
const schoolSlug = "jinan-university";
const citySlug = "guangzhou";

type ProgramSpec = {
  slug: string; nameEn: string; nameZh: string; durationYears: number; category: string;
  language: "Chinese" | "English"; tuition: number; csca: string[]; note?: string;
};
const specs: ProgramSpec[] = [
  { slug: "jinan-university-accounting", nameEn: "Accounting", nameZh: "会计学", durationYears: 4, category: "Management", language: "Chinese", tuition: 19000, csca: ["Chinese for Humanities", "Mathematics"] },
  { slug: "jinan-university-accounting-international-college", nameEn: "Accounting (International College)", nameZh: "会计学（国际学院）", durationYears: 4, category: "Management", language: "English", tuition: 32000, csca: ["Mathematics"] },
  { slug: "jinan-university-artificial-intelligence", nameEn: "Artificial Intelligence", nameZh: "人工智能", durationYears: 4, category: "Engineering", language: "Chinese", tuition: 22000, csca: ["Chinese for STEM", "Mathematics", "Physics"] },
  { slug: "jinan-university-business-administration", nameEn: "Business Administration", nameZh: "工商管理", durationYears: 4, category: "Management", language: "Chinese", tuition: 19000, csca: ["Chinese for Humanities", "Mathematics"] },
  { slug: "jinan-university-chinese-language-and-literature-teacher-education-shipai", nameEn: "Chinese Language and Literature (Teacher Education, Shipai Campus)", nameZh: "汉语言文学（师范）", durationYears: 4, category: "Literature", language: "Chinese", tuition: 19000, csca: ["Mathematics"], note: "Kept separate from the Zhuhai-campus route because the legacy generic identity is ambiguous." },
  { slug: "jinan-university-chinese-language-and-literature-zhuhai", nameEn: "Chinese Language and Literature (Zhuhai Campus)", nameZh: "汉语言文学", durationYears: 4, category: "Literature", language: "Chinese", tuition: 19000, csca: ["Mathematics"], note: "Kept separate from the Shipai teacher-education route because the legacy generic identity is ambiguous." },
  { slug: "jinan-university-clinical-medicine-international-college", nameEn: "Clinical Medicine (International College)", nameZh: "临床医学（国际学院）", durationYears: 6, category: "Medicine", language: "English", tuition: 40000, csca: ["Mathematics", "Chemistry"] },
  { slug: "jinan-university-computer-science-and-technology", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", durationYears: 4, category: "Engineering", language: "Chinese", tuition: 22000, csca: ["Chinese for STEM", "Mathematics", "Physics"] },
  { slug: "jinan-university-computer-science-and-technology-international-college", nameEn: "Computer Science and Technology (International College)", nameZh: "计算机科学与技术（国际学院）", durationYears: 4, category: "Engineering", language: "English", tuition: 30000, csca: ["Mathematics", "Physics"] },
  { slug: "jinan-university-finance", nameEn: "Finance", nameZh: "金融学", durationYears: 4, category: "Economics", language: "Chinese", tuition: 19000, csca: ["Chinese for Humanities", "Mathematics"] },
  { slug: "jinan-university-finance-international-college", nameEn: "Finance (International College)", nameZh: "金融学（国际学院）", durationYears: 4, category: "Economics", language: "English", tuition: 28000, csca: ["Mathematics"] },
  { slug: "jinan-university-international-economics-and-trade", nameEn: "International Economics and Trade", nameZh: "国际经济与贸易", durationYears: 4, category: "Economics", language: "Chinese", tuition: 19000, csca: ["Chinese for Humanities", "Mathematics"] },
  { slug: "jinan-university-international-economics-and-trade-international-college", nameEn: "International Economics and Trade (International College)", nameZh: "国际经济与贸易（国际学院）", durationYears: 4, category: "Economics", language: "English", tuition: 28000, csca: ["Mathematics"] },
  { slug: "jinan-university-journalism", nameEn: "Journalism", nameZh: "新闻学", durationYears: 4, category: "Journalism", language: "Chinese", tuition: 19000, csca: ["Chinese for Humanities", "Mathematics"] },
  { slug: "jinan-university-law", nameEn: "Law", nameZh: "法学", durationYears: 4, category: "Law", language: "Chinese", tuition: 19000, csca: ["Chinese for Humanities", "Mathematics"] },
  { slug: "jinan-university-software-engineering", nameEn: "Software Engineering", nameZh: "软件工程", durationYears: 4, category: "Engineering", language: "Chinese", tuition: 22000, csca: ["Chinese for STEM", "Mathematics", "Physics"] },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => ({
  slug: spec.slug, schoolSlug, citySlug, nameEn: spec.nameEn, nameZh: spec.nameZh,
  degreeLevel: "Undergraduate", durationYears: spec.durationYears, fieldCategory: spec.category,
  subjectArea: spec.nameEn, teachingLanguage: spec.language, cscaSubjects: spec.csca,
  cscaRequirement: `The official 2026 catalog lists ${spec.csca.join(", ")} for this route.`,
  ...(spec.language === "Chinese"
    ? { hskRequirement: "HSK Level 5 score 180 or above." }
    : { englishRequirement: "IELTS 5.5 with no component below 5.0, TOEFL iBT 80, or SAT 1030; the guide also describes exemptions for applicable applicants." }),
  tuitionAmount: spec.tuition, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/year`,
  applicationUrl: undergraduate.url, applicationNote: spec.note || "Official 2026 international undergraduate route; applications are made through Jinan University's own admissions system.",
  hasScholarship: true, scholarshipText: "The official 2026 guide lists several scholarship routes; eligibility and deadlines differ by award.",
  status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label,
  sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt,
  sourceFieldLineage: {
    nameEn: "editorial English rendering of the official 2026 major table; requires review", nameZh: "2026 major table",
    degreeLevel: "guide title", durationYears: "2026 major table", teachingLanguage: "college heading and guide language rules",
    cscaSubjects: "2026 major table",
    ...(spec.language === "Chinese" ? { hskRequirement: "language requirements" } : { englishRequirement: "language requirements" }),
    tuitionAmount: "2026 tuition table", applicationUrl: "registered official guide URL",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
  openDate: "2026-01-14T16:00:00.000Z", deadlineDate: "2026-05-31T15:59:59.000Z",
  deadlineLabel: "Application-review admission: January 15-February 28 and April 1-May 31, 2026",
  applicationRound: "2026 application-review admission", status: "closed" as const,
  sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256,
  capturedAt: undergraduate.fetchedAt, sourceFieldLineage: { openDate: "official enrollment schedule", deadlineDate: "official enrollment schedule", intakeYear: "guide cycle" },
}));

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
function scholarshipBase(source: any) {
  return { schoolSlug, status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256,
    capturedAt: source.fetchedAt, providerLocation: "Guangzhou, Guangdong, China", targetRegions: [],
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }],
    sourceFieldLineage: { title: "official page title", fundingLevel: "funding section", coverage: "funding section",
      applicableDegree: "program section", applicableProgram: "program section", deadlineDate: "official schedule",
      eligibilityItems: "eligibility section", applicationMaterials: "materials section", applicationSteps: "application procedure" } };
}
const scholarships: CatalogSeedScholarship[] = [
  { ...scholarshipBase(highLevel), slug: "official-2026-jnu-cgs-high-level-graduate", title: "Jinan University 2026 Chinese Government Scholarship - High-Level Graduate Program",
    nameZh: "暨南大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship",
    providerName: "国家留学基金管理委员会 / 暨南大学", providerNameEn: "China Scholarship Council / Jinan University",
    fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.",
    applicableDegree: "Master, Doctoral", applicableProgram: "All Jinan University graduate programs subject to published entry requirements",
    amountText: "Full scholarship under the published Chinese Government Scholarship standard.", deadlineDate: "2026-03-24",
    deadlineLabel: "University application closed March 3, 2026; CSC submission closed March 24, 2026", applicationRound: "2026 high-level graduate scholarship",
    targetCountries: [], benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Citizenship", "Non-Chinese citizen"), info("Age", "Master generally under 35; doctoral generally under 40"), info("Language", "Published HSK or English threshold for the selected program")],
    applicationMaterials: [info("JNU graduate application materials"), info("CSC application after pre-admission nomination")],
    applicationSteps: [info("Step 1", "Apply to Jinan University and the relevant college"), info("Step 2", "Complete college interview and nomination review"), info("Step 3", "After pre-admission, submit the CSC Type B application")],
    summary: "Closed 2026 full scholarship route for nominated master's and doctoral applicants." },
  { ...scholarshipBase(silkRoad), slug: "official-2026-jnu-cgs-silk-road-undergraduate", title: "Jinan University 2026 Chinese Government Scholarship - Silk Road Undergraduate Program",
    nameZh: "暨南大学2026年丝绸之路中国政府奖学金项目", type: "government", typeLabel: "Chinese Government Scholarship - Silk Road",
    providerName: "国家留学基金管理委员会 / 暨南大学", providerNameEn: "China Scholarship Council / Jinan University",
    fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.",
    applicableDegree: "Undergraduate", applicableProgram: "Business Administration, International Business and Tourism Management, Chinese-taught 2+2 route",
    amountText: "Full scholarship; CNY 500 application fee and visa fees remain self-funded.", deadlineDate: "2026-05-17",
    deadlineLabel: "May 17, 2026, 24:00 Beijing Time", applicationRound: "2026 Silk Road undergraduate scholarship",
    targetCountries: ["Vietnam", "Myanmar", "Cambodia", "Thailand", "Malaysia", "Indonesia", "Philippines", "Uzbekistan", "Italy", "Ecuador"],
    benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Nationality", "Limited to the ten countries published in the official guide"), info("Age", "18-25"), info("Language", "HSK Level 4 score 180 or above"), info("CSCA", "Chinese for Humanities and Mathematics scores of 50 or above are preferred")],
    applicationMaterials: [info("CSC application form"), info("JNU application form"), info("Passport"), info("Diploma and transcripts"), info("HSK certificate"), info("CSCA report"), info("Personal statement"), info("Recommendation"), info("Physical examination"), info("No-criminal-record certificate")],
    applicationSteps: [info("Step 1", "Apply in the CSC system as Type B using agency number 10559"), info("Step 2", "Apply in Jinan University's undergraduate system"), info("Step 3", "Submit the published evidence and await nomination and CSC final review")],
    summary: "Closed 2026 full undergraduate scholarship for three Chinese-taught 2+2 programs and ten published nationalities." },
];

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt, cities: [cityBundle.cities[0]],
  schools: [{ slug: schoolSlug, nameEn: "Jinan University", nameZh: "暨南大学", citySlug,
    schoolType: "Public", region: "Guangzhou, Guangdong, South China", applicationLevel: "Undergraduate, Master and Doctoral",
    languageOfInstruction: "Chinese and English", languageRequirement: "Chinese- and English-taught programs use different published language thresholds.",
    hskRequirement: "Undergraduate Chinese-taught programs require HSK 5 score 180; graduate thresholds vary by discipline.",
    englishRequirement: "Undergraduate International College: IELTS 5.5, TOEFL iBT 80 or SAT 1030; graduate English routes: TOEFL 90 or IELTS 6.5.",
    deadlineSummary: "Reviewed 2026 undergraduate and graduate admission cycles are closed; no 2027 cycle is inferred.",
    tuitionSummary: "2026 undergraduate tuition ranges from CNY 19,000 to CNY 40,000/year by college and subject category.",
    applicationFee: "CNY 500", websiteUrl: "https://www.jnu.edu.cn/", admissionsUrl: undergraduate.url,
    cscaRequired: true, cscaRequirement: "The 2026 undergraduate major table publishes route-specific CSCA subjects.",
    cscaSubjects: ["Chinese for Humanities", "Chinese for STEM", "Mathematics", "Physics", "Chemistry"],
    subjectTags: ["Business", "Economics", "Engineering", "Medicine", "Law", "Journalism", "Chinese Language"],
    languageTags: ["Chinese", "English"], campusHighlights: ["Five campuses in Guangzhou, Zhuhai and Shenzhen", "Official 2026 catalog includes Chinese- and English-taught undergraduate routes"],
    status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256,
    capturedAt: undergraduate.fetchedAt, sourceFieldLineage: { nameEn: "official English university identity", nameZh: "official guide title", citySlug: "official guide campus section",
      applicationLevel: `undergraduate guide plus graduate guide ${graduate.sha256}`, languageOfInstruction: "official program and language sections",
      deadlineSummary: `undergraduate guide plus graduate guide ${graduate.sha256}`, tuitionSummary: "undergraduate tuition table", applicationFee: "both admission guides", admissionsUrl: "registered official guide URL" } }],
  programs, programIntakes, scholarships,
};

const validation = createCatalogMigrationValidationReport(candidate);
const candidateText = JSON.stringify(candidate, null, 2) + "\n";
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(await readFile(manifestPath, "utf8")),
  sourceReview: { status: "unreviewed_draft", notes: [
    "The official 2026 undergraduate guide contains the program, duration, language, CSCA, tuition and admission schedule tables used here.",
    "The legacy generic Chinese Language and Literature identity is not overwritten because the official catalog publishes distinct Shipai and Zhuhai routes.",
    "No 2027 Jinan University admission cycle was found in the registered official sources, so dates are not rolled forward.",
    "Graduate program identities are not created until the referenced official graduate catalog is acquired as a direct artifact rather than inferred from a QR code.",
  ] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await writeFile(candidatePath, candidateText, "utf8");
await writeFile(validationPath, JSON.stringify(validationArtifact, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
