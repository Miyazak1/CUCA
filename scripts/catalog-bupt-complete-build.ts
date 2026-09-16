import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = {
  manifest: resolve(root, "work/catalog-official/bupt-complete-batch-01/manifest.json"),
  base: resolve(root, "seeds/catalog.beihang-school-program-batch-01.approved.local.json"),
  draft: resolve(root, "seeds/catalog.bupt-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.bupt-complete-batch-01.validation.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [manifestText, baseText] = await Promise.all([readFile(paths.manifest, "utf8"), readFile(paths.base, "utf8")]);
const manifest = JSON.parse(manifestText);
const base = JSON.parse(baseText) as CatalogSeedBundle;
const source = manifest.sources?.find((row: any) => row.id === "bupt-international-admission-brochure-2026");
if (!source || source.status !== 200 || source.sha256 !== "60c223830d1e46ab8625daa3060584544ad699bf3c7925a33ce59cc0d32d56a8" || source.byteLength !== 185780) throw new Error("BUPT official brochure evidence mismatch.");
const city = base.cities?.find((row) => row.slug === "beijing");
if (!city) throw new Error("Current Beijing city dependency missing.");

type Route = { name: string; school: string; degree: "Undergraduate" | "Master" | "Doctoral"; language: "Chinese" | "English"; duration?: number; tuition: number };
const undergraduateChinese: Array<[string, string]> = [
  ["Communication Engineering", "School of Information and Communication Engineering"],
  ["Computer Science and Technology", "School of Computer Science"],
  ["Cyberspace Security", "School of Cyberspace Security"],
  ["Information Engineering", "School of Artificial Intelligence"],
  ["Artificial Intelligence", "School of Artificial Intelligence"],
  ["Mechanical Engineering (Digital Intelligence)", "School of Intelligent Engineering and Automation"],
  ["Robot Engineering", "School of Intelligent Engineering and Automation"],
  ["Automation", "School of Intelligent Engineering and Automation"],
  ["E-Commerce", "School of Economics and Management"],
  ["Mathematics and Applied Mathematics", "School of Mathematical Sciences"],
  ["Information and Computing Science", "School of Mathematical Sciences"],
  ["Applied Physics", "School of Physical Science and Technology"],
  ["Law", "School of Humanities"],
  ["English", "School of Humanities"],
  ["Chinese Language", "School of Humanities"],
  ["Network and New Media", "School of Digital Media and Art"],
];
const masterChinese: Array<[string, string]> = [
  ["Information and Communication Engineering", "School of Information and Communication Engineering"],
  ["Electronic Science and Technology", "School of Electronic Engineering"],
  ["Optical Engineering", "School of Electronic Engineering"],
  ["Computer Science and Technology", "School of Computer Science"],
  ["Software Engineering", "School of Computer Science"],
  ["Cyberspace Security", "School of Cyberspace Security"],
  ["Intelligent Science and Technology", "School of Artificial Intelligence"],
  ["Electronic Information", "School of Artificial Intelligence"],
  ["Mechanical Engineering", "School of Intelligent Engineering and Automation"],
  ["Logistics Engineering", "School of Intelligent Engineering and Automation"],
  ["Control Science and Engineering", "School of Intelligent Engineering and Automation"],
  ["Electronic Information (Control Engineering)", "School of Intelligent Engineering and Automation"],
  ["Integrated Circuit Science and Engineering", "School of Integrated Circuit"],
  ["Mathematics", "School of Mathematical Sciences"],
  ["System Science", "School of Physical Science and Technology"],
  ["Physics", "School of Physical Science and Technology"],
  ["International Chinese Language Education", "School of Humanities"],
  ["Law", "School of Humanities"],
  ["Foreign Language and Literature", "School of Humanities"],
  ["Education", "School of Humanities"],
  ["Educational Technology", "School of Humanities"],
  ["Translation and Interpreting", "School of Humanities"],
  ["Juris", "School of Humanities"],
  ["Design", "School of Digital Media and Art"],
  ["Journalism", "School of Digital Media and Art"],
  ["Journalism and Communication Studies", "School of Digital Media and Art"],
];
const doctoralChinese: Array<[string, string]> = [
  ["Information and Communication Engineering", "School of Information and Communication Engineering"],
  ["Computer Science and Technology", "School of Computer Science"],
  ["Software Engineering", "School of Computer Science"],
  ["Cyberspace Security", "School of Cyberspace Security"],
  ["Electronic Information", "School of Artificial Intelligence"],
  ["Intelligent Science and Technology", "School of Artificial Intelligence"],
  ["Control Science and Engineering", "School of Intelligent Engineering and Automation"],
  ["Mechanical Engineering", "School of Intelligent Engineering and Automation"],
  ["Integrated Circuit Science and Engineering", "School of Integrated Circuit"],
];
const routes: Route[] = [
  ...undergraduateChinese.map(([name, school]) => ({ name, school, degree: "Undergraduate" as const, language: "Chinese" as const, duration: 4, tuition: name === "Chinese Language" ? 20000 : 24600 })),
  { name: "Computer Science and Technology", school: "School of Computer Science", degree: "Undergraduate", language: "English", duration: 4, tuition: 24600 },
  ...masterChinese.map(([name, school]) => ({ name, school, degree: "Master" as const, language: "Chinese" as const, tuition: /Humanities|Digital Media/.test(school) ? 30000 : 32800 })),
  { name: "Computer Technology", school: "School of Computer Science", degree: "Master", language: "English", duration: 2, tuition: 32800 },
  { name: "International Business", school: "School of Economics and Management", degree: "Master", language: "English", duration: 2, tuition: 32800 },
  ...doctoralChinese.map(([name, school]) => ({ name, school, degree: "Doctoral" as const, language: "Chinese" as const, duration: 4, tuition: 41000 })),
  { name: "Information and Communication Engineering", school: "School of Information and Communication Engineering", degree: "Doctoral", language: "English", duration: 4, tuition: 41000 },
  { name: "Computer Science and Technology", school: "School of Computer Science", degree: "Doctoral", language: "English", duration: 4, tuition: 41000 },
  { name: "Electronic Science and Technology", school: "School of Electronic Engineering", degree: "Doctoral", language: "English", duration: 4, tuition: 41000 },
  { name: "Optical Engineering", school: "School of Electronic Engineering", degree: "Doctoral", language: "English", duration: 4, tuition: 41000 },
];
if (routes.length !== 58) throw new Error(`BUPT route count mismatch: ${routes.length}`);
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const schoolSlug = "beijing-university-of-posts-and-telecommunications";
const programs: CatalogSeedProgram[] = routes.map((route) => {
  const undergraduate = route.degree === "Undergraduate";
  const chinese = route.language === "Chinese";
  const hsk = chinese ? (route.name === "Chinese Language" ? "HSK Level 4" : "HSK Level 5") : undefined;
  return {
    slug: `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.name)}-${route.language.toLowerCase()}`,
    schoolSlug,
    citySlug: "beijing",
    nameEn: route.name,
    degreeLevel: route.degree,
    ...(route.duration ? { durationYears: route.duration } : {}),
    fieldCategory: route.school,
    subjectArea: route.school,
    teachingLanguage: route.language,
    ...(undergraduate ? { cscaSubjects: ["Mathematics", "Physics"], cscaRequirement: "All undergraduate applicants must take CSCA before applying; Mathematics and Physics scores are key admission criteria." } : { cscaRequirement: "No CSCA requirement is published for this graduate route." }),
    ...(hsk ? { hskRequirement: hsk } : {}),
    ...(!chinese ? { englishRequirement: "TOEFL 80 or IELTS 6.0" } : {}),
    tuitionAmount: route.tuition,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `CNY ${route.tuition.toLocaleString("en-US")}/academic year`,
    scholarshipText: "No current-cycle award detail is published in the reviewed 2026 admissions brochure; consult BUPT for route-specific scholarship availability.",
    applicationUrl: "https://ois.bupt.edu.cn/",
    applicationNote: `Official 2026 ${route.degree.toLowerCase()} route taught in ${route.language}; ${route.school}. Application period: October 20, 2025 to April 20, 2026.`,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: route.language === "English" ? "official brochure page 6, Programs taught in English table" : route.degree === "Undergraduate" ? "official brochure page 4, Chinese-taught undergraduate table" : "official brochure pages 5-6, Chinese-taught graduate tables",
      degreeLevel: "official brochure program table heading",
      ...(route.duration ? { durationYears: "official brochure pages 3 and 6" } : {}),
      fieldCategory: "official brochure school column",
      teachingLanguage: "official brochure language section heading",
      ...(undergraduate ? { cscaSubjects: "official brochure page 8, additional explanation" } : {}),
      ...(chinese ? { hskRequirement: "official brochure pages 7-9" } : {}),
      ...(!chinese ? { englishRequirement: "official brochure page 7" } : {}),
      tuitionAmount: route.language === "English" ? "official brochure page 6" : "official brochure page 3 fee table",
      applicationUrl: "official brochure page 9",
    },
  };
});
if (new Set(programs.map((row) => row.slug)).size !== 58) throw new Error("BUPT route slugs are not unique.");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [city],
  schools: [{
    slug: schoolSlug,
    nameEn: "Beijing University of Posts and Telecommunications",
    nameZh: "北京邮电大学",
    citySlug: "beijing",
    schoolType: "Public",
    region: "Beijing, North China",
    applicationLevel: "Undergraduate, Master, Doctoral",
    languageOfInstruction: "Chinese, English",
    hskRequirement: "Chinese-taught routes require HSK Level 5; Chinese Language requires HSK Level 4.",
    englishRequirement: "English-taught routes require TOEFL 80 or IELTS 6.0.",
    deadlineSummary: "2026 degree application period: October 20, 2025 to April 20, 2026.",
    tuitionSummary: "Undergraduate CNY 20,000-24,600/year; master's CNY 30,000-32,800/year; doctoral CNY 41,000/year.",
    applicationFee: "CNY 500, non-refundable",
    websiteUrl: "https://www.bupt.edu.cn/",
    admissionsUrl: "https://ois.bupt.edu.cn/",
    cscaRequired: true,
    cscaRequirement: "All undergraduate applicants must take CSCA before applying; Mathematics and Physics scores are key admission criteria.",
    cscaSubjects: ["Mathematics", "Physics"],
    subjectTags: ["Information and Communication Engineering", "Computer Science", "Cyberspace Security", "Artificial Intelligence", "Electronic Engineering", "Management", "Humanities", "Digital Media"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["Xitucheng Campus", "Shahe Campus", "Information technology and engineering strengths"],
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official brochure cover and profile",
      nameZh: "official institution identity",
      citySlug: "official brochure contact address",
      applicationLevel: "official brochure degree program tables",
      languageOfInstruction: "official brochure program language sections",
      hskRequirement: "official brochure pages 7-9",
      englishRequirement: "official brochure page 7",
      deadlineSummary: "official brochure page 10",
      tuitionSummary: "official brochure pages 3 and 6",
      applicationFee: "official brochure page 3",
      cscaSubjects: "official brochure page 8",
    },
  }],
  programs,
  programIntakes: programs.map((program) => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    openDate: "2025-10-20T00:00:00.000Z",
    deadlineDate: "2026-04-20T00:00:00.000Z",
    deadlineLabel: "April 20, 2026",
    applicationRound: "2026 international degree admissions",
    status: "closed",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: { openDate: "official brochure page 10", deadlineDate: "official brochure page 10" },
  })),
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`BUPT candidate invalid:\n${validation.errors.join("\n")}`);
await Promise.all([
  writeFile(paths.draft, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify({ ...validation, sourceManifestSha256: sha(manifestText), evidenceSha256: source.sha256, pageCount: 10, extractedRouteCounts: { undergraduateChinese: 16, undergraduateEnglish: 1, masterChinese: 26, masterEnglish: 2, doctoralChinese: 9, doctoralEnglish: 4 } }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, summary: validation.summary, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, paths }, null, 2));
