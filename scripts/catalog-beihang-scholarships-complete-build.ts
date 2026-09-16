import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/beihang-scholarships-complete-batch-01/manifest.json");
const schoolBundlePath = resolve(root, "seeds/catalog.beihang-graduate-batch-01.approved.local.json");
const draftPath = resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.validation.json");
const [manifest, schoolBundle] = await Promise.all([
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(schoolBundlePath, "utf8").then(JSON.parse),
]);
const sources = new Map<string, any>(manifest.sources.map((row: any) => [row.id, row]));
const requiredSourceIds = [
  "beihang-undergraduate-program-2026-rich", "beihang-self-supported-scholarship-policy",
  "beihang-program-cooperation-scholarship-policy", "beihang-postgraduate-self-supported-scholarships-2026",
  "beihang-belt-road-scholarship-2026", "beihang-youth-excellence-scholarship-2026",
  "beihang-international-chinese-language-teachers-scholarship-2026", "beihang-cgs-bilateral-current",
];
for (const id of requiredSourceIds) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || !/^https:\/\/is\.buaa\.edu\.cn\//.test(source.finalUrl) || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Missing valid official source: ${id}`);
}
const meta = (id: string) => {
  const source = sources.get(id)!;
  return { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
};
const schoolSlug = "beihang-university";
const applicationUrl = "https://admission.buaa.edu.cn/";
const cscUrl = "https://studyinchina.csc.edu.cn/";
const languageScholarshipUrl = "https://www.chinese.cn/";
const items = (values: string[]) => values.map((label) => ({ label }));
const steps = (values: string[]) => values.map((body, index) => ({ label: `Step ${index + 1}`, body }));
const benefits = (values: Array<string | [string, string, boolean?]>) => values.map((value) => typeof value === "string" ? ({ label: value, included: true }) : ({ label: value[0], note: value[1], included: value[2] ?? true }));

type ScholarshipInput = {
  sourceId: string; slug: string; title: string; nameZh: string; type: string; typeLabel: string; providerName: string; providerNameEn: string;
  fundingLevel: string; coverage: string; applicableDegree: string; applicableProgram: string; amountText: string; eligibility: string[];
  materials: string[]; procedure: string[]; benefits: Array<string | [string, string, boolean?]>; deadlineDate?: string; deadlineLabel: string;
  applicationRound: string; summary: string; sortOrder: number; extraLinks?: Array<{label: string; url: string; kind: string}>; limitations?: string[];
};
function scholarship(input: ScholarshipInput): CatalogSeedScholarship {
  const source = meta(input.sourceId);
  const bodySections = [
    { title: "Program overview", body: input.summary },
    { title: "Important application notes", items: [...input.procedure, ...(input.limitations ?? [])] },
  ];
  const record: CatalogSeedScholarship = {
    slug: input.slug, title: input.title, nameZh: input.nameZh, schoolSlug, type: input.type, typeLabel: input.typeLabel,
    providerName: input.providerName, providerNameEn: input.providerNameEn, providerLocation: "Beijing, China",
    fundingLevel: input.fundingLevel, coverage: input.coverage, applicableDegree: input.applicableDegree, applicableProgram: input.applicableProgram,
    amountText: input.amountText, requirementText: input.eligibility.join("; "), bodySections, benefitItems: benefits(input.benefits),
    eligibilityItems: items(input.eligibility), applicationMaterials: items(input.materials), applicationSteps: steps(input.procedure),
    actionLinks: [{ label: "Official Beihang scholarship source", url: source.sourceUrl, kind: "official-source" }, ...(input.extraLinks ?? [])],
    deadlineDate: input.deadlineDate, deadlineLabel: input.deadlineLabel, applicationRound: input.applicationRound,
    targetCountries: [], targetRegions: [], benefits: input.benefits.map((value) => typeof value === "string" ? value : value[0]),
    tags: ["Beihang University", input.typeLabel, input.applicationRound], summary: input.summary, sortOrder: input.sortOrder, status: "draft",
    ...source,
    sourceFieldLineage: {
      title: "explicit: official page title or scholarship table label", nameZh: "derived: faithful Chinese catalog label",
      fundingLevel: "explicit: official scholarship coverage/table", coverage: "explicit: official scholarship coverage/table",
      applicableDegree: "explicit: official eligibility or scholarship table", applicableProgram: "explicit: official program scope",
      amountText: "explicit: official coverage statement; unresolved amounts remain explicitly unpublished",
      eligibilityItems: "explicit: official eligibility section", applicationMaterials: "explicit: official materials/admission section",
      applicationSteps: "explicit: official application procedure", deadlineLabel: "explicit: official deadline or application period",
      summary: "derived: concise catalog summary of the registered official source",
    },
  };
  return record;
}

const undergraduateMaterials = ["Beihang 2026 undergraduate admission materials", "Corresponding scholarship application form submitted with the admission application"];
const selfFundedPostgraduateMaterials = ["Completed Application Form for Self-Supported Students Scholarship (New Postgraduate)", "Successfully submitted 2026 Beihang postgraduate online application"];
const scholarships: CatalogSeedScholarship[] = [
  scholarship({
    sourceId: "beihang-cgs-bilateral-current", slug: "official-beihang-cgs-bilateral-type-a", title: "Beihang Chinese Government Scholarship - Bilateral Program", nameZh: "北京航空航天大学中国政府奖学金国别双边项目",
    type: "government", typeLabel: "Chinese Government Scholarship - Bilateral Program", providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council",
    fundingLevel: "Full or partial", coverage: "Full or partial scholarship according to the applicable bilateral agreement and dispatching authority.", applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "Beihang routes permitted by the bilateral agreement and home-country dispatching authority",
    amountText: "The official Beihang page does not publish a single amount; coverage is full or partial under the applicable bilateral arrangement.", benefits: [["Full or partial scholarship", "Exact package follows the bilateral agreement and dispatching authority"]],
    eligibility: ["Apply through the dispatching department in the applicant's home country", "Meet the selected Beihang program's admission requirements", "Choose Beihang University as the first target university"], materials: ["Documents required by the home-country dispatching authority", "Beihang admission documents for the selected route"],
    procedure: ["Consult the home-country dispatching authority for its agency number and timetable", "Apply in the CSC system as Type A and select Beihang University", "Complete Beihang review or pre-admission steps when requested"], deadlineLabel: "Generally November to March; exact deadline is set by the home-country dispatching authority", applicationRound: "Current bilateral route", summary: "Current Beihang Type A route administered through each applicant's home-country dispatching authority.", sortOrder: 110, extraLinks: [{label:"CSC application system",url:cscUrl,kind:"official-application"}], limitations:["The official page does not publish a single central deadline, amount or material list for all countries."]
  }),
  scholarship({
    sourceId: "beihang-undergraduate-program-2026-rich", slug: "official-2026-beihang-outstanding-talents-scholarship-undergraduate", title: "Beihang 2026 Outstanding Talents Scholarship for Undergraduate Freshmen", nameZh: "北京航空航天大学2026年优秀人才奖学金（本科新生）",
    type: "university", typeLabel: "Outstanding Talents Scholarship", providerName: "北京航空航天大学", providerNameEn: "Beihang University", fundingLevel: "Full", coverage: "Full tuition, accommodation and living allowance.", applicableDegree: "Bachelor", applicableProgram: "Eligible 2026 Beihang international undergraduate programs",
    amountText: "Full tuition fee, accommodation fee and living allowance; the official table does not publish a numeric allowance.", benefits: ["Full tuition fee", "Accommodation fee", ["Living allowance", "Numeric amount not separately published"]], eligibility: ["Fresh high-school graduate meeting Beihang's international undergraduate requirements", "Recommended by the applicant's high school", "Excellent academic performance and conduct", "Outstanding entrance integrative-test performance", "Relevant expertise, honors, patents, arts or sports awards receive priority"], materials: undergraduateMaterials,
    procedure: ["Complete the 2026 undergraduate application in the Beihang system", "Submit the corresponding scholarship form with the admission materials", "Complete Beihang's admission and scholarship evaluation"], deadlineDate: "2026-05-30", deadlineLabel: "May 30, 2026", applicationRound: "2026 undergraduate intake", summary: "Full university award for high-performing fresh high-school graduates entering Beihang undergraduate study.", sortOrder: 120, extraLinks:[{label:"Beihang application system",url:applicationUrl,kind:"official-application"}]
  }),
  scholarship({
    sourceId: "beihang-undergraduate-program-2026-rich", slug: "official-2026-beihang-program-cooperation-scholarship-undergraduate", title: "Beihang 2026 Program and Cooperation Scholarship for Undergraduate Students", nameZh: "北京航空航天大学2026年项目与合作外国留学生奖学金（本科）",
    type: "university", typeLabel: "Program and Cooperation Scholarship", providerName: "北京航空航天大学", providerNameEn: "Beihang University", fundingLevel: "Tiered tuition award", coverage: "100%, 80%, 50% or 20% of tuition.", applicableDegree: "Bachelor", applicableProgram: "Eligible 2026 undergraduate applicants recommended by organizations cooperating with Beihang",
    amountText: "100%, 80%, 50% or 20% tuition waiver.", benefits: [["Tuition waiver", "100%, 80%, 50% or 20%"]], eligibility: ["Meet Beihang's 2026 international undergraduate requirements", "Excellent academic performance and conduct", "Outstanding entrance integrative-test performance", "Recommended by a domestic or foreign organization cooperating with Beihang"], materials: undergraduateMaterials,
    procedure: ["Obtain a recommendation from a cooperating organization", "Apply for 2026 undergraduate admission", "Submit the corresponding scholarship form with the admission materials"], deadlineDate: "2026-05-30", deadlineLabel: "May 30, 2026", applicationRound: "2026 undergraduate intake", summary: "Tiered tuition scholarship for undergraduate applicants recommended through Beihang cooperation channels.", sortOrder: 130, extraLinks:[{label:"Beihang application system",url:applicationUrl,kind:"official-application"}]
  }),
  scholarship({
    sourceId: "beihang-undergraduate-program-2026-rich", slug: "official-2026-beihang-beijing-government-scholarship-undergraduate", title: "Beihang 2026 Beijing Government Scholarship for Undergraduate Students", nameZh: "北京航空航天大学2026年北京市政府奖学金（本科）",
    type: "local-government", typeLabel: "Beijing Government Scholarship", providerName: "北京市人民政府", providerNameEn: "Beijing Municipal Government", fundingLevel: "Full tuition plus insurance", coverage: "Full tuition and comprehensive medical insurance for one academic year.", applicableDegree: "Bachelor", applicableProgram: "Eligible 2026 Beihang international undergraduate programs",
    amountText: "Full tuition fee and comprehensive medical insurance for one academic year.", benefits: ["Full tuition fee", "Comprehensive medical insurance"], eligibility: ["Meet Beihang's 2026 international undergraduate requirements", "Excellent academic performance and conduct", "Outstanding entrance integrative-test performance"], materials: undergraduateMaterials,
    procedure: ["Complete the 2026 Beihang undergraduate application", "Submit the corresponding scholarship form with the admission materials", "Complete Beihang's scholarship evaluation"], deadlineDate: "2026-05-30", deadlineLabel: "May 30, 2026", applicationRound: "2026 undergraduate intake", summary: "One-academic-year Beijing municipal tuition and insurance award for eligible Beihang undergraduate applicants.", sortOrder: 140, extraLinks:[{label:"Beihang application system",url:applicationUrl,kind:"official-application"}]
  }),
  scholarship({
    sourceId: "beihang-undergraduate-program-2026-rich", slug: "official-2026-beihang-self-supported-scholarship-undergraduate", title: "Beihang 2026 Self-Supported Foreign Students Scholarship for Undergraduate Freshmen", nameZh: "北京航空航天大学2026年自费外国留学生奖学金（本科新生）",
    type: "university", typeLabel: "Self-Supported Foreign Students Scholarship", providerName: "北京航空航天大学", providerNameEn: "Beihang University", fundingLevel: "Tiered tuition award", coverage: "100%, 80%, 50% or 20% of tuition for one academic year.", applicableDegree: "Bachelor", applicableProgram: "Eligible 2026 Beihang international undergraduate programs",
    amountText: "100%, 80%, 50% or 20% tuition waiver for one academic year.", benefits: [["Tuition waiver", "100%, 80%, 50% or 20% for one academic year"]], eligibility: ["Meet Beihang's 2026 international undergraduate requirements", "Excellent academic performance and conduct", "Outstanding entrance integrative-test performance", "No other scholarship funding"], materials: undergraduateMaterials,
    procedure: ["Complete the 2026 undergraduate application", "Submit the scholarship form with the admission materials", "Complete Beihang's evaluation; awards are made by academic year"], deadlineDate: "2026-05-30", deadlineLabel: "May 30, 2026", applicationRound: "2026 undergraduate intake", summary: "One-year tiered tuition award for new self-supported Beihang undergraduate students.", sortOrder: 150, extraLinks:[{label:"Beihang application system",url:applicationUrl,kind:"official-application"}]
  }),
  scholarship({
    sourceId: "beihang-postgraduate-self-supported-scholarships-2026", slug: "official-2026-beihang-beijing-government-scholarship-postgraduate", title: "Beihang 2026 Beijing Government Scholarship for New Self-Supported Postgraduates", nameZh: "北京航空航天大学2026年北京市政府奖学金（自费研究生新生）",
    type: "local-government", typeLabel: "Beijing Government Scholarship", providerName: "北京市人民政府 / 北京航空航天大学", providerNameEn: "Beijing Municipal Government / Beihang University", fundingLevel: "Not separately published", coverage: "The 2026 official notice opens this route but directs applicants to the maintained self-supported scholarship procedures for category, criteria and duration.", applicableDegree: "Master, Doctoral", applicableProgram: "New 2026 self-supported international postgraduate applicants",
    amountText: "A separate 2026 Beijing Government Scholarship amount is not published in the captured notice.", benefits: [["Award package", "Refer to the applicable category confirmed by Beihang; not separately stated in the 2026 notice", false]], eligibility: ["Meet Beihang's international postgraduate admission requirements", "Have successfully submitted the 2026 Beihang online application", "Have not received another scholarship"], materials: selfFundedPostgraduateMaterials,
    procedure: ["Submit the 2026 Beihang postgraduate online application", "Complete the self-supported scholarship form", "Submit the form to Beihang by the published deadline"], deadlineDate: "2026-06-17", deadlineLabel: "16:00 Beijing Time, June 17, 2026", applicationRound: "2026 new self-supported postgraduate intake", summary: "Current application notice for new self-supported postgraduates seeking the Beijing Government Scholarship at Beihang.", sortOrder: 160, limitations:["The captured notice does not separately state the monetary package; the final category follows Beihang's scholarship decision."]
  }),
  scholarship({
    sourceId: "beihang-postgraduate-self-supported-scholarships-2026", slug: "official-2026-beihang-self-supported-scholarship-postgraduate", title: "Beihang 2026 Scholarship for New Self-Supported Postgraduates", nameZh: "北京航空航天大学2026年自费外国留学生奖学金（研究生新生）",
    type: "university", typeLabel: "Self-Supported Foreign Students Scholarship", providerName: "北京航空航天大学", providerNameEn: "Beihang University", fundingLevel: "Full or partial", coverage: "Under the maintained policy, a full award can include tuition, accommodation, insurance and living expenses; partial awards can cover 20%, 50%, 80% or 100% tuition and/or partial accommodation or living expenses. Award period is one year.", applicableDegree: "Master, Doctoral", applicableProgram: "New 2026 self-supported international postgraduate applicants",
    amountText: "Full or partial award; numeric living and accommodation amounts are not separately published in the 2026 notice.", benefits: ["Tuition", "Accommodation", "Insurance", "Living expenses", ["Partial award options", "20%, 50%, 80% or 100% tuition and/or partial accommodation or living expenses"]], eligibility: ["Meet Beihang's international postgraduate admission requirements", "Have submitted the 2026 Beihang online application", "Have not received another scholarship", "Strong prior academic record, achievements or development potential"], materials: selfFundedPostgraduateMaterials,
    procedure: ["Submit the 2026 Beihang postgraduate online application", "Complete the self-supported scholarship form", "Submit the form to Beihang by the published deadline", "Awards are made for one academic year"], deadlineDate: "2026-06-17", deadlineLabel: "16:00 Beijing Time, June 17, 2026", applicationRound: "2026 new self-supported postgraduate intake", summary: "Current one-year full-or-partial Beihang award for new self-supported international postgraduates.", sortOrder: 170
  }),
  scholarship({
    sourceId: "beihang-belt-road-scholarship-2026", slug: "official-2026-beihang-cgs-belt-road", title: "Beihang 2026 Chinese Government Scholarship - Belt and Road Program", nameZh: "北京航空航天大学2026年中国政府奖学金“一带一路”项目",
    type: "government", typeLabel: "Chinese Government Scholarship - Belt and Road", providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, university dormitory or accommodation subsidy, stipend and comprehensive medical insurance; international travel is excluded.", applicableDegree: "Master, Doctoral", applicableProgram: "Space Technology Applications; Aerospace Science and Technology; Mechanical Engineering; Information and Communications Engineering; Control Science and Engineering",
    amountText: "Full published package; the official page does not state numeric stipend or accommodation-subsidy amounts.", benefits: ["Tuition", "University dormitory or accommodation subsidy", "Stipend", "Comprehensive medical insurance", ["International travel", "Not covered", false]], eligibility: ["Citizen of a country other than China and in good physical and mental health", "Bachelor's degree and under 35 for master's study", "Master's degree and under 40 for doctoral study", "HSK 5 for Chinese-taught routes", "Relevant English certificate for English-taught routes"], materials: ["CSC application form", "Passport", "Highest diploma and transcripts", "Language certificate", "Supervisor acceptance letter", "Study plan", "Two academic recommendations", "Physical examination", "No-criminal-record certificate", "Integrity commitment", "Resume"],
    procedure: ["Apply in both Beihang and CSC systems", "Choose CSC Type B and Beihang agency number 10006", "Complete Beihang document review and interviews", "CSC makes the final selection"], deadlineDate: "2026-05-25", deadlineLabel: "May 25, 2026", applicationRound: "September 2026 intake", summary: "Full CSC Type B postgraduate route for Beihang's five published Belt and Road major groups.", sortOrder: 180, extraLinks:[{label:"Beihang application system",url:applicationUrl,kind:"official-application"},{label:"CSC application system",url:cscUrl,kind:"official-application"}]
  }),
  scholarship({
    sourceId: "beihang-youth-excellence-scholarship-2026", slug: "official-2026-beihang-youth-of-excellence", title: "Beihang 2026 Youth of Excellence Scheme of China Program", nameZh: "北京航空航天大学2026年中国政府奖学金青年精英项目",
    type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Full scholarship in a 1+1 master's mode; living expenses are funded for one year.", applicableDegree: "Master", applicableProgram: "Space Information Engineering; Artificial Intelligence and Big Data; Global Outstanding Management Talents",
    amountText: "Full scholarship; living expenses are provided for one year. The official page does not publish a numeric stipend.", benefits: ["Full scholarship", ["Living expenses", "Funded for one year"]], eligibility: ["Non-Chinese citizen under age 45 and in good physical and mental health", "Bachelor's degree or above and at least three years of work experience", "Qualifying public official, senior institutional or enterprise manager, university or research administrator, or applicant with international-organization experience", "Obtain Beihang pre-admission"], materials: ["Beihang international-student application form", "Passport", "Highest degree certificate and transcripts", "English certificate: IELTS 6.0 or TOEFL 90", "English study plan over 1,000 characters or words", "Employment or work-experience proof", "Two recommendation letters", "Physical examination", "No-criminal-record certificate", "Integrity commitment"],
    procedure: ["Submit pre-admission materials to Beihang before March 15, 2026", "Complete Beihang preliminary review and academic interview", "Obtain the Beihang pre-admission letter", "Apply in the CSC system before March 31 as Type A, agency 1563"], deadlineDate: "2026-03-31", deadlineLabel: "Beihang pre-admission: March 15, 2026; CSC application: March 31, 2026", applicationRound: "2026 Youth of Excellence intake", summary: "Full 1+1 master's scholarship across three Beihang global-governance-oriented program groups.", sortOrder: 190, extraLinks:[{label:"CSC application system",url:cscUrl,kind:"official-application"}]
  }),
  scholarship({
    sourceId: "beihang-international-chinese-language-teachers-scholarship-2026", slug: "official-2026-beihang-international-chinese-language-teachers-scholarship", title: "Beihang 2026 International Chinese Language Teachers Scholarship", nameZh: "北京航空航天大学2026年国际中文教师奖学金",
    type: "education-center", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "教育部中外语言交流合作中心 / 北京航空航天大学", providerNameEn: "Center for Language Education and Cooperation / Beihang University", fundingLevel: "Per scholarship authority and Beihang rules", coverage: "The Beihang 2026 guide confirms the route but directs applicants to Beihang for the current scholarship coverage and standard.", applicableDegree: "Non-degree", applicableProgram: "One-academic-year, one-semester and four-week Chinese-language and culture study routes",
    amountText: "The captured Beihang 2026 guide does not separately publish the coverage amount or standard.", benefits: [["Scholarship coverage", "Consult Beihang and the official scholarship system for the current standard", false]], eligibility: ["Non-Chinese citizen", "Age 16-35 on September 1, 2026; in-service Chinese teachers may be up to 45", "Good physical and mental health, academic performance and conduct", "Commitment to Chinese-language education or related fields", "Meet the HSK/HSKK threshold for the selected study category"], materials: ["Passport photo page", "Valid HSK and HSKK reports as applicable", "Recommendation letter from the recommending institution", "Employment and employer recommendation for in-service teachers", "Guardian documents for applicants under 18", "Other proof requested for the Beihang interview"],
    procedure: ["Apply in the official International Chinese Language Teachers Scholarship system", "Choose Beihang University as host institution", "Upload the required documents and track review online", "Confirm enrollment and register by the admission-letter date"], deadlineDate: "2026-10-31", deadlineLabel: "July intake: April 15; September intake: May 15; December intake: September 15; March 2027 intake: October 31, 2026", applicationRound: "2026-2027 language-teacher scholarship", summary: "Beihang-hosted one-year, one-semester and four-week Chinese-language teacher-development routes.", sortOrder: 200, extraLinks:[{label:"Official scholarship application system",url:languageScholarshipUrl,kind:"official-application"}], limitations:["The captured 2026 Beihang page explicitly does not state a monetary coverage standard."]
  }),
];

if (scholarships.length !== 10 || new Set(scholarships.map((row) => row.slug)).size !== 10) throw new Error("Beihang scholarship batch must contain ten distinct routes.");
if (scholarships.some((row) => !row.coverage || !row.amountText || !row.benefitItems?.length || !row.eligibilityItems?.length || !row.applicationMaterials?.length || !row.applicationSteps?.length || !row.actionLinks?.length)) throw new Error("Beihang rich scholarship fields are incomplete.");
const bundle: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: schoolBundle.cities ?? [], schools: schoolBundle.schools ?? [], programs: [], programIntakes: [], scholarships,
};
const bundleText = `${JSON.stringify(bundle, null, 2)}\n`;
const persistedBundle = JSON.parse(bundleText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(persistedBundle);
if (!validation.ok) throw new Error(`Invalid Beihang scholarship candidate:\n${validation.errors.join("\n")}`);
await Promise.all([
  writeFile(draftPath, bundleText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, scholarshipCount: scholarships.length, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, draftPath, validationPath }, null, 2));
