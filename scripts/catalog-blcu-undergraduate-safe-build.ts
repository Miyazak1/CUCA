import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const prefix = "catalog.blcu-undergraduate-safe-batch-01";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const manifestText = await readFile("work/catalog-official/blcu-school-programs-attachments-batch-01/manifest.json", "utf8");
const manifest = JSON.parse(manifestText);
const base = JSON.parse(await readFile("seeds/catalog.blcu-graduate-safe-batch-03.approved.local.json", "utf8"));
const source = manifest.sources.find((row: any) => row.id === "blcu-undergraduate-programs-pdf-2026");
if (source?.sha256 !== "9afce0ef7a651d54a67be6b62a0f1783cc3e2c6bac080def5a22c9b9d58ab954" || source?.contentType !== "application/pdf") {
  throw new Error("BLCU undergraduate evidence mismatch.");
}

type Intake = "Spring" | "Fall";
type Row = {
  en: string;
  zh: string;
  group: string;
  school: string;
  degree?: "Bachelor" | "Associate";
  durationYears?: number;
  teachingLanguage?: string;
  tuitionAmount?: number;
  tuitionText: string;
  campus: string;
  intakes: Intake[];
  page: 1 | 2;
};

const manchester = [
  ["Chinese Language", "汉语言"],
  ["Translation", "翻译"],
  ["English Literature", "英语文学"],
  ["Linguistics", "语言学"],
  ["Linguistics and Sociology", "语言学与社会学"],
  ["Art History", "艺术史"],
  ["Film Studies", "电影研究"],
  ["English Literature and Film Studies", "英语文学与电影研究"],
  ["Film Studies and Linguistics", "电影研究与语言学"],
  ["East Asian Studies", "东亚研究"],
].map(([en, zh]) => ({
  en: `${en} (BLCU-University of Manchester Dual Degree)`, zh: `${zh}（北京语言大学-曼彻斯特大学双学位）`,
  group: "Dual Degree", school: "BLCU / University of Manchester", degree: "Bachelor" as const, durationYears: 4,
  tuitionText: "Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at the University of Manchester: GBP 25,200 in year 3 and GBP 31,500 in year 4 (Manchester states 2026 tuition remains subject to final confirmation).",
  campus: "Beijing / Manchester", intakes: ["Fall" as const], page: 1 as const,
}));

const rows: Row[] = [
  ...manchester,
  { en: "Hearing and Speech Rehabilitation (BLCU-Northeastern Illinois University Dual Degree)", zh: "听力与言语康复学（北京语言大学-美国东北州立大学双学位）", group: "Dual Degree", school: "Hainan International College / Northeastern Illinois University", degree: "Bachelor", durationYears: 4, teachingLanguage: "English", tuitionAmount: 82500, tuitionText: "CNY 82,500 per academic year", campus: "Hainan", intakes: ["Fall"], page: 1 },
  { en: "Chinese Language (BLCU-National Academy of Chinese Theatre Arts Dual Degree)", zh: "汉语言（北京语言大学-中国戏曲学院双学位）", group: "Dual Degree", school: "BLCU / National Academy of Chinese Theatre Arts", degree: "Bachelor", durationYears: 4, tuitionText: "Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at the National Academy of Chinese Theatre Arts: CNY 35,000 per year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "Arts Management (BLCU-National Academy of Chinese Theatre Arts Dual Degree)", zh: "艺术管理（北京语言大学-中国戏曲学院双学位）", group: "Dual Degree", school: "BLCU / National Academy of Chinese Theatre Arts", degree: "Bachelor", durationYears: 4, tuitionText: "Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at the National Academy of Chinese Theatre Arts: CNY 35,000 per year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "Cultural Industry Management (BLCU-National Academy of Chinese Theatre Arts Dual Degree)", zh: "文化产业管理（北京语言大学-中国戏曲学院双学位）", group: "Dual Degree", school: "BLCU / National Academy of Chinese Theatre Arts", degree: "Bachelor", durationYears: 4, tuitionText: "Years 1-2 at BLCU: CNY 25,800 per year; years 3-4 at the National Academy of Chinese Theatre Arts: CNY 35,000 per year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "Applied Chinese - Technology", zh: "应用中文（科技）", group: "Independent Degree", school: "BLCU", degree: "Bachelor", durationYears: 4, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 1 },
  { en: "Applied Chinese - Business", zh: "应用中文（商务）", group: "Independent Degree", school: "BLCU", degree: "Bachelor", durationYears: 4, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 1 },
  { en: "Applied Chinese - Tourism", zh: "应用中文（文旅）", group: "Independent Degree", school: "BLCU", degree: "Bachelor", durationYears: 4, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 1 },
  { en: "Translation - AI-assisted Translation", zh: "翻译（AI智能翻译）", group: "Independent Degree", school: "BLCU", degree: "Bachelor", durationYears: 4, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 1 },
  { en: "International Politics", zh: "国际政治", group: "Chinese-International Same-cohort", school: "School of International Politics and Communication", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "International Affairs and International Relations", zh: "国际事务与国际关系", group: "Chinese-International Same-cohort", school: "School of International Politics and Communication", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "Network and New Media", zh: "网络与新媒体", group: "Chinese-International Same-cohort", school: "School of International Politics and Communication", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "Journalism", zh: "新闻学", group: "Chinese-International Same-cohort", school: "School of International Politics and Communication", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 1 },
  { en: "Computer Science and Technology", zh: "计算机科学与技术", group: "Undergraduate", school: "School of Information Science", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "Artificial Intelligence", zh: "人工智能", group: "Undergraduate", school: "School of Information Science", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "Data Science and Big Data Technology", zh: "数据科学与大数据技术", group: "Undergraduate", school: "School of Information Science", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "Digital Media Technology", zh: "数字媒体技术", group: "Undergraduate", school: "School of Information Science", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "Psychology", zh: "心理学", group: "Undergraduate", school: "School of Psychology and Cognitive Sciences", degree: "Bachelor", tuitionAmount: 25800, tuitionText: "CNY 25,800 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "English", zh: "英语", group: "Undergraduate", school: "School of English and Advanced Translation", degree: "Bachelor", tuitionAmount: 27600, tuitionText: "CNY 27,600 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "English - English-Spanish Bilingual", zh: "英语（英西复语）", group: "Undergraduate", school: "School of English and Advanced Translation", degree: "Bachelor", tuitionAmount: 27600, tuitionText: "CNY 27,600 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "Business English", zh: "商务英语", group: "Undergraduate", school: "School of English and Advanced Translation", degree: "Bachelor", tuitionAmount: 27600, tuitionText: "CNY 27,600 per academic year", campus: "Beijing", intakes: ["Fall"], page: 2 },
  { en: "Chinese Language - Language and Culture (Associate)", zh: "汉语言（语言文化）（专科）", group: "Associate", school: "BLCU", degree: "Associate", durationYears: 2, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 2 },
  { en: "Chinese Language - Chinese-English Bilingual (Associate)", zh: "汉语言（汉英双语）（专科）", group: "Associate", school: "BLCU", degree: "Associate", durationYears: 2, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 2 },
  { en: "Chinese Language - Economics and Trade Chinese (Associate)", zh: "汉语言（经贸汉语）（专科）", group: "Associate", school: "BLCU", degree: "Associate", durationYears: 2, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 2 },
  { en: "Applied Chinese - Technology (Associate)", zh: "应用中文（科技）（专科）", group: "Associate", school: "BLCU", degree: "Associate", durationYears: 2, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 2 },
  { en: "Applied Chinese - Business (Associate)", zh: "应用中文（商务）（专科）", group: "Associate", school: "BLCU", degree: "Associate", durationYears: 2, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 2 },
  { en: "Applied Chinese - Tourism (Associate)", zh: "应用中文（文旅）（专科）", group: "Associate", school: "BLCU", degree: "Associate", durationYears: 2, tuitionText: "Beijing: CNY 25,800 per year; Hainan: CNY 22,000 per year", campus: "Beijing or Hainan", intakes: ["Spring", "Fall"], page: 2 },
];
if (rows.length !== 36 || new Set(rows.map((row) => row.en)).size !== rows.length) throw new Error("BLCU safe undergraduate route list mismatch.");

const schoolSlug = "beijing-language-and-culture-university";
const programs = rows.map((row) => ({
  slug: `${schoolSlug}-${slugify(row.en)}-2026`, schoolSlug, citySlug: "beijing", nameEn: row.en, nameZh: row.zh,
  degreeLevel: row.degree ?? "Bachelor", ...(row.durationYears ? { durationYears: row.durationYears } : {}),
  fieldCategory: row.group, subjectArea: row.school, ...(row.teachingLanguage ? { teachingLanguage: row.teachingLanguage } : {}),
  ...(row.tuitionAmount ? { tuitionAmount: row.tuitionAmount, tuitionCurrency: "RMB", tuitionPeriod: "year" } : {}), tuitionText: row.tuitionText,
  applicationUrl: "https://apply.blcu.edu.cn", applicationNote: `2026 ${row.group} route; campus: ${row.campus}.`, status: "draft",
  sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameZh: `2026 undergraduate catalog PDF page ${row.page}, ${row.group} table`,
    nameEn: `editorial English translation of the official Chinese route title on PDF page ${row.page}`,
    degreeLevel: `PDF title and page ${row.page} section heading`,
    tuitionText: `PDF page ${row.page}, tuition column`,
    applicationUrl: "PDF page 2, registration information",
  },
}));

const deadlines: Record<Intake, { date: string; label: string }> = {
  Spring: { date: "2026-02-15T00:00:00.000Z", label: "February 15, 2026" },
  Fall: { date: "2026-06-30T00:00:00.000Z", label: "June 30, 2026" },
};
const programIntakes = rows.flatMap((row, index) => row.intakes.map((intakeTerm) => ({
  programSlug: programs[index].slug, intakeTerm, intakeYear: 2026, deadlineDate: deadlines[intakeTerm].date,
  deadlineLabel: deadlines[intakeTerm].label, applicationRound: "BLCU 2026 international degree admissions", status: "closed",
  sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { deadlineDate: "2026 undergraduate catalog PDF page 2, registration information" },
})));
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [base.cities.find((row: any) => row.slug === "beijing")],
  schools: [base.schools.find((row: any) => row.slug === schoolSlug)],
  programs, programIntakes, scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await Promise.all([
  writeFile(`seeds/${prefix}.draft.json`, candidateText),
  writeFile(`seeds/${prefix}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256: sha(candidateText), manifestSha256: sha(manifestText) }, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, programs: programs.length, programIntakes: programIntakes.length, summary: validation.summary }, null, 2));
