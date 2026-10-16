import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-45-30-565Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.cqnu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.cqnu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const undergraduateSource = manifest.sources.find((item) => item.id === "cqnu-international-undergraduate-admissions-2026");
const graduateSource = manifest.sources.find((item) => item.id === "cqnu-international-graduate-admissions-2026");
if (!undergraduateSource || undergraduateSource.status !== 200 || undergraduateSource.sha256 !== "bf462d9b015c07fa2d1f93982125794823068beed4e31a8f6a2853ed45e26e4b") throw new Error("CQNU undergraduate evidence mismatch.");
if (!graduateSource || graduateSource.status !== 200 || graduateSource.sha256 !== "2eb89bd00398ecfa8a0a51706f5348fd2926e059b3be8e17c987fd1d1355863b") throw new Error("CQNU graduate evidence mismatch.");

const schoolSlug = "chongqing-normal-university";
const citySlug = "chongqing";
const evidence = { sourceUrl: undergraduateSource.finalUrl, sourceLabel: undergraduateSource.label, sourceSha256: undergraduateSource.sha256, capturedAt: undergraduateSource.fetchedAt };
const slug = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Spec = readonly [nameZh: string, nameEn: string, tuition: number, category: string, csca: "humanities" | "physics" | "chemistry"];
const specs: Spec[] = `思想政治教育|Ideology and Political Science Education|14000|Education|humanities
历史学|History|14000|History|humanities
文物与博物馆学|Cultural Heritage and Museology|14000|History|humanities
社会工作|Social Work|14000|Social Science|humanities
应用心理学|Applied Psychology|14000|Science|humanities
教育学|Pedagogy|14000|Education|humanities
学前教育|Pre-school Education|14000|Education|humanities
特殊教育|Special Education|14000|Education|humanities
教育康复学|Educational Rehabilitation|14000|Education|humanities
体育教育|Physical Education|14000|Education|humanities
运动训练|Sports Training|14000|Education|humanities
汉语言文学|Chinese Language and Literature|14000|Literature|humanities
秘书学|Secretarial Studies|14000|Literature|humanities
戏剧影视文学|Drama and Television Literature|21000|Arts|humanities
汉语国际教育|Teaching Chinese as a Foreign Language|14000|Literature|humanities
英语|English|14000|Literature|humanities
翻译|Translation|14000|Literature|humanities
日语|Japanese|14000|Literature|humanities
音乐学|Musicology|21000|Arts|humanities
音乐表演|Music Performance|21000|Arts|humanities
舞蹈学|Dance|21000|Arts|humanities
舞蹈表演|Dance Performance|21000|Arts|humanities
服装与服饰设计|Fashion and Clothing Design|21000|Arts|humanities
环境设计|Environment Design|21000|Arts|humanities
视觉传达设计|Visual Communication Design|21000|Arts|humanities
产品设计|Product Design|21000|Arts|humanities
美术学|Fine Arts|21000|Arts|humanities
绘画|Drawing|21000|Arts|humanities
数学与应用数学|Mathematics and Applied Mathematics|16000|Science|physics
数据科学与大数据技术|Data Science and Big Data Technology|16000|Engineering|physics
物理学|Physics|16000|Science|physics
光电信息科学与工程|Opto-Electronics Information Science and Engineering|16000|Engineering|physics
电子信息科学与技术|Electronic and Information Science|16000|Engineering|physics
化学|Chemistry|16000|Science|chemistry
材料化学|Materials Chemistry|16000|Science|chemistry
高分子材料与工程|Polymer Materials and Engineering|16000|Engineering|chemistry
生物科学|Biological Sciences|16000|Science|chemistry
森林保护|Forest Protection|16000|Agriculture|chemistry
生物技术|Biotechnology|16000|Science|chemistry
食品质量与安全|Food Quality and Safety|16000|Engineering|chemistry
经济学|Economics|16000|Economics|humanities
金融工程|Financial Engineering|16000|Economics|humanities
工商管理|Business Administration|16000|Management|humanities
人力资源管理|Human Resource Management|16000|Management|humanities
大数据管理与应用|Big Data Management and Application|16000|Management|humanities
财务管理|Financial Management|16000|Management|humanities
计算机科学与技术|Computer Science and Technology|16000|Engineering|physics
软件工程|Software Engineering|16000|Engineering|physics
电子商务|Electronic Commerce|16000|Management|physics
智能科学与技术|Intelligent Science and Technology|16000|Engineering|physics
地理科学|Geographical Science|16000|Science|physics
地理信息科学|Geographic Information Science|16000|Science|physics
旅游管理|Tourism Management|16000|Management|humanities
航空服务艺术与管理|Aviation Service Art and Management|21000|Arts|humanities
影视摄影与制作|Television Photography and Production|21000|Arts|humanities
广播电视编导|Radio and Television Directing|21000|Arts|humanities
新闻学|Journalism|14000|Literature|humanities
数字媒体艺术|Digital Media Art|21000|Arts|humanities
网络与新媒体|Internet and New Media|14000|Literature|humanities`.split("\n").map((row) => { const [a, b, c, d, e] = row.split("|"); return [a, b, Number(c), d, e] as Spec; });

const cscaSubjects = (kind: Spec[4]) => kind === "humanities" ? ["Humanities Chinese", "Mathematics"] : kind === "physics" ? ["STEM Chinese", "Mathematics", "Physics"] : ["STEM Chinese", "Mathematics", "Chemistry"];
const programs: CatalogSeedProgram[] = specs.map(([nameZh, nameEn, tuitionAmount, fieldCategory, csca]) => ({
  slug: `${schoolSlug}-undergraduate-${slug(nameEn)}`,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel: "Undergraduate",
  durationYears: 4,
  fieldCategory,
  subjectArea: nameEn,
  teachingLanguage: "Chinese",
  cscaSubjects: cscaSubjects(csca),
  cscaRequirement: "A CSCA score certificate is required; subjects are program-specific as listed in the official table.",
  hskRequirement: "HSK Level 4 with a score of 180 or above.",
  tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
  applicationNote: "Apply through the Chongqing Normal University International Student Online Service System published in the official brochure.",
  hasScholarship: true,
  status: "draft",
  ...evidence,
  sourceFieldLineage: { nameZh: "undergraduate program table", nameEn: "undergraduate program table", degreeLevel: "brochure scope", durationYears: "undergraduate program table", teachingLanguage: "Special Notes", cscaSubjects: "undergraduate program table", cscaRequirement: "Admission Process", hskRequirement: "Eligibility and Application Materials", tuitionText: "undergraduate program table" },
}));
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2026-01-01T00:00:00.000Z", deadlineDate: "2026-06-30T15:59:59.000Z", deadlineLabel: "June 30, 2026", applicationRound: "2026 undergraduate admissions", status: "closed" as const, ...evidence, sourceFieldLineage: { intakeYear: "brochure title", openDate: "Online Application", deadlineDate: "Online Application" } }));

const scholarshipBase = { schoolSlug, applicableDegree: "Undergraduate", targetCountries: [] as string[], targetRegions: [] as string[], applicationRound: "2026 undergraduate admissions", actionLinks: [{ label: undergraduateSource.label, url: undergraduateSource.finalUrl, kind: "official-source" as const }], status: "draft" as const, ...evidence };
const scholarships = [
  { ...scholarshipBase, slug: `${schoolSlug}-chinese-government-scholarship-2026`, title: "Chinese Government Scholarship at Chongqing Normal University", type: "government", typeLabel: "Chinese Government Scholarship", providerNameEn: "China Scholarship Council", providerLocation: "China", fundingLevel: "Full or partial scholarship", coverage: "Full scholarship exempts registration, tuition, on-campus accommodation and comprehensive medical insurance fees and provides CNY 2,500/month living allowance for undergraduate students; partial scholarship covers one or more items.", amountText: "Full route includes CNY 2,500/month living allowance; partial route covers one or more full-scholarship items", deadlineLabel: "Type B deadline published as March 1, 2026 in the reviewed brochure", eligibilityItems: [{ label: "Language", value: "HSK Level 4 with a score of 180 or above." }, { label: "Assessment", value: "CSCA score certificate required." }], applicationSteps: [] as Array<{ label: string; value: string }>, summary: "Chinese Government Scholarship route for undergraduate applicants.", sourceFieldLineage: { title: "Scholarship Application", coverage: "Chinese Government Scholarship coverage", amountText: "Chinese Government Scholarship coverage", deadlineLabel: "Chinese Government Scholarship application time" } },
  { ...scholarshipBase, slug: `${schoolSlug}-international-chinese-language-teachers-scholarship-2026`, title: "International Chinese Language Teachers Scholarship at Chongqing Normal University", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerNameEn: "Center for Language Education and Cooperation", providerLocation: "China", fundingLevel: "Full scholarship", coverage: "Registration, tuition, accommodation, CNY 2,500/month living allowance and comprehensive medical insurance.", amountText: "CNY 2,500/month living allowance plus registration, tuition, accommodation and medical insurance", deadlineLabel: "May 15, 2026", eligibilityItems: [{ label: "Language", value: "HSK Level 4 score of 210 or above and HSKK." }, { label: "Assessment", value: "CSCA score certificate required." }], applicationSteps: [] as Array<{ label: string; value: string }>, summary: "Full scholarship route for the eligible September-start bachelor program.", sourceFieldLineage: { title: "Scholarship Application", coverage: "International Chinese Language Teachers Scholarship coverage", amountText: "International Chinese Language Teachers Scholarship coverage", deadlineLabel: "application time" } },
  { ...scholarshipBase, slug: `${schoolSlug}-chongqing-mayor-scholarship-2026`, title: "Chongqing Municipal People's Government Mayor Scholarship at CQNU", type: "government", typeLabel: "Municipal government scholarship", providerNameEn: "Chongqing Municipal People's Government", providerLocation: "Chongqing, China", fundingLevel: "CNY 25,000/year", coverage: "Annual scholarship award for the undergraduate program.", amountText: "CNY 25,000/year", deadlineLabel: "May 30, 2026", eligibilityItems: [{ label: "Language", value: "HSK Level 4 score of 210 or above." }, { label: "Assessment", value: "CSCA score certificate required." }], applicationSteps: [] as Array<{ label: string; value: string }>, summary: "Municipal scholarship for CQNU undergraduate applicants.", sourceFieldLineage: { title: "Scholarship Application", amountText: "Mayor Scholarship basic information", deadlineLabel: "application time" } },
  { ...scholarshipBase, slug: `${schoolSlug}-president-scholarship-2026`, title: "Chongqing Normal University President Scholarship", type: "university", typeLabel: "University scholarship", providerNameEn: "Chongqing Normal University", providerLocation: "Chongqing, China", fundingLevel: "First or second class", coverage: "First class waives tuition, four-bed accommodation and registration fees and provides CNY 400/month; second class waives tuition and registration fees. First-year applicants can apply only for second class.", amountText: "First class includes CNY 400/month plus fee waivers; second class waives tuition and registration fees", deadlineLabel: "May 30, 2026", eligibilityItems: [{ label: "Language", value: "HSK Level 4 score of 210 or above." }, { label: "Assessment", value: "CSCA score certificate required." }], applicationSteps: [] as Array<{ label: string; value: string }>, summary: "University-funded first- and second-class scholarship.", sourceFieldLineage: { title: "Scholarship Application", coverage: "President Scholarship coverage", amountText: "President Scholarship coverage", deadlineLabel: "application time" } },
];

const graduateEvidence = { sourceUrl: graduateSource.finalUrl, sourceLabel: graduateSource.label, sourceSha256: graduateSource.sha256, capturedAt: graduateSource.fetchedAt };
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Chongqing", nameZh: "重庆", province: "Chongqing", region: "Southwest China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "contact address", nameZh: "official institution identity", province: "contact address", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "Chongqing Normal University", nameZh: "重庆师范大学", citySlug, schoolType: "Public", region: "Chongqing, Southwest China", applicationLevel: "Undergraduate, Master and Doctorate", languageOfInstruction: "All listed undergraduate programs are Chinese-taught; graduate Chinese and selected English routes are described in the graduate brochure.", languageRequirement: "Undergraduate HSK 4 (180+); master's HSK 5 (180+); English-taught Mathematics and Biology doctorates require IELTS 6.0 or TOEFL iBT 80 unless exempt.", hskRequirement: "HSK 4 (180+) undergraduate; HSK 5 (180+) Chinese-taught graduate.", deadlineSummary: "Undergraduate and graduate applications closed June 30, 2026.", tuitionSummary: "Undergraduate CNY 14,000-21,000/year by field; graduate tuition varies by level and field as published in the graduate brochure.", applicationFee: "CNY 400", websiteUrl: "https://www.cqnu.edu.cn/", admissionsUrl: undergraduateSource.finalUrl, subjectTags: [...new Set(specs.map((item) => item[3]))], languageTags: ["Chinese", "English", "HSK 4", "HSK 5"], campusHighlights: ["Chongqing municipality", "59 listed undergraduate programs", "Undergraduate through doctoral study"], status: "draft", ...graduateEvidence, sourceFieldLineage: { nameEn: "brochure title", nameZh: "official institution identity", citySlug: "contact address", applicationLevel: "undergraduate and graduate brochure scopes", languageRequirement: "eligibility requirements", deadlineSummary: "application periods", tuitionSummary: "tuition sections", applicationFee: "fee sections", admissionsUrl: "registered official brochure" } }],
  programs,
  programIntakes,
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const artifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["All 59 undergraduate rows, Chinese instruction, four-year duration, tuition and CSCA subjects are transcribed from the official undergraduate table.", "The graduate brochure confirms graduate routes and requirements but refers to a separate major list; graduate program rows are not invented.", "The published online service system uses HTTP, so no normalized HTTPS applicationUrl is invented.", "Only scholarship values expressly published in the brochures are recorded."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, summary: validation.summary }, null, 2));
