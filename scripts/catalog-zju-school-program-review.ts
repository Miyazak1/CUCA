import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const guideManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-21-26-713Z/manifest.json");
const chineseManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-22-19-877Z/manifest.json");
const englishManifestPath = resolve(root, "work/catalog-official/2026-09-11T06-22-30-744Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.zju-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.zju-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.zju-school-program-batch-01.review.json");

const GUIDE_SHA = "453aad6734876d0b16ddc5141ab2496412867929e6a8c62d420619de0e6ff3f8";
const CHINESE_CATALOG_SHA = "e5a481bba1daf518e00d8e1cc8cf92f2428a104a531d1fd40281a35c523eef79";
const ENGLISH_CATALOG_SHA = "a50f58bec7a76e0e437e2b4bef7884f4a1af5899f920edcdf819b5b551c72355";
const GUIDE_URL = "https://iczu.zju.edu.cn/admissionsen/2024/1030/c68988a2981659/page.htm";
const CHINESE_CATALOG_URL = "https://iczu.zju.edu.cn/_upload/article/files/e7/8c/1be7b2df433fb9427df707571d84/3300a725-ca29-443b-845f-8c1a3c15c929.pdf";
const ENGLISH_CATALOG_URL = "https://iczu.zju.edu.cn/_upload/article/files/e7/8c/1be7b2df433fb9427df707571d84/f8f1cb33-05a5-4fec-a602-3eac6caf8e14.pdf";
const APPLICATION_URL = "https://intlstudent.zju.edu.cn/";

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const guideEvidence = (await parse(guideManifestPath)).sources?.[0];
const chineseEvidence = (await parse(chineseManifestPath)).sources?.[0];
const englishEvidence = (await parse(englishManifestPath)).sources?.[0];
for (const [evidence, id, sha] of [
  [guideEvidence, "zhejiang-university-undergraduate-2026", GUIDE_SHA],
  [chineseEvidence, "zhejiang-university-chinese-undergraduate-catalog-2026", CHINESE_CATALOG_SHA],
  [englishEvidence, "zhejiang-university-english-undergraduate-catalog-2026", ENGLISH_CATALOG_SHA],
] as const) {
  if (evidence?.id !== id || evidence?.sha256 !== sha || evidence?.status !== 200) {
    throw new Error(`The refreshed official source does not match the reviewed snapshot: ${id}`);
  }
}

type ProgramOverride = {
  name: string;
  durationYears?: number;
  tuition?: number;
  hsk?: string;
  subjects?: string[];
  note?: string;
  slug?: string;
};
type ChineseGroup = {
  area: string;
  durationYears: number;
  tuition: number;
  hsk: string;
  subjects: string[];
  note?: string;
  programs: Array<string | ProgramOverride>;
};

const H = "Chinese (Humanities)";
const S = "Chinese (STEM)";
const M = "Mathematics";
const P = "Physics";
const C = "Chemistry";
const chineseGroups: ChineseGroup[] = [
  { area: "Philosophy", durationYears: 4, tuition: 19800, hsk: "HSK Level 5, score 180 or above", subjects: [H, M], programs: ["Philosophy"] },
  { area: "Literature", durationYears: 4, tuition: 19800, hsk: "HSK Level 6, score 210 or above", subjects: [H, M], note: "Fluent Mandarin listening, speaking, reading and writing, plus basic Chinese language and literature knowledge, are required.", programs: ["Chinese Language and Literature", "Classical Documentology"] },
  { area: "History", durationYears: 4, tuition: 19800, hsk: "HSK Level 5, score 180 or above", subjects: [H, M], programs: ["History"] },
  { area: "Art and Archaeology", durationYears: 4, tuition: 19800, hsk: "HSK Level 5, score 180 or above", subjects: [H, M, C], programs: ["Heritage and Museology", "Archaeology", { name: "Art and Science and Technology", tuition: 29800, subjects: [H, M], note: "Fundamental art, painting, aesthetic and perceptual-thinking skills are required; relevant art-design or computer-technology study and portfolio or competition experience are recommended." }] },
  { area: "Media and Communication", durationYears: 4, tuition: 19800, hsk: "HSK Level 6, score 180 or above", subjects: [H, M], programs: ["Journalism", { name: "Communication", hsk: "HSK Level 5, score 200 or above" }] },
  { area: "International Studies", durationYears: 4, tuition: 19800, hsk: "HSK Level 6, score 180 or above", subjects: [H, M], note: "Strong Chinese and English proficiency is considered in admission; TOEFL, IELTS, TOEIC or another English certificate is recommended.", programs: [{ name: "English", hsk: "HSK Level 5, score 180 or above" }, "Translation", "Russian", "Japanese", "German", "French", "Spanish"] },
  { area: "Economics", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 210 or above", subjects: [H, M], note: "Good mathematics and cross-cultural communication skills are required.", programs: ["Economics", "Finance", "Public Finance", { name: "International Economics and Trade", slug: "zhejiang-university-international-economics-and-trade" }] },
  { area: "Education", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [H, M], note: "Good English knowledge and Chinese writing and communication skills are required.", programs: ["Education"] },
  { area: "Management", durationYears: 4, tuition: 24800, hsk: "HSK Level 6, score 220 or above", subjects: [H, M], programs: [{ name: "Business Administration", note: "Good mathematics and English knowledge are required." }, { name: "Information Management and Information System", subjects: [H, M, P], note: "Good mathematics, English and programming knowledge are required." }, { name: "Accounting", note: "Excellent Chinese reading skills and good English and mathematics knowledge are required." }] },
  { area: "Public Affairs", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [H, M], note: "Good mathematics and English knowledge and good Chinese writing and communication skills are required.", programs: ["Economics and Management of Agricultural and Forestry", "Public Administration", "Land Resource Management", "Labor and Social Security", { name: "Politics and Public Administration", note: "Good English knowledge and good Chinese writing and communication skills are required." }, { name: "Sociology", hsk: "HSK Level 6, score 180 or above" }] },
  { area: "Law", durationYears: 4, tuition: 24800, hsk: "HSK Level 6, score 180 or above", subjects: [H, M], note: "Good Chinese writing and communication skills are required.", programs: ["Law"] },
  { area: "Mathematics", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics knowledge is required.", programs: ["Mathematics and Applied Mathematics", "Information and Computational Science", "Statistics"] },
  { area: "Physics", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge is required.", programs: ["Physics"] },
  { area: "Chemistry", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P, C], note: "Applicants must not be colorblind and need good Chinese, physics, mathematics and chemistry knowledge.", programs: ["Chemistry"] },
  { area: "Earth Sciences", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge is required.", programs: ["Geographical Information Science", "Atmosphere Science", { name: "Geology", subjects: [S, M, P, C] }] },
  { area: "Psychology", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge is required.", programs: ["Psychology"] },
  { area: "Mechanical Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics knowledge and fluent Mandarin reading, writing and listening skills are required.", programs: ["Mechanical Engineering"] },
  { area: "Energy Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good Chinese, mathematics and physics knowledge is required.", programs: ["Energy and Environmental System Engineering", "Vehicle Engineering", "Process Equipment and Control Engineering"] },
  { area: "Chemical and Biological Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P, C], note: "Applicants must not be colorblind and need good Chinese, physics, mathematics and chemistry knowledge.", programs: ["Chemical Engineering and Technology", "Biological Engineering"] },
  { area: "Polymer Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, C], note: "Applicants must not be colorblind and need good Chinese, physics, mathematics and chemistry knowledge.", programs: ["Polymer Materials and Engineering"] },
  { area: "Materials Science", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Applicants must not be colorblind and need good mathematics and physics knowledge.", programs: ["Materials Science and Engineering"] },
  { area: "Civil Engineering and Architecture", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], programs: [{ name: "Architecture", durationYears: 5, slug: "zhejiang-university-architecture", note: "Applicants must not be colorblind and need good mathematics, physics, art and aesthetic skills." }, { name: "Architecture", slug: "zhejiang-university-architecture-4-years", note: "Applicants must not be colorblind and need good mathematics, physics, art and aesthetic skills." }, { name: "Urban and Rural Planning", subjects: [S, M] }, { name: "Civil Engineering", note: "Good mathematics and physics knowledge is required." }] },
  { area: "Electrical Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge is required.", programs: ["Electrical Engineering and Automation", "Electronic Information Engineering"] },
  { area: "Aeronautics and Astronautics", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge, fluent Mandarin reading, writing and listening skills, and high-school physics and chemistry are required.", programs: ["Engineering Mechanics", "Flight Vehicle Design and Engineering"] },
  { area: "Ocean Science", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "The third and fourth years are offered on Zhoushan Campus.", programs: ["Ocean Engineering and Technology", "Marine Science"] },
  { area: "Optical Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Applicants must not be colorblind and need good mathematics knowledge.", programs: ["Optical Information Science and Engineering"] },
  { area: "Information and Electronic Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge and fluent Mandarin reading, writing and listening skills are required.", programs: ["Information Engineering", "Electronic Science and Technology", "Microelectronic Science and Engineering"] },
  { area: "Computer Science", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and fluent Mandarin are required. Applicants without an English-language high-school diploma and whose native language is not English must provide TOEFL 80+, IELTS 6.5+, or equivalent proof.", programs: ["Industrial Design", "Computer Science and Technology", "Software Engineering", "Information Safety"] },
  { area: "Control Science", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics knowledge and fluent Mandarin reading, writing and listening skills are required.", programs: ["Automation"] },
  { area: "Biomedical Engineering", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P], note: "Good mathematics and physics knowledge is required; applicants must not be colorblind.", programs: ["Biomedical Engineering"] },
  { area: "Life Sciences", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, C], note: "Good mathematics knowledge and fluent Mandarin reading, writing and listening skills are required.", programs: ["Biology", "Ecology"] },
  { area: "Environmental and Resource Sciences", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, P, C], note: "Good Chinese proficiency and high-school physics, biology and chemistry are required.", programs: ["Environmental Science", "Environmental Engineering", { name: "Agricultural Resources and Environment", subjects: [S, M, C] }] },
  { area: "Agriculture", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, C], programs: [{ name: "Agronomy", note: "High-school physics, biology and chemistry and good Chinese writing and communication skills are required." }, { name: "Horticulture", note: "Good Chinese writing and communication skills are required." }, "Plant Protection", { name: "Tea Science", note: "Chemistry must have been a compulsory high-school subject; good Chinese writing and communication skills are required." }, { name: "Landscape Gardening", subjects: [S, M], note: "Good Chinese writing and communication skills are required." }] },
  { area: "Animal Sciences", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, C], programs: [{ name: "Animal Science", note: "High-school chemistry and biology with good grades are required." }, { name: "Veterinary Medicine", durationYears: 5, note: "Applicants must be free of color blindness or color weakness and have good high-school chemistry and biology grades." }] },
  { area: "Biosystems and Food Science", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 220 or above", subjects: [S, M, P, C], note: "High-school physics, biology and chemistry are required.", programs: ["Food Science and Engineering", "Agricultural Engineering"] },
  { area: "Medicine", durationYears: 5, tuition: 29800, hsk: "HSK Level 6, score 180 or above", subjects: [S, M, C], note: "Applicants must be free of color blindness or color weakness and have good high-school physics, chemistry and biology grades.", programs: ["Clinical Medicine", "Preventative Medicine", "Stomatology"] },
  { area: "Pharmacy", durationYears: 4, tuition: 24800, hsk: "HSK Level 5, score 180 or above", subjects: [S, M, C], note: "Applicants must be free of color blindness or color weakness and have good high-school physics, chemistry and biology grades.", programs: ["Pharmacy"] },
  { area: "Chinese Language", durationYears: 4, tuition: 19800, hsk: "HSK Level 5, score 180 or above", subjects: [H, M], note: "Applicants below HSK 5 score 180 may receive conditional admission after interview but must reach that score within one year. A valid HSK 4 score of 180+ may exempt the Humanities Chinese CSCA subject.", programs: ["Chinese"] },
];

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const chinesePrograms: CatalogSeedProgram[] = chineseGroups.flatMap(group => group.programs.map(item => {
  const program = typeof item === "string" ? { name: item } : item;
  const subjects = program.subjects ?? group.subjects;
  const note = program.note ?? group.note;
  return {
    slug: program.slug ?? `zhejiang-university-${slugify(program.name)}`,
    schoolSlug: "zhejiang-university",
    citySlug: "hangzhou",
    nameEn: program.name,
    degreeLevel: "Undergraduate",
    durationYears: program.durationYears ?? group.durationYears,
    fieldCategory: group.area,
    subjectArea: group.area,
    teachingLanguage: "Chinese",
    cscaSubjects: subjects,
    cscaRequirement: `CSCA in Chinese: ${subjects.join(", ")}`,
    hskRequirement: program.hsk ?? group.hsk,
    tuitionAmount: program.tuition ?? group.tuition,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `RMB ${(program.tuition ?? group.tuition).toLocaleString("en-US")}/year`,
    applicationUrl: APPLICATION_URL,
    ...(note ? { applicationNote: note } : {}),
    status: "draft",
    sourceUrl: CHINESE_CATALOG_URL,
    sourceLabel: "Zhejiang University Chinese-taught Undergraduate Programs 2026",
    sourceSha256: CHINESE_CATALOG_SHA,
    capturedAt: chineseEvidence.fetchedAt,
    sourceFieldLineage: {
      nameEn: "Undergraduate Programs column",
      durationYears: "Program Duration column",
      tuitionAmount: "Tuition column",
      hskRequirement: "HSK Minimum Requirement column",
      cscaSubjects: "Required Subjects for CSCA column",
      ...(note ? { applicationNote: "Other Requirements and Tips column" } : {}),
      applicationUrl: "registered 2026 application guide: Online Application System link",
    },
  };
}));

const englishRequirement = "IELTS 6.0 overall with 5.0 in each component; TOEFL iBT 75 with 15 in each component; Cambridge CAE 170; Duolingo 100; or qualifying IB, A-level or other standardized test scores.";
const englishPrograms: CatalogSeedProgram[] = [
  { nameEn: "Clinical Medicine (MBBS)", slug: "zhejiang-university-clinical-medicine-mbbs-6-years", durationYears: 6, tuitionAmount: 42800, fieldCategory: "Medicine", subjectArea: "Medicine", cscaSubjects: [M, C], englishRequirement, applicationNote: "Applicants need at least 70% in high-school mathematics, physics, chemistry and biology. Offered at the International School of Medicine in Yiwu City." },
  { nameEn: "Biomedical Engineering", slug: "zhejiang-university-biomedical-engineering-english", durationYears: 4, tuitionAmount: 42800, fieldCategory: "Biomedical Engineering", subjectArea: "Biomedical Engineering", cscaSubjects: [M, C], englishRequirement, applicationNote: "Applicants need at least 70% in high-school mathematics, physics, chemistry and biology. Offered at the International School of Medicine in Yiwu City." },
  { nameEn: "Global Communication and Management", slug: "zhejiang-university-global-communication-and-management", durationYears: 4, tuitionAmount: 65000, fieldCategory: "Communication and Management", subjectArea: "Communication and Management", cscaSubjects: [M], englishRequirement: "IELTS 6.5+, TOEFL 80+, or Duolingo 120+.", applicationNote: "Solid mathematics knowledge is recommended. Offered on Haining International Campus." },
  { nameEn: "Integrative Biomedical Sciences (Dual Degree)", slug: "zhejiang-university-zju-uoe-dual-degree-biomedical-sciences", durationYears: 4, tuitionAmount: 200000, fieldCategory: "Biomedical Sciences", subjectArea: "Biomedical Sciences", cscaSubjects: [M, C], englishRequirement: "See the official ZJU-UoE Institute entry requirements linked by the 2026 catalog.", applicationNote: "Biology and chemistry must have been compulsory high-school subjects. Offered on Haining International Campus." },
  { nameEn: "Biomedical Informatics (Dual Degree)", slug: "zhejiang-university-biomedical-informatics-dual-degree", durationYears: 4, tuitionAmount: 200000, fieldCategory: "Biomedical Informatics", subjectArea: "Biomedical Informatics", cscaSubjects: [M, C], englishRequirement: "See the official ZJU-UoE Institute entry requirements linked by the 2026 catalog.", applicationNote: "Offered on Haining International Campus." },
].map(program => ({
  ...program,
  schoolSlug: "zhejiang-university",
  citySlug: "hangzhou",
  degreeLevel: "Undergraduate",
  teachingLanguage: "English",
  cscaRequirement: `CSCA in English: ${program.cscaSubjects.join(", ")}`,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: `RMB ${program.tuitionAmount.toLocaleString("en-US")}/year`,
  applicationUrl: APPLICATION_URL,
  status: "draft",
  sourceUrl: ENGLISH_CATALOG_URL,
  sourceLabel: "Zhejiang University English-taught Undergraduate Programs 2026",
  sourceSha256: ENGLISH_CATALOG_SHA,
  capturedAt: englishEvidence.fetchedAt,
  sourceFieldLineage: {
    nameEn: "Undergraduate Programs column",
    durationYears: "Program Duration column",
    tuitionAmount: "Tuition column",
    englishRequirement: "Requirements column",
    cscaSubjects: "Required Subjects for CSCA column",
    applicationNote: "Requirements and Remarks columns",
    applicationUrl: "registered 2026 application guide: Online Application System link",
  },
}));

const programs = [...chinesePrograms, ...englishPrograms];
if (chinesePrograms.length !== 87 || englishPrograms.length !== 5 || programs.length !== 92) {
  throw new Error(`Unexpected ZJU program count: ${chinesePrograms.length} Chinese + ${englishPrograms.length} English.`);
}
if (new Set(programs.map(program => program.slug)).size !== programs.length) throw new Error("Generated ZJU program slugs are not unique.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: guideEvidence.fetchedAt,
  cities: [{
    slug: "hangzhou", nameEn: "Hangzhou", nameZh: "杭州", region: "East China", province: "Zhejiang", status: "draft",
    sourceUrl: GUIDE_URL, sourceLabel: "Zhejiang University Application Guide for Undergraduate Programs 2026", sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt, sourceFieldLineage: { nameEn: "contact address: Hangzhou", province: "institution name and contact address" },
  }],
  schools: [{
    slug: "zhejiang-university", nameEn: "Zhejiang University", nameZh: "浙江大学", citySlug: "hangzhou", schoolType: "public", region: "East China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese and English",
    languageRequirement: "Chinese-taught programs require the program-specific HSK level in the official catalog. English-taught programs require an English test score unless exempt under the official guide.",
    hskRequirement: "Program-specific: HSK Level 5 or 6 with the score stated in the 2026 Chinese-taught catalog.",
    englishRequirement: "Program-specific IELTS, TOEFL, Cambridge, Duolingo or equivalent requirements are stated in the 2026 English-taught catalog.",
    deadlineSummary: "Applications open December 1, 2025 and normally close February 28, 2026; specified programs close May 31, 2026 (Beijing time).",
    tuitionSummary: "RMB 19,800-29,800/year for Chinese-taught programs; RMB 42,800-200,000/year for English-taught programs.",
    applicationFee: "RMB 800, non-refundable", websiteUrl: "https://www.zju.edu.cn/english/", admissionsUrl: GUIDE_URL,
    cscaRequired: true, cscaRequirement: "All 2026/2027 international undergraduate applicants must submit a valid CSCA report; Chinese-taught applicants select Chinese and English-taught applicants select English as the examination language.",
    cscaSubjects: [H, S, M, P, C], subjectTags: [...new Set(programs.map(program => program.subjectArea).filter(Boolean))] as string[],
    languageTags: ["Chinese-taught", "English-taught"], campusHighlights: ["92 official 2026 undergraduate routes", "Online application only", "Program-specific CSCA and language requirements"],
    status: "draft", sourceUrl: GUIDE_URL, sourceLabel: "Zhejiang University Application Guide for Undergraduate Programs 2026", sourceSha256: GUIDE_SHA,
    capturedAt: guideEvidence.fetchedAt,
    sourceFieldLineage: { nameEn: "page introduction", citySlug: "contact address", applicationLevel: "page title", languageOfInstruction: "page introduction", languageRequirement: "Eligibility 3.1-3.2", deadlineSummary: "Application Duration", tuitionSummary: "the two registered 2026 program catalogs", applicationFee: "Application Fee and Tuition Fee", admissionsUrl: "registered source URL", cscaRequirement: "Eligibility section 4" },
  }],
  programs,
  programIntakes: programs.map(program => {
    const specialDeadline = program.teachingLanguage === "English" || program.nameEn === "Chinese";
    return {
      programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2025-12-01T00:00:00.000Z",
      deadlineDate: specialDeadline ? "2026-05-31T15:59:59.000Z" : "2026-02-28T15:59:59.000Z",
      deadlineLabel: specialDeadline ? "May 31, 2026 (Beijing time)" : "February 28, 2026 (Beijing time)",
      applicationRound: "2026 undergraduate admission", status: "closed" as const,
      sourceUrl: specialDeadline ? (program.teachingLanguage === "English" ? ENGLISH_CATALOG_URL : CHINESE_CATALOG_URL) : GUIDE_URL,
      sourceLabel: specialDeadline ? "Zhejiang University 2026 undergraduate program catalog" : "Zhejiang University Application Guide for Undergraduate Programs 2026",
      sourceSha256: specialDeadline ? (program.teachingLanguage === "English" ? ENGLISH_CATALOG_SHA : CHINESE_CATALOG_SHA) : GUIDE_SHA,
      capturedAt: specialDeadline ? (program.teachingLanguage === "English" ? englishEvidence.fetchedAt : chineseEvidence.fetchedAt) : guideEvidence.fetchedAt,
      sourceFieldLineage: { openDate: "Application Duration", deadlineDate: specialDeadline ? "program catalog Remarks/Other Requirements" : "Application Duration default deadline" },
    };
  }),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`ZJU candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object"
  ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The ZJU candidate contains a prohibited-data marker.");

const legacyAliasesToArchive = [
  "zhejiang-university-applied-mathematics-and-informatics",
  "zhejiang-university-business-management-in-innovation-entrepreneurship-and-global-leadership",
  "zhejiang-university-doctor-of-philosophy-in-business-data-science",
  "zhejiang-university-economics-international-economy-and-trade",
  "zhejiang-university-economics-and-management-experiment-class",
  "zhejiang-university-humanities-experiment-class",
  "zhejiang-university-international-relations",
  "zhejiang-university-machine-intelligence-and-robotics",
];
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: guideEvidence.fetchedAt,
  scope: { schoolSlug: "zhejiang-university", schoolCount: 1, chineseProgramCount: 87, englishProgramCount: 5, programCount: 92, intakeCount: 92 },
  officialEvidence: {
    guide: { sha256: GUIDE_SHA, fetchedAt: guideEvidence.fetchedAt, unchangedSince: "2026-09-10" },
    chineseCatalog: { sha256: CHINESE_CATALOG_SHA, fetchedAt: chineseEvidence.fetchedAt, contentType: chineseEvidence.contentType },
    englishCatalog: { sha256: ENGLISH_CATALOG_SHA, fetchedAt: englishEvidence.fetchedAt, contentType: englishEvidence.contentType },
  },
  reconciliation: { actionAfterApproval: "upsert_official_2026_catalog_and_archive_legacy_aliases", legacyAliasesToArchive, destructiveDeletion: false, stableMatchingSlugsPreserved: true },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "No applicant, account, payment, private-file or personal-contact fields are present. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};

for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, legacyAliasesToArchive: legacyAliasesToArchive.length }, null, 2));
