import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const runPath = resolve(root, "work/catalog-official/ecnu-complete-batch-01");
const manifest = JSON.parse(await readFile(resolve(runPath, "manifest.json"), "utf8"));
const extracted = JSON.parse(await readFile(resolve(runPath, "programs.extracted.json"), "utf8"));
const legacy = JSON.parse(await readFile(resolve(root, "seeds/catalog.cscalite-online-20260910.published.json"), "utf8"));
const tongji = JSON.parse(await readFile(resolve(root, "seeds/catalog.tongji-school-program-batch-01.approved.local.json"), "utf8"));
const byId = new Map(manifest.sources.map((source: any) => [source.id, source]));
const meta = (id: string) => {
  const source: any = byId.get(id);
  if (!source) throw new Error(`Missing source metadata: ${id}`);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 92) || "program";
const degrees: Record<string, string> = { Bachelor: "Bachelor", Master: "Master", Doctoral: "Doctoral" };
const programSeen = new Map<string, number>();
const programs = extracted.programs.map((row: any, index: number) => {
  const base = `official-2026-ecnu-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-${slugify(row.school)}`;
  const ordinal = (programSeen.get(base) ?? 0) + 1;
  programSeen.set(base, ordinal);
  const slug = `${base}-${ordinal}`;
  const hskRequirement = row.teachingLanguage === "English" ? "No HSK requirement is published for this English-taught route." : row.hskLevel ? `HSK ${row.hskLevel}${row.hskMinimumScore ? ` ≥ ${row.hskMinimumScore}` : ""}; confirm the current admissions guide for discipline-specific thresholds.` : "Chinese proficiency follows the current ECNU graduate admissions guide; no route-specific HSK number is printed in this catalog row.";
  return {
    slug,
    schoolSlug: "east-china-normal-university",
    citySlug: "shanghai",
    nameEn: row.nameEn,
    nameZh: row.nameEn,
    degreeLevel: degrees[row.degreeLevel],
    durationYears: row.durationYears,
    fieldCategory: row.school,
    subjectArea: row.school,
    teachingLanguage: row.teachingLanguage,
    hskRequirement,
    cscaRequirement: row.degreeLevel === "Bachelor" ? `2026 CSCA required subjects: ${row.cscaSubjects || "refer to the official catalog"}; no minimum score threshold is published.` : "No CSCA requirement is published for this graduate route.",
    tuitionText: `${row.tuitionText}/year`,
    displayTuition: `${row.tuitionText}/year`,
    scholarshipText: "Scholarship eligibility depends on the selected ECNU funding route and is not guaranteed by program listing.",
    applicationUrl: "https://lxsapply.ecnu.edu.cn/",
    applicationNote: `${row.campus} Campus; ${row.locator}.`,
    hasScholarship: true,
    badgeText: "Official 2026 catalog",
    displayGroup: row.degreeLevel,
    displayGroupLabel: `${row.degreeLevel} programs`,
    status: "draft" as const,
    ...meta(row.sourceId),
    sourceFieldLineage: {
      nameEn: `${row.locator}, Name column`,
      degreeLevel: "official catalog page category",
      fieldCategory: `${row.locator}, school section heading`,
      teachingLanguage: "official catalog legend and row marker",
      durationYears: `${row.locator}, Length column`,
      tuitionText: `${row.locator}, Tuition column`,
      hskRequirement: `${row.locator}, circled HSK marker and current admissions guide`,
      cscaRequirement: row.degreeLevel === "Bachelor" ? `${row.locator}, CSCA Test Subjects column` : "graduate admissions guide",
    },
    _sourceOrdinal: index + 1,
  };
}).map(({ _sourceOrdinal, ...row }: any) => row);

const admissionsSource = (degree: string) => degree === "Bachelor" ? meta("ecnu-undergraduate-admissions-2026") : meta("ecnu-graduate-admissions-2026");
const programIntakes = programs.map((program: any) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-01T00:00:00Z",
  deadlineLabel: "Self-financed application deadline: June 1, 2026",
  applicationRound: "ECNU international degree programs, 2026 intake",
  status: "closed" as const,
  ...admissionsSource(program.degreeLevel),
  sourceFieldLineage: { deadlineDate: "official application deadline table; date-only value normalized to ISO UTC" },
}));

const commonMaterials = ["Passport information page", "Highest diploma or expected-graduation proof", "Academic transcripts", "Language proficiency evidence", "Study or research plan", "Physical examination record where required", "No-criminal-record report where required"].map(label => ({ label }));
const scholarship = (sourceId: string, value: any) => ({
  schoolSlug: "east-china-normal-university",
  status: "draft" as const,
  providerLocation: "Shanghai, China",
  targetCountries: [], targetRegions: [],
  ...meta(sourceId),
  actionLinks: [
    { label: value.title, url: (byId.get(sourceId) as any).finalUrl, kind: "official-source" },
    { label: "ECNU international application system", url: "https://lxsapply.ecnu.edu.cn/", kind: "official-application" },
  ],
  sourceFieldLineage: { title: "official page title", fundingLevel: "Scholarship Coverage section", coverage: "Scholarship Coverage section", applicableDegree: "Target Applicants section", applicableProgram: "Target Applicants section", eligibilityItems: "Eligibility section", applicationMaterials: "linked official admissions guide and Application Documents section", applicationSteps: "Application Procedures section" },
  applicationMaterials: commonMaterials,
  ...value,
});

const scholarships = [
  scholarship("ecnu-cgs-type-a-undergraduate-2026", {
    slug: "official-2026-ecnu-cgs-type-a-bilateral", title: "ECNU 2026 Chinese Government Scholarship Type A", nameZh: "华东师范大学2026年中国政府奖学金A类", type: "government", typeLabel: "Chinese Government Scholarship Type A", providerName: "Ministry of Education of the PRC / China Scholarship Council", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "According to bilateral award", coverage: "The ECNU page refers applicants to the official CSC scholarship rules and does not restate a fixed component list.", applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "Programs accepted under the applicant's bilateral dispatch route", amountText: "Not separately published by ECNU", deadlineLabel: "Set by the dispatching authority", applicationRound: "2026 Chinese Government Scholarship Type A", benefitItems: [{ label: "Award composition", included: true, note: "Determined by the bilateral CSC award; verify the dispatch notice" }], eligibilityItems: [{ label: "Application route", value: "Apply through the dispatching department in the applicant's home country" }, { label: "ECNU pre-admission", value: "If requested, submit ECNU online application and pay the RMB 800 application fee" }], applicationSteps: [{ label: "Step 1", value: "Consult and apply through the home-country dispatching authority" }, { label: "Step 2", value: "Complete the CSC process required by that authority" }, { label: "Step 3", value: "If a pre-admission letter is requested, submit the ECNU online application" }], bodySections: [{ title: "Route note", body: "This is a country-dispatched Type A route; local deadlines and award composition are controlled by the dispatching authority and CSC." }], summary: "ECNU's official bilateral Chinese Government Scholarship Type A route.", sortOrder: 10,
  }),
  scholarship("ecnu-shanghai-government-undergraduate-scholarship-2026", {
    slug: "official-2026-ecnu-shanghai-government-scholarship-undergraduate", title: "ECNU 2026 Shanghai Government Scholarship — Undergraduate", nameZh: "华东师范大学2026年上海市政府奖学金（本科）", type: "government", typeLabel: "Shanghai Government Scholarship", providerName: "Shanghai Municipal Government / East China Normal University", providerNameEn: "Shanghai Municipal Government / East China Normal University", fundingLevel: "Type A full; Type B partial", coverage: "Type A covers tuition, on-campus accommodation, RMB 2,500 monthly stipend and RMB 800/year medical insurance; Type B covers tuition and medical insurance.", applicableDegree: "Bachelor", applicableProgram: "Full-time undergraduate programs excluding joint, English-taught and School of International Chinese Studies programs", amountText: "Type A stipend RMB 2,500/month; insurance RMB 800/year", deadlineLabel: "April 30, 2026", applicationRound: "2026 Shanghai Government Scholarship", benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus accommodation", included: true, note: "Type A" }, { label: "Monthly stipend", included: true, note: "RMB 2,500/month, Type A" }, { label: "Medical insurance", included: true, note: "RMB 800/year" }], eligibilityItems: [{ label: "Nationality and conduct", value: "Non-Chinese citizen in good health with good academic and personal conduct" }, { label: "Degree and age", value: "High-school diploma and under 25" }, { label: "Language", value: "Meet the Chinese-language admission requirement of the applied major" }], applicationSteps: [{ label: "Step 1", value: "Submit ECNU online application and pay RMB 800 application fee" }, { label: "Step 2", value: "ECNU nominates outstanding applicants; no separate SGS application is required" }, { label: "Step 3", value: "Await school review and scholarship result" }], bodySections: [{ title: "Excluded programs", body: "Joint programs, English-taught programs and programs in the School of International Chinese Studies are not open for this undergraduate route." }], summary: "ECNU's 2026 Shanghai Government Scholarship route for eligible full-time undergraduates.", sortOrder: 20,
  }),
  scholarship("ecnu-iclts-undergraduate-2026", {
    slug: "official-2026-ecnu-iclts-undergraduate", title: "ECNU 2026 International Chinese Language Teachers Scholarship — Undergraduate", nameZh: "华东师范大学2026年国际中文教师奖学金（本科）", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "Center for Language Education and Cooperation / ECNU", providerNameEn: "Center for Language Education and Cooperation / ECNU", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, RMB 2,500/month stipend and RMB 800/year comprehensive medical insurance.", applicableDegree: "Bachelor", applicableProgram: "International Chinese Education; Chinese Language and Literature; Chinese Language and Culture; Business Chinese", amountText: "RMB 2,500/month stipend; RMB 800/year insurance", deadlineLabel: "May 15, 2026", applicationRound: "2026 International Chinese Language Teachers Scholarship", benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus accommodation", included: true }, { label: "Monthly stipend", included: true, note: "RMB 2,500/month" }, { label: "Medical insurance", included: true, note: "RMB 800/year" }], eligibilityItems: [{ label: "Age and degree", value: "High-school diploma and under 25 as of September 1, 2026" }, { label: "International Chinese Education routes", value: "HSK 4 ≥ 210 and HSKK Intermediate ≥ 60" }, { label: "Chinese Language and Literature", value: "HSK 5 ≥ 180 and HSKK Intermediate ≥ 60" }], applicationSteps: [{ label: "Step 1", value: "Submit ECNU online application and pay RMB 800 application fee" }, { label: "Step 2", value: "Apply through the ICLTS platform from March 1 to May 15" }, { label: "Step 3", value: "Obtain online recommendation from a recommending institution" }], bodySections: [{ title: "Program term", body: "The undergraduate scholarship period is four years." }], summary: "ECNU's 2026 full ICLTS undergraduate scholarship for specified Chinese-language education routes.", sortOrder: 30,
  }),
  scholarship("ecnu-excellent-freshmen-scholarship-2026", {
    slug: "official-2026-ecnu-excellent-freshmen-scholarship", title: "ECNU 2026 Excellent Freshmen Scholarship", nameZh: "华东师范大学2026年优秀本科新生奖学金", type: "university", typeLabel: "ECNU Scholarship", providerName: "East China Normal University", providerNameEn: "East China Normal University", fundingLevel: "First-year living allowance", coverage: "RMB 2,500/month for 12 months of the first academic year.", applicableDegree: "Bachelor", applicableProgram: "Full-time undergraduate programs excluding joint and English-taught programs", amountText: "RMB 2,500/month for 12 months", deadlineLabel: "April 30, 2026", applicationRound: "2026 ECNU Excellent Freshmen Scholarship", benefitItems: [{ label: "Living allowance", included: true, note: "RMB 2,500/month for 12 months of the first academic year" }], eligibilityItems: [{ label: "Nationality and health", value: "Non-Chinese citizen in good health" }, { label: "Academic performance", value: "Excellent high-school performance; major competition winners preferred" }, { label: "Degree and age", value: "High-school diploma and under 25" }, { label: "Language", value: "HSK 5 ≥ 180" }, { label: "Other funding", value: "May not concurrently receive another scholarship or fellowship" }], applicationSteps: [{ label: "Step 1", value: "Submit ECNU online application and pay RMB 800 application fee" }, { label: "Step 2", value: "Complete school/department review and any interview" }, { label: "Step 3", value: "Await the scholarship evaluation result after pre-admission" }], bodySections: [{ title: "Excluded programs", body: "Joint programs and English-taught programs are not open for this scholarship." }], summary: "ECNU first-year living allowance for excellent eligible international undergraduate freshmen.", sortOrder: 40,
  }),
  scholarship("ecnu-cgs-type-b-graduate-2026", {
    slug: "official-2026-ecnu-cgs-type-b-graduate", title: "ECNU 2026 Chinese Government Scholarship Type B — Graduate", nameZh: "华东师范大学2026年中国政府奖学金B类（研究生）", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "Ministry of Education of the PRC / China Scholarship Council", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, RMB 3,000/month master's or RMB 3,500/month doctoral stipend, and RMB 800/year medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible full-time ECNU graduate programs; exclusions are listed on the official page", amountText: "Master RMB 3,000/month; Doctoral RMB 3,500/month; insurance RMB 800/year", deadlineLabel: "First batch extended to January 9, 2026; second batch March 1, 2026", applicationRound: "2026 Chinese Government Scholarship Type B", benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus accommodation", included: true }, { label: "Monthly stipend", included: true, note: "RMB 3,000 master; RMB 3,500 doctoral" }, { label: "Medical insurance", included: true, note: "RMB 800/year" }], eligibilityItems: [{ label: "Master", value: "Bachelor's degree and under 35" }, { label: "Doctoral", value: "Master's degree and under 40" }, { label: "Chinese-medium liberal arts/economics", value: "HSK 5 ≥ 210 or HSK 6 ≥ 180" }, { label: "Chinese-medium art/sport/science", value: "HSK 5 ≥ 180" }, { label: "English-medium", value: "IELTS ≥ 6.0, TOEFL ≥ 80 or Cambridge C1 Advanced ≥ 169 for non-native speakers" }], applicationSteps: [{ label: "Step 1", value: "Submit ECNU online application and pay RMB 800 application fee" }, { label: "Step 2", value: "Submit the CSC Type B online application using ECNU agency number 10269" }, { label: "Step 3", value: "Await ECNU and CSC review" }], bodySections: [{ title: "Program exclusions", body: "The official page excludes specified programs in International Chinese Studies, Asia Europe Business School, and the School of Economics and Management." }], summary: "ECNU's 2026 full Chinese Government Scholarship Type B route for eligible master's and doctoral programs.", sortOrder: 50,
  }),
  scholarship("ecnu-iclts-graduate-2026", {
    slug: "official-2026-ecnu-iclts-graduate", title: "ECNU 2026 International Chinese Language Teachers Scholarship — Graduate", nameZh: "华东师范大学2026年国际中文教师奖学金（研究生）", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "Center for Language Education and Cooperation / ECNU", providerNameEn: "Center for Language Education and Cooperation / ECNU", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, RMB 3,000/month master's or RMB 3,500/month doctoral stipend, and RMB 800/year medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "International Chinese Language Education", amountText: "Master RMB 3,000/month; Doctoral RMB 3,500/month; insurance RMB 800/year", deadlineLabel: "May 15, 2026", applicationRound: "2026 International Chinese Language Teachers Scholarship", benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus accommodation", included: true }, { label: "Monthly stipend", included: true, note: "RMB 3,000 master; RMB 3,500 doctoral" }, { label: "Medical insurance", included: true, note: "RMB 800/year" }], eligibilityItems: [{ label: "Age", value: "16–35 as of September 1, 2026; up to 45 for in-service Chinese-language teachers" }, { label: "Master", value: "Bachelor's degree; HSK 5 ≥ 210 and HSKK Intermediate ≥ 60" }, { label: "Doctoral", value: "Relevant master's degree; HSK 6 ≥ 200 and HSKK Advanced ≥ 60, or HSK 7" }], applicationSteps: [{ label: "Step 1", value: "Submit ECNU online application and pay RMB 800 application fee" }, { label: "Step 2", value: "Apply through the ICLTS platform from March 1 to May 15" }, { label: "Step 3", value: "Contact the selected recommending institution to complete recommendation" }], bodySections: [{ title: "Program term", body: "Two years for master's study and four years for doctoral study." }], summary: "ECNU's 2026 full ICLTS graduate scholarship for International Chinese Language Education.", sortOrder: 60,
  }),
  scholarship("ecnu-youth-of-excellence-scholarship-2026", {
    slug: "official-2026-ecnu-youth-of-excellence-master", title: "ECNU 2026 Youth of Excellence Scheme of China — Master", nameZh: "华东师范大学2026年中国政府来华留学卓越奖学金（硕士）", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "China Scholarship Council / East China Normal University", providerNameEn: "China Scholarship Council / East China Normal University", fundingLevel: "Full", coverage: "Tuition; during the first academic year in China, on-campus accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "Master", applicableProgram: "Design; International Business (Single Degree); Education Management", amountText: "Component amounts not separately published on the ECNU page", deadlineLabel: "March 1, 2026", applicationRound: "2026 Youth of Excellence Scheme of China", benefitItems: [{ label: "Tuition waiver", included: true }, { label: "First-year on-campus accommodation", included: true }, { label: "First-year living allowance", included: true }, { label: "First-year medical insurance", included: true }], eligibilityItems: [{ label: "Age and degree", value: "Under 45 with bachelor's degree or above" }, { label: "Experience", value: "At least three years of work experience" }, { label: "Professional profile", value: "Eligible government official, senior manager, university/research administrator, or applicant with international-organization experience" }, { label: "English", value: "IELTS ≥ 6.0, TOEFL ≥ 80 or Cambridge C1 Advanced ≥ 169 for non-native speakers" }], applicationSteps: [{ label: "Step 1", value: "Apply in ECNU's system under Master Programs — Youth of Excellence Scheme of China Program and pay RMB 800" }, { label: "Step 2", value: "Complete school review and any interview" }, { label: "Step 3", value: "Download pre-admission material and complete the CSC procedure when instructed" }], bodySections: [{ title: "1+1 structure", body: "The first academic year is full-time at ECNU; the second year is completed in the home country with return to ECNU for thesis defense as required." }], summary: "ECNU's 2026 full Youth of Excellence master's route for three specified English-medium programs.", sortOrder: 70,
  }),
  scholarship("ecnu-china-studies-phd-scholarship-2026", {
    slug: "official-2026-ecnu-china-studies-phd", title: "ECNU 2026 China Studies Programs — PhD", nameZh: "华东师范大学2026年新汉学计划博士项目", type: "government", typeLabel: "China Studies Program", providerName: "Center for Language Education and Cooperation / ECNU", providerNameEn: "Center for Language Education and Cooperation / ECNU", fundingLevel: "Full published support", coverage: "Tuition, living allowance, research subsidy and related support published by the program.", applicableDegree: "Doctoral", applicableProgram: "China Studies doctoral research routes accepted by ECNU", amountText: "Amounts not separately published on the ECNU page", deadlineLabel: "February 28, 2026", applicationRound: "2026 China Studies Program", benefitItems: [{ label: "Tuition", included: true }, { label: "Living allowance", included: true }, { label: "Research subsidy", included: true }, { label: "Academic activities and supervisor guidance", included: true }], eligibilityItems: [{ label: "Nationality", value: "Non-Chinese citizen with valid passport" }, { label: "Degree", value: "Master's degree or equivalent (or higher)" }, { label: "Chinese", value: "HSK 5 > 210 or HSK 6 > 180; higher proficiency receives priority under equal conditions" }], applicationMaterials: [{ label: "Notarized undergraduate and master's transcripts and degree certificates with Chinese translations" }, { label: "Two expert recommendation letters" }, { label: "Valid HSK transcript" }, { label: "Doctoral study plan" }, { label: "Publication catalogue/abstract or other academic evidence" }, { label: "Master's thesis abstract" }, { label: "Passport copy" }, { label: "No-criminal-record certificate" }, { label: "Physical examination form issued within six months" }], applicationSteps: [{ label: "Step 1", value: "Submit the China Studies Program online application" }, { label: "Step 2", value: "Submit the ECNU online application and pay RMB 800" }, { label: "Step 3", value: "Upload all required documents before February 28, 2026" }], bodySections: [{ title: "Academic support", body: "Awardees may join customized forums, seminars and workshops and receive guidance from supervisors at Chinese and international universities." }], summary: "ECNU's 2026 China Studies doctoral scholarship with tuition, living and research support.", sortOrder: 80,
  }),
];

if (programs.length !== 280 || programIntakes.length !== 280 || scholarships.length !== 8) throw new Error("ECNU safe-new scope count mismatch.");
const city = tongji.cities.find((row: any) => row.slug === "shanghai");
const school = legacy.schools.find((row: any) => row.slug === "east-china-normal-university");
if (!city || !school) throw new Error("Dependency records not found.");
const bundle: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const report = createCatalogMigrationValidationReport(bundle);
if (!report.ok) throw new Error(`Invalid ECNU candidate: ${report.errors.join(" ")}`);
const draftPath = resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.validation.json");
const body = `${JSON.stringify(bundle, null, 2)}\n`;
await writeFile(draftPath, body);
await writeFile(validationPath, `${JSON.stringify({ ...report, candidateSha256: createHash("sha256").update(body).digest("hex"), sourceManifest: "work/catalog-official/ecnu-complete-batch-01/manifest.json", sourceManifestSha256: createHash("sha256").update(await readFile(resolve(runPath, "manifest.json"))).digest("hex"), extractionCounts: extracted.counts }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, draftPath, validationPath, counts: report.summary, bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
