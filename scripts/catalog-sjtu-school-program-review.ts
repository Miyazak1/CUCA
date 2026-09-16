import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidatePath = resolve(root, "seeds/catalog.sjtu-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sjtu-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.sjtu-school-program-batch-01.review.json");
const evidenceSpecs = [
  ["work/catalog-official/2026-09-11T07-42-48-650Z/manifest.json", "sjtu-chinese-undergraduate-2026", "d89ecfbc82bc657bdf2aee0ff0aae8d085b1c7eea522718361f3163f8d41d795"],
  ["work/catalog-official/2026-09-11T07-42-49-374Z/manifest.json", "sjtu-chinese-undergraduate-catalog-en-pdf-2026", "980a91af67ac31c79b0fbecac6438a58547d3f9cd552e9d2d1ebffe807567340"],
  ["work/catalog-official/2026-09-11T07-42-49-837Z/manifest.json", "sjtu-chinese-undergraduate-catalog-zh-pdf-2026", "18b2fd98c8204d80ea8c81bf5a6f130b54e7f3c6e0bd4ac2093d3f6c03e70308"],
  ["work/catalog-official/2026-09-11T07-42-50-327Z/manifest.json", "sjtu-english-engineering-cluster-2026", "f9ebb1c2f3a811c1acdb669bd9000be5652f92e260ebdaf7c141f2dc83cdf86a"],
  ["work/catalog-official/2026-09-11T07-42-51-052Z/manifest.json", "sjtu-english-civil-engineering-2026", "082be15f56a15bdc346674a2ad903fc1fbb46b423e32ab371328a99f98244f65"],
  ["work/catalog-official/2026-09-11T07-42-51-773Z/manifest.json", "sjtu-gift-undergraduate-2026", "ad7388a6a4fc1319b0f39b582fe5e9251cac70a6a24a66e4241cd68450a6a3c0"],
  ["work/catalog-official/2026-09-11T07-42-52-532Z/manifest.json", "sjtu-french-engineering-cluster-2026", "aa01dba2fd30805fcd9f6f72164506d65bf1a8623cb8343674f5c1d6a24a7478"],
] as const;
const parse = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const evidence = new Map<string, any>();
for (const [path, id, sha] of evidenceSpecs) {
  const item = (await parse(path)).sources?.[0];
  if (item?.id !== id || item?.sha256 !== sha || item?.status !== 200) throw new Error(`Official evidence mismatch: ${id}`);
  evidence.set(id, item);
}
const source = (id: string) => evidence.get(id)!;
const GUIDE = source("sjtu-chinese-undergraduate-2026");
const CATALOG = source("sjtu-chinese-undergraduate-catalog-en-pdf-2026");
const APPLY_URL = "https://apply.sjtu.edu.cn/";
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const STEM = ["Chinese (STEM)", "Mathematics"];
const HUMANITIES = ["Chinese (Humanities)", "Mathematics"];

type ChineseSpec = { nameEn: string; nameZh: string; school: string; field: string; streams?: string; duration?: number };
const chineseSpecs: ChineseSpec[] = [
  { nameEn: "Ocean Engineering", nameZh: "海洋工程类", school: "School of Ocean and Civil Engineering", field: "Ocean and Civil Engineering", streams: "Naval Architecture and Ocean Engineering (including Intelligent Marine Equipment); Civil Engineering (Smart and Green Construction)" },
  { nameEn: "Mechanical Engineering", nameZh: "机械类", school: "School of Mechanical Engineering", field: "Mechanical and Energy Engineering", streams: "Mechanical Engineering; Power and Energy Engineering; Industrial Engineering; Energy Storage Science and Engineering" },
  { nameEn: "Electrical Engineering and Automation", nameZh: "电气工程及其自动化", school: "School of Electrical Engineering", field: "Electrical Engineering" },
  { nameEn: "Automation", nameZh: "自动化", school: "School of Automation and IntelliSense", field: "Automation" },
  { nameEn: "Intelligent Sensing Engineering", nameZh: "智能感知工程", school: "School of Automation and IntelliSense", field: "Intelligent Sensing" },
  { nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", school: "School of Computer Science", field: "Computer Science" },
  { nameEn: "Software Engineering", nameZh: "软件工程", school: "School of Computer Science", field: "Software Engineering" },
  { nameEn: "Information Engineering", nameZh: "信息工程", school: "School of Integrated Circuits", field: "Information Engineering" },
  { nameEn: "Electronic Science and Technology", nameZh: "电子科学与技术", school: "School of Integrated Circuits", field: "Electronic Science" },
  { nameEn: "Microelectronics Science and Engineering", nameZh: "微电子科学与工程", school: "School of Integrated Circuits", field: "Microelectronics" },
  { nameEn: "Artificial Intelligence", nameZh: "人工智能", school: "School of Artificial Intelligence", field: "Artificial Intelligence" },
  { nameEn: "Materials Science and Engineering", nameZh: "材料科学与工程", school: "School of Materials Science and Engineering", field: "Materials Science" },
  { nameEn: "Aerospace Engineering", nameZh: "航空航天工程", school: "School of Aeronautics and Astronautics", field: "Aerospace Engineering" },
  { nameEn: "Environmental Science and Engineering", nameZh: "环境科学与工程", school: "School of Environmental Science and Engineering", field: "Environmental Science" },
  { nameEn: "Biomedical Engineering", nameZh: "生物医学工程", school: "School of Biomedical Engineering", field: "Biomedical Engineering" },
  { nameEn: "Smart Energy", nameZh: "智慧能源工程", school: "College of Smart Energy", field: "Energy Engineering" },
  { nameEn: "Sustainable Energy", nameZh: "可持续能源", school: "Global Institute of Future Technology", field: "Energy Engineering" },
  { nameEn: "Health Science and Technology", nameZh: "健康科学与技术", school: "Global Institute of Future Technology", field: "Health Technology" },
  { nameEn: "Science (Mathematics)", nameZh: "理科试验班类（数学方向）", school: "School of Mathematical Sciences", field: "Mathematics and Statistics", streams: "Mathematics and Applied Mathematics; Statistics" },
  { nameEn: "Science (Physics)", nameZh: "理科试验班类（物理方向）", school: "School of Physics and Astronomy", field: "Physics and Astronomy", streams: "Physics; Astronomy" },
  { nameEn: "Chemistry", nameZh: "化学类", school: "School of Chemistry and Chemical Engineering", field: "Chemistry and Chemical Engineering", streams: "Chemical Engineering and Technology; Chemistry (including Polymer); Chemical Biology" },
  { nameEn: "Marine Science (Physical Oceanography and Observational Technology)", nameZh: "海洋科学（物理海洋与观测技术）", school: "School of Oceanography", field: "Marine Science" },
  { nameEn: "Marine Science (Chemical, Biological and Geological Oceanography)", nameZh: "海洋科学（化学、生物与地质海洋）", school: "School of Oceanography", field: "Marine Science" },
  { nameEn: "Biotechnology", nameZh: "生物科学类", school: "School of Life Science and Biotechnology", field: "Life Science and Biotechnology", streams: "Biotechnology; Bioengineering" },
  { nameEn: "Nature Conservation and Environmental Ecology (including Smart Agriculture)", nameZh: "自然保护与环境生态类（含智慧农业）", school: "School of Agriculture and Biology", field: "Agriculture and Environmental Ecology", streams: "Agricultural Resources and Environment; Food Science and Engineering; Animal Science; Plant Science and Technology; Smart Agriculture" },
  { nameEn: "Pharmacy", nameZh: "药学类", school: "School of Pharmacy", field: "Pharmacy", streams: "Pharmacy (4 years); Clinical Pharmacy (5 years)" },
  { nameEn: "Economics and Management", nameZh: "经济管理试验班", school: "Antai College of Economics and Management", field: "Economics and Management", streams: "Finance; Economics; Business Administration (Marketing); Accounting; Human Resource Management; Big Data Management and Applications" },
  { nameEn: "Law", nameZh: "法学试验班", school: "KoGuan School of Law", field: "Law" },
  { nameEn: "English (Language Science and Engineering)", nameZh: "英语（语言科学与工程试点班）", school: "School of Foreign Languages", field: "Foreign Languages" },
  { nameEn: "Japanese", nameZh: "日语", school: "School of Foreign Languages", field: "Foreign Languages" },
  { nameEn: "German", nameZh: "德语", school: "School of Foreign Languages", field: "Foreign Languages" },
  { nameEn: "Chinese Language and Literature (Sino-foreign Cultural Exchange)", nameZh: "汉语言文学（中外文化交流）", school: "School of Humanities", field: "Chinese Language and Literature" },
  { nameEn: "Chinese Language (Business Chinese)", nameZh: "汉语言（商务汉语方向）", school: "School of Humanities", field: "Chinese Language" },
  { nameEn: "Public Administration", nameZh: "行政管理", school: "School of International and Public Affairs", field: "Public Administration" },
  { nameEn: "Communication", nameZh: "传播学", school: "School of Media and Communication", field: "Communication" },
  { nameEn: "Broadcasting and Television Editing (Digital and Intelligent Imaging)", nameZh: "广播电视编导（数智影像方向）", school: "School of Media and Communication", field: "Media Production" },
  { nameEn: "Cultural Industries Management", nameZh: "文化产业管理", school: "School of Media and Communication", field: "Cultural Industries" },
  { nameEn: "Industrial Design (Intelligent Human-Machine Interaction Pilot Class)", nameZh: "工业设计（智能人机交互试验班）", school: "School of Design", field: "Industrial Design" },
  { nameEn: "Visual Communication", nameZh: "视觉传达设计", school: "School of Design", field: "Visual Communication" },
  { nameEn: "Human Habitat Design", nameZh: "人居设计", school: "School of Design", field: "Human Habitat Design" },
];

const chinesePrograms: CatalogSeedProgram[] = chineseSpecs.map((spec, index) => {
  const subjects = index < 26 || index === 37 ? STEM : HUMANITIES;
  const note = spec.streams ? `This is one official admissions route. After enrollment, the school assigns students to: ${spec.streams}.` : undefined;
  return {
    slug: index === 1 ? "shanghai-jiao-tong-university-mechanical-engineering-cluster" : `shanghai-jiao-tong-university-${slugify(spec.nameEn)}`, schoolSlug: "shanghai-jiao-tong-university", citySlug: "shanghai",
    nameEn: spec.nameEn, nameZh: spec.nameZh, degreeLevel: "Undergraduate", durationYears: spec.duration ?? 4,
    fieldCategory: spec.field, subjectArea: spec.school, teachingLanguage: "Chinese", cscaSubjects: subjects,
    cscaRequirement: `CSCA: ${subjects.join(", ")}; pre-admitted applicants must supplement the report by June 30, 2026.`,
    hskRequirement: "HSK Level 5 score 200 with Writing 60, or HSK Level 6 score 180 with Writing 60; official exemption and conditional Chinese-course rules may apply.",
    englishRequirement: "TOEFL, IELTS or equivalent English proficiency evidence is requested; the Chinese-taught admissions page does not publish a numeric threshold.",
    tuitionAmount: index === 16 || index === 17 ? 120000 : 24800, tuitionCurrency: "RMB", tuitionPeriod: "year",
    tuitionText: index === 16 || index === 17 ? "RMB 120,000/year" : "RMB 24,800/year",
    scholarshipText: "The official guide lists CSC, Shanghai Government, SJTU and International Chinese Language Teachers scholarship routes; eligibility and award level require separate review.",
    hasScholarship: true, applicationUrl: APPLY_URL, ...(note ? { applicationNote: note } : {}), status: "draft",
    sourceUrl: CATALOG.url, sourceLabel: CATALOG.label, sourceSha256: CATALOG.sha256, capturedAt: CATALOG.fetchedAt,
    sourceFieldLineage: { nameEn: `bilingual catalog row ${index + 1}`, nameZh: `Chinese catalog row ${index + 1}`, subjectArea: `bilingual catalog row ${index + 1} School column`, durationYears: `bilingual catalog row ${index + 1} Study Duration`, cscaSubjects: `bilingual catalog row ${index + 1} CSCA Test Category`, hskRequirement: "Chinese-taught admissions page language requirement", tuitionAmount: "Chinese-taught admissions page tuition section", scholarshipText: "Chinese-taught admissions page scholarship section", ...(note ? { applicationNote: "catalog Note 2 and Specific Major column" } : {}) },
  };
});

type OtherSpec = { nameEn: string; nameZh: string; slug: string; language: "English" | "French"; field: string; sourceId: string; tuition: number; deadline: string; deadlineLabel: string; fee: string; note?: string };
const otherSpecs: OtherSpec[] = [
  { nameEn: "Engineering Cluster", nameZh: "工科平台（英文授课）", slug: "shanghai-jiao-tong-university-engineering-cluster-english", language: "English", field: "Engineering", sourceId: "sjtu-english-engineering-cluster-2026", tuition: 120000, deadline: "2026-03-31T15:59:59.000Z", deadlineLabel: "March 31, 2026", fee: "USD 75, non-refundable", note: "One cluster application covering engineering disciplines; the discipline is assigned after enrollment under the official cluster rules." },
  { nameEn: "Civil Engineering (Smart and Sustainable Construction)", nameZh: "土木工程（智慧与可持续建造，英文授课）", slug: "shanghai-jiao-tong-university-civil-engineering-smart-and-sustainable-construction-english", language: "English", field: "Civil Engineering", sourceId: "sjtu-english-civil-engineering-2026", tuition: 80000, deadline: "2026-06-30T15:59:59.000Z", deadlineLabel: "June 30, 2026 (final round)", fee: "RMB 800, non-refundable" },
  { nameEn: "Sustainable Energy", nameZh: "可持续能源（英文授课）", slug: "shanghai-jiao-tong-university-sustainable-energy-english", language: "English", field: "Energy Engineering", sourceId: "sjtu-gift-undergraduate-2026", tuition: 120000, deadline: "2026-06-30T15:59:59.000Z", deadlineLabel: "June 30, 2026 (final round)", fee: "RMB 800, non-refundable" },
  { nameEn: "Health Science and Technology", nameZh: "健康科学与技术（英文授课）", slug: "shanghai-jiao-tong-university-health-science-and-technology-english", language: "English", field: "Health Technology", sourceId: "sjtu-gift-undergraduate-2026", tuition: 120000, deadline: "2026-06-30T15:59:59.000Z", deadlineLabel: "June 30, 2026 (final round)", fee: "RMB 800, non-refundable" },
  { nameEn: "Engineering Cluster", nameZh: "工科平台（法文授课）", slug: "shanghai-jiao-tong-university-engineering-cluster-french", language: "French", field: "Engineering", sourceId: "sjtu-french-engineering-cluster-2026", tuition: 65000, deadline: "2026-04-30T09:00:00.000Z", deadlineLabel: "April 30, 2026, 17:00 Beijing time", fee: "RMB 800, non-refundable", note: "One cluster application covering Mechanical Engineering, Electrical and Computer Engineering, and Power and Energy Engineering." },
];
const otherPrograms: CatalogSeedProgram[] = otherSpecs.map(spec => {
  const item = source(spec.sourceId);
  const languageRequirement = spec.language === "English"
    ? { englishRequirement: "TOEFL iBT 90 (Essentials 10) or IELTS 6.0; the official page also publishes defined exemption routes." }
    : {};
  const frenchRequirement = spec.language === "French" ? "French requirement: CEFR B2 or above, evidenced by native-language proof or TCF, TEF, DELF or DALF." : undefined;
  return {
    slug: spec.slug, schoolSlug: "shanghai-jiao-tong-university", citySlug: "shanghai", nameEn: spec.nameEn, nameZh: spec.nameZh,
    degreeLevel: "Undergraduate", durationYears: 4, fieldCategory: spec.field, subjectArea: spec.sourceId.includes("gift") ? "Global Institute of Future Technology" : spec.field,
    teachingLanguage: spec.language, cscaSubjects: ["Mathematics"], cscaRequirement: "CSCA Mathematics; the official admissions page requires the result by June 30, 2026.",
    ...languageRequirement, tuitionAmount: spec.tuition, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `RMB ${spec.tuition.toLocaleString("en-US")}/year`,
    scholarshipText: "SJTU first-, second- and third-class scholarship routes are listed; tuition, accommodation, insurance and stipend coverage vary by award level.",
    hasScholarship: true, applicationUrl: APPLY_URL, applicationNote: [spec.note, frenchRequirement, `Application fee: ${spec.fee}.`].filter(Boolean).join(" "), status: "draft",
    sourceUrl: item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt,
    sourceFieldLineage: { nameEn: "official program page title", nameZh: "editorial Chinese display translation of the official route and teaching language", durationYears: "official program structure/scholarship duration", cscaSubjects: "CSCA requirement section", tuitionAmount: "Tuition section", scholarshipText: "Scholarship section", applicationNote: "program scope and application fee sections" },
  };
});

const programs = [...chinesePrograms, ...otherPrograms];
if (chinesePrograms.length !== 40 || otherPrograms.length !== 5 || programs.length !== 45) throw new Error("Unexpected SJTU program count.");
if (new Set(programs.map(item => item.slug)).size !== programs.length) throw new Error("Generated SJTU slugs are not unique.");
const otherBySlug = new Map(otherSpecs.map(item => [item.slug, item]));
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: GUIDE.fetchedAt,
  cities: [{ slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", region: "East China", province: "Shanghai", status: "draft", sourceUrl: GUIDE.url, sourceLabel: GUIDE.label, sourceSha256: GUIDE.sha256, capturedAt: GUIDE.fetchedAt, sourceFieldLineage: { nameEn: "official university location", province: "official university location" } }],
  schools: [{
    slug: "shanghai-jiao-tong-university", nameEn: "Shanghai Jiao Tong University", nameZh: "上海交通大学", citySlug: "shanghai", schoolType: "public", region: "East China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese, English and French",
    languageRequirement: "Chinese routes require the published HSK threshold; English and French routes use program-specific language evidence.",
    hskRequirement: "HSK Level 5 score 200 with Writing 60, or HSK Level 6 score 180 with Writing 60; official exemption and conditional-study rules may apply.",
    englishRequirement: "English routes require TOEFL iBT 90 (Essentials 10) or IELTS 6.0 unless an official exemption applies.",
    deadlineSummary: "2026 Chinese-route applications closed March 10; other-language routes closed between March 31 and June 30 depending on program.",
    tuitionSummary: "RMB 24,800/year for standard Chinese routes; GIFT Chinese routes RMB 120,000/year; other-language routes RMB 65,000-120,000/year.",
    applicationFee: "Program-specific: normally RMB 800; the English Engineering Cluster lists USD 75.", websiteUrl: "https://www.sjtu.edu.cn/", admissionsUrl: GUIDE.url,
    cscaRequired: true, cscaRequirement: "All listed 2026 undergraduate routes require CSCA. Chinese routes use the catalog's Chinese subject category plus Mathematics; other-language routes require Mathematics.",
    cscaSubjects: ["Chinese (STEM)", "Chinese (Humanities)", "Mathematics"], subjectTags: [...new Set(programs.map(item => item.fieldCategory!).filter(Boolean))],
    languageTags: ["Chinese-taught", "English-taught", "French-taught"], tuitionBandLabel: "RMB 24,800-120,000/year",
    campusHighlights: ["45 official 2026 main-campus application routes", "40 Chinese, 4 English and 1 French route", "Admissions clusters remain single application routes", "School of Medicine handled as a separate catalog entity"],
    status: "draft", sourceUrl: GUIDE.url, sourceLabel: GUIDE.label, sourceSha256: GUIDE.sha256, capturedAt: GUIDE.fetchedAt,
    sourceFieldLineage: { nameEn: "official admissions page institution title", nameZh: "official Chinese catalog title", citySlug: "official university context", languageOfInstruction: "Chinese catalog and four other-language admissions pages", languageRequirement: "program-specific language requirement sections", deadlineSummary: "application period sections", tuitionSummary: "program tuition sections", applicationFee: "application fee sections", cscaRequirement: "catalog and program CSCA sections" },
  }],
  programs,
  programIntakes: programs.map(program => {
    const other = otherBySlug.get(program.slug);
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
      openDate: other?.language === "French" ? "2026-01-07T00:00:00.000Z" : program.teachingLanguage === "Chinese" ? "2025-12-08T00:00:00.000Z" : "2025-12-08T00:00:00.000Z",
      deadlineDate: other?.deadline ?? "2026-03-10T09:00:00.000Z", deadlineLabel: other?.deadlineLabel ?? "March 10, 2026, 17:00 Beijing time",
      applicationRound: "2026 undergraduate admission", status: "closed" as const,
      sourceUrl: other ? source(other.sourceId).url : GUIDE.url, sourceLabel: other ? source(other.sourceId).label : GUIDE.label,
      sourceSha256: other ? source(other.sourceId).sha256 : GUIDE.sha256, capturedAt: other ? source(other.sourceId).fetchedAt : GUIDE.fetchedAt,
      sourceFieldLineage: { openDate: "official application period", deadlineDate: "official application period; converted from Beijing time where an exact time is published" } };
  }),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`SJTU candidate is invalid: ${validation.errors.join(" ")}`);
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}` : JSON.stringify(value);
const prohibitedPatterns = [/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /cvv/i, /passwordHash/i, /sessionToken/i, /beneficiaryBank/i, /applicationNumber/i];
if (prohibitedPatterns.some(pattern => pattern.test(canonical(candidate)))) throw new Error("The SJTU candidate contains a prohibited-data marker.");
const stableMatchingSlugs = [
  "shanghai-jiao-tong-university-electrical-engineering-and-automation", "shanghai-jiao-tong-university-automation",
  "shanghai-jiao-tong-university-intelligent-sensing-engineering", "shanghai-jiao-tong-university-computer-science-and-technology",
];
const legacyAliasesToArchive = [
  "shanghai-jiao-tong-university-naval-architecture-and-ocean-engineering", "shanghai-jiao-tong-university-civil-engineering",
  "shanghai-jiao-tong-university-mechanical-engineering", "shanghai-jiao-tong-university-industrial-engineering", "shanghai-jiao-tong-university-power-and-energy-engineering",
  "shanghai-jiao-tong-university-energy-storage-science-and-engineering",
];
for (const slug of stableMatchingSlugs) if (!programs.some(program => program.slug === slug)) throw new Error(`Stable SJTU slug missing: ${slug}`);
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: GUIDE.fetchedAt,
  scope: { schoolSlug: "shanghai-jiao-tong-university", schoolCount: 1, chineseProgramCount: 40, englishProgramCount: 4, frenchProgramCount: 1, programCount: 45, intakeCount: 45 },
  officialEvidence: Object.fromEntries([...evidence.entries()].map(([id, item]) => [id, { sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType }])),
  reviewItems: [
    { field: "School of Medicine", result: "excluded_separate_entity", reason: "Catalog rows 41-42 belong to the separately administered Shanghai Jiao Tong University School of Medicine and are not imported into the main-school batch." },
    { field: "admissions clusters", result: "normalized", reason: "Starred catalog rows remain one application route; their post-enrollment streams are retained in application notes rather than published as separate programs." },
    { field: "Pharmacy duration", result: "qualified", reason: "The route contains a four-year Pharmacy stream and a five-year Clinical Pharmacy stream; the route displays four years and records both durations in its note." },
    { field: "other-language Chinese labels", result: "editorial_translation", reason: "Chinese display labels identify teaching language and are translations of the official English/French route titles." },
    { field: "third-party/applicant sources", result: "excluded", reason: "Only registered official SJTU sources were used; no third-party page or applicant record enters the candidate." },
  ],
  reconciliation: { actionAfterApproval: "upsert_official_2026_catalog_and_archive_split_legacy_aliases", legacyAliasesToArchive, destructiveDeletion: false, stableMatchingSlugs },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "The candidate excludes applicant data, identity/financial documents, personal contacts and application records. Raw official snapshots remain ignored and are not imported." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};
for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, chinesePrograms: chinesePrograms.length, englishPrograms: 4, frenchPrograms: 1, stableMatchingSlugs: stableMatchingSlugs.length, legacyAliasesToArchive: legacyAliasesToArchive.length }, null, 2));
