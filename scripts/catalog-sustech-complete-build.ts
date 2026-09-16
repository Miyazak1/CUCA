import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const primaryPath = resolve(root, "work/catalog-official/sustech-complete-batch-01");
const apiPath = resolve(root, "work/catalog-official/sustech-complete-batch-01-api");
const primaryText = await readFile(resolve(primaryPath, "manifest.json"), "utf8");
const apiText = await readFile(resolve(apiPath, "manifest.json"), "utf8");
const primary = JSON.parse(primaryText);
const api = JSON.parse(apiText);
const sources = new Map([...primary.sources, ...api.sources].map((row: any) => [row.id, row]));
const requiredSourceIds = [
  "sustech-international-students-overview",
  "sustech-postgraduate-admission-guide-2026",
  "sustech-undergraduate-scholarships-api",
  "sustech-undergraduate-cost-api",
  ...api.sources.filter((row: any) => row.id.includes("-majors-")).map((row: any) => row.id),
];
for (const id of requiredSourceIds) {
  const source: any = sources.get(id);
  if (!source || source.status !== 200 || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Missing valid source: ${id}`);
}
const meta = (id: string) => {
  const source: any = sources.get(id);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const readSnapshot = async (basePath: string, id: string) => {
  const source: any = sources.get(id);
  return JSON.parse(await readFile(resolve(basePath, source.artifactPath), "utf8"));
};
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const schoolSlug = "southern-university-of-science-and-technology";
const applicationUrl = "https://sustech.at0086.cn/StuApplication/Login.aspx";

const departmentNames: Record<string, string> = {
  mathematics: "Department of Mathematics", physics: "Department of Physics", chemistry: "Department of Chemistry",
  biology: "Department of Biology", "statistics-data-science": "Department of Statistics and Data Science",
  "electrical-electronic-engineering": "Department of Electrical and Electronic Engineering",
  "materials-science-engineering": "Department of Materials Science and Engineering",
  "computer-science-engineering": "Department of Computer Science and Engineering",
  "environmental-science-engineering": "School of Environmental Science and Engineering",
  "mechanics-aerospace-engineering": "Department of Mechanics and Aerospace Engineering",
  "mechanical-energy-engineering": "Department of Mechanical and Energy Engineering",
  microelectronics: "School of Microelectronics", "biomedical-engineering": "Department of Biomedical Engineering",
  "ocean-science-engineering": "Department of Ocean Science and Engineering", "earth-space-sciences": "Department of Earth and Space Sciences",
  "system-design-intelligent-manufacturing": "School of System Design and Intelligent Manufacturing",
  "school-of-medicine": "School of Medicine", "information-systems-management-engineering": "Department of Information Systems and Management Engineering",
  finance: "School of Finance", "industrial-design": "School of Design",
};

const bachelorPrograms: any[] = [];
for (const source of api.sources.filter((row: any) => row.id.includes("-majors-") && !row.id.endsWith("no-degree-program-api"))) {
  const response = await readSnapshot(apiPath, source.id);
  if (!response.isSuccess || !Array.isArray(response.module)) throw new Error(`Invalid majors API response: ${source.id}`);
  const departmentKey = source.id.replace("sustech-undergraduate-majors-", "").replace("-api", "");
  for (const row of response.module) {
    const nameEn = String(row.zyywmc || "").trim().replace("lnformation", "Information");
    const nameZh = String(row.zymc || "").trim();
    if (!nameEn) throw new Error(`Missing English major name: ${source.id}`);
    bachelorPrograms.push({
      slug: `official-sustech-bachelor-${slugify(nameEn)}-${row.id.slice(0, 8)}`,
      schoolSlug, citySlug: "shenzhen", nameEn, nameZh, degreeLevel: "Bachelor", durationYears: 4,
      fieldCategory: departmentNames[departmentKey] ?? departmentKey, subjectArea: departmentNames[departmentKey] ?? departmentKey,
      teachingLanguage: "English", hskRequirement: "No HSK threshold is published on the official English-medium international route catalog.",
      englishRequirement: "Confirm the current undergraduate admission notice; the program catalog itself does not publish a test-score threshold.",
      cscaRequirement: "No CSCA requirement is published on the official SUSTech international undergraduate pages.",
      tuitionAmount: 30000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 30,000/year", displayTuition: "CNY 30,000/year",
      scholarshipText: "Eligible applicants are considered for SUSTech undergraduate scholarship routes according to the published scholarship rules.",
      applicationUrl, applicationNote: `Official international undergraduate catalog route; ${row.zwfjmc || "curriculum attachment not published"}. Admission deadline is not stated on this catalog page.`,
      hasScholarship: true, badgeText: "Official international route", displayGroup: "Bachelor", displayGroupLabel: "English-taught bachelor programs", status: "draft" as const,
      ...meta(source.id), sourceFieldLineage: { nameEn: "module[].zyywmc", nameZh: "module[].zymc", fieldCategory: `official department API chain: ${departmentKey}`, degreeLevel: "official page heading: Undergraduate Programs", teachingLanguage: "official international admissions overview", durationYears: "scholarship page states the entire four-year college program", tuitionText: "official undergraduate cost API" },
    });
  }
}

const graduateDefinitions = [
  ["070100", "Mathematics", true, false], ["070200", "Physics", true, true], ["070300", "Chemistry", true, false],
  ["070800", "Geophysics", true, true], ["071000", "Biology", true, true], ["080100", "Mechanics", true, true],
  ["0801Z1", "Intelligent Manufacturing and Robotics", true, true], ["080500", "Materials Science and Engineering", true, true],
  ["081100", "Control Science and Engineering", true, true], ["081200", "Computer Science and Technology", true, true],
  ["083000", "Environmental Science and Engineering", true, true], ["083100", "Biomedical Engineering", true, true],
  ["087300", "Integrated Circuits Science and Engineering", true, true], ["120100", "Management Science and Engineering", true, false],
] as const;
const graduatePrograms: any[] = [];
for (const [code, nameEn, doctoral, master] of graduateDefinitions) {
  for (const degreeLevel of [...(master ? ["Master"] : []), ...(doctoral ? ["Doctoral"] : [])]) {
    graduatePrograms.push({
      slug: `official-2026-sustech-${degreeLevel.toLowerCase()}-${code.toLowerCase()}-${slugify(nameEn)}`, schoolSlug, citySlug: "shenzhen",
      nameEn, nameZh: nameEn, degreeLevel, durationYears: degreeLevel === "Master" ? 3 : 4, fieldCategory: `Academic code ${code}`, subjectArea: nameEn,
      teachingLanguage: "English", hskRequirement: "No HSK requirement is published for this English-taught postgraduate route.",
      englishRequirement: "TOEFL 90 or IELTS 6.5 with no sub-score below 6.0; waiver possible for a degree taught solely in English with an official medium-of-instruction letter.",
      cscaRequirement: "No CSCA requirement is published for this postgraduate route.",
      tuitionText: "All admitted international postgraduates are evaluated for a comprehensive scholarship; a separate self-funded tuition rate is not stated in this guide.",
      scholarshipText: "CGS applicants must apply in the first round; other admitted international postgraduates are considered for the SUSTech First-Grade Scholarship.",
      applicationUrl, applicationNote: "Full-time English-taught 2026 postgraduate route. A potential supervisor and signed research plan are required.",
      hasScholarship: true, badgeText: "Official 2026 route", displayGroup: degreeLevel, displayGroupLabel: `English-taught ${degreeLevel.toLowerCase()} programs`, status: "draft" as const,
      ...meta("sustech-postgraduate-admission-guide-2026"), sourceFieldLineage: { nameEn: `Available Majors table, code ${code}`, degreeLevel: `Available Majors table, ${degreeLevel} marker`, teachingLanguage: "Our Postgraduate Programs: delivered entirely in English", durationYears: "Our Postgraduate Programs: standard duration", englishRequirement: "Eligibility Requirements", scholarshipText: "Funding & Scholarships" },
    });
  }
}
const graduateIntakes = graduatePrograms.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2025-11-03T00:00:00Z", deadlineDate: "2026-04-01T00:00:00Z",
  deadlineLabel: "Round 1: November 3, 2025–January 18, 2026; Round 2: February 16–April 1, 2026. CGS consideration requires Round 1.",
  applicationRound: "2026 SUSTech international postgraduate admission", status: "closed" as const,
  ...meta("sustech-postgraduate-admission-guide-2026"), sourceFieldLineage: { openDate: "Application Timeline & Deadlines, first-round opening", deadlineDate: "Application Timeline & Deadlines, second-round closing; normalized to ISO UTC", deadlineLabel: "Application Timeline & Deadlines" },
}));

const scholarship = (sourceId: string, value: Omit<CatalogSeedScholarship, "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt" | "schoolSlug" | "status">): CatalogSeedScholarship => ({
  schoolSlug, status: "draft", providerLocation: "Shenzhen, China", targetCountries: [], targetRegions: [],
  ...meta(sourceId), actionLinks: [{ label: "Official scholarship information", url: meta(sourceId).sourceUrl, kind: "official-source" }, { label: "SUSTech application portal", url: applicationUrl, kind: "official-application" }],
  sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official benefits section", coverage: "official benefits section", applicableDegree: "official degree scope", eligibilityItems: "official eligibility and policy text", applicationMaterials: "official admission materials or no-separate-application statement", applicationSteps: "official application process" },
  ...value,
});
const ugMaterials = [{ label: "Undergraduate admission application", value: "No separate scholarship application is required for automatic-consideration routes." }];
const ugEligibility = [{ label: "Degree", value: "Undergraduate admissions only" }, { label: "Assessment", value: "Pass the online test and interview" }, { label: "Test-waiver restriction", value: "Applicants who waive the online test using an international standard test are not eligible for the President or Tuition Waiver scholarships." }];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("sustech-undergraduate-scholarships-api", { slug: "official-sustech-undergraduate-president-scholarship", title: "SUSTech President Scholarship for International Undergraduates", nameZh: "南方科技大学国际本科生校长奖学金", type: "university", typeLabel: "President Scholarship", providerName: "Southern University of Science and Technology", providerNameEn: "Southern University of Science and Technology", fundingLevel: "Full", coverage: "Tuition, dormitory, insurance and living expenses for the four-year program, subject to continuing good academic standing and semester review.", applicableDegree: "Bachelor", applicableProgram: "SUSTech international undergraduate programs", amountText: "CNY 68,000/year", deadlineLabel: "Not separately published; automatic consideration with admission", applicationRound: "International undergraduate admission", benefitItems: [{ label: "Tuition", included: true }, { label: "Dormitory", included: true }, { label: "Insurance", included: true }, { label: "Living expenses", included: true }], eligibilityItems: ugEligibility, applicationMaterials: ugMaterials, applicationSteps: [{ label: "Step 1", value: "Apply for international undergraduate admission" }, { label: "Step 2", value: "Pass the online test and interview" }, { label: "Step 3", value: "Receive the scholarship decision with the offer; no separate application" }], bodySections: [{ title: "Renewal", body: "From the second year, funding is awarded semester by semester when renewal requirements are met." }], summary: "Full SUSTech undergraduate award worth CNY 68,000 per year.", sortOrder: 10 }),
  scholarship("sustech-undergraduate-scholarships-api", { slug: "official-sustech-undergraduate-tuition-waiver-scholarship", title: "SUSTech Tuition Waiver Scholarship for International Undergraduates", nameZh: "南方科技大学国际本科生学费减免奖学金", type: "university", typeLabel: "Tuition Waiver Scholarship", providerName: "Southern University of Science and Technology", providerNameEn: "Southern University of Science and Technology", fundingLevel: "Partial", coverage: "Annual undergraduate tuition funding.", applicableDegree: "Bachelor", applicableProgram: "SUSTech international undergraduate programs", amountText: "CNY 30,000/year", deadlineLabel: "Not separately published; automatic consideration with admission", applicationRound: "International undergraduate admission", benefitItems: [{ label: "Tuition funding", included: true, note: "CNY 30,000/year" }], eligibilityItems: ugEligibility, applicationMaterials: ugMaterials, applicationSteps: [{ label: "Step 1", value: "Apply for international undergraduate admission" }, { label: "Step 2", value: "Pass the online test and interview" }, { label: "Step 3", value: "Receive the award decision with the offer; no separate application" }], summary: "SUSTech undergraduate tuition award of CNY 30,000 per year.", sortOrder: 20 }),
  scholarship("sustech-undergraduate-scholarships-api", { slug: "official-sustech-undergraduate-chinese-government-scholarship", title: "Chinese Government Scholarship at SUSTech — Undergraduate Route", nameZh: "南方科技大学中国政府奖学金本科生项目", type: "government", typeLabel: "Chinese Government Scholarship", providerName: "Chinese Government / Southern University of Science and Technology", providerNameEn: "Chinese Government / Southern University of Science and Technology", fundingLevel: "Full", coverage: "Tuition CNY 30,000/year, monthly stipend CNY 2,500, housing CNY 7,200/year and insurance CNY 800/year.", applicableDegree: "Bachelor", applicableProgram: "SUSTech international undergraduate programs", amountText: "Tuition CNY 30,000/year; stipend CNY 2,500/month; housing CNY 7,200/year; insurance CNY 800/year", deadlineLabel: "Set by the applicant's local Chinese embassy", applicationRound: "Chinese Government Scholarship", benefitItems: [{ label: "Tuition", included: true, note: "CNY 30,000/year" }, { label: "Monthly stipend", included: true, note: "CNY 2,500/month" }, { label: "Housing", included: true, note: "CNY 7,200/year" }, { label: "Insurance", included: true, note: "CNY 800/year" }], eligibilityItems: [{ label: "Route", value: "International undergraduate study at SUSTech" }], applicationMaterials: [{ label: "SUSTech admission offer", value: "SUSTech recommends obtaining its offer before the scholarship application." }, { label: "Embassy-required materials", value: "Follow the local Chinese embassy's current requirements." }], applicationSteps: [{ label: "Step 1", value: "Obtain a SUSTech offer" }, { label: "Step 2", value: "Apply through the local Chinese embassy" }], summary: "Officially published CGS support package for SUSTech undergraduates.", sortOrder: 30 }),
  scholarship("sustech-undergraduate-scholarships-api", { slug: "official-sustech-undergraduate-guangdong-provincial-scholarship", title: "Guangdong Provincial Excellent International Student Scholarship at SUSTech — Undergraduate", nameZh: "广东省优秀来华留学生奖学金（南方科技大学本科生）", type: "government", typeLabel: "Guangdong Provincial Scholarship", providerName: "Guangdong Provincial Government / Southern University of Science and Technology", providerNameEn: "Guangdong Provincial Government / Southern University of Science and Technology", fundingLevel: "Partial", coverage: "One-year award; tuition and accommodation are paid first and reimbursed after the award process.", applicableDegree: "Bachelor", applicableProgram: "SUSTech international undergraduate programs", amountText: "CNY 10,000 for one year", deadlineLabel: "Not separately published; first-year students are considered by default", applicationRound: "First-year international undergraduate admission", benefitItems: [{ label: "One-year award", included: true, note: "CNY 10,000" }], eligibilityItems: [{ label: "Year", value: "First-year students are included in the candidate list by default" }], applicationMaterials: ugMaterials, applicationSteps: [{ label: "Step 1", value: "Receive the SUSTech offer" }, { label: "Step 2", value: "Pay tuition and accommodation first" }, { label: "Step 3", value: "Await university award details and reimbursement" }], summary: "One-year Guangdong award of CNY 10,000 for SUSTech international undergraduates.", sortOrder: 40 }),
  scholarship("sustech-postgraduate-admission-guide-2026", { slug: "official-2026-sustech-cgs-high-level-postgraduate", title: "SUSTech 2026 Chinese Government Scholarship — High-Level Postgraduate Program", nameZh: "南方科技大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "China Scholarship Council / Southern University of Science and Technology", providerNameEn: "China Scholarship Council / Southern University of Science and Technology", fundingLevel: "Full", coverage: "Full tuition and shared-room accommodation waiver, medical insurance, monthly living stipend and research allowance.", applicableDegree: "Master, Doctoral", applicableProgram: "Published 2026 SUSTech international postgraduate majors", amountText: "Living stipend: CNY 3,000/month master, CNY 3,500/month doctoral; research allowance: CNY 2,500/month master, CNY 4,550 pre-proposal or CNY 5,500 post-proposal doctoral (pre-tax)", deadlineDate: "2026-01-18", deadlineLabel: "Apply in Round 1 by January 18, 2026", applicationRound: "2026 Round 1", benefitItems: [{ label: "Full tuition waiver", included: true }, { label: "Shared-room accommodation waiver", included: true }, { label: "Medical insurance", included: true }, { label: "Living stipend", included: true, note: "CNY 3,000 master; CNY 3,500 doctoral per month" }, { label: "Research allowance", included: true, note: "CNY 2,500 master; doctoral CNY 4,550 pre-proposal or CNY 5,500 post-proposal per month, pre-tax" }], eligibilityItems: [{ label: "Citizenship", value: "Non-Chinese citizen with a valid foreign passport" }, { label: "Master", value: "Bachelor's degree or equivalent; under age 35" }, { label: "Doctoral", value: "Master's degree or equivalent; under age 40" }, { label: "English", value: "TOEFL 90 or IELTS 6.5 with no sub-score below 6.0, subject to the published waiver" }], applicationMaterials: [{ label: "Passport information page" }, { label: "Physical examination form" }, { label: "Non-criminal record certificate" }, { label: "Degree certificates and transcripts" }, { label: "English proficiency proof" }, { label: "Supervisor-signed research plan" }, { label: "Two recommendation letters" }, { label: "CV or resume" }], applicationSteps: [{ label: "Step 1", value: "Apply in SUSTech's portal in Round 1 and select CGS" }, { label: "Step 2", value: "Complete departmental review and assessment" }, { label: "Step 3", value: "If selected, obtain SUSTech pre-admission and complete CSC Type B using agency code 14325" }, { label: "Step 4", value: "Await CSC's final decision" }], bodySections: [{ title: "Renewal and exclusivity", body: "Up to three years for master and four years for doctoral study, subject to annual review. CGS cannot be held concurrently with another Chinese government or university scholarship." }], summary: "SUSTech's full 2026 CGS Type B route for international postgraduate applicants.", sortOrder: 50 }),
  scholarship("sustech-postgraduate-admission-guide-2026", { slug: "official-2026-sustech-first-grade-postgraduate-scholarship", title: "SUSTech 2026 First-Grade Scholarship for International Postgraduates", nameZh: "南方科技大学2026年国际研究生一等奖学金", type: "university", typeLabel: "SUSTech First-Grade Scholarship", providerName: "Southern University of Science and Technology", providerNameEn: "Southern University of Science and Technology", fundingLevel: "Full", coverage: "Full tuition and shared-room accommodation waiver, medical insurance and research allowance.", applicableDegree: "Master, Doctoral", applicableProgram: "Published 2026 SUSTech international postgraduate majors", amountText: "Research allowance: CNY 2,500/month master; CNY 4,550/month doctoral pre-proposal and CNY 5,500/month post-proposal, pre-tax", deadlineDate: "2026-04-01", deadlineLabel: "Final postgraduate admission deadline: April 1, 2026; no additional scholarship application", applicationRound: "2026 international postgraduate admission", benefitItems: [{ label: "Full tuition waiver", included: true }, { label: "Shared-room accommodation waiver", included: true }, { label: "Medical insurance", included: true }, { label: "Research allowance", included: true, note: "CNY 2,500 master; doctoral CNY 4,550 pre-proposal or CNY 5,500 post-proposal per month, pre-tax" }], eligibilityItems: [{ label: "Award population", value: "All admitted international postgraduates not awarded CGS are considered" }, { label: "Renewal", value: "Annual review of academic performance and conduct" }], applicationMaterials: [{ label: "Postgraduate admission materials", value: "No additional scholarship application is required." }], applicationSteps: [{ label: "Step 1", value: "Apply for a 2026 international postgraduate program" }, { label: "Step 2", value: "Complete academic review and assessment" }, { label: "Step 3", value: "Automatic scholarship evaluation if not awarded CGS" }], summary: "SUSTech's comprehensive university scholarship for other admitted international postgraduates.", sortOrder: 60 }),
  scholarship("sustech-postgraduate-admission-guide-2026", { slug: "official-2026-sustech-guangdong-provincial-postgraduate-scholarship", title: "Guangdong Provincial Scholarship for Outstanding International Students at SUSTech — Postgraduate", nameZh: "广东省优秀来华留学生奖学金（南方科技大学研究生）", type: "government", typeLabel: "Guangdong Provincial Scholarship", providerName: "Guangdong Provincial Government / Southern University of Science and Technology", providerNameEn: "Guangdong Provincial Government / Southern University of Science and Technology", fundingLevel: "Supplementary", coverage: "One-time supplementary award for the first academic year; may be renewed upon annual application and performance.", applicableDegree: "Master, Doctoral", applicableProgram: "Newly enrolled SUSTech international postgraduate programs", amountText: "CNY 20,000 master; CNY 30,000 doctoral", deadlineDate: "2026-04-01", deadlineLabel: "No separate application; admission closes April 1, 2026", applicationRound: "2026 international postgraduate admission", benefitItems: [{ label: "Master award", included: true, note: "CNY 20,000 one time" }, { label: "Doctoral award", included: true, note: "CNY 30,000 one time" }], eligibilityItems: [{ label: "Enrollment", value: "Newly enrolled master or doctoral student" }, { label: "Exclusion", value: "Not receiving the Chinese Government Scholarship" }, { label: "Selection", value: "Academic merit aligned with admission criteria" }], applicationMaterials: [{ label: "Postgraduate admission application", value: "No separate scholarship application is needed for the first-year award." }], applicationSteps: [{ label: "Step 1", value: "Apply for postgraduate admission" }, { label: "Step 2", value: "Complete merit evaluation" }, { label: "Step 3", value: "Receive the one-time award decision" }], summary: "Supplementary Guangdong award for newly enrolled SUSTech international postgraduates.", sortOrder: 70 }),
];

const schoolSource = meta("sustech-international-students-overview");
const bundle: CatalogSeedBundle = {
  version: 1, generatedAt: primary.generatedAt,
  cities: [{ slug: "shenzhen", nameEn: "Shenzhen", nameZh: "深圳", region: "South China", province: "Guangdong", status: "active", sourceUrl: "https://iso.sysu.edu.cn/en/application/guide/1420575.htm", sourceLabel: "Sun Yat-sen University 2026 international undergraduate admission guide", sourceFieldLineage: { nameEn: "official campus descriptions", province: "official university location" } }],
  schools: [{ slug: schoolSlug, nameEn: "Southern University of Science and Technology", nameZh: "南方科技大学", citySlug: "shenzhen", schoolType: "Public", region: "Shenzhen, Guangdong, South China", applicationLevel: "Bachelor, Master, Doctoral", languageOfInstruction: "English", languageRequirement: "International undergraduate routes are English-medium; 2026 postgraduate routes require TOEFL 90 or IELTS 6.5 with no sub-score below 6.0, subject to the published waiver.", hskRequirement: "No HSK threshold is published for the English-medium routes in this batch.", englishRequirement: "Postgraduate: TOEFL 90 or IELTS 6.5 (no sub-score below 6.0), with a published medium-of-instruction waiver.", deadlineSummary: "2026 postgraduate Round 1 closes January 18 and Round 2 closes April 1; the current undergraduate catalog does not publish a deadline.", tuitionSummary: "Undergraduate tuition CNY 30,000/year; admitted international postgraduates are evaluated for comprehensive scholarships.", websiteUrl: "https://www.sustech.edu.cn/en/", admissionsUrl: applicationUrl, cscaRequirement: "No CSCA requirement is published on the official international admissions pages used for this batch.", subjectTags: [...new Set([...bachelorPrograms, ...graduatePrograms].map((row) => row.nameEn))].slice(0, 16), languageTags: ["English-taught"], tuitionBandLabel: "CNY 30,000/year undergraduate", campusHighlights: ["Credit system", "Residential colleges", "Dual-faculty advising", "Shenzhen innovation ecosystem"], status: "draft", ...schoolSource, sourceFieldLineage: { nameEn: "official international admissions overview", nameZh: "official institution identity", citySlug: "official address", schoolType: "2026 postgraduate guide", applicationLevel: "official undergraduate overview plus 2026 postgraduate guide", languageOfInstruction: "official undergraduate overview and postgraduate guide", deadlineSummary: "2026 postgraduate Application Timeline & Deadlines", tuitionSummary: "undergraduate cost API and postgraduate Funding & Scholarships" } }],
  programs: [...bachelorPrograms, ...graduatePrograms], programIntakes: graduateIntakes, scholarships,
};
const report = createCatalogMigrationValidationReport(bundle);
if (!report.ok || bachelorPrograms.length !== 35 || graduatePrograms.length !== 25 || bundle.programs?.length !== 60 || graduateIntakes.length !== 25 || scholarships.length !== 7) throw new Error(`Invalid SUSTech candidate: ${JSON.stringify({ errors: report.errors, bachelor: bachelorPrograms.length, graduate: graduatePrograms.length, intakes: graduateIntakes.length, scholarships: scholarships.length })}`);
const candidatePath = resolve(root, "seeds/catalog.sustech-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sustech-complete-batch-01.validation.json");
const body = `${JSON.stringify(bundle, null, 2)}\n`;
await writeFile(candidatePath, body);
await writeFile(validationPath, `${JSON.stringify({ ...report, candidateSha256: createHash("sha256").update(body).digest("hex"), primaryManifestSha256: createHash("sha256").update(primaryText).digest("hex"), apiManifestSha256: createHash("sha256").update(apiText).digest("hex"), lockedCounts: { bachelor: 35, master: 11, doctoral: 14, totalPrograms: 60, english: 60, intakes: 25, scholarships: 7 } }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, counts: report.summary, lockedCounts: { bachelor: 35, master: 11, doctoral: 14, totalPrograms: 60, english: 60, intakes: 25, scholarships: 7 }, bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
