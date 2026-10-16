import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const pageManifestPath = resolve(root, "work/catalog-official/2026-10-16T06-28-16-648Z/manifest.json");
const catalogManifestPath = resolve(root, "work/catalog-official/2026-10-16T06-40-18-545Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.caa-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.caa-complete-batch-01.validation.json");
const [pageManifestText, catalogManifestText] = await Promise.all([readFile(pageManifestPath, "utf8"), readFile(catalogManifestPath, "utf8")]);
type Manifest = { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const pageManifest = JSON.parse(pageManifestText) as Manifest;
const catalogManifest = JSON.parse(catalogManifestText) as Manifest;
const pageSource = pageManifest.sources.find((row) => row.id === "caa-chinese-taught-undergraduate-admissions-2026");
const catalogSource = catalogManifest.sources.find((row) => row.id === "caa-chinese-taught-undergraduate-programs-pdf-2026");
if (!pageSource || pageSource.status !== 200 || pageSource.sha256 !== "7a7c2f5fe4ccfe64a8d5fa2dd5371f33986f76f96b9213111c213f55b9707a3f") throw new Error("CAA admissions evidence mismatch.");
if (!catalogSource || catalogSource.status !== 200) throw new Error("CAA program catalog evidence mismatch.");

const schoolSlug = "china-academy-of-art";
const citySlug = "hangzhou";
const applicationUrl = "https://caa.at0086.cn/StuApplication/Login.aspx";
const pageEvidence = { sourceUrl: pageSource.finalUrl, sourceLabel: pageSource.label, sourceSha256: pageSource.sha256, capturedAt: pageSource.fetchedAt };
const catalogEvidence = { sourceUrl: catalogSource.finalUrl, sourceLabel: catalogSource.label, sourceSha256: catalogSource.sha256, capturedAt: catalogSource.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Spec = readonly [nameZh: string, nameEn: string, years: number, category: string];
const specs: Spec[] = [
  ["中国画（人物）", "Chinese Painting (Figure)", 4, "Fine Arts"], ["中国画（山水）", "Chinese Painting (Landscape)", 4, "Fine Arts"], ["中国画（花鸟）", "Chinese Painting (Birds and Flowers)", 4, "Fine Arts"],
  ["书法与篆刻", "Calligraphy and Seal Carving", 4, "Calligraphy"], ["书法教育与传播", "Calligraphy Education and Dissemination", 4, "Calligraphy"], ["书法理论", "Calligraphy Theory", 4, "Calligraphy"],
  ["雕塑", "Sculpture", 5, "Fine Arts"], ["美术学", "Fine Arts", 4, "Fine Arts"], ["绘画", "Painting", 4, "Fine Arts"], ["摄影", "Photography", 4, "Media Arts"], ["文物保护与修复", "Conservation and Restoration of Cultural Relics", 4, "Fine Arts"], ["纤维艺术", "Fiber Art", 4, "Fine Arts"], ["跨媒体艺术", "Intermedia Art", 4, "Media Arts"],
  ["数字媒体艺术", "Digital Media Art", 4, "Design"], ["艺术与科技", "Art and Science and Technology", 4, "Design"], ["视觉传达设计", "Visual Communication Design", 4, "Design"], ["产品设计", "Product Design", 4, "Design"], ["服装与服饰设计", "Apparel and Fashion Design", 4, "Design"], ["公共艺术", "Public Art", 4, "Design"], ["环境设计", "Environmental Design", 4, "Design"], ["工艺美术", "Industrial Art", 4, "Design"], ["陶瓷艺术设计", "Ceramic Art Design", 4, "Design"], ["艺术设计学", "Art Design", 4, "Design"], ["工业设计", "Industrial Design", 4, "Design"],
  ["动画", "Animation", 4, "Drama and Film"], ["戏剧影视美术设计", "Art Design in Theater and Film", 4, "Drama and Film"], ["影视摄影与制作", "Film and TV Photography and Production", 4, "Drama and Film"], ["广播电视编导", "Broadcasting and TV Direction", 4, "Drama and Film"], ["戏剧影视导演", "Theater and Film Direction", 4, "Drama and Film"],
  ["建筑学", "Architecture", 5, "Architecture"], ["风景园林", "Landscape Architecture", 4, "Architecture"], ["艺术史论", "Art Historical Theory", 4, "Art Theory"], ["艺术管理", "Art Management", 4, "Art Management"],
];
const programs: CatalogSeedProgram[] = specs.map(([nameZh, nameEn, durationYears, fieldCategory]) => ({
  slug: `${schoolSlug}-undergraduate-${slugify(nameEn)}`, schoolSlug, citySlug, nameEn, nameZh, degreeLevel: "Undergraduate", durationYears, fieldCategory, subjectArea: nameEn, teachingLanguage: "Chinese",
  hskRequirement: "Valid HSK Level 4 with at least 180 overall and at least 70 in listening; certificate issued after August 31, 2024, subject to the stated exemptions.",
  cscaSubjects: ["Professional Chinese (Liberal Arts)", "Mathematics"], cscaRequirement: "CSCA score report required in Chinese for Professional Chinese (Liberal Arts) and Mathematics.",
  tuitionAmount: 52000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 52,000/year, including CNY 1,000 comprehensive insurance.", applicationUrl,
  applicationNote: "A program-specific portfolio or written-work requirement applies as published in Attachment 1. Applications are submitted exclusively through the International Student Service System.",
  hasScholarship: true, status: "draft", ...catalogEvidence,
  sourceFieldLineage: { nameZh: "Attachment 1 program row", nameEn: "Attachment 1 bilingual program row", degreeLevel: "Attachment 1 title", durationYears: "Attachment 1 term column", teachingLanguage: "admissions guide title", hskRequirement: "III. Eligibility and VII. Application Materials", cscaSubjects: "III. Eligibility", tuitionText: "IV. Fees", applicationUrl: "VI. Application Procedure" },
}));
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-04-30T15:59:59.000Z", deadlineLabel: "April 30, 2026 (postponed deadline)", applicationRound: "2026 Chinese-taught undergraduate admissions", status: "closed" as const, ...pageEvidence, sourceFieldLineage: { intakeYear: "guide title", deadlineDate: "II. Application Deadline" } }));
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: catalogManifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Hangzhou", nameZh: "杭州", province: "Zhejiang", region: "East China", status: "draft", verificationStatus: "unverified", ...pageEvidence, sourceFieldLineage: { nameEn: "guide introduction", nameZh: "official university location", province: "guide introduction", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "China Academy of Art", nameZh: "中国美术学院", citySlug, schoolType: "Public", region: "Hangzhou, Zhejiang, East China", applicationLevel: "Undergraduate", languageOfInstruction: "Chinese", languageRequirement: "Valid HSK Level 4 with at least 180 overall and at least 70 in listening, with published exemptions for qualifying Chinese-medium education.", hskRequirement: "HSK Level 4, minimum 180 overall and minimum 70 listening, subject to published exemptions.", deadlineSummary: "April 30, 2026 postponed deadline; the reviewed cycle is closed.", tuitionSummary: "CNY 52,000/year including comprehensive insurance of CNY 1,000.", applicationFee: "CNY 800", websiteUrl: "https://admission.caa.edu.cn/", admissionsUrl: pageSource.finalUrl, cscaRequired: true, cscaRequirement: "Chinese-language CSCA papers in Professional Chinese (Liberal Arts) and Mathematics are required.", subjectTags: ["Fine Arts", "Calligraphy", "Design", "Media Arts", "Drama and Film", "Architecture", "Art Theory", "Art Management"], languageTags: ["Chinese", "HSK 4"], campusHighlights: ["Hangzhou-based national art academy", "33 listed Chinese-taught undergraduate directions", "Four campuses"], status: "draft", ...pageEvidence, sourceFieldLineage: { nameEn: "guide title", nameZh: "official university identity", citySlug: "guide introduction", schoolType: "official university identity", applicationLevel: "guide title", languageRequirement: "III. Eligibility and VII. Application Materials", deadlineSummary: "II. Application Deadline", tuitionSummary: "IV. Fees", applicationFee: "IV. Fees", websiteUrl: "X. Contacts", admissionsUrl: "registered official guide", cscaRequirement: "III. Eligibility" } }],
  programs, programIntakes, scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), admissionsManifestSha256: sha256(pageManifestText), catalogManifestSha256: sha256(catalogManifestText), sourceReview: { status: "unreviewed_draft", notes: ["All 33 undergraduate directions and durations are transcribed from the official bilingual attachment.", "Tuition, language, HSK, CSCA subjects, application portal and deadline are explicit in the official guide.", "The guide names scholarship routes but delegates details to separate pages, so no unsupported scholarship amount is created here.", "Personal contact details and portfolio files are excluded."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
