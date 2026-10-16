import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-46-53-401Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.wzu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.wzu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((item) => item.id === "wzu-international-student-admission-guide-pdf-2026");
if (!source || source.status !== 200 || source.sha256 !== "057e87df010a699825b45b4c579aa191b2e869043de7de0affad101f87146f89") throw new Error("WZU evidence mismatch.");
const schoolSlug = "wenzhou-university", citySlug = "wenzhou";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slug = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Spec = readonly [degreeLevel: "Undergraduate" | "Master", nameEn: string, years: number, category: "Liberal Arts" | "Science and Engineering" | "Art and Sports", language?: "Chinese"];
const specs: Spec[] = [
  ["Undergraduate", "International Economics and Trade", 4, "Liberal Arts"],
  ["Undergraduate", "Business Administration", 4, "Liberal Arts"],
  ["Undergraduate", "Applied Psychology", 4, "Liberal Arts"],
  ["Undergraduate", "Translation", 4, "Liberal Arts"],
  ["Undergraduate", "Japanese", 4, "Liberal Arts"],
  ["Undergraduate", "English", 4, "Liberal Arts"],
  ["Undergraduate", "Materials Science and Engineering", 4, "Science and Engineering"],
  ["Undergraduate", "Chemistry", 4, "Science and Engineering"],
  ["Undergraduate", "Biotechnology", 4, "Science and Engineering"],
  ["Undergraduate", "Mechanical Engineering", 4, "Science and Engineering"],
  ["Undergraduate", "Electrical Engineering and Automation", 4, "Science and Engineering"],
  ["Undergraduate", "Electronic Information Science and Technology", 4, "Science and Engineering"],
  ["Undergraduate", "Computer Science and Technology", 4, "Science and Engineering"],
  ["Undergraduate", "Civil Engineering", 4, "Science and Engineering"],
  ["Undergraduate", "Calligraphy", 4, "Art and Sports", "Chinese"],
  ["Undergraduate", "Chinese Language and Literature", 4, "Liberal Arts", "Chinese"],
  ["Master", "Applied Economics", 3, "Liberal Arts"],
  ["Master", "Applied Psychology", 3, "Liberal Arts"],
  ["Master", "Modern Educational Technology", 3, "Liberal Arts"],
  ["Master", "Chinese Language and Literature", 3, "Liberal Arts", "Chinese"],
  ["Master", "English Teaching", 3, "Liberal Arts"],
  ["Master", "Translation", 3, "Liberal Arts"],
  ["Master", "Materials Science and Engineering", 3, "Science and Engineering"],
  ["Master", "Biology", 3, "Science and Engineering"],
  ["Master", "Resources and Environment", 3, "Science and Engineering"],
  ["Master", "Mechanical Engineering", 3, "Science and Engineering", "Chinese"],
  ["Master", "Electrical Engineering", 3, "Science and Engineering"],
  ["Master", "Computer Science and Technology", 3, "Science and Engineering"],
  ["Master", "Civil and Hydraulic Engineering", 3, "Science and Engineering"],
  ["Master", "International Chinese Language Education", 3, "Liberal Arts", "Chinese"],
  ["Master", "Overseas Chinese Studies", 3, "Liberal Arts", "Chinese"],
];
const fees = { Undergraduate: { "Liberal Arts": [16000, 18000], "Science and Engineering": [18000, 20000], "Art and Sports": [20000, 22000] }, Master: { "Liberal Arts": [20000, 22000], "Science and Engineering": [22000, 24000], "Art and Sports": [24000, 26000] } } as const;
const programs: CatalogSeedProgram[] = specs.map(([degreeLevel, nameEn, durationYears, fieldCategory, explicitLanguage]) => {
  const [chineseFee, englishFee] = fees[degreeLevel][fieldCategory];
  const teachingLanguage = explicitLanguage ?? "Chinese or English (program-dependent)";
  const tuitionText = explicitLanguage === "Chinese" ? `Chinese-taught: CNY ${chineseFee.toLocaleString("en-US")}/year` : `Chinese-taught: CNY ${chineseFee.toLocaleString("en-US")}/year; English-taught: CNY ${englishFee.toLocaleString("en-US")}/year`;
  return { slug: `${schoolSlug}-${degreeLevel.toLowerCase()}-${slug(nameEn)}`, schoolSlug, citySlug, nameEn, degreeLevel, durationYears, fieldCategory, subjectArea: nameEn, teachingLanguage, hskRequirement: "HSK Level 4 or higher for Chinese-taught programs.", englishRequirement: "TOEFL above 70, IELTS above 6.0, Duolingo above 105, or other proof of English proficiency for non-native English speakers applying to English-taught programs.", tuitionText, applicationNote: "Apply through the official online system published in the guide; the reviewed guide prints an HTTP application address.", hasScholarship: true, status: "draft", ...evidence, sourceFieldLineage: { nameEn: "Admission Programs table", degreeLevel: "Admission Programs table", durationYears: "degree-level program structure", teachingLanguage: explicitLanguage ? "program label" : "Language Requirements and fee table", hskRequirement: "Language Requirements", englishRequirement: "Language Requirements", tuitionText: "Fees table" } };
});
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2026-03-01T00:00:00.000Z", deadlineDate: "2026-06-30T15:59:59.000Z", deadlineLabel: "June 30, 2026", applicationRound: "2026 international admissions", status: "closed" as const, ...evidence, sourceFieldLineage: { intakeYear: "guide title", openDate: "Application Time", deadlineDate: "Application Time" } }));
const scholarships = [
  { key: "chinese-government", title: "Chinese Government Scholarship at Wenzhou University", type: "government", provider: "China Scholarship Council", degree: "Freshmen of master and doctoral programs", funding: "Full scholarship", amount: "Tuition, living allowance, accommodation and insurance", coverage: "Tuition, living allowance, accommodation and insurance." },
  { key: "international-chinese-language-teachers", title: "International Chinese Language Teachers Scholarship at Wenzhou University", type: "government", provider: "Center for Language Education and Cooperation", degree: "Non-degree students", funding: "Full scholarship", amount: "Tuition, living allowance, accommodation and insurance", coverage: "Tuition, living allowance, accommodation and insurance." },
  { key: "freshman", title: "Wenzhou University Freshman Scholarship", type: "university", provider: "Wenzhou University", degree: "Freshmen of degree programs", funding: "Type A tuition-equivalent; Type B fixed award", amount: "Type A: equivalent to tuition; Type B: CNY 6,000 undergraduate and CNY 8,000 master/doctoral", coverage: "Type A is equivalent to tuition in the enrollment year. Type B awards CNY 6,000 for undergraduate and CNY 8,000 for master and doctoral applicants." },
  { key: "zhejiang-government", title: "Zhejiang Provincial Government Scholarship at Wenzhou University", type: "government", provider: "Zhejiang Provincial Government", degree: "Degree programs", funding: "According to provincial policy", amount: undefined, coverage: "Awarded according to relevant provincial policies and regulations; exact values are not published in the reviewed guide." },
  { key: "academic", title: "Wenzhou University International Student Academic Scholarship", type: "university", provider: "Wenzhou University", degree: "Continuing degree students", funding: "According to university policy", amount: undefined, coverage: "Awarded according to relevant university policies and regulations; exact values are not published in the reviewed guide." },
].map((item) => ({ slug: `${schoolSlug}-${item.key}-scholarship-2026`, title: item.title, schoolSlug, type: item.type, typeLabel: item.type === "government" ? "Government scholarship" : "University scholarship", providerNameEn: item.provider, providerLocation: item.type === "government" ? "China" : "Wenzhou, Zhejiang, China", fundingLevel: item.funding, ...(item.amount ? { amountText: item.amount } : {}), coverage: item.coverage, applicableDegree: item.degree, deadlineLabel: "See the relevant scholarship notice", applicationRound: "2026", targetCountries: [] as string[], targetRegions: [] as string[], eligibilityItems: [] as Array<{ label: string; value: string }>, applicationSteps: [{ label: "Apply", value: "Use the official route printed in the Wenzhou University admission guide or follow the university notification." }], actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" as const }], summary: item.coverage, status: "draft" as const, ...evidence, sourceFieldLineage: { title: "Scholarship table", fundingLevel: "Scholarship table", ...(item.amount ? { amountText: "Scholarship table" } : {}), coverage: "Scholarship table", applicableDegree: "Scholarship table" } }));
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [{ slug: citySlug, nameEn: "Wenzhou", nameZh: "温州", province: "Zhejiang", region: "East China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "About Wenzhou University", nameZh: "guide title", province: "About Wenzhou University", region: "CUAC geographic taxonomy" } }], schools: [{ slug: schoolSlug, nameEn: "Wenzhou University", nameZh: "温州大学", citySlug, schoolType: "Public", region: "Wenzhou, Zhejiang, East China", applicationLevel: "Undergraduate, Master, Doctorate and Language", languageOfInstruction: "Chinese and English, program-dependent; explicitly Chinese-labelled routes are recorded as Chinese.", languageRequirement: "Chinese-taught HSK 4 or above; English-taught TOEFL above 70, IELTS above 6.0, Duolingo above 105 or other proof.", hskRequirement: "HSK Level 4 or higher for Chinese-taught programs.", deadlineSummary: "March 1-June 30, 2026; the reviewed round is closed.", tuitionSummary: "Degree tuition varies by level, field and teaching language from CNY 16,000 to CNY 30,000/year; language study CNY 9,000/semester or CNY 16,000/year.", applicationFee: "Degree CNY 800; non-degree CNY 400", websiteUrl: "https://www.wzu.edu.cn/en/", admissionsUrl: source.finalUrl, subjectTags: [...new Set(specs.map((item) => item[3]))], languageTags: ["Chinese", "English", "HSK 4"], campusHighlights: ["Wenzhou, Zhejiang", "Comprehensive public university", "International students from 70+ countries and regions"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "guide title", nameZh: "guide title", citySlug: "About Wenzhou University", applicationLevel: "Admission Programs and Fees", languageRequirement: "Eligibility", deadlineSummary: "Application Time", tuitionSummary: "Fees", applicationFee: "Fees", admissionsUrl: "registered official PDF" } }], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const artifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["Program names are transcribed from the admission-program table after visual inspection of the two-page official PDF.", "Only programs visibly listed in the table are included; no unlisted doctoral row is invented.", "Where the table does not label a program's teaching language, the generic Chinese/English route and both applicable fee values are retained rather than selecting one.", "The online application URL printed in the guide is HTTP, so applicationUrl remains absent in the normalized seed."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, summary: validation.summary }, null, 2));
