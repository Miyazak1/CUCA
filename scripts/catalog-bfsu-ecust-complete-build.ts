import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedProgramIntake, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const parsedRoot = resolve(workRoot, "bfsu-ecust-complete-2026");
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string };
type ParsedProgram = {
  degreeLevel: "Undergraduate" | "Master" | "Doctoral";
  nameEn: string;
  nameZh?: string;
  programCode?: string;
  discipline?: string;
  fieldCategory?: string;
  researchDirection?: string;
  teachingLanguage: string;
  cscaText?: string;
  cscaSubjects?: string[];
  intakeText?: string;
  tuitionAmount?: number;
  durationYears?: number;
  school?: string;
  route?: string;
  acceptanceLetterText?: string;
  sourcePage?: number;
  sourceTable?: number;
  sourceRow?: number;
};
type Parsed = { schoolSlug: string; programs: ParsedProgram[]; summary: { programCount: number; degreeCounts: Record<string, number> } };

const expected = new Map<string, string>([
  ["bfsu-international-undergraduate-admissions-en-2026", "2077792799a8271076340e715dc50be8835cb60a0b03e714492aa25733ad0329"],
  ["bfsu-international-graduate-admissions-zh-2026", "366a44e4a90d5ae1364300d2cd8e2d3a83438c2e912e20019163a714717aa44e"],
  ["bfsu-international-graduate-admissions-pdf-zh-2026", "2045bbd4480e1a2cf5bb3ad72bca573acbee4d52cf0b9bb65ed2003629f2ca89"],
  ["bfsu-international-undergraduate-program-catalog-en-2026", "8468397309cbc8615abde48cfd4dde37949be55bf46d3bac48c5452fa533861b"],
  ["bfsu-international-master-program-catalog-en-2026", "2615a263880c8dccf89522a8fea6401a52cbe02e5df4abbdec5fca78ff62591e"],
  ["bfsu-international-doctoral-program-catalog-en-2026", "e2ee28d2840d89b1ce2d670f9228b2ee7ec203532acd590d8f4e10d426e1aa44"],
  ["ecust-international-undergraduate-admissions-en-2026", "3257d2cc6575acfa62ef1c7d5839e32c715ab345376c07a7af84b15dde61bf87"],
  ["ecust-international-graduate-admissions-en-2026", "9cba7dc3947a9fdad21895a307e2977c9125ab343106a5bafaba60e6fe63180d"],
  ["ecust-international-undergraduate-program-catalog-2026", "bad3b7d0b2778675a4f326338ba67ded3defaa97fdaf29b6e28453ea853588e8"],
  ["ecust-international-master-program-catalog-en-2026", "1eb8a37d52848f15f1f361cb446a9a2e6794a0a52a060ad197e870bbacd43a34"],
  ["ecust-international-doctoral-program-catalog-en-2026", "bbcd47325775797560b9993a6abea4ae51175bcf1573201442a0ee25e86c97ba"],
]);

const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const row of manifest.sources ?? []) if (row.status === 200 && expected.get(row.id) === row.sha256) evidence.set(row.id, row);
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = [...expected.keys()].filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked official evidence: ${missing.join(", ")}`);

const [bfsu, ecust] = await Promise.all([
  readFile(resolve(parsedRoot, "bfsu-programs.json"), "utf8").then((text) => JSON.parse(text) as Parsed),
  readFile(resolve(parsedRoot, "ecust-programs.json"), "utf8").then((text) => JSON.parse(text) as Parsed),
]);
if (bfsu.summary.programCount !== 151 || ecust.summary.programCount !== 137) throw new Error("Parsed program counts changed; rerun source inspection before rebuilding.");

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sourceUrl = (source: Source) => source.finalUrl ?? source.url;
const locator = (row: ParsedProgram) => [row.sourcePage ? `page ${row.sourcePage}` : undefined, row.sourceTable ? `table ${row.sourceTable}` : undefined, row.sourceRow ? `row ${row.sourceRow}` : undefined].filter(Boolean).join(", ");
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

function bfsuSource(row: ParsedProgram): Source {
  if (row.degreeLevel === "Undergraduate") return evidence.get("bfsu-international-undergraduate-program-catalog-en-2026")!;
  if (row.degreeLevel === "Master") return evidence.get("bfsu-international-master-program-catalog-en-2026")!;
  return evidence.get("bfsu-international-doctoral-program-catalog-en-2026")!;
}

function ecustSource(row: ParsedProgram): Source {
  if (row.degreeLevel === "Undergraduate") return evidence.get("ecust-international-undergraduate-program-catalog-2026")!;
  if (row.degreeLevel === "Master") return evidence.get("ecust-international-master-program-catalog-en-2026")!;
  return evidence.get("ecust-international-doctoral-program-catalog-en-2026")!;
}

function bfsuSubjects(text = ""): string[] {
  return ["Chinese (Arts)", "Chinese (Science)", "Mathematics", "Physics", "Chemistry"].filter((subject) => text.includes(subject));
}

function buildPrograms(rows: ParsedProgram[], schoolSlug: string, citySlug: string, getSource: (row: ParsedProgram) => Source, applicationUrl: string): CatalogSeedProgram[] {
  const used = new Map<string, number>();
  return rows.map((row) => {
    const source = getSource(row);
    const direction = row.researchDirection && row.researchDirection !== "*" ? row.researchDirection : undefined;
    const base = `${schoolSlug}-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-${slugify(row.teachingLanguage)}`;
    const sequence = (used.get(base) ?? 0) + 1;
    used.set(base, sequence);
    const slug = sequence === 1 ? base : `${base}-${sequence}`;
    const csca = row.degreeLevel === "Undergraduate" ? (row.cscaSubjects ?? bfsuSubjects(row.cscaText)) : [];
    const applicationNotes = [
      row.route,
      row.programCode ? `Official program code: ${row.programCode}.` : undefined,
      direction ? `Published research direction: ${direction}.` : undefined,
      row.acceptanceLetterText ? `Acceptance-letter policy: ${row.acceptanceLetterText}.` : undefined,
      schoolSlug === "beijing-foreign-studies-university" && row.degreeLevel === "Doctoral" ? "The prospectus requires the doctoral research plan to be confirmed with a prospective supervisor before submission; personal supervisor contacts are intentionally excluded." : undefined,
      schoolSlug === "beijing-foreign-studies-university" && row.degreeLevel === "Master" && row.nameEn === "International Business" && sequence > 1 ? "The official catalog lists a second English International Business route with a different tuition amount; both source rows are retained without inferring an unstated subtype." : undefined,
    ].filter(Boolean).join(" ");
    const program: CatalogSeedProgram = {
      slug, schoolSlug, citySlug, nameEn: row.nameEn, ...(row.nameZh ? { nameZh: row.nameZh } : {}), degreeLevel: row.degreeLevel,
      ...(row.durationYears ? (Number.isInteger(row.durationYears) ? { durationYears: row.durationYears } : { durationMonths: Math.round(row.durationYears * 12) }) : {}), fieldCategory: row.fieldCategory ?? row.discipline ?? row.school,
      subjectArea: row.discipline ?? row.fieldCategory ?? row.school, teachingLanguage: row.teachingLanguage,
      ...(csca.length ? { cscaSubjects: csca, cscaRequirement: row.cscaText ?? `Submit the published CSCA subjects: ${csca.join(", ")}.` } : row.degreeLevel === "Undergraduate" ? { cscaRequirement: "CSCA is required; use the route-specific subjects in the official program table." } : { cscaRequirement: "No CSCA requirement is published for this postgraduate route." }),
      applicationUrl, ...(applicationNotes ? { applicationNote: applicationNotes } : {}), hasScholarship: true, status: "draft",
      sourceUrl: sourceUrl(source), sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
      sourceFieldLineage: { nameEn: locator(row), degreeLevel: "official catalog section", ...(row.durationYears ? (Number.isInteger(row.durationYears) ? { durationYears: locator(row) } : { durationMonths: `${locator(row)}; converted from the published fractional year duration` }) : {}), fieldCategory: locator(row), teachingLanguage: locator(row), ...(csca.length ? { cscaSubjects: locator(row) } : {}), applicationUrl: "official admissions prospectus" },
    };
    if (schoolSlug === "beijing-foreign-studies-university" && row.tuitionAmount) Object.assign(program, { tuitionAmount: row.tuitionAmount, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `CNY ${row.tuitionAmount.toLocaleString("en-US")}/year` });
    if (schoolSlug === "east-china-university-of-science-and-technology") applyEcustTuition(program, row);
    return program;
  });
}

function applyEcustTuition(program: CatalogSeedProgram, row: ParsedProgram): void {
  let amount: number | undefined;
  let text: string | undefined;
  if (row.degreeLevel === "Undergraduate") {
    if (row.route === "International Joint Multi-Degree Program" && row.teachingLanguage === "English") { amount = 55000; text = "CNY 55,000/year for the single-degree route; CNY 70,000/year for the double-degree route"; }
    else if (row.route === "International Joint Multi-Degree Program") { amount = 40000; text = "CNY 40,000/year for the single-degree route; CNY 70,000/year for the double-degree route"; }
    else { amount = (row.school ?? "").includes("Art Design") ? 30000 : 22000; text = `CNY ${amount.toLocaleString("en-US")}/year`; }
  } else if (row.degreeLevel === "Master") {
    const professional = new Map([["International Business", 120000], ["International Development", 100000], ["Intelligent Chemical Engineering", 75000], ["Artificial Intelligence", 75000]]);
    amount = professional.get(row.nameEn);
    if (!amount) amount = (row.school ?? "").toLowerCase().includes("art") ? 34000 : row.teachingLanguage === "English" ? 42000 : row.teachingLanguage === "Chinese" ? 28000 : undefined;
    text = amount ? `CNY ${amount.toLocaleString("en-US")}/year` : "CNY 28,000/year for Chinese-taught academic routes or CNY 42,000/year for English-taught academic routes; the bilingual route amount is not separately published";
  } else if (row.teachingLanguage === "Chinese") { amount = 35000; text = "CNY 35,000/year"; }
  else if (row.teachingLanguage === "English") { amount = 44000; text = "CNY 44,000/year"; }
  else text = "CNY 35,000/year if Chinese-taught or CNY 44,000/year if English-taught";
  Object.assign(program, { ...(amount ? { tuitionAmount: amount } : {}), tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: text });
}

function buildIntakes(programs: CatalogSeedProgram[], rows: ParsedProgram[], schoolSlug: string): CatalogSeedProgramIntake[] {
  const output: CatalogSeedProgramIntake[] = [];
  programs.forEach((program, index) => {
    const row = rows[index];
    const undergraduate = row.degreeLevel === "Undergraduate";
    const source = schoolSlug === "beijing-foreign-studies-university"
      ? evidence.get(undergraduate ? "bfsu-international-undergraduate-admissions-en-2026" : "bfsu-international-graduate-admissions-pdf-zh-2026")!
      : evidence.get(undergraduate ? "ecust-international-undergraduate-admissions-en-2026" : "ecust-international-graduate-admissions-en-2026")!;
    const deadline = schoolSlug === "beijing-foreign-studies-university"
      ? (undergraduate ? "2026-06-15T00:00:00.000Z" : "2026-05-31T00:00:00.000Z")
      : (undergraduate ? "2026-07-10T00:00:00.000Z" : "2026-06-15T00:00:00.000Z");
    const autumnPublished = schoolSlug === "east-china-university-of-science-and-technology" || !undergraduate || (row.intakeText ?? "Autumn").includes("Autumn");
    if (!autumnPublished) return;
    output.push({
      programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: deadline,
      deadlineLabel: deadline.slice(0, 10), applicationRound: "2026 international degree admissions", status: "closed",
      sourceUrl: sourceUrl(source), sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
      sourceFieldLineage: { deadlineDate: undergraduate ? "official undergraduate application schedule" : "official graduate application schedule" },
    });
  });
  return output;
}

function scholarship(source: Source, value: Omit<CatalogSeedScholarship, "status" | "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt">): CatalogSeedScholarship {
  return { ...value, status: "draft", sourceUrl: sourceUrl(source), sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
}

const bfsuUg = evidence.get("bfsu-international-undergraduate-admissions-en-2026")!;
const bfsuGrad = evidence.get("bfsu-international-graduate-admissions-pdf-zh-2026")!;
const bfsuPrograms = buildPrograms(bfsu.programs, bfsu.schoolSlug, "beijing", bfsuSource, "https://study.bfsu.edu.cn/");
const bfsuScholarships: CatalogSeedScholarship[] = [
  scholarship(bfsuGrad, { slug: "official-2026-bfsu-cgs-high-level-postgraduate", title: "BFSU 2026/27 Chinese Government Scholarship High-Level Postgraduate Program", nameZh: "北京外国语大学2026/2027学年中国政府奖学金高水平研究生项目", schoolSlug: bfsu.schoolSlug, type: "government", typeLabel: "Chinese Government Scholarship", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Full tuition, accommodation, medical insurance and monthly living allowance", applicableDegree: "Master and Doctoral", amountText: "Full tuition, accommodation, medical insurance and a monthly living allowance; exact cash amounts are not stated in the captured prospectus.", deadlineLabel: "See the separate 2026/27 scholarship notice", targetCountries: [], targetRegions: [], summary: "Graduate scholarship route named in the official 2026 BFSU prospectus.", sourceFieldLineage: { title: "prospectus page 6", coverage: "prospectus page 6", amountText: "exact allowance amount not published" } }),
  scholarship(bfsuGrad, { slug: "official-2026-bfsu-international-chinese-language-teachers-translation-master", title: "BFSU 2026 International Chinese Language Teachers Scholarship - Foreign Translation Master's Training", nameZh: "北京外国语大学2026年国际中文教师奖学金外国翻译硕士培养项目", schoolSlug: bfsu.schoolSlug, type: "government", typeLabel: "International Chinese Language Teachers Scholarship", fundingLevel: "Full", coverage: "Full tuition, accommodation, medical insurance and monthly living allowance", applicableDegree: "Master", applicableProgram: "Foreign Translation Master's Training", amountText: "Full tuition, accommodation, medical insurance and a monthly living allowance; exact cash amounts are not stated in the captured prospectus.", deadlineLabel: "See the separate 2026 program notice", targetCountries: [], targetRegions: [], summary: "Translation master's scholarship route named in the official 2026 BFSU prospectus.", sourceFieldLineage: { title: "prospectus page 7", coverage: "prospectus page 7" } }),
  scholarship(bfsuGrad, { slug: "official-2026-bfsu-beijing-government-graduate", title: "BFSU 2026 Beijing Government Scholarship for New International Students", nameZh: "北京外国语大学2026年北京市外国留学生奖学金", schoolSlug: bfsu.schoolSlug, type: "government", typeLabel: "Beijing Government Scholarship", providerNameEn: "Beijing Municipal Government", fundingLevel: "Partial", coverage: "Class B: tuition, accommodation and medical insurance; Class C: tuition and medical insurance", applicableDegree: "Master and Doctoral", amountText: "No fixed cash amount is published in the captured prospectus.", deadlineLabel: "See the separate 2026 application procedure", targetCountries: [], targetRegions: [], summary: "Class B and C benefits are stated in the official 2026 BFSU prospectus.", sourceFieldLineage: { title: "prospectus page 7", coverage: "prospectus page 7" } }),
];

const ecustUg = evidence.get("ecust-international-undergraduate-admissions-en-2026")!;
const ecustGrad = evidence.get("ecust-international-graduate-admissions-en-2026")!;
const ecustPrograms = buildPrograms(ecust.programs, ecust.schoolSlug, "shanghai", ecustSource, "https://cie.ecust.edu.cn/notices/514.html");
const ecustScholarships: CatalogSeedScholarship[] = [
  scholarship(ecustUg, { slug: "official-2026-ecust-cgs-type-a-undergraduate", title: "ECUST 2026 Chinese Government Scholarship Type A", schoolSlug: ecust.schoolSlug, type: "government", typeLabel: "Chinese Government Scholarship Type A", providerNameEn: "China Scholarship Council", fundingLevel: "Not stated", coverage: "Refer to the dispatching authority and CGS notice", applicableDegree: "Undergraduate", applicableProgram: "Chinese-taught programs", amountText: "Coverage is not stated in the captured ECUST admissions page.", deadlineDate: "2026-04-30", deadlineLabel: "April 30, 2026 scholarship-program deadline", targetCountries: [], targetRegions: [], summary: "Type A undergraduate route published by ECUST; no coverage is inferred.", sourceFieldLineage: { title: "scholarship section", applicableProgram: "scholarship section", deadlineDate: "application deadline section" } }),
  scholarship(ecustUg, { slug: "official-2026-ecust-shanghai-government-undergraduate", title: "ECUST 2026 Shanghai Government Scholarship Class B and 1+4 Program", schoolSlug: ecust.schoolSlug, type: "government", typeLabel: "Shanghai Government Scholarship", providerNameEn: "Shanghai Municipal Government", fundingLevel: "Not stated", coverage: "Not published in the captured admissions page", applicableDegree: "Undergraduate", applicableProgram: "Chinese-taught programs", amountText: "Coverage will be notified separately; no amount is inferred.", deadlineDate: "2026-04-30", deadlineLabel: "April 30, 2026 scholarship-program deadline", targetCountries: [], targetRegions: [], summary: "Apply by checking the scholarship box in the ECUST application system.", sourceFieldLineage: { title: "scholarship section", coverage: "explicitly deferred by source", deadlineDate: "application deadline section" } }),
  scholarship(ecustUg, { slug: "official-2026-ecust-president-undergraduate", title: "ECUST 2026 President Scholarship", schoolSlug: ecust.schoolSlug, type: "university", typeLabel: "ECUST President Scholarship", providerNameEn: "East China University of Science and Technology", fundingLevel: "Not stated", coverage: "Not published in the captured admissions page", applicableDegree: "Undergraduate", amountText: "Coverage will be notified separately; no amount is inferred.", deadlineDate: "2026-04-30", deadlineLabel: "April 30, 2026 scholarship-program deadline", targetCountries: [], targetRegions: [], summary: "Apply by checking the scholarship box in the ECUST application system.", sourceFieldLineage: { title: "scholarship section", coverage: "explicitly deferred by source", deadlineDate: "application deadline section" } }),
  scholarship(ecustGrad, { slug: "official-2026-ecust-cgs-graduate", title: "ECUST 2026 Chinese Government Scholarship for Graduate Programs", schoolSlug: ecust.schoolSlug, type: "government", typeLabel: "Chinese Government Scholarship Type A or Type B", providerNameEn: "China Scholarship Council", fundingLevel: "Not stated", coverage: "Not published in the captured admissions page", applicableDegree: "Master and Doctoral", amountText: "No amount or benefit schedule is inferred from the captured page.", deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", targetCountries: [], targetRegions: [], summary: "ECUST lists Type A and Type B graduate application routes.", sourceFieldLineage: { title: "scholarship section", deadlineDate: "application deadline section" } }),
  scholarship(ecustGrad, { slug: "official-2026-ecust-shanghai-government-graduate", title: "ECUST 2026 Shanghai Government Scholarship for Graduate Programs", schoolSlug: ecust.schoolSlug, type: "government", typeLabel: "Shanghai Government Scholarship", providerNameEn: "Shanghai Municipal Government", fundingLevel: "Not stated", coverage: "Not published in the captured admissions page", applicableDegree: "Master and Doctoral", amountText: "Coverage will be notified separately; no amount is inferred.", deadlineDate: "2026-04-15", deadlineLabel: "April 15, 2026", targetCountries: [], targetRegions: [], summary: "Apply by checking the scholarship box in the ECUST application system.", sourceFieldLineage: { title: "scholarship section", coverage: "explicitly deferred by source", deadlineDate: "application deadline section" } }),
];

const bfsuBundle: CatalogSeedBundle = {
  version: 1, generatedAt: bfsuGrad.fetchedAt,
  cities: [{ slug: "beijing", nameEn: "Beijing", nameZh: "北京", region: "North China", province: "Beijing", status: "draft", sourceUrl: sourceUrl(bfsuGrad), sourceLabel: bfsuGrad.label, sourceSha256: bfsuGrad.sha256, capturedAt: bfsuGrad.fetchedAt, sourceFieldLineage: { nameEn: "official university address, prospectus page 1", province: "official university address, prospectus page 1" } }],
  schools: [{ slug: bfsu.schoolSlug, nameEn: "Beijing Foreign Studies University", nameZh: "北京外国语大学", citySlug: "beijing", schoolType: "Public", region: "Beijing, North China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese, English and program-specific foreign languages", deadlineSummary: "Autumn undergraduate: June 15, 2026; graduate: May 31, 2026. Both captured cycles are closed.", tuitionSummary: "Undergraduate CNY 26,000-39,900/year; master's CNY 30,000-64,000/year. Doctoral tuition is not published in the captured compliant sources.", applicationFee: "CNY 800, non-refundable", websiteUrl: "https://www.bfsu.edu.cn/", admissionsUrl: "https://lb.bfsu.edu.cn/", cscaRequired: true, cscaRequirement: "CSCA applies to 2026 undergraduate applicants with route-specific Chinese and/or Mathematics subjects; no CSCA requirement is published for graduate routes.", cscaSubjects: ["Chinese (Arts)", "Chinese (Science)", "Mathematics"], subjectTags: ["Foreign Languages", "Translation", "International Relations", "International Business", "Law", "Communication"], languageTags: ["Chinese", "English", "Arabic", "German", "Russian", "Japanese"], status: "draft", sourceUrl: sourceUrl(bfsuUg), sourceLabel: bfsuUg.label, sourceSha256: bfsuUg.sha256, capturedAt: bfsuUg.fetchedAt, sourceFieldLineage: { nameEn: "prospectus title", citySlug: "official address", applicationLevel: "undergraduate and graduate prospectuses plus program catalogs", deadlineSummary: "official application schedules", tuitionSummary: "official program catalogs", applicationFee: "undergraduate prospectus and graduate prospectus", cscaSubjects: "undergraduate program catalog" } }],
  programs: bfsuPrograms, programIntakes: buildIntakes(bfsuPrograms, bfsu.programs, bfsu.schoolSlug), scholarships: bfsuScholarships,
};

const ecustBundle: CatalogSeedBundle = {
  version: 1, generatedAt: ecustGrad.fetchedAt,
  cities: [{ slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", region: "East China", province: "Shanghai", status: "draft", sourceUrl: sourceUrl(ecustGrad), sourceLabel: ecustGrad.label, sourceSha256: ecustGrad.sha256, capturedAt: ecustGrad.fetchedAt, sourceFieldLineage: { nameEn: "official university address", province: "official university address" } }],
  schools: [{ slug: ecust.schoolSlug, nameEn: "East China University of Science and Technology", nameZh: "华东理工大学", citySlug: "shanghai", schoolType: "Public", region: "Shanghai, East China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English", languageRequirement: "Chinese-taught undergraduate: HSK 4 with route-specific score thresholds; Chinese-taught graduate: HSK 5 (210) or HSK 6 (180). English-taught: TOEFL 80, IELTS 6.0 or Duolingo 105, subject to the published exemptions.", hskRequirement: "Undergraduate HSK 4: 190 for science/engineering or 210 for humanities/business, with writing 60; graduate HSK 5 (210) or HSK 6 (180).", englishRequirement: "TOEFL 80, IELTS 6.0 or Duolingo 105; prior English-medium degree proof or native English status may qualify for exemption.", deadlineSummary: "Undergraduate self-sponsored: July 10, 2026; undergraduate scholarship: April 30, 2026; graduate self-sponsored: June 15, 2026; graduate scholarship deadlines vary by route. All captured cycles are closed.", tuitionSummary: "Undergraduate CNY 22,000-70,000/year by route; master's CNY 28,000-120,000/year by route; doctoral CNY 35,000/year Chinese or CNY 44,000/year English.", applicationFee: "CNY 600, non-refundable", websiteUrl: "https://www.ecust.edu.cn/", admissionsUrl: "https://cie.ecust.edu.cn/", cscaRequired: true, cscaRequirement: "CSCA is required for undergraduate applicants with route-specific Chinese, Mathematics, Physics and/or Chemistry subjects; no graduate CSCA requirement is published.", cscaSubjects: ["Chinese (Arts)", "Chinese (Science)", "Mathematics", "Physics", "Chemistry"], subjectTags: ["Chemical Engineering", "Chemistry", "Materials", "Bioengineering", "Business", "Artificial Intelligence"], languageTags: ["Chinese", "English"], status: "draft", sourceUrl: sourceUrl(ecustUg), sourceLabel: ecustUg.label, sourceSha256: ecustUg.sha256, capturedAt: ecustUg.fetchedAt, sourceFieldLineage: { nameEn: "admissions page title", citySlug: "official address", applicationLevel: "undergraduate and graduate admissions plus program catalogs", languageRequirement: "admissions qualification sections", deadlineSummary: "application deadline sections", tuitionSummary: "study term and fee tables", applicationFee: "application procedures and fee tables", cscaSubjects: "undergraduate program catalog" } }],
  programs: ecustPrograms, programIntakes: buildIntakes(ecustPrograms, ecust.programs, ecust.schoolSlug), scholarships: ecustScholarships,
};

async function persist(name: string, bundle: CatalogSeedBundle): Promise<void> {
  const text = `${JSON.stringify(bundle, null, 2)}\n`;
  const validation = createCatalogMigrationValidationReport(JSON.parse(text));
  if (!validation.ok) throw new Error(`${name} validation failed:\n${validation.errors.join("\n")}`);
  const draftPath = resolve(root, `seeds/catalog.${name}-complete-batch-01.draft.json`);
  const validationPath = resolve(root, `seeds/catalog.${name}-complete-batch-01.validation.json`);
  await Promise.all([
    writeFile(draftPath, text, "utf8"),
    writeFile(validationPath, `${JSON.stringify({ ...validation, parsedSha256: sha256(await readFile(resolve(parsedRoot, `${name}-programs.json`), "utf8")), evidence: [...expected].filter(([id]) => id.startsWith(name === "bfsu" ? "bfsu-" : "ecust-")).map(([id, hash]) => ({ id, sha256: hash })) }, null, 2)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify({ name, draftPath, validationPath, summary: validation.summary }, null, 2));
}

await persist("bfsu", bfsuBundle);
await persist("ecust", ecustBundle);
