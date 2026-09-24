import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T11-39-11-817Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.chongqing-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.sisu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sisu-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText), cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>(((manifest.sources || []) as SourceRecord[]).map(row => [row.id, row]));
const expected = {
  "sisu-international-undergraduate-admissions-2026-2027": "ef9fddfe6d355d2c4fc80826aad101006c4b990251ac94826ec8842ba9c827e6",
  "sisu-chinese-language-admissions-2026-2027": "125e479ea88010d4dae90ecbb6b901725d7723bd0893379304f17d88d173b52c",
  "sisu-moe-chongqing-joint-scholarship-2026-2027": "5116d870bb35c9c25488d4fea5e5d4641880ae5176971dbc98e15021f325c814",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`SISU evidence mismatch: ${id}`);
}
const ug = sources.get("sisu-international-undergraduate-admissions-2026-2027")!;
const language = sources.get("sisu-chinese-language-admissions-2026-2027")!;
const joint = sources.get("sisu-moe-chongqing-joint-scholarship-2026-2027")!;
const schoolSlug = "sichuan-international-studies-university", citySlug = "chongqing";
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const namedMajors = [
  ["Chinese Language and Literature", "汉语言文学", "Literature"],
  ["Teaching Chinese to Speakers of Other Languages", "汉语国际教育", "Chinese Language"],
  ["Journalism", "新闻学", "Media"],
  ["Diplomacy", "外交学", "International Studies"],
  ["International Economics and Trade", "国际经济与贸易", "Economics"],
  ["E-commerce", "电子商务", "Business"],
  ["Tourism Management", "旅游管理", "Management"],
] as const;
const degreePrograms: CatalogSeedProgram[] = namedMajors.map(([nameEn, nameZh, category]) => ({
  slug: `${schoolSlug}-${slugify(nameEn)}`, schoolSlug, citySlug, nameEn, nameZh, degreeLevel: "Undergraduate",
  fieldCategory: category, subjectArea: nameEn, teachingLanguage: "Chinese",
  cscaSubjects: nameZh === "汉语言文学" ? ["Chinese for Humanities", "Mathematics"] : ["Chinese for Humanities", "Mathematics"],
  cscaRequirement: nameZh === "汉语言文学" ? "CSCA Chinese for Humanities and Mathematics are required; the Chinese subject may be waived with a valid HSK Level 4 report." : "CSCA Chinese for Humanities and Mathematics are required.",
  tuitionAmount: 15000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 15,000/year",
  applicationUrl: ug.url, applicationNote: "Official 2026-2027 international undergraduate route; the page explicitly names this major but does not publish a route-specific duration or HSK score threshold.",
  hasScholarship: true, scholarshipText: "The guide lists Chinese Government, International Chinese Language Teachers, and Chongqing Municipal Government scholarship categories.",
  status: "draft", sourceUrl: ug.url, sourceLabel: ug.label, sourceSha256: ug.sha256, capturedAt: ug.fetchedAt,
  sourceFieldLineage: { nameEn: "editorial English rendering of the explicitly named official major; requires review", nameZh: "official major list", degreeLevel: "guide title", teachingLanguage: "guide's Chinese-language requirement and CSCA instructions", cscaSubjects: "CSCA section", tuitionAmount: "fee section", applicationUrl: "registered official guide URL" },
}));
const languageProgram: CatalogSeedProgram = {
  slug: `${schoolSlug}-chinese-language-study-2026-2027`, schoolSlug, citySlug,
  nameEn: "Chinese Language Study Program 2026-2027", nameZh: "2026-2027学年国际学生汉语进修项目",
  degreeLevel: "Non-degree", fieldCategory: "Chinese Language", subjectArea: "Chinese Language Study", teachingLanguage: "Chinese",
  tuitionAmount: 7000, tuitionCurrency: "CNY", tuitionPeriod: "semester", tuitionText: "CNY 7,000/semester or CNY 14,000/year",
  applicationUrl: language.url, applicationNote: "The official guide permits one-semester, one-academic-year and short-group study; short-group tuition is agreed separately.",
  hasScholarship: false, status: "draft", sourceUrl: language.url, sourceLabel: language.label, sourceSha256: language.sha256, capturedAt: language.fetchedAt,
  sourceFieldLineage: { nameEn: "editorial English rendering of the official guide title; requires review", nameZh: "official guide title", degreeLevel: "program categories", teachingLanguage: "program title", tuitionAmount: "fee section", applicationUrl: "registered official guide URL" },
};
const programs = [...degreePrograms, languageProgram];
const programIntakes = [
  ...degreePrograms.map(program => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2026-01-01T00:00:00.000Z", deadlineDate: "2026-05-31T15:59:59.000Z", deadlineLabel: "May 31, 2026", applicationRound: "2026-2027 self-funded international undergraduate admission", status: "closed" as const, sourceUrl: ug.url, sourceLabel: ug.label, sourceSha256: ug.sha256, capturedAt: ug.fetchedAt, sourceFieldLineage: { openDate: "official self-funded application schedule", deadlineDate: "official self-funded application schedule", intakeYear: "official intake schedule" } })),
  { programSlug: languageProgram.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-15T15:59:59.000Z", deadlineLabel: "June 15, 2026", applicationRound: "September 2026 Chinese language admission", status: "closed" as const },
  { programSlug: languageProgram.slug, intakeTerm: "Late Fall", intakeYear: 2026, deadlineDate: "2026-09-30T15:59:59.000Z", deadlineLabel: "September 30, 2026", applicationRound: "November 2026 Chinese language admission", status: "open" as const },
  { programSlug: languageProgram.slug, intakeTerm: "Spring", intakeYear: 2027, deadlineDate: "2026-12-15T15:59:59.000Z", deadlineLabel: "December 15, 2026", applicationRound: "March 2027 Chinese language admission", status: "open" as const },
  { programSlug: languageProgram.slug, intakeTerm: "Late Spring", intakeYear: 2027, deadlineDate: "2027-03-30T15:59:59.000Z", deadlineLabel: "March 30, 2027", applicationRound: "May 2027 Chinese language admission", status: "open" as const },
].map(row => ({ sourceUrl: language.url, sourceLabel: language.label, sourceSha256: language.sha256, capturedAt: language.fetchedAt, sourceFieldLineage: { deadlineDate: "official intake and deadline section", intakeYear: "official intake and deadline section" }, ...row }));

const scholarship: CatalogSeedScholarship = {
  slug: "official-2026-2027-sisu-moe-chongqing-joint-scholarship", schoolSlug,
  title: "SISU 2026-2027 MOE-Chongqing Government Joint Scholarship", nameZh: "四川外国语大学2026-2027学年教育部重庆市人民政府来华留学联合奖学金",
  type: "government", typeLabel: "MOE-Chongqing Government Joint Scholarship", providerName: "教育部 / 重庆市人民政府 / 四川外国语大学", providerNameEn: "Ministry of Education / Chongqing Municipal Government / Sichuan International Studies University", providerLocation: "Chongqing, China", fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance under the published joint-scholarship standard.", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Programs in the official scholarship attachment; three undergraduate, nine master's and three doctoral quotas are published.", amountText: "Full scholarship; the university page directs applicants to the applicable CSC standard for amounts.", deadlineDate: "2026-02-28", deadlineLabel: "February 28, 2026", applicationRound: "2026-2027 joint scholarship", targetCountries: [], targetRegions: [],
  benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true }, { label: "Living allowance", included: true }, { label: "Comprehensive medical insurance", included: true }],
  eligibilityItems: [{ label: "Citizenship and health", value: "Non-Chinese citizen in good physical and mental health" }, { label: "Age", value: "Undergraduate under 25; master under 35; doctoral under 40" }, { label: "Chinese proficiency", value: "Undergraduate Chinese Language and Literature HSK 4 score 180; other undergraduate and master routes generally HSK 5 score 180; doctoral HSK 6 score 180" }],
  applicationMaterials: [{ label: "CSC application form" }, { label: "Passport" }, { label: "Diploma and transcripts" }, { label: "Language certificate" }, { label: "CSCA report for undergraduate applicants" }, { label: "Study plan" }, { label: "Recommendation letters" }, { label: "Physical examination" }, { label: "No-criminal-record certificate" }],
  applicationSteps: [{ label: "Step 1", value: "Complete the required CSCA test if applying for undergraduate study" }, { label: "Step 2", value: "Apply in the CSC system using SISU agency number 10650" }, { label: "Step 3", value: "Apply in SISU's international student service platform" }, { label: "Step 4", value: "Complete university assessment and nomination review" }],
  actionLinks: [{ label: joint.label, url: joint.url, kind: "official-source" }], summary: "Closed 2026-2027 full joint scholarship with published undergraduate, master's and doctoral quotas.", status: "draft", sourceUrl: joint.url, sourceLabel: joint.label, sourceSha256: joint.sha256, capturedAt: joint.fetchedAt,
  sourceFieldLineage: { title: "official page title", fundingLevel: "coverage section", coverage: "coverage section", applicableDegree: "quota section", deadlineDate: "application procedure", eligibilityItems: "eligibility section", applicationMaterials: "materials section", applicationSteps: "application procedure" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [cityBundle.cities[0]], schools: [{ slug: schoolSlug, nameEn: "Sichuan International Studies University", nameZh: "四川外国语大学", citySlug, schoolType: "Public", region: "Chongqing, Southwest China", applicationLevel: "Undergraduate, Master, Doctoral and Non-degree", languageOfInstruction: "Chinese", languageRequirement: "Degree applicants must provide a valid HSK report meeting the selected route's requirements; the general undergraduate guide does not publish one universal score threshold.", deadlineSummary: "Reviewed Fall 2026 degree routes are closed. Chinese-language intakes for November 2026, March 2027 and May 2027 remain open on their published schedules.", tuitionSummary: "International undergraduate tuition is CNY 15,000/year; Chinese language study is CNY 7,000/semester or CNY 14,000/year.", applicationFee: "CNY 800", websiteUrl: "https://www.sisu.edu.cn/", admissionsUrl: ug.url, cscaRequired: true, cscaRequirement: "International undergraduate applicants require CSCA Chinese for Humanities and Mathematics; Chinese Language and Literature may waive Chinese with a valid HSK Level 4 report.", cscaSubjects: ["Chinese for Humanities", "Mathematics"], subjectTags: ["Languages", "Journalism", "Diplomacy", "Economics", "Business", "Tourism"], languageTags: ["Chinese"], campusHighlights: ["Foreign-language and international-studies focus", "Current 2026-2027 Chinese-language intake schedule"], status: "draft", sourceUrl: ug.url, sourceLabel: ug.label, sourceSha256: ug.sha256, capturedAt: ug.fetchedAt, sourceFieldLineage: { nameEn: "official English university identity", nameZh: "official guide title", citySlug: "official contact address", applicationLevel: `undergraduate guide plus language guide ${language.sha256} and scholarship degree categories ${joint.sha256}`, languageOfInstruction: "reviewed guide requirements", deadlineSummary: `undergraduate guide and language guide ${language.sha256}`, tuitionSummary: `undergraduate guide and language guide ${language.sha256}`, applicationFee: `undergraduate guide and language guide ${language.sha256}`, admissionsUrl: "registered official guide URL", cscaRequirement: "undergraduate CSCA section" } }], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha(candidateText), manifestSha256: sha(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["Only seven majors explicitly named in the official undergraduate page are created; the phrase 'and more' is not expanded.", "The prohibited legacy MBBS and Stomatology records are not treated as replacements because the reviewed official pages do not identify those programs.", "The prohibited legacy generic Economics record is not conflated with the explicitly published International Economics and Trade route.", "November 2026, March 2027 and May 2027 Chinese-language intakes use their explicit current deadlines.", "English program names are editorial renderings and remain review-required."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
