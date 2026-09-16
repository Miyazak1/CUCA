import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/ouc-complete-batch-01/manifest.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);
const sources = new Map(manifest.sources.map((row: any) => [row.id, row]));
const requiredSourceIds = [
  "ouc-international-admission-guide-page-2026",
  "ouc-english-undergraduate-program-pdf-2026",
  "ouc-international-programs-pdf-2026",
  "ouc-program-list-pdf-2026",
  "ouc-csca-subjects-pdf-2026",
  "ouc-silk-road-scholarship-pdf-2026",
  "ouc-youth-excellence-scholarship-pdf-2026",
  "ouc-high-level-graduate-scholarship-pdf-2026",
];
for (const id of requiredSourceIds) {
  const source: any = sources.get(id);
  if (!source || source.status !== 200 || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Missing valid OUC source: ${id}`);
}
const meta = (id: string) => {
  const source: any = sources.get(id);
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const schoolSlug = "ocean-university-of-china";
const citySlug = "qingdao";
const applicationUrl = "https://ouc.at0086.cn/student";
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const routeDefinitions = [
  ["Oceanography", "Bachelor", 4, 23000],
  ["Tourism Management", "Bachelor", 4, 8000],
  ["Computer Science and Technology", "Bachelor", 4, 8000],
  ["International Economics and Trade", "Bachelor", 4, 8000],
  ["International Business", "Master", 2, 25000],
  ["China Studies", "Master", 2, 20500],
  ["Food Science and Engineering", "Master", 2, 25000],
  ["Aquaculture", "Master", 2, 25000],
  ["Pharmacy", "Master", 2, 25000],
  ["Computer Technology", "Master", 3, 25000],
] as const;
const stableSlugs: Record<string, string> = {
  "Computer Science and Technology": "ocean-university-of-china-computer-science-and-technology",
  "International Economics and Trade": "ocean-university-of-china-international-economics-and-trade",
};
const programs = routeDefinitions.map(([nameEn, degreeLevel, durationYears, tuitionAmount]) => ({
  slug: stableSlugs[nameEn] ?? `official-2026-ouc-${degreeLevel.toLowerCase()}-${slugify(nameEn)}`,
  schoolSlug, citySlug, nameEn, nameZh: nameEn, degreeLevel, durationYears,
  fieldCategory: nameEn, subjectArea: nameEn, teachingLanguage: "English",
  cscaSubjects: degreeLevel === "Bachelor" ? ["Mathematics"] : [],
  cscaRequirement: degreeLevel === "Bachelor" ? "CSCA Mathematics is required; Physics or Chemistry is additionally required only where the official program subject table specifies it." : "No CSCA requirement is published for this postgraduate route.",
  hskRequirement: "No HSK threshold is published for this English-taught route.",
  englishRequirement: "Applicants from non-English-speaking countries: IELTS 5.5, TOEFL 80, equivalent English proof, an English-medium prior degree certificate, or at least one year of study in an English-speaking country.",
  tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`, displayTuition: `CNY ${tuitionAmount.toLocaleString("en-US")}/year`,
  scholarshipText: "Official OUC scholarship routes are published separately; funding is not guaranteed.", applicationUrl,
  applicationNote: `Apply by June 10, 2026. ${degreeLevel === "Bachelor" ? "High school diploma; age 16-30." : "Bachelor's degree or equivalent; age 18-50."}`,
  hasScholarship: true, badgeText: "Official 2026 international route", displayGroup: degreeLevel,
  displayGroupLabel: `English-taught ${degreeLevel.toLowerCase()} programs`, status: "draft" as const,
  ...meta("ouc-international-programs-pdf-2026"),
  sourceFieldLineage: { nameEn: "Programs Overview table", degreeLevel: "Programs Overview type", durationYears: "Programs Overview duration", teachingLanguage: "Programs Overview teaching language", tuitionAmount: "Programs Overview standard CNY fee", englishRequirement: "Qualification table", applicationNote: "Qualification and How to apply sections" },
}));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-10T00:00:00Z",
  deadlineLabel: "Complete and submit the application before June 10, 2026.", applicationRound: "OUC international programs 2026", status: "closed" as const,
  ...meta("ouc-international-programs-pdf-2026"), sourceFieldLineage: { deadlineDate: "How to apply section; normalized to ISO UTC", deadlineLabel: "How to apply section" },
}));

const commonMaterials = [
  { label: "Chinese Government Scholarship application form" }, { label: "Passport information page" }, { label: "Notarized highest diploma" },
  { label: "Academic transcripts" }, { label: "Language qualification certificate" }, { label: "Study plan" },
  { label: "Two professor or associate-professor recommendation letters" }, { label: "Physical examination form" }, { label: "Non-criminal record report" },
];
const scholarship = (sourceId: string, value: Omit<CatalogSeedScholarship, "sourceUrl" | "sourceLabel" | "sourceSha256" | "capturedAt" | "schoolSlug" | "status">): CatalogSeedScholarship => ({
  schoolSlug, status: "draft", providerLocation: "Qingdao, China", targetCountries: [], targetRegions: [], ...meta(sourceId),
  actionLinks: [{ label: "Official scholarship information", url: meta(sourceId).sourceUrl, kind: "official-source" }, { label: "OUC application portal", url: applicationUrl, kind: "official-application" }],
  sourceFieldLineage: { title: "official scholarship title", coverage: "Scholarship Coverage or Program Form", amountText: "Scholarship Coverage", eligibilityItems: "Eligibility or Application Requirements", applicationMaterials: "Application Documents", applicationSteps: "Application Procedure" }, ...value,
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship("ouc-high-level-graduate-scholarship-pdf-2026", {
    slug: "official-2026-ouc-cgs-high-level-graduate", title: "OUC 2026/2027 Chinese Government Scholarship - High-Level Graduate Student Program", nameZh: "中国海洋大学2026/2027中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship Type B", providerName: "China Scholarship Council / Ocean University of China", providerNameEn: "China Scholarship Council / Ocean University of China", fundingLevel: "Full", applicableDegree: "Master, Doctoral", applicableProgram: "OUC Chinese- and English-taught graduate programs", coverage: "Tuition waiver, free on-campus accommodation, living stipend and comprehensive medical insurance.", amountText: "CNY 3,000/month master; CNY 3,500/month doctoral", deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "2026/2027", benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus twin-room accommodation", included: true }, { label: "Living stipend", included: true, note: "CNY 3,000/month master; CNY 3,500/month doctoral" }, { label: "Comprehensive medical insurance", included: true }], eligibilityItems: [{ label: "Citizenship", value: "Non-Chinese citizen in good health" }, { label: "Master", value: "Bachelor's degree; generally under age 35" }, { label: "Doctoral", value: "Master's degree; generally under age 40" }, { label: "Chinese route", value: "HSK 4 score 180 or above" }, { label: "English route", value: "IELTS 5.5, TOEFL 80 or an accepted published alternative" }], applicationMaterials: commonMaterials, applicationSteps: [{ label: "Step 1", value: "Pay the CNY 400 OUC application fee by February 15, 2026" }, { label: "Step 2", value: "Complete the CSC online application using OUC agency number 10423" }, { label: "Step 3", value: "Submit complete supporting documents and complete OUC review/interview" }, { label: "Step 4", value: "Await OUC nomination and CSC final approval" }], bodySections: [{ title: "Duration", body: "Master: 2-3 years plus up to one year Chinese study; doctoral: 4 years plus up to one year Chinese study, as specified in the admission letter." }], summary: "Full 2026/2027 OUC Chinese Government Scholarship route for master and doctoral candidates.", sortOrder: 10,
  }),
  scholarship("ouc-silk-road-scholarship-pdf-2026", {
    slug: "official-2026-ouc-cgs-silk-road", title: "OUC 2026/2027 Silk Road Program Chinese Government Scholarship", nameZh: "中国海洋大学2026/2027丝绸之路中国政府奖学金项目", type: "government", typeLabel: "Chinese Government Scholarship - Silk Road Program", providerName: "China Scholarship Council / Ocean University of China", providerNameEn: "China Scholarship Council / Ocean University of China", fundingLevel: "Full", applicableDegree: "Master, Doctoral", applicableProgram: "Aquaculture; Fisheries Technology; Fisheries Resource; Fishery Development; Food and Nutrition (master); Aquaculture; Fisheries Technology; Fisheries Resource (doctoral)", coverage: "Tuition waiver, free on-campus accommodation, living stipend and comprehensive medical insurance.", amountText: "CNY 3,000/month master; CNY 3,500/month doctoral", deadlineDate: "2026-05-15", deadlineLabel: "May 15, 2026", applicationRound: "2026/2027", targetCountries: ["Thailand", "Viet Nam", "Malaysia", "Indonesia", "Brunei", "Pakistan", "Tanzania", "Fiji"], benefitItems: [{ label: "Tuition waiver", included: true }, { label: "On-campus twin-room accommodation", included: true }, { label: "Living stipend", included: true, note: "CNY 3,000/month master; CNY 3,500/month doctoral" }, { label: "Comprehensive medical insurance", included: true }], eligibilityItems: [{ label: "Citizenship", value: "Non-Chinese citizen in good health from a published eligible country" }, { label: "Master", value: "Bachelor's degree; generally under age 35" }, { label: "Doctoral", value: "Master's degree; generally under age 40" }, { label: "Language", value: "HSK 4 score 180 for Chinese routes; IELTS 5.5, TOEFL 80 or a published alternative for English routes" }], applicationMaterials: commonMaterials, applicationSteps: [{ label: "Step 1", value: "Pay the CNY 400 OUC application fee by May 15, 2026" }, { label: "Step 2", value: "Complete the CSC online application" }, { label: "Step 3", value: "Send the CSC form to the published OUC scholarship mailbox with the Silk Road subject line" }, { label: "Step 4", value: "Complete OUC nomination and CSC review" }], summary: "Full Silk Road scholarship for published fisheries and food-related graduate routes.", sortOrder: 20,
  }),
  scholarship("ouc-youth-excellence-scholarship-pdf-2026", {
    slug: "official-2026-ouc-cgs-youth-excellence", title: "OUC 2026/2027 Chinese Government Scholarship - Youth of Excellence Scheme of China", nameZh: "中国海洋大学2026/2027中国政府来华留学卓越奖学金项目", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "China Scholarship Council / Ocean University of China", providerNameEn: "China Scholarship Council / Ocean University of China", fundingLevel: "Full", applicableDegree: "Master", applicableProgram: "Master of International Business (International Student)", coverage: "Full scholarship for the published 1+1 English-taught International Business master's route.", amountText: "Full scholarship; itemized amount is not published in the OUC guide", deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026 at 23:59 (GMT+8)", applicationRound: "2026/2027", benefitItems: [{ label: "Full scholarship", included: true }, { label: "1+1 study model", included: true, note: "First academic year at OUC; second year based in the home country while completing the dissertation" }], eligibilityItems: [{ label: "Citizenship and age", value: "Non-Chinese citizen, under age 45, in good health" }, { label: "Education and experience", value: "Bachelor's degree or higher and at least three years of work experience" }, { label: "Leadership profile", value: "Government official, senior institutional/enterprise manager, university/research administrator, or relevant international-organization experience" }, { label: "English", value: "IELTS 5.5, TOEFL 80 or a published alternative" }], applicationMaterials: [...commonMaterials, { label: "OUC pre-admission letter" }], applicationSteps: [{ label: "Step 1", value: "Obtain an OUC pre-admission letter for the International Business program" }, { label: "Step 2", value: "Apply in the CSC system as Type A using agency code 1563 by March 31, 2026" }, { label: "Step 3", value: "CSC conducts preliminary and expert review" }, { label: "Step 4", value: "Await the final enrollment result" }], bodySections: [{ title: "Training model", body: "English-taught 1+1 route: coursework and research at OUC in year one, home-country work and dissertation completion in year two, followed by the OUC defense." }], summary: "Full Youth of Excellence award for OUC's English-taught Master of International Business route.", sortOrder: 30,
  }),
];

const schoolSource = meta("ouc-international-programs-pdf-2026");
const bundle: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Qingdao", nameZh: "青岛", region: "East China", province: "Shandong", status: "draft", ...schoolSource, sourceFieldLineage: { nameEn: "Qingdao, China section", region: "official geographic description", province: "official address" } }],
  schools: [{ slug: schoolSlug, nameEn: "Ocean University of China", nameZh: "中国海洋大学", citySlug, schoolType: "Public", region: "Qingdao, Shandong, East China", applicationLevel: "Bachelor, Master, Doctoral", languageOfInstruction: "Chinese, English", languageRequirement: "English international routes require IELTS 5.5, TOEFL 80 or a published alternative; Chinese graduate scholarship routes require HSK 4 score 180 or above.", hskRequirement: "HSK 4 score 180 or above is published for Chinese-taught graduate scholarship routes.", englishRequirement: "IELTS 5.5, TOEFL 80, equivalent English proof, English-medium prior degree, or one year of study in an English-speaking country.", deadlineSummary: "Published international program deadline: June 10, 2026; scholarship deadlines vary by route.", tuitionSummary: "Published English routes: CNY 8,000-25,000/year; Oceanography CNY 23,000/year.", applicationFee: "CNY 400", websiteUrl: "https://www.ouc.edu.cn/", admissionsUrl: applicationUrl, cscaRequired: true, cscaRequirement: "2026 English undergraduate routes require CSCA Mathematics; Physics or Chemistry is additionally required for specified science/engineering programs.", cscaSubjects: ["Mathematics", "Physics", "Chemistry"], subjectTags: routeDefinitions.map(([name]) => name), languageTags: ["English-taught", "Chinese-taught"], tuitionBandLabel: "CNY 8,000-25,000/year for published English routes", campusHighlights: ["Oceanography and fisheries strengths", "Four Qingdao campuses", "Project 985", "Double First Class"], status: "draft", ...schoolSource, sourceFieldLineage: { nameEn: "official title and Introduction to OUC", nameZh: "official institution identity", citySlug: "Qingdao, China and official address", schoolType: "Introduction to OUC", applicationLevel: "Programs Overview and Program List", languageOfInstruction: "Programs Overview and scholarship guides", deadlineSummary: "How to apply", tuitionSummary: "Programs Overview" } }],
  programs, programIntakes, scholarships,
};
const report = createCatalogMigrationValidationReport(bundle);
if (!report.ok || programs.length !== 10 || programIntakes.length !== 10 || scholarships.length !== 3) throw new Error(`Invalid OUC candidate: ${JSON.stringify({ errors: report.errors, programs: programs.length, intakes: programIntakes.length, scholarships: scholarships.length })}`);
const candidatePath = resolve(root, "seeds/catalog.ouc-international-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ouc-international-batch-01.validation.json");
const body = `${JSON.stringify(bundle, null, 2)}\n`;
await writeFile(candidatePath, body);
await writeFile(validationPath, `${JSON.stringify({ ...report, candidateSha256: createHash("sha256").update(body).digest("hex"), manifestSha256: createHash("sha256").update(manifestText).digest("hex"), lockedCounts: { bachelor: 4, master: 6, totalPrograms: 10, english: 10, intakes: 10, scholarships: 3 } }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, counts: report.summary, lockedCounts: { bachelor: 4, master: 6, totalPrograms: 10, english: 10, intakes: 10, scholarships: 3 }, bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
