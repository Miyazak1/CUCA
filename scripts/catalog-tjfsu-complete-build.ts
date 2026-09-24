import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T11-18-46-263Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.tianjin-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.tjfsu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tjfsu-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText), cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>(((manifest.sources || []) as SourceRecord[]).map(row => [row.id, row]));
const expected = {
  "tjfsu-international-undergraduate-admissions-2026": "5897ff767d97fb6df0452ba42c094be43817d0caf739b5ad01dfb1ba50bcb4c5",
  "tjfsu-tianjin-government-scholarship-2026": "8886b7a1c817344835f96c50787dcef25025cc9bed7f07900772303702bb6678",
  "tjfsu-cgs-bilateral-type-a-2026": "68dfe88b3d023ae3d7525abb8cea85a03f133d6eb1d31df5b136c11294576a2e",
  "tjfsu-cgs-high-level-graduate-type-b-2026": "f87a698f9ae3e83b6de60b0034a29837a2de34c95997acc2c600fd90886b8c24",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`TJFSU evidence mismatch: ${id}`);
}

const undergraduate = sources.get("tjfsu-international-undergraduate-admissions-2026");
const municipal = sources.get("tjfsu-tianjin-government-scholarship-2026");
const bilateral = sources.get("tjfsu-cgs-bilateral-type-a-2026");
const highLevel = sources.get("tjfsu-cgs-high-level-graduate-type-b-2026");
const schoolSlug = "tianjin-foreign-studies-university", citySlug = "tianjin";
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type ProgramSpec = readonly [nameEn: string, nameZh: string, language: "Chinese" | "English", category: string, csca: readonly string[]];
const specs: ProgramSpec[] = [
  ["Teaching Chinese to Speakers of Other Languages", "汉语国际教育", "Chinese", "Chinese Language", ["Mathematics"]],
  ["E-commerce (Cross-border E-commerce)", "电子商务（跨境电商）", "Chinese", "Business", ["Chinese for Humanities", "Mathematics"]],
  ["Translation", "翻译", "English", "Languages", ["Mathematics"]],
  ["Business English", "商务英语", "English", "Languages", ["Mathematics"]],
  ["English", "英语", "English", "Languages", ["Mathematics"]],
  ["International Economics and Trade", "国际经济与贸易", "Chinese", "Economics", ["Chinese for Humanities", "Mathematics"]],
  ["Chinese Language and Literature", "汉语言文学", "Chinese", "Literature", ["Chinese for Humanities", "Mathematics"]],
  ["Diplomacy", "外交学", "Chinese", "International Studies", ["Chinese for Humanities", "Mathematics"]],
  ["Law", "法学", "Chinese", "Law", ["Chinese for Humanities", "Mathematics"]],
  ["International Politics", "国际政治", "Chinese", "International Studies", ["Chinese for Humanities", "Mathematics"]],
  ["International Organizations and Global Governance", "国际组织与全球治理", "Chinese", "International Studies", ["Chinese for Humanities", "Mathematics"]],
  ["Digital Media Technology", "数字媒体技术", "Chinese", "Technology", ["Chinese for STEM", "Mathematics", "Physics"]],
  ["Educational Technology", "教育技术学", "Chinese", "Education", ["Chinese for Humanities", "Mathematics"]],
  ["Korean", "朝鲜语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Arabic", "阿拉伯语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["German", "德语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Russian", "俄语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["French", "法语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Portuguese", "葡萄牙语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Japanese", "日语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Spanish", "西班牙语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Italian", "意大利语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Swahili", "斯瓦西里语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Czech", "捷克语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Romanian", "罗马尼亚语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Hungarian", "匈牙利语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Serbian", "塞尔维亚语", "Chinese", "Languages", ["Chinese for Humanities", "Mathematics"]],
  ["Communication", "传播学", "Chinese", "Media", ["Chinese for Humanities", "Mathematics"]],
  ["Advertising", "广告学", "Chinese", "Media", ["Chinese for Humanities", "Mathematics"]],
  ["Network and New Media", "网络与新媒体", "Chinese", "Media", ["Chinese for Humanities", "Mathematics"]],
  ["Journalism", "新闻学", "Chinese", "Media", ["Chinese for Humanities", "Mathematics"]],
  ["Digital Media Art", "数字媒体艺术", "Chinese", "Arts", ["Chinese for Humanities", "Mathematics"]],
  ["Animation", "动画", "Chinese", "Arts", ["Chinese for Humanities", "Mathematics"]],
];

const programs: CatalogSeedProgram[] = specs.map(([nameEn, nameZh, language, category, csca]) => ({
  slug: `${schoolSlug}-${slugify(nameEn)}`, schoolSlug, citySlug, nameEn, nameZh,
  degreeLevel: "Undergraduate", durationYears: 4, fieldCategory: category, subjectArea: nameEn,
  teachingLanguage: language, cscaSubjects: [...csca],
  cscaRequirement: `The official 2026 table lists ${csca.join(", ")} for this route; the test-paper language must match the teaching language.`,
  ...(language === "Chinese" ? { hskRequirement: "HSK Level 4 score 180 or above." } : { englishRequirement: "IELTS 6.0, TOEFL 80, or equivalent English proficiency." }),
  tuitionAmount: 15400, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 15,400/year, excluding textbooks",
  applicationUrl: undergraduate.url, applicationNote: "Official 2026 international undergraduate route; applications are submitted through the university's international student service platform.",
  hasScholarship: true, scholarshipText: "Separate official 2026 municipal and Chinese Government Scholarship routes have their own eligibility and deadlines.",
  status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt,
  sourceFieldLineage: { nameEn: "editorial English rendering of the official 2026 major table; requires review", nameZh: "official 2026 major table", degreeLevel: "guide title", durationYears: "official major table", teachingLanguage: "official major table", cscaSubjects: "official major table", tuitionAmount: "fee section", applicationUrl: "registered official guide URL" },
}));

const programIntakes = programs.map(program => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-30T15:59:59.000Z",
  deadlineLabel: "June 30, 2026", applicationRound: "2026 international undergraduate admission", status: "closed" as const,
  sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt,
  sourceFieldLineage: { deadlineDate: "official application deadline", intakeYear: "official guide cycle" },
}));

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarshipBase = (source: SourceRecord) => ({ schoolSlug, status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256,
  capturedAt: source.fetchedAt, providerLocation: "Tianjin, China", targetCountries: [], targetRegions: [],
  actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }],
  sourceFieldLineage: { title: "official page title", fundingLevel: "official coverage section", coverage: "official coverage section", applicableDegree: "official category section", eligibilityItems: "official eligibility section", applicationMaterials: "official materials section", applicationSteps: "official application procedure" } });
const scholarships: CatalogSeedScholarship[] = [
  { ...scholarshipBase(municipal), slug: "official-2026-tjfsu-tianjin-government-scholarship", title: "TJFSU 2026 Tianjin Government Scholarship for International Students", nameZh: "天津外国语大学2026年天津市外国留学生政府奖学金", type: "government", typeLabel: "Tianjin Government Scholarship", providerName: "天津市人民政府 / 天津外国语大学", providerNameEn: "Tianjin Municipal Government / Tianjin Foreign Studies University", fundingLevel: "Full or tuition-only first-year award", coverage: "First prize covers first-year tuition, medical insurance and ten months of living allowance; second prize covers one year of tuition.", applicableDegree: "Non-degree, Undergraduate, Master, Doctoral", applicableProgram: "Published TJFSU programs subject to program-specific entry requirements", amountText: "First prize stipend: CNY 1,400/month for non-degree and undergraduate, CNY 1,700/month for master, CNY 2,000/month for doctoral, for ten months.", deadlineDate: "2026-06-30", deadlineLabel: "Applications accepted April 1-June 30, 2026", applicationRound: "2026 Tianjin Government Scholarship", benefitItems: [benefit("Tuition", "First or second prize"), benefit("Comprehensive medical insurance", "First prize"), benefit("Living allowance", "First prize, ten months")], eligibilityItems: [info("Citizenship", "Non-Chinese citizen"), info("Age", "Non-degree under 45; undergraduate under 30; master under 35; doctoral under 40"), info("Language", "Chinese routes: HSK 4/5/6 by degree; English routes: IELTS 6.0, TOEFL 80 or equivalent"), info("Other funding", "Applicant must not hold another scholarship")], applicationMaterials: [info("Passport"), info("Highest diploma and transcripts"), info("Language certificate"), info("Physical examination"), info("No-criminal-record certificate"), info("Bank statement"), info("CSCA report for undergraduate applicants")], applicationSteps: [info("Step 1", "Apply through the TJFSU international student service platform"), info("Step 2", "Submit the published supporting evidence"), info("Step 3", "Await university review and scholarship decision")], summary: "Closed 2026 municipal scholarship with distinct first- and second-prize coverage." },
  { ...scholarshipBase(highLevel), slug: "official-2026-tjfsu-cgs-high-level-graduate-type-b", title: "TJFSU 2026 Chinese Government Scholarship - High-Level Graduate Program (Type B)", nameZh: "天津外国语大学2026年中国政府奖学金高水平研究生项目（B类）", type: "government", typeLabel: "Chinese Government Scholarship", providerName: "国家留学基金管理委员会 / 天津外国语大学", providerNameEn: "China Scholarship Council / Tianjin Foreign Studies University", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible TJFSU graduate programs", amountText: "Master: CNY 3,000/month; doctoral: CNY 3,500/month, plus tuition, accommodation and insurance.", deadlineDate: "2026-02-22", deadlineLabel: "University application deadline: February 22, 2026", applicationRound: "2026 high-level graduate scholarship", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Living allowance", "CNY 3,000/month for master; CNY 3,500/month for doctoral"), benefit("Comprehensive medical insurance")], eligibilityItems: [info("Citizenship", "Non-Chinese citizen in good physical and mental health"), info("Academic and language requirements", "Must meet TJFSU's published program requirements")], applicationMaterials: [info("Passport"), info("Highest diploma and transcripts"), info("Language certificate"), info("Study or research plan"), info("Two recommendations"), info("Physical examination"), info("No-criminal-record certificate")], applicationSteps: [info("Step 1", "Apply to TJFSU by February 22, 2026"), info("Step 2", "Complete university review and interview"), info("Step 3", "After pre-admission, submit the CSC Type B application using agency number 10068")], summary: "Closed 2026 full scholarship for nominated master's and doctoral applicants." },
  { ...scholarshipBase(bilateral), slug: "official-2026-tjfsu-cgs-bilateral-type-a", title: "TJFSU 2026 Chinese Government Scholarship - Bilateral Program (Type A)", nameZh: "天津外国语大学2026年中国政府奖学金国别双边项目（A类）", type: "government", typeLabel: "Chinese Government Scholarship - Bilateral Program", providerName: "国家留学基金管理委员会 / 派遣国受理机构", providerNameEn: "China Scholarship Council / Home-country Dispatching Authority", fundingLevel: "Full or partial", coverage: "Full or partial scholarship according to the applicable bilateral agreement and CSC standard.", applicableDegree: "Undergraduate, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "Programs available under the bilateral agreement and TJFSU admission requirements", amountText: "Full or partial scholarship; exact coverage follows the applicable bilateral agreement.", deadlineLabel: "Usually early November to early April; exact 2026 deadline set by the applicant's dispatching authority", applicationRound: "2026 bilateral scholarship", benefitItems: [benefit("Full or partial scholarship", "Coverage follows the applicable bilateral agreement")], eligibilityItems: [info("Citizenship", "Non-Chinese citizen in good physical and mental health"), info("Nomination", "Recommendation by the applicant's home-country dispatching authority"), info("Age", "Undergraduate under 25; master under 35; doctoral under 40; general scholar under 45; senior scholar under 50")], applicationMaterials: [info("CSC application"), info("TJFSU pre-admission evidence if obtained"), info("Academic records"), info("Language certificate"), info("CSCA report for undergraduate applicants"), info("Study plan and recommendations where applicable"), info("Physical examination"), info("No-criminal-record certificate")], applicationSteps: [info("Step 1", "Confirm the deadline and nomination process with the home-country dispatching authority"), info("Step 2", "Obtain TJFSU pre-admission where required"), info("Step 3", "Submit the CSC Type A application through the dispatching authority")], summary: "Historical 2026 bilateral route; the exact deadline is controlled by each dispatching authority and is not inferred." },
];

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt, cities: [cityBundle.cities[0]],
  schools: [{ slug: schoolSlug, nameEn: "Tianjin Foreign Studies University", nameZh: "天津外国语大学", citySlug, schoolType: "Public", region: "Tianjin, North China", applicationLevel: "Undergraduate, Master, Doctoral and Non-degree", languageOfInstruction: "Chinese and English", languageRequirement: "Chinese-taught undergraduate routes require HSK 4 score 180; English-taught undergraduate routes require IELTS 6.0, TOEFL 80 or equivalent.", hskRequirement: "HSK Level 4 score 180 for reviewed 2026 Chinese-taught undergraduate routes.", englishRequirement: "IELTS 6.0, TOEFL 80 or equivalent for reviewed 2026 English-taught undergraduate routes.", deadlineSummary: "The reviewed 2026 undergraduate and university-controlled scholarship deadlines have passed; no 2027 cycle is inferred.", tuitionSummary: "2026 international undergraduate tuition: CNY 15,400/year, excluding textbooks.", applicationFee: "CNY 500", websiteUrl: "https://www.tjfsu.edu.cn/", admissionsUrl: undergraduate.url, cscaRequired: true, cscaRequirement: "All reviewed 2026 international undergraduate routes require the route-specific CSCA subjects in the official table.", cscaSubjects: ["Chinese for Humanities", "Chinese for STEM", "Mathematics", "Physics"], subjectTags: ["Languages", "International Studies", "Media", "Business", "Law", "Technology"], languageTags: ["Chinese", "English"], campusHighlights: ["Foreign-language and international-studies focus", "33 evidence-backed international undergraduate routes in the reviewed 2026 table"], status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt, sourceFieldLineage: { nameEn: "official university identity", nameZh: "official guide title", citySlug: "official admissions-office address", applicationLevel: `undergraduate guide plus scholarship categories ${municipal.sha256}`, languageOfInstruction: "official undergraduate major table", deadlineSummary: "reviewed 2026 official guides", tuitionSummary: "undergraduate fee section", applicationFee: "undergraduate fee section", admissionsUrl: "registered official guide URL", cscaRequirement: "undergraduate major table" } }],
  programs, programIntakes, scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha(candidateText), manifestSha256: sha(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["The official 2026 undergraduate table contains all 33 program identities, teaching languages, durations and CSCA subjects used here.", "English program names are editorial renderings and remain review-required.", "All 2026 university-controlled deadlines are represented as closed; no 2027 cycle is inferred.", "The municipal scholarship and two CSC routes are separate records. The legacy generic new-student scholarship is not overwritten.", "The Type A deadline remains dispatching-authority controlled and no exact date is fabricated."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
