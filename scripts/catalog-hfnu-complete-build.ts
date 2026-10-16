import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-28-19-549Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.hfnu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.hfnu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((row) => row.id === "hfnu-international-student-admissions-pdf-2026");
if (!source || source.status !== 200 || source.sha256 !== "84fac21acdad4ab6c7027c3f78ce5ebf2ab9fe2b3b10e5dc7ceb5a3d83af0b8c") throw new Error("HFNU official evidence mismatch.");

const schoolSlug = "hefei-normal-university";
const citySlug = "hefei";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type NamedSpec = readonly [nameZh: string, nameEn: string, category: string];
const undergraduate: NamedSpec[] = [
  ["汉语言文学", "Chinese Language and Literature", "Languages and Literature"], ["网络与新媒体", "Network and New Media", "Media"],
  ["国际经济与贸易", "International Economics and Trade", "Economics"], ["人力资源管理", "Human Resource Management", "Management"], ["财务管理", "Financial Management", "Business"], ["互联网金融", "Internet Finance", "Finance"], ["数字经济", "Digital Economy", "Economics"],
  ["应用心理学", "Applied Psychology", "Psychology"],
  ["视觉传达设计", "Visual Communication Design", "Arts"], ["服装与服饰设计", "Fashion and Apparel Design", "Arts"], ["环境设计", "Environmental Design", "Arts"], ["动画", "Animation", "Arts"], ["音乐表演", "Music Performance", "Arts"],
  ["应用统计学", "Applied Statistics", "Science"], ["经济统计学", "Economic Statistics", "Economics"],
  ["电子信息工程", "Electronic Information Engineering", "Engineering"], ["通信工程", "Communication Engineering", "Engineering"], ["电气工程及其自动化", "Electrical Engineering and Automation", "Engineering"], ["集成电路设计与集成系统", "Integrated Circuit Design and Integrated Systems", "Engineering"], ["微电子科学与工程", "Microelectronics Science and Engineering", "Engineering"],
  ["材料科学与工程", "Materials Science and Engineering", "Engineering"], ["光电信息科学与工程", "Optoelectronic Information Science and Engineering", "Engineering"], ["新能源材料与器件", "New Energy Materials and Devices", "Engineering"],
  ["计算机科学与技术", "Computer Science and Technology", "Information Technology"], ["人工智能", "Artificial Intelligence", "Information Technology"], ["软件工程", "Software Engineering", "Information Technology"], ["数据科学与大数据技术", "Data Science and Big Data Technology", "Information Technology"], ["网络工程", "Network Engineering", "Information Technology"],
  ["制药工程", "Pharmaceutical Engineering", "Engineering"], ["化学工程与工艺", "Chemical Engineering and Technology", "Engineering"], ["食品质量与安全", "Food Quality and Safety", "Food Science"], ["生物制药", "Biopharmaceuticals", "Medicine"],
];
const masters: NamedSpec[] = [
  ["学科教学（物理）", "Subject Teaching (Physics)", "Education"], ["学科教学（化学）", "Subject Teaching (Chemistry)", "Education"], ["学科教学（生物）", "Subject Teaching (Biology)", "Education"], ["学科教学（美术）", "Subject Teaching (Fine Arts)", "Education"], ["学科教学（体育）", "Subject Teaching (Physical Education)", "Education"], ["学科教学（音乐）", "Subject Teaching (Music)", "Education"], ["教育管理", "Educational Administration", "Education"], ["心理健康教育", "Mental Health Education", "Education"], ["现代教育技术", "Modern Educational Technology", "Education"], ["职业技术教育", "Vocational and Technical Education", "Education"],
  ["光电信息工程", "Optoelectronic Information Engineering", "Engineering"], ["制药工程", "Pharmaceutical Engineering", "Engineering"], ["生物技术与工程", "Biotechnology and Engineering", "Engineering"], ["食品工程", "Food Engineering", "Food Science"], ["新一代电子信息技术（含量子技术等）", "New Generation Electronic Information Technology (Including Quantum Technology)", "Information Technology"], ["电子信息", "Electronic Information", "Information Technology"], ["人工智能", "Artificial Intelligence", "Information Technology"],
];
const makePrograms = (specs: NamedSpec[], degreeLevel: "Undergraduate" | "Master", tuitionAmount: number): CatalogSeedProgram[] => specs.map(([nameZh, nameEn, fieldCategory]) => ({
  slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slugify(nameEn)}`,
  schoolSlug, citySlug, nameEn, nameZh, degreeLevel, fieldCategory, subjectArea: nameEn,
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 4 or above for Chinese-taught degree programs.",
  tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
  scholarshipText: "Degree students may apply for the Anhui Provincial Foreign Student Scholarship or the Study at HFNU Outstanding International Student Scholarship.",
  applicationNote: "Applications are submitted by email according to the reviewed 2026 brochure; English names are editorial translations of the official Chinese table labels.",
  hasScholarship: true, status: "draft", ...evidence,
  sourceFieldLineage: { nameZh: degreeLevel === "Undergraduate" ? "Section II.1(a) undergraduate table" : "Section II.1(b) postgraduate table", nameEn: "editorial translation of official Chinese name", degreeLevel: "Section II headings", teachingLanguage: "Section II program table", hskRequirement: "Section IV.5", tuitionText: "Section VIII fee table" },
}));
const programs = [...makePrograms(undergraduate, "Undergraduate", 15000), ...makePrograms(masters, "Master", 20000)];
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-07-31T15:59:59.000Z", deadlineLabel: "July 31, 2026", applicationRound: "2026 international student admissions", status: "closed" as const, ...evidence, sourceFieldLineage: { intakeYear: "brochure title", deadlineDate: "Section VI.1" } }));
const scholarships: CatalogSeedScholarship[] = [{
  slug: "hfnu-study-at-hfnu-outstanding-international-student-scholarship-2026",
  title: "Study at HFNU Outstanding International Student Scholarship",
  nameZh: "留学合师优秀国际生奖学金",
  schoolSlug, type: "university", typeLabel: "University scholarship", providerName: "合肥师范学院", providerNameEn: "Hefei Normal University", providerLocation: "Hefei, Anhui, China",
  fundingLevel: "Annual tuition-level award", coverage: "CNY 20,000/year for master's students and CNY 15,000/year for undergraduate students.", applicableDegree: "Undergraduate and Master", applicableProgram: "Degree programs listed in the 2026 brochure", amountText: "CNY 20,000/year (Master); CNY 15,000/year (Undergraduate)", deadlineLabel: "July 31, 2026 admissions deadline; no separate scholarship deadline stated", applicationRound: "2026 international student admissions", targetCountries: [], targetRegions: [],
  eligibilityItems: [{ label: "Applicant group", value: "International degree students; award places and levels are determined by university expert review." }], applicationSteps: [{ label: "Application", value: "Submit the scholarship application form with the admissions materials by email." }], actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" }], summary: "The 2026 brochure publishes annual award amounts for degree students and excludes preparatory and language students.", status: "draft", ...evidence,
  sourceFieldLineage: { title: "Section IX", fundingLevel: "Section IX", coverage: "Section IX", applicableDegree: "Section IX", amountText: "Section IX", deadlineLabel: "Section VI.1 and no separate scholarship deadline" },
}];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Hefei", nameZh: "合肥", province: "Anhui", region: "East China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "Section IX contact address", nameZh: "Section IX contact address", province: "Section IX contact address", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "Hefei Normal University", nameZh: "合肥师范学院", citySlug, schoolType: "Public", region: "Hefei, Anhui, East China", applicationLevel: "Undergraduate, Master, Preparatory, Non-degree Chinese Language", languageOfInstruction: "Chinese for all listed degree programs", languageRequirement: "HSK Level 4 or above for Chinese-taught degree programs; no Chinese threshold is stated for non-degree applicants.", hskRequirement: "HSK Level 4 or above for degree programs.", deadlineSummary: "July 31, 2026; the reviewed cycle is closed and no later deadline is inferred.", tuitionSummary: "Master: CNY 20,000/year. Undergraduate: CNY 15,000/year. Preparatory/Chinese language: CNY 4,500/year.", applicationFee: "Free", websiteUrl: "https://www.hfnu.edu.cn/", admissionsUrl: source.finalUrl, subjectTags: ["Education", "Humanities", "Business", "Engineering", "Science", "Arts", "Food Science"], languageTags: ["Chinese", "HSK 4"], campusHighlights: ["Hefei location", "32 listed undergraduate programs", "17 listed master's fields"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "brochure title / editorial English rendering", nameZh: "brochure title", citySlug: "Section IX contact address", schoolType: "official university identity", applicationLevel: "Section II", languageRequirement: "Section IV", deadlineSummary: "Section VI", tuitionSummary: "Section VIII", websiteUrl: "Section IX", admissionsUrl: "registered official PDF" } }],
  programs, programIntakes, scholarships };

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["All 32 undergraduate and 17 master's fields are transcribed from the official 2026 PDF.", "English program names are editorial translations; Chinese names, teaching language and tuition are explicit.", "The brochure gives duration ranges by level rather than per program, so program duration fields remain absent.", "No 2027 intake or CSCA subject assignment is inferred.", "Personal contact details and applicant documents are excluded."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
