import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-46-15-701Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.scnu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.scnu-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((row) => row.id === "scnu-international-undergraduate-admissions-2026");
if (!source || source.status !== 200 || source.sha256 !== "ca1bd48ae1423d04753e3502a3df54e94997a18d86e5f3e0e0c93086c43e9fa0") throw new Error("SCNU official evidence mismatch.");
const schoolSlug = "south-china-normal-university";
const citySlug = "guangzhou";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
type Spec = readonly [name: string, language: string, subjects: string[], english?: string];
const specs: Spec[] = [
  ["Chinese Language", "Chinese", ["Mathematics in Chinese"]],
  ["Education", "Chinese", ["Mathematics in Chinese", "Chinese for Humanities"]],
  ["Human Resource Management", "Chinese", ["Mathematics in Chinese", "Chinese for Humanities"]],
  ["English", "Chinese and English", ["Mathematics in Chinese", "Chinese for Humanities"], "IELTS 5.5 or TOEFL 75; native English speakers are exempt."],
];
const programs: CatalogSeedProgram[] = specs.map(([nameEn, teachingLanguage, cscaSubjects, englishRequirement]) => ({
  slug: `${schoolSlug}-undergraduate-${nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, schoolSlug, citySlug, nameEn, degreeLevel: "Undergraduate", durationYears: 4, fieldCategory: nameEn, subjectArea: nameEn, teachingLanguage,
  hskRequirement: "HSK Level 4, minimum score 180.", ...(englishRequirement ? { englishRequirement } : {}), cscaSubjects, cscaRequirement: `CSCA required: ${cscaSubjects.join(" and ")}.`,
  tuitionAmount: 21000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 21,000/year for humanities and social science.",
  applicationNote: "The published application system is HTTP-only, so applicationUrl remains absent under the HTTPS-only catalog contract.", hasScholarship: true, status: "draft", ...evidence,
  sourceFieldLineage: { nameEn: "I. Undergraduate Programs table", degreeLevel: "I. Undergraduate Programs", durationYears: "III. Program Duration", teachingLanguage: "I. Undergraduate Programs table", hskRequirement: "I. Undergraduate Programs and V. Application Materials", ...(englishRequirement ? { englishRequirement: "I. Undergraduate Programs and V. Application Materials" } : {}), cscaSubjects: "I. Undergraduate Programs table", tuitionText: "VII. Fees" },
}));
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-10T15:59:59.000Z", deadlineLabel: "June 10, 2026", applicationRound: "2026 international undergraduate admissions", status: "closed" as const, ...evidence, sourceFieldLineage: { intakeYear: "brochure title", deadlineDate: "IV. Application Timeline" } }));
const scholarship = { slug: "scnu-guangdong-outstanding-international-student-scholarship-2026", title: "Guangdong Province Outstanding International Student Scholarship at SCNU", schoolSlug, type: "government", typeLabel: "Provincial government scholarship", providerName: "广东省", providerNameEn: "Guangdong Province", providerLocation: "Guangdong, China", fundingLevel: "One-time award", coverage: "One-time grant of CNY 10,000.", applicableDegree: "Undergraduate", amountText: "CNY 10,000 one-time", deadlineLabel: "April to July annually", applicationRound: "2026 international undergraduate admissions", targetCountries: [] as string[], targetRegions: [] as string[], eligibilityItems: [{ label: "Eligibility", value: "Self-funded admitted students under age 30; awarded competitively." }], applicationSteps: [{ label: "Apply", value: "Follow the April-to-July annual scholarship notice and university instructions." }], actionLinks: [{ label: source.label, url: source.finalUrl, kind: "official-source" as const }], summary: "Competitive one-time provincial award for self-funded admitted international undergraduates.", status: "draft" as const, ...evidence, sourceFieldLineage: { title: "VIII. Scholarship Categories item 3", coverage: "VIII. Scholarship Categories item 3", applicableDegree: "brochure scope", amountText: "VIII. Scholarship Categories item 3", deadlineLabel: "VIII. Scholarship Categories item 3" } };
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Guangzhou", nameZh: "广州", province: "Guangdong", region: "South China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "University Overview", nameZh: "official university location", province: "University Overview", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "South China Normal University", nameZh: "华南师范大学", citySlug, schoolType: "Public", region: "Guangzhou, Guangdong, South China", applicationLevel: "Undergraduate", languageOfInstruction: "Chinese; the English major is listed as Chinese and English", languageRequirement: "HSK 4 at 180 or above; the English major additionally accepts IELTS 5.5 or TOEFL 75 with a native-speaker exemption.", hskRequirement: "HSK Level 4, minimum 180.", englishRequirement: "English major: IELTS 5.5 or TOEFL 75; native English speakers are exempt.", deadlineSummary: "June 10, 2026; the reviewed cycle is closed.", tuitionSummary: "Humanities and social science: CNY 21,000/year.", applicationFee: "CNY 420", websiteUrl: "https://english.scnu.edu.cn/", admissionsUrl: source.finalUrl, cscaRequired: true, cscaRequirement: "Program-specific Mathematics in Chinese and, for three programs, Chinese for Humanities.", subjectTags: ["Chinese Language", "Education", "Management", "English"], languageTags: ["Chinese", "English", "HSK 4", "IELTS", "TOEFL"], campusHighlights: ["Double First-Class and Project 211 university", "Four international undergraduate routes", "Four campuses in Guangdong"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "University Overview", nameZh: "official university identity", citySlug: "University Overview", schoolType: "University Overview", applicationLevel: "I. Undergraduate Programs", languageRequirement: "I. Undergraduate Programs and V. Application Materials", deadlineSummary: "IV. Application Timeline", tuitionSummary: "VII. Fees", applicationFee: "VII. Fees", websiteUrl: "official page domain", admissionsUrl: "registered official brochure", cscaRequirement: "I. Undergraduate Programs" } }], programs, programIntakes, scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["All four undergraduate rows, teaching languages, CSCA subjects and tuition are transcribed from the official table.", "The application portal is HTTP-only and remains absent under the HTTPS-only contract.", "Only the scholarship with a stated amount and eligibility is materialized from this guide."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary }, null, 2));
