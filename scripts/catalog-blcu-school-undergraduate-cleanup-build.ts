import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const prefix = "catalog.blcu-school-undergraduate-cleanup";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const manifestText = await readFile("work/catalog-official/blcu-school-programs-attachments-batch-01/manifest.json", "utf8");
const manifest = JSON.parse(manifestText);
const base = JSON.parse(await readFile("seeds/catalog.blcu-undergraduate-safe-batch-01.approved.local.json", "utf8"));
const source = manifest.sources.find((row: any) => row.id === "blcu-undergraduate-programs-pdf-2026");
if (source?.sha256 !== "9afce0ef7a651d54a67be6b62a0f1783cc3e2c6bac080def5a22c9b9d58ab954" || source?.contentType !== "application/pdf") throw new Error("BLCU undergraduate cleanup evidence mismatch.");

const schoolSlug = "beijing-language-and-culture-university";
const school = {
  slug: schoolSlug, nameEn: "Beijing Language and Culture University", nameZh: "北京语言大学", citySlug: "beijing", region: "Beijing",
  applicationLevel: "Bachelor, Associate", languageOfInstruction: "Chinese and English",
  deadlineSummary: "2026 spring intake deadline: February 15, 2026; 2026 fall intake deadline: June 30, 2026",
  tuitionSummary: "Published 2026 routes range from CNY 22,000 to CNY 82,500 per academic year; overseas partner-stage tuition varies by institution and year.",
  applicationFee: "CNY 800, non-refundable", websiteUrl: "https://www.blcu.edu.cn", admissionsUrl: "https://admission.blcu.edu.cn", campusHighlights: ["Beijing", "Hainan", "Tokyo and overseas partner stages for named joint programs"],
  status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { nameEn: "official university identity shown on PDF pages 1-2", nameZh: "official university name and logo on PDF page 1", citySlug: "PDF cultivation-campus columns", applicationLevel: "PDF title and degree-section headings", languageOfInstruction: "PDF page 2 English-taught section and other published route tables", deadlineSummary: "PDF page 2 registration information", tuitionSummary: "PDF pages 1-2 tuition columns", applicationFee: "PDF page 2 registration information", websiteUrl: "PDF page 2 registration information", admissionsUrl: "PDF page 2 registration information", campusHighlights: "PDF pages 1-2 cultivation arrangements" },
};

type Intake = "Spring" | "Fall";
type Spec = { slug: string; en: string; zh: string; group: string; school: string; tuitionText: string; tuitionAmount?: number; teachingLanguage?: string; durationYears?: number; intakes: Intake[]; page: 1 | 2; note: string };
const commonIndependent = { group: "Independent Degree", school: "BLCU", tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", durationYears: 4, intakes: ["Spring", "Fall"] as Intake[], page: 1 as const };
const specs: Spec[] = [
  { slug: `${schoolSlug}-accounting-digital-accounting`, en: "Accounting - Digital Accounting", zh: "会计学（数智会计）", group: "English-taught", school: "Business School", teachingLanguage: "English", tuitionText: "CNY 39,000 per academic year", tuitionAmount: 39000, intakes: ["Fall"], page: 2, note: "Official English-taught undergraduate route." },
  { slug: `${schoolSlug}-chinese-characters-and-chinese-studies`, en: "Chinese Studies", zh: "汉学与中国学", group: "English-taught", school: "School of Chinese Studies and China Studies", teachingLanguage: "English", tuitionText: "CNY 39,000 per academic year", tuitionAmount: 39000, intakes: ["Spring", "Fall"], page: 2, note: "Corrects the legacy mistranslation 'Chinese Characters and Chinese Studies'." },
  { slug: `${schoolSlug}-chinese-language-china-japan-bilingual-track-beijing-nara-2-2-program`, en: "Chinese Language - Chinese-Japanese Bilingual", zh: "汉语言（中日复语）", ...commonIndependent, tuitionText: "Years 1-2 in Beijing: CNY 25,800 per year; years 3-4 at BLCU Tokyo: JPY 1,000,000 per year", school: "BLCU Beijing / BLCU Tokyo", note: "Corrects the legacy Beijing-Nara label to the official BLCU Tokyo cultivation arrangement." },
  { slug: `${schoolSlug}-chinese-language-chinese-english-bilingual-track`, en: "Chinese Language - Chinese-English Bilingual", zh: "汉语言（汉英双语）", ...commonIndependent, note: "Official independent undergraduate route." },
  { slug: `${schoolSlug}-chinese-language-chinese-track`, en: "Chinese Language - Language and Culture", zh: "汉语言（语言文化）", ...commonIndependent, note: "Corrects the generic legacy Chinese-track label." },
  { slug: `${schoolSlug}-chinese-language-economics-and-trade-track`, en: "Chinese Language - Economics and Trade Chinese", zh: "汉语言（经贸汉语）", ...commonIndependent, note: "Corrects the abbreviated legacy economics-and-trade label." },
  { slug: `${schoolSlug}-finance-digital-finance`, en: "Finance - Digital Finance", zh: "金融学（数智金融）", group: "English-taught", school: "Business School", teachingLanguage: "English", tuitionText: "CNY 39,000 per academic year", tuitionAmount: 39000, intakes: ["Fall"], page: 2, note: "Official English-taught undergraduate route." },
  { slug: `${schoolSlug}-international-chinese-language-education`, en: "International Chinese Language Education", zh: "汉语国际教育", ...commonIndependent, note: "Uses the official 2026 Chinese title." },
  { slug: `${schoolSlug}-international-economics-and-trade`, en: "International Economics and Trade", zh: "国际经济与贸易", ...commonIndependent, note: "Canonical independent undergraduate route; duplicate legacy row is archived separately." },
  { slug: `${schoolSlug}-translation-english-chinese-translation`, en: "Translation - English-Chinese", zh: "翻译（英汉翻译）", ...commonIndependent, note: "Official independent undergraduate translation route." },
  { slug: `${schoolSlug}-translation-korean-chinese-translation`, en: "Translation - Korean-Chinese", zh: "翻译（韩汉翻译）", ...commonIndependent, note: "Official independent undergraduate translation route." },
  { slug: `${schoolSlug}-chinese-language-blcu-ustb-dual-degree-2026`, en: "Chinese Language (BLCU-University of Science and Technology Beijing Dual Degree)", zh: "汉语言（北京语言大学-北京科技大学双学位）", group: "Dual Degree", school: "BLCU / University of Science and Technology Beijing", tuitionText: "Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at USTB: CNY 23,300 per year", durationYears: 4, intakes: ["Fall"], page: 1, note: "New official dual-degree direction split from the incorrect merged legacy record." },
  { slug: `${schoolSlug}-artificial-intelligence-blcu-ustb-dual-degree-2026`, en: "Artificial Intelligence (BLCU-University of Science and Technology Beijing Dual Degree)", zh: "人工智能（北京语言大学-北京科技大学双学位）", group: "Dual Degree", school: "BLCU / University of Science and Technology Beijing", tuitionText: "Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at USTB: CNY 23,300 per year", durationYears: 4, intakes: ["Fall"], page: 1, note: "New official dual-degree direction split from the incorrect merged legacy record." },
];
if (specs.length !== 13 || new Set(specs.map((row) => row.slug)).size !== 13) throw new Error("BLCU cleanup program specification mismatch.");
const programs = specs.map((row) => ({
  slug: row.slug, schoolSlug, citySlug: "beijing", nameEn: row.en, nameZh: row.zh, degreeLevel: "Bachelor", ...(row.durationYears ? { durationYears: row.durationYears } : {}), fieldCategory: row.group, subjectArea: row.school, ...(row.teachingLanguage ? { teachingLanguage: row.teachingLanguage } : {}), ...(row.tuitionAmount ? { tuitionAmount: row.tuitionAmount, tuitionCurrency: "RMB", tuitionPeriod: "year" } : {}), tuitionText: row.tuitionText, applicationUrl: "https://apply.blcu.edu.cn", applicationNote: row.note, status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { nameZh: `PDF page ${row.page}, ${row.group} table`, nameEn: `editorial English translation of the official Chinese title on PDF page ${row.page}`, degreeLevel: "PDF title and section heading", ...(row.durationYears ? { durationYears: `PDF page ${row.page} cultivation arrangement` } : {}), ...(row.teachingLanguage ? { teachingLanguage: "PDF page 2 English-taught section heading" } : {}), tuitionText: `PDF page ${row.page} tuition column`, applicationUrl: "PDF page 2 registration information" },
}));
const deadline: Record<Intake, [string, string]> = { Spring: ["2026-02-15T00:00:00.000Z", "February 15, 2026"], Fall: ["2026-06-30T00:00:00.000Z", "June 30, 2026"] };
const programIntakes = specs.flatMap((row) => row.intakes.map((term) => ({ programSlug: row.slug, intakeTerm: term, intakeYear: 2026, deadlineDate: deadline[term][0], deadlineLabel: deadline[term][1], applicationRound: "BLCU 2026 international degree admissions", status: "closed" as const, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: "PDF page 2 registration information" } })));
if (programIntakes.length !== 22) throw new Error("BLCU cleanup intake count mismatch.");
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [base.cities.find((row: any) => row.slug === "beijing")], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`, validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await Promise.all([writeFile(`seeds/${prefix}.draft.json`, candidateText), writeFile(`seeds/${prefix}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256: sha(candidateText), manifestSha256: sha(manifestText) }, null, 2)}\n`)]);
console.log(JSON.stringify({ ok: true, programs: programs.length, programIntakes: programIntakes.length, summary: validation.summary }, null, 2));
