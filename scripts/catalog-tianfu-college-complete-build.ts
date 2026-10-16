import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-10-16T06-28-04-501Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.tianfu-college-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tianfu-college-complete-batch-01.validation.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: Array<{ id: string; status: number; finalUrl: string; label: string; sha256: string; fetchedAt: string }> };
const source = manifest.sources.find((row) => row.id === "tianfu-college-international-student-admissions-2026");
if (!source || source.status !== 200 || source.sha256 !== "f2cb2b71d707dd4ebc92476f931df1b2adc8f235cd0340c3d4976f15b7609af0") throw new Error("Tianfu College official evidence mismatch.");

const schoolSlug = "southwestern-university-of-finance-and-economics-tianfu-college";
const citySlug = "chengdu";
const evidence = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const specs = [
  ["国际经济与贸易", "International Economics and Trade", "Economics"],
  ["计算机科学与技术", "Computer Science and Technology", "Information Technology"],
] as const;
const programs: CatalogSeedProgram[] = specs.map(([nameZh, nameEn, fieldCategory]) => ({
  slug: `${schoolSlug}-undergraduate-${nameEn.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  schoolSlug, citySlug, nameEn, nameZh, degreeLevel: "Undergraduate", durationYears: 4, fieldCategory, subjectArea: nameEn, teachingLanguage: "English",
  tuitionAmount: 29500, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 29,500/year standard tuition; the brochure also displays CNY 13,000/year after scholarship.",
  scholarshipText: "The official program table displays tuition after scholarship of CNY 13,000/year, but does not state a scholarship name, eligibility rule, or separate application process.",
  applicationNote: "Application materials are submitted to the International Education College admissions email. The official page does not publish an HTTPS application portal or a numeric English-test threshold.",
  hasScholarship: true, status: "draft", ...evidence,
  sourceFieldLineage: { nameZh: "III. Admissions Information table", nameEn: "III. Admissions Information bilingual table", degreeLevel: "III. Admissions Information table", durationYears: "III. Admissions Information table", teachingLanguage: "III. Admissions Information table", tuitionText: "III. Admissions Information table" },
}));
const programIntakes = programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-09-30T15:59:59.000Z", deadlineLabel: "September 30, 2026", applicationRound: "2026 international student admissions", status: "closed" as const, ...evidence, sourceFieldLineage: { intakeYear: "brochure title", deadlineDate: "X. Application Time" } }));
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Chengdu", nameZh: "成都", province: "Sichuan", region: "Southwest China", status: "draft", verificationStatus: "unverified", ...evidence, sourceFieldLineage: { nameEn: "I. School Overview", nameZh: "I. School Overview", province: "XIII. Contact Information", region: "CUAC geographic taxonomy" } }],
  schools: [{ slug: schoolSlug, nameEn: "Southwestern University of Finance and Economics Tianfu College", nameZh: "西南财经大学天府学院", citySlug, schoolType: "Private independent college", region: "Chengdu, Sichuan, Southwest China", applicationLevel: "Undergraduate", languageOfInstruction: "English for the two listed 2026 international undergraduate programs", languageRequirement: "English proficiency certification is required; the reviewed brochure does not publish a numeric IELTS or TOEFL threshold.", deadlineSummary: "September 30, 2026; the reviewed cycle is closed and no later deadline is inferred.", tuitionSummary: "CNY 29,500/year standard tuition; the program table displays CNY 13,000/year after scholarship.", applicationFee: "CNY 600 registration fee", websiteUrl: "https://www.tfswufe.edu.cn/", admissionsUrl: source.finalUrl, subjectTags: ["Economics", "Information Technology"], languageTags: ["English"], campusHighlights: ["Chengdu East Campus", "Two English-taught undergraduate routes", "International students study at one designated campus"], status: "draft", ...evidence, sourceFieldLineage: { nameEn: "brochure bilingual title", nameZh: "brochure title", citySlug: "I. School Overview", schoolType: "I. School Overview", applicationLevel: "III. Admissions Information", languageRequirement: "IX. Eligibility Requirements", deadlineSummary: "X. Application Time", tuitionSummary: "III. Admissions Information", applicationFee: "III. Admissions Information notes", websiteUrl: "XIII. Contact Information", admissionsUrl: "registered official page" } }],
  programs, programIntakes, scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = { ...validation, candidateSha256: sha256(candidateText), manifestSha256: sha256(manifestText), sourceReview: { status: "unreviewed_draft", notes: ["Both program rows are transcribed from the official 2026 bilingual admissions table.", "The brochure only requires English proficiency evidence and does not publish a numeric threshold, so no score is inferred.", "The tuition-after-scholarship figure is retained as program text; no detailed scholarship record is invented without a published name and eligibility process.", "The official application workflow is email-based, so applicationUrl remains absent."] }, publicationAuthorized: false, databaseWriteAuthorized: false };
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
