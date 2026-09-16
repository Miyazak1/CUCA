import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const runPath = resolve(root, "work/catalog-official/dut-complete-batch-01");
const manifestText = await readFile(resolve(runPath, "manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);
const legacy = JSON.parse(await readFile(resolve(root, "seeds/catalog.cscalite-online-20260910.published.json"), "utf8"));
const byId = new Map(manifest.sources.map((source: any) => [source.id, source]));
const meta = (id: string) => {
  const source: any = byId.get(id);
  if (!source || source.status !== 200 || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Missing valid source metadata: ${id}`);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const schoolSlug = "dalian-university-of-technology";
const school = legacy.schools.find((row: any) => row.slug === schoolSlug);
if (!school) throw new Error("DUT legacy dependency school not found.");

const programDefinitions = [
  { slug: "official-2026-dut-youth-excellence-mechanical-engineering", nameEn: "Global Advanced Talent Master Program in Mechanical Engineering", nameZh: "机械工程全球高端人才硕士项目", fieldCategory: "School of Mechanical Engineering", subjectArea: "Mechanical Engineering" },
  { slug: "official-2026-dut-youth-excellence-software-engineering", nameEn: "Excellent Talent Master Program in Software Engineering", nameZh: "卓越人才软件工程硕士项目", fieldCategory: "School of Software", subjectArea: "Software Engineering" },
  { slug: "official-2026-dut-youth-excellence-materials-science-and-engineering", nameEn: "Excellent Talent Master Program in Materials Science and Engineering", nameZh: "材料科学与工程卓越人才硕士项目", fieldCategory: "School of Materials Science and Engineering", subjectArea: "Materials Science and Engineering" },
];
const programs = programDefinitions.map(row => ({
  ...row,
  schoolSlug,
  degreeLevel: "Master",
  durationYears: 2,
  teachingLanguage: "English",
  hskRequirement: "No HSK requirement is published for this English-taught route.",
  cscaRequirement: "No CSCA requirement is published for this graduate route.",
  tuitionText: "Youth of Excellence route: full scholarship; the general 2026 English-taught science and technology master's tuition is CNY 29,500/year.",
  displayTuition: "CNY 29,500/year before scholarship",
  scholarshipText: "Eligible route under the 2026 Youth of Excellence Scheme of China; funding is subject to award approval.",
  applicationUrl: "https://iso.dlut.edu.cn",
  applicationNote: "Special two-year 1+1 structure: first academic year at DUT, second year completed in the home country with return for thesis defense as required.",
  hasScholarship: true,
  badgeText: "Official 2026 route",
  displayGroup: "Master",
  displayGroupLabel: "English-taught master's programs",
  status: "draft" as const,
  ...meta("dut-youth-of-excellence-scholarship-2026"),
  sourceFieldLineage: {
    nameEn: "program table rows 1-3, translated from the official Chinese title",
    nameZh: "program table rows 1-3, 项目名称",
    fieldCategory: "program table rows 1-3, 学院",
    subjectArea: "program table rows 1-3, 专业",
    degreeLevel: "program table rows 1-3, 学位",
    teachingLanguage: "program table rows 1-3, 授课语言",
    durationYears: "项目说明：两年制（1+1学习）",
    tuitionText: "Youth of Excellence funding section plus 2026 English-taught master admissions fee table",
  },
}));

const programIntakes = programs.map(program => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-02-15T00:00:00Z",
  deadlineLabel: "DUT pre-admission deadline: February 15, 2026; CSC deadline: March 31, 2026",
  applicationRound: "2026 Youth of Excellence Scheme of China",
  status: "closed" as const,
  ...meta("dut-youth-of-excellence-scholarship-2026"),
  sourceFieldLineage: { deadlineDate: "申请方式：学校网站申请截止日期 2月15日; date normalized to ISO UTC" },
}));

const common = (sourceId: string, value: any) => ({
  schoolSlug,
  status: "draft" as const,
  providerLocation: "Dalian, China",
  targetCountries: [],
  targetRegions: [],
  ...meta(sourceId),
  actionLinks: [
    { label: value.title, url: (byId.get(sourceId) as any).finalUrl, kind: "official-source" },
    { label: "DUT international application system", url: "https://iso.dlut.edu.cn", kind: "official-application" },
  ],
  sourceFieldLineage: {
    title: "official page title",
    fundingLevel: "official funding section",
    coverage: "official funding section",
    applicableDegree: "official target category or qualifications section",
    eligibilityItems: "official qualifications section",
    applicationMaterials: "official application materials section",
    applicationSteps: "official application process section",
  },
  ...value,
});

const scholarships = [
  common("dut-cgs-type-a-scholarship-2026", {
    slug: "official-2026-dut-cgs-type-a-bilateral",
    title: "DUT 2026 Chinese Government Scholarship Type A — Bilateral Program",
    nameZh: "大连理工大学2026年度中国政府奖学金国别双边项目（Type A）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type A",
    providerName: "Ministry of Education of the PRC / China Scholarship Council",
    providerNameEn: "Ministry of Education of the PRC / China Scholarship Council",
    fundingLevel: "Full or partial according to the bilateral award",
    coverage: "The DUT notice refers applicants to the current Chinese Government Scholarship rules; the exact component package is determined by the bilateral award.",
    applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar",
    applicableProgram: "Programs accepted under the applicant's bilateral dispatch route",
    amountText: "Not separately restated by DUT",
    deadlineLabel: "Early November to early April; exact date set by the home-country dispatching authority",
    applicationRound: "2026 Chinese Government Scholarship Type A",
    benefitItems: [{ label: "Bilateral award package", included: true, note: "Full or partial; confirm the dispatch notice" }],
    eligibilityItems: [{ label: "Nationality and health", value: "Non-Chinese citizen in good health" }, { label: "Bachelor", value: "High-school diploma and age 25 or under" }, { label: "Master", value: "Bachelor's degree and age 35 or under" }, { label: "Doctoral", value: "Master's degree and age 40 or under" }, { label: "Chinese-medium", value: "HSK 4 ≥ 180 for science, engineering, economics and management; HSK 5 ≥ 180 for humanities, social sciences and philosophy" }],
    applicationMaterials: [{ label: "Chinese Government Scholarship application form" }, { label: "Passport information page" }, { label: "Notarized highest diploma" }, { label: "Academic transcripts" }, { label: "Study or research plan" }, { label: "Two recommendation letters for graduate and senior-scholar applicants" }, { label: "Physical examination and blood-test reports where required" }, { label: "No-criminal-record certificate" }, { label: "Language proficiency evidence" }],
    applicationSteps: [{ label: "Step 1", value: "Apply through the dispatching authority in the applicant's home country" }, { label: "Step 2", value: "Obtain recommendation eligibility and request DUT pre-admission when required" }, { label: "Step 3", value: "Complete the CSC application required by the dispatching authority" }, { label: "Step 4", value: "Submit all materials to the dispatching authority before its deadline" }],
    bodySections: [{ title: "Route limitation", body: "DUT cannot directly accept a Type A bilateral application; the home-country dispatching authority controls nomination and deadline." }],
    summary: "DUT's 2026 country-dispatched Chinese Government Scholarship Type A route.", sortOrder: 10,
  }),
  common("dut-china-link-scholarship-2026", {
    slug: "official-2026-dut-china-link",
    title: "DUT 2026 Chinese Government Scholarship — China Link Program",
    nameZh: "大连理工大学2026年中国政府奖学金短期来华科研交流项目",
    type: "government", typeLabel: "China Link Scholarship", providerName: "China Scholarship Council / Dalian University of Technology", providerNameEn: "China Scholarship Council / Dalian University of Technology",
    fundingLevel: "Chinese Government Scholarship standard for the approved scholar category",
    coverage: "Funding follows the current Chinese Government Scholarship standard for general or senior scholars; DUT does not restate component amounts on this notice.",
    applicableDegree: "General Scholar, Senior Scholar", applicableProgram: "Research fields other than Chinese language", amountText: "Current CSC scholar-category standard", deadlineLabel: "Nomination must be submitted at least three months before the proposed start; study must begin no later than August 31, 2027", applicationRound: "2026 China Link Program",
    benefitItems: [{ label: "CSC scholar-category support", included: true, note: "At the current general- or senior-scholar standard" }],
    eligibilityItems: [{ label: "General scholar", value: "Full-time bachelor or master's student at a CSC overseas partner institution; age 45 or under" }, { label: "Senior scholar", value: "Full-time doctoral student or staff member at a CSC overseas partner institution; age 50 or under" }, { label: "Nationality and health", value: "Non-Chinese citizen in good physical and mental health" }, { label: "Duration", value: "1–12 months" }],
    applicationMaterials: [{ label: "Candidate nomination list submitted by the recommending DUT unit" }, { label: "Stamped PDF and editable spreadsheet versions of the nomination list" }],
    applicationSteps: [{ label: "Step 1", value: "Confirm eligibility through a CSC overseas partner institution and a recommending DUT unit" }, { label: "Step 2", value: "The DUT unit reviews and nominates the candidate" }, { label: "Step 3", value: "Submit the nomination at least three months before the planned start" }, { label: "Step 4", value: "Complete the CSC Type B process after nomination" }],
    bodySections: [{ title: "Study format", body: "One to twelve months of Chinese- or English-medium research exchange in any field except Chinese language." }], summary: "DUT's 2026 China Link short-term research exchange scholarship route.", sortOrder: 20,
  }),
  common("dut-youth-of-excellence-scholarship-2026", {
    slug: "official-2026-dut-youth-of-excellence",
    title: "DUT 2026 Youth of Excellence Scheme of China",
    nameZh: "大连理工大学2026学年中国政府来华留学卓越奖学金",
    type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "China Scholarship Council / Dalian University of Technology", providerNameEn: "China Scholarship Council / Dalian University of Technology",
    fundingLevel: "Full", coverage: "The official DUT notice states full scholarship funding for a two-year 1+1 master's structure but does not separately list component amounts.", applicableDegree: "Master", applicableProgram: "Mechanical Engineering; Software Engineering; Materials Science and Engineering", amountText: "Full scholarship; component amounts not separately published", deadlineLabel: "DUT pre-admission: February 15, 2026; CSC application: March 31, 2026", applicationRound: "2026 Youth of Excellence Scheme of China",
    benefitItems: [{ label: "Full scholarship", included: true }, { label: "Two-year 1+1 study structure", included: true, note: "First year at DUT; second year in the home country with return for thesis defense as required" }],
    eligibilityItems: [{ label: "Age and degree", value: "Age 45 or under with bachelor's degree or above" }, { label: "Experience", value: "At least three years of work experience" }, { label: "Professional profile", value: "Eligible government official, senior manager, university/research administrator, or applicant with international-organization experience" }, { label: "English", value: "IELTS ≥ 5.5, TOEFL ≥ 80, Duolingo ≥ 100, or proof that the previous degree was taught in English" }],
    applicationMaterials: [{ label: "Passport copy valid for more than one year" }, { label: "Bachelor's diploma and transcripts with required translation/notarization" }, { label: "English study or research plan of at least 1,000 words" }, { label: "Two recommendation letters" }, { label: "Employment certificate" }, { label: "English proficiency evidence" }, { label: "Physical examination and blood-test reports" }, { label: "No-criminal-record certificate" }, { label: "DUT pre-admission letter" }],
    applicationSteps: [{ label: "Step 1", value: "Apply in DUT's system by February 15, 2026" }, { label: "Step 2", value: "Obtain DUT pre-admission" }, { label: "Step 3", value: "Submit the CSC Type A application by March 31, 2026 using agency code 1563" }],
    bodySections: [{ title: "Published routes", body: "Three English-taught master's routes: Mechanical Engineering, Software Engineering, and Materials Science and Engineering." }], summary: "DUT's 2026 full Youth of Excellence scholarship for three named English-taught master's routes.", sortOrder: 30,
  }),
  common("dut-presidential-scholarship-2026", {
    slug: "official-2026-dut-presidential-scholarship",
    title: "DUT 2026 International Students Presidential Scholarship",
    nameZh: "大连理工大学2026年国际学生校长奖学金",
    type: "university", typeLabel: "DUT Presidential Scholarship", providerName: "Dalian University of Technology", providerNameEn: "Dalian University of Technology",
    fundingLevel: "Full or partial", coverage: "Full award waives tuition, provides on-campus accommodation and a monthly allowance of CNY 1,500 for master's or CNY 1,800 for doctoral students. Partial award waives tuition only.", applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "Eligible 2026 DUT international degree programs", amountText: "Master CNY 1,500/month; Doctoral CNY 1,800/month; partial award: tuition waiver", deadlineLabel: "Master and Doctoral: February 15, 2026; Bachelor: June 30, 2026", applicationRound: "2026 DUT Presidential Scholarship",
    benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus accommodation", included: true, note: "Full award" }, { label: "Monthly allowance", included: true, note: "Full award: CNY 1,500 master; CNY 1,800 doctoral" }, { label: "International travel", included: false, note: "Self-funded" }],
    eligibilityItems: [{ label: "Bachelor", value: "New applicant with high-school diploma, excellent academic achievement and age under 25" }, { label: "Master", value: "New applicant with bachelor's degree, excellent academic achievement and age under 35" }, { label: "Doctoral", value: "New applicant with master's degree, excellent academic achievement and age under 40" }, { label: "Language", value: "Chinese routes: HSK 4 ≥ 180 for science/engineering/economics/management or HSK 5 ≥ 180 for humanities/foreign languages; English routes: TOEFL ≥ 80, IELTS ≥ 5.5 or Duolingo ≥ 100, subject to published exemptions" }],
    applicationMaterials: [{ label: "DUT online application form" }, { label: "DUT Presidential Scholarship application form" }, { label: "Notarized highest diploma and transcripts" }, { label: "Language proficiency evidence" }, { label: "Study plan or research proposal" }, { label: "Recommendation letter(s) appropriate to degree level" }, { label: "Physical examination and blood-test reports" }, { label: "Passport pages" }, { label: "No-criminal-record certificate" }],
    applicationSteps: [{ label: "Step 1", value: "Submit the DUT online application and select Scholarship" }, { label: "Step 2", value: "Upload the Presidential Scholarship application form and degree-specific materials" }, { label: "Step 3", value: "Confirm that the DUT system generated an application number" }, { label: "Step 4", value: "Await university review and award decision" }],
    bodySections: [{ title: "Award variants", body: "Full and partial awards are distinct. A full award adds accommodation and the published graduate allowance; a partial award waives tuition only." }], summary: "DUT's 2026 university-funded Presidential Scholarship for eligible new degree students.", sortOrder: 40,
  }),
];

const bundle: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, schools: [school], programs, programIntakes, scholarships };
const report = createCatalogMigrationValidationReport(bundle);
if (!report.ok || programs.length !== 3 || programIntakes.length !== 3 || scholarships.length !== 4) throw new Error(`Invalid DUT safe-new candidate: ${report.errors.join(" ")}`);
const draftPath = resolve(root, "seeds/catalog.dut-safe-new-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.dut-safe-new-batch-01.validation.json");
const body = `${JSON.stringify(bundle, null, 2)}\n`;
await writeFile(draftPath, body);
await writeFile(validationPath, `${JSON.stringify({ ...report, candidateSha256: createHash("sha256").update(body).digest("hex"), sourceManifestSha256: createHash("sha256").update(manifestText).digest("hex") }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, draftPath, validationPath, counts: report.summary, bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
