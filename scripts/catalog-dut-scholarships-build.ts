import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const schoolBundlePath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/dut-complete-batch-01/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.dut-scholarships-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.dut-scholarships-batch-01.validation.json");
const [schoolBundleText, manifestText] = await Promise.all([readFile(schoolBundlePath, "utf8"), readFile(manifestPath, "utf8")]);
const schoolBundle = JSON.parse(schoolBundleText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { id: string; label: string; url: string; sha256: string; status: number }[] };
const school = schoolBundle.schools.find((row) => row.slug === "dalian-university-of-technology");
if (!school) throw new Error("Missing DUT school identity draft");
const evidence = (id: string) => {
  const row = manifest.sources.find((source) => source.id === id && source.status === 200);
  if (!row) throw new Error(`Missing successful DUT evidence: ${id}`);
  return row;
};
const common = (id: string) => {
  const row = evidence(id);
  return {
    schoolSlug: school.slug,
    status: "draft",
    sourceUrl: row.url,
    sourceLabel: row.label,
    sourceSha256: row.sha256,
    capturedAt: manifest.generatedAt,
    providerLocation: "China",
    targetCountries: [],
    targetRegions: [],
    actionLinks: [{ label: row.label, url: row.url, kind: "official-source" }],
  };
};
const lineage = {
  title: "explicit: official notice title",
  fundingLevel: "explicit: scholarship coverage section",
  coverage: "explicit: scholarship coverage section",
  applicableDegree: "explicit: funded study category or project section",
  applicableProgram: "explicit: funded program section",
  eligibilityItems: "explicit: eligibility section",
  applicationMaterials: "explicit: application documents section",
  applicationSteps: "explicit: application procedure section",
  deadlineDate: "explicit: official application-time section where a fixed school deadline is stated",
};
const scholarships = [
  {
    ...common("dut-chinese-government-scholarship-2026"),
    slug: "official-2026-dut-cgs-high-level-and-silk-road",
    title: "DUT 2026 Chinese Government Scholarship — High-Level Postgraduate and Silk Road Programs",
    nameZh: "大连理工大学2026年度中国政府奖学金高水平研究生和丝绸之路项目",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B",
    providerName: "国家留学基金管理委员会 / 大连理工大学",
    providerNameEn: "China Scholarship Council / Dalian University of Technology",
    fundingLevel: "Full",
    coverage: "Tuition waiver, on-campus accommodation, monthly stipend and comprehensive medical insurance",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "Eligible DUT master's and doctoral programs; the official route includes High-Level Postgraduate and Silk Road categories",
    amountText: "CNY 3,000/month for master's students and CNY 3,500/month for doctoral students, plus tuition, accommodation and medical insurance.",
    deadlineDate: "2026-02-15",
    deadlineLabel: "November 1, 2025 - February 15, 2026",
    applicationRound: "2026 High-Level Postgraduate and Silk Road Programs",
    benefitItems: [
      { label: "Tuition waiver", included: true },
      { label: "On-campus accommodation", included: true },
      { label: "Master stipend: CNY 3,000/month", included: true },
      { label: "Doctoral stipend: CNY 3,500/month", included: true },
      { label: "Comprehensive medical insurance", included: true },
    ],
    eligibilityItems: [
      { label: "Nationality and health", value: "Non-Chinese citizen in good health" },
      { label: "Master", value: "Bachelor's degree and under 35" },
      { label: "Doctoral", value: "Master's degree and under 40" },
    ],
    applicationMaterials: [
      { label: "CSC online application and signed form" },
      { label: "DUT online application" },
      { label: "Highest diploma and transcripts" },
      { label: "Language certificate and study plan" },
      { label: "Recommendation letters and required health/security documents" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Apply in the CSC system as Type B using DUT agency number 10141" },
      { label: "Step 2", value: "Apply in the DUT international-student system" },
      { label: "Step 3", value: "Submit the required documents before the published deadline" },
    ],
    sourceFieldLineage: lineage,
    summary: "DUT's full 2026 Chinese Government Scholarship route for eligible master's and doctoral applicants.",
    sortOrder: 10,
  },
  {
    ...common("dut-cgs-type-a-scholarship-2026"),
    slug: "official-2026-dut-cgs-type-a-bilateral",
    title: "DUT 2026 Chinese Government Scholarship — Type A Bilateral Program",
    nameZh: "大连理工大学2026年度中国政府奖学金国别双边项目（Type A）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type A",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会",
    providerNameEn: "Ministry of Education of the PRC / China Scholarship Council",
    fundingLevel: "Full or partial",
    coverage: "Full or partial scholarship under the applicable bilateral agreement and CSC award decision",
    applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar",
    applicableProgram: "DUT programs permitted by the applicant's home-country dispatching authority and the bilateral route",
    amountText: "Coverage follows the applicable bilateral agreement and CSC award; the DUT notice does not publish one universal amount.",
    deadlineLabel: "Usually early November to early April; exact deadline is set by the home-country dispatching authority",
    applicationRound: "2026 Type A Bilateral Program",
    benefitItems: [{ label: "Full or partial CSC funding according to the bilateral agreement", included: true }],
    eligibilityItems: [
      { label: "Nationality and health", value: "Non-Chinese citizen in good health" },
      { label: "Bachelor", value: "High-school diploma and under 25" },
      { label: "Master", value: "Bachelor's degree and under 35" },
      { label: "Doctoral", value: "Master's degree and under 40" },
    ],
    applicationMaterials: [
      { label: "CSC application form and passport page" },
      { label: "Highest diploma and complete transcripts" },
      { label: "Study or research plan and degree-appropriate recommendations" },
      { label: "Language, health and non-criminal-record documents" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Apply to the dispatching authority in the applicant's home country" },
      { label: "Step 2", value: "Request a DUT pre-admission letter through the DUT system and official admissions email when required" },
      { label: "Step 3", value: "Submit the CSC Type A application using the authority's agency number" },
    ],
    sourceFieldLineage: { ...lineage, deadlineDate: undefined, deadlineLabel: "explicit: official application range and dispatching-authority dependency" },
    summary: "DUT's 2026 bilateral CSC route administered through the applicant's home-country dispatching authority.",
    sortOrder: 20,
  },
  {
    ...common("dut-china-link-scholarship-2026"),
    slug: "official-2026-dut-cgs-china-link",
    title: "DUT 2026 Chinese Government Scholarship — China Link Program",
    nameZh: "大连理工大学2026年中国政府奖学金短期来华科研交流项目",
    type: "government",
    typeLabel: "China Link Scholarship",
    providerName: "国家留学基金管理委员会 / 大连理工大学",
    providerNameEn: "China Scholarship Council / Dalian University of Technology",
    fundingLevel: "Full under the applicable CSC visiting-student standard",
    coverage: "Funding follows the current CSC standard for general or senior visiting scholars",
    applicableDegree: "General Scholar, Senior Scholar",
    applicableProgram: "One- to twelve-month research exchange in fields other than Chinese language",
    amountText: "Funding follows the current CSC visiting-student standard; the DUT notice does not restate fixed amounts.",
    deadlineLabel: "Nomination must be submitted at least three months before the proposed start; start no later than August 31, 2027",
    applicationRound: "2026 China Link Program",
    benefitItems: [{ label: "CSC visiting-student funding under the applicable standard", included: true }],
    eligibilityItems: [
      { label: "General scholar", value: "Full-time undergraduate or master's student at a CSC overseas partner institution; under 45" },
      { label: "Senior scholar", value: "Doctoral student or staff member at a CSC overseas partner institution; under 50" },
    ],
    applicationMaterials: [{ label: "Institutional candidate list in Excel and stamped PDF form" }],
    applicationSteps: [
      { label: "Step 1", value: "The eligible overseas partner institution reviews and nominates candidates" },
      { label: "Step 2", value: "The institution submits the candidate list to DUT at least three months before study begins" },
      { label: "Step 3", value: "The application proceeds through the CSC Type B system" },
    ],
    sourceFieldLineage: { ...lineage, deadlineDate: undefined, deadlineLabel: "explicit: rolling three-month lead time and latest start date" },
    summary: "DUT's 2026 China Link short-term research-exchange scholarship for eligible partner-institution students and staff.",
    sortOrder: 30,
  },
  {
    ...common("dut-youth-of-excellence-scholarship-2026"),
    slug: "official-2026-dut-youth-of-excellence",
    title: "DUT 2026 Youth of Excellence Scheme of China",
    nameZh: "大连理工大学2026学年中国政府来华留学卓越奖学金项目",
    type: "government",
    typeLabel: "Youth of Excellence Scheme of China",
    providerName: "国家留学基金管理委员会 / 大连理工大学",
    providerNameEn: "China Scholarship Council / Dalian University of Technology",
    fundingLevel: "Full",
    coverage: "Full Chinese Government Scholarship for a two-year 1+1 master's route",
    applicableDegree: "Master",
    applicableProgram: "Mechanical Engineering, Software Engineering, or Materials Science and Engineering, taught in English",
    amountText: "Full scholarship; the DUT notice does not restate fixed stipend amounts.",
    deadlineDate: "2026-02-15",
    deadlineLabel: "DUT application by February 15, 2026; CSC application by March 31, 2026",
    applicationRound: "2026 Youth of Excellence Scheme",
    benefitItems: [{ label: "Full Chinese Government Scholarship", included: true }],
    eligibilityItems: [
      { label: "Age and degree", value: "Bachelor's degree or above and under 45" },
      { label: "Experience", value: "At least three years of work experience and membership in an eligible leadership or professional category" },
      { label: "English", value: "IELTS 5.5, TOEFL 80, Duolingo 100, equivalent English-medium proof, or applicable exemption" },
    ],
    applicationMaterials: [
      { label: "Passport, bachelor's diploma and transcripts" },
      { label: "English study plan and two recommendations" },
      { label: "Employment, language, health and non-criminal-record documents" },
      { label: "DUT pre-admission letter for the CSC application" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Apply in DUT's system by February 15 and send the application number as instructed" },
      { label: "Step 2", value: "Obtain DUT pre-admission" },
      { label: "Step 3", value: "Apply in the CSC system as Type A by March 31 using agency number 1563" },
    ],
    sourceFieldLineage: lineage,
    summary: "DUT's full 2026 two-year 1+1 English-taught master's scholarship for experienced global-governance candidates.",
    sortOrder: 40,
  },
  {
    ...common("dut-presidential-scholarship-2026"),
    slug: "official-2026-dut-international-students-presidential-scholarship",
    title: "DUT 2026 International Students Presidential Scholarship",
    nameZh: "大连理工大学2026年国际学生校长奖学金",
    type: "university",
    typeLabel: "DUT Presidential Scholarship",
    providerName: "大连理工大学",
    providerNameEn: "Dalian University of Technology",
    fundingLevel: "Full or partial",
    coverage: "Full award: tuition waiver, on-campus accommodation and degree-level monthly stipend; partial award: tuition waiver",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Eligible new DUT degree students",
    amountText: "Full award includes tuition and accommodation plus CNY 1,500/month for master's students or CNY 1,800/month for doctoral students; partial award waives tuition. The page does not state a bachelor's stipend.",
    deadlineLabel: "Graduate applicants: November 1, 2025 - February 15, 2026; bachelor applicants: November 1, 2025 - June 30, 2026",
    applicationRound: "2026 DUT Presidential Scholarship",
    benefitItems: [
      { label: "Full award tuition waiver", included: true },
      { label: "Full award on-campus accommodation", included: true },
      { label: "Master stipend: CNY 1,500/month", included: true },
      { label: "Doctoral stipend: CNY 1,800/month", included: true },
      { label: "Partial award tuition waiver", included: true },
    ],
    eligibilityItems: [
      { label: "Bachelor", value: "New student with high-school diploma, excellent achievement and under 25" },
      { label: "Master", value: "New student with bachelor's degree and excellent achievement; under 35" },
      { label: "Doctoral", value: "New student with master's degree and excellent achievement; under 40" },
    ],
    applicationMaterials: [
      { label: "DUT online application and presidential-scholarship application form" },
      { label: "Highest diploma and academic transcripts" },
      { label: "Degree-appropriate language, study-plan, recommendation and health/security documents" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Complete the DUT international-student online application" },
      { label: "Step 2", value: "Upload the presidential-scholarship form and all required evidence" },
      { label: "Step 3", value: "Complete DUT review before the degree-specific deadline" },
    ],
    sourceFieldLineage: { ...lineage, deadlineDate: undefined, deadlineLabel: "explicit: two degree-specific fixed application windows" },
    summary: "DUT's 2026 university-funded full or tuition-only scholarship for new bachelor's, master's and doctoral students.",
    sortOrder: 50,
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.scholarships !== 5) throw new Error(`DUT scholarship bundle invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Five distinct current DUT scholarship routes are structured only from hash-pinned official pages.",
      "Degree-specific or rolling deadline text is preserved without inventing a universal calendar date.",
      "Program-list attachments require an interactive image verification challenge and are not bypassed; program-catalog completion remains blocked on accessible official evidence.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
