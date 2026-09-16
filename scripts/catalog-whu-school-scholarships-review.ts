import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const runDir = resolve(root, "work/catalog-official/whu-complete-batch-01");
const candidatePath = resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.whu-school-scholarships-batch-01.review.json");
const schoolSlug = "wuhan-university";
const citySlug = "wuhan";
const applicationUrl = "https://admission.whu.edu.cn/";

const expected: Record<string, string> = {
  "whu-undergraduate-guide-2026": "a5922203ef423a934b1c72cdf55290dc7fe1d351d2da8c04a43679e461f10de1",
  "whu-csca-instructions-2026": "daf166ef5e9f5dadd73ca46dfec0ddc48708eb7bde9c04dccd16268bd8d10ca4",
  "whu-postgraduate-guide-2026": "ab91135bfc8763d3c8ce100e5d7e8205f35d8f740b5774e36dabd921bd91bda3",
  "whu-china-link-scholarship-2026": "9648ed4d37a46b8eb3fbbf11946b285586fff4d92b43db108c7b4caecf4be2b5",
  "whu-belt-and-road-scholarship-2026": "752e045be0dc4c08ff41427e457fb558a666d53909ff0a24cd4954c8ed47a5a9",
  "whu-bilateral-scholarship-2026": "3697461f7d3fe3b6c4eec57d86ce080e7ae91926dbe3594a468d9a7437d736be",
  "whu-youth-of-excellence-scholarship-2026": "c411997d06c92c4367978ceacea43606c5f4cb9b8f2327dbbd6c9a7587cb7e72",
  "whu-high-level-graduate-scholarship-2026": "c23f45e24652df7ca5d9206aa95930bba458af1933f17c147a7845b4d5e6c904",
  "whu-china-studies-phd-fellowship-2026": "6bce2c8441a756ef27d7ee830a72e16719a7d8b81ffadf63a82e5c40ed3fd3cd",
};

const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
const evidence = new Map<string, any>();
for (const source of manifest.sources ?? []) {
  if (expected[source.id]) {
    if (expected[source.id] !== source.sha256 || source.status !== 200 || source.contentType !== "text/html") {
      throw new Error(`Official snapshot mismatch: ${source.id}`);
    }
    evidence.set(source.id, source);
  }
}
if (evidence.size !== Object.keys(expected).length) throw new Error("The publishable Wuhan University evidence set is incomplete.");

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const commonGraduateMaterials = [
  info("Passport information page"), info("Degree certificate or expected-graduation proof"), info("Academic transcripts"),
  info("Language proficiency certificate"), info("Study or research plan"), info("Two academic recommendation letters"),
  info("Foreigner Physical Examination Form"), info("Non-criminal record certificate"),
];
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Wuhan, Hubei, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: {
      title: `${sourceId} article title`, fundingLevel: `${sourceId} funding or coverage section`, coverage: `${sourceId} funding or coverage section`,
      amountText: `${sourceId} funding or coverage section`, applicableDegree: `${sourceId} categories and eligibility`,
      eligibilityItems: `${sourceId} eligibility section`, applicationMaterials: `${sourceId} application documents section`,
      applicationSteps: `${sourceId} application process section`, ...(value.deadlineDate ? { deadlineDate: `${sourceId} application deadline section` } : {}),
    },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "Wuhan University application system", url: applicationUrl, kind: "official-application" }],
    ...value,
  };
};

const scholarships: CatalogSeedScholarship[] = [
  scholarship("whu-china-link-scholarship-2026", {
    slug: "official-2026-whu-china-link-scholarship", title: "Wuhan University 2026 China-Link Scholarship Program", nameZh: "武汉大学2026年中国政府奖学金China Link短期科研交流项目",
    type: "government", typeLabel: "China-Link Scholarship", providerNameEn: "China Scholarship Council / Wuhan University", fundingLevel: "Full",
    coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend", applicableDegree: "General Scholar, Senior Scholar",
    applicableProgram: "One-to-twelve-month study or research in all fields except Chinese language study", amountText: "General scholar CNY 3,000/month; senior scholar CNY 3,500/month, plus tuition, accommodation and insurance",
    deadlineDate: "2026-12-20", deadlineLabel: "December 20, 2026", applicationRound: "Start no later than August 31, 2027",
    summary: "Short-term scientific research exchange for eligible students and faculty at CSC foreign partner universities.",
    benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Comprehensive medical insurance"), benefit("General scholar stipend", "CNY 3,000/month"), benefit("Senior scholar stipend", "CNY 3,500/month")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("General scholar", "Current undergraduate or master's student under 45"), info("Senior scholar", "Current doctoral student or faculty member under 50"), info("Affiliation", "Full-time student or faculty at a CSC foreign partner university")],
    applicationMaterials: [info("Wuhan University online application"), info("CSC application after pre-admission"), info("Supporting documents required by the two official systems")],
    applicationSteps: [info("Step 1", "Apply to Wuhan University as a Type B general or senior scholar"), info("Step 2", "Send the Wuhan application number as instructed by the official guide"), info("Step 3", "After pre-admission, complete the CSC application using WHU agency number 10486")],
  }),
  scholarship("whu-belt-and-road-scholarship-2026", {
    slug: "official-2026-whu-belt-and-road-scholarship", title: "Wuhan University 2026 Chinese Government Scholarship - Belt and Road Program (Type B)", nameZh: "武汉大学2026年中国政府奖学金丝绸之路项目",
    type: "government", typeLabel: "Chinese Government Scholarship - Belt and Road", providerNameEn: "China Scholarship Council / Wuhan University", fundingLevel: "Full",
    coverage: "Tuition and application fee waiver, accommodation, living allowance and comprehensive medical insurance; international travel is self-funded", applicableDegree: "Master, Doctoral",
    applicableProgram: "Published Belt and Road majors in surveying, mapping, geographic information and software engineering", amountText: "Full scholarship; the Wuhan University notice does not itemize the living-allowance amount",
    deadlineDate: "2026-04-15", deadlineLabel: "April 15, 2026", applicationRound: "December 15, 2025 - April 15, 2026",
    summary: "Full graduate scholarship for eligible citizens of Belt and Road Initiative countries in the majors listed by Wuhan University.",
    benefitItems: [benefit("Tuition and application fee waiver"), benefit("Accommodation"), benefit("Living allowance", "Amount not itemized by WHU"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Citizen of a Belt and Road Initiative country in good health"), info("Master", "Under 35"), info("Doctoral", "Under 40"), info("Chinese-taught route", "HSK 4 or qualifying prior Chinese-medium study"), info("English-taught route", "TOEFL 80 or IELTS 6.0, subject to published exemptions"), info("Cannot hold another scholarship")],
    applicationMaterials: commonGraduateMaterials,
    applicationSteps: [info("Step 1", "Complete the CSC Type B application using WHU agency number 10486"), info("Step 2", "Complete the Wuhan University application and select Chinese Government Scholarship")],
  }),
  scholarship("whu-bilateral-scholarship-2026", {
    slug: "official-2026-whu-bilateral-scholarship", title: "Wuhan University 2026 Chinese Government Scholarship - Bilateral Program (Type A)", nameZh: "武汉大学2026年中国政府奖学金国别双边项目",
    type: "government", typeLabel: "Chinese Government Scholarship - Bilateral", providerNameEn: "China Scholarship Council / home-country dispatching authority", fundingLevel: "Full or partial",
    coverage: "Coverage and award level follow the bilateral agreement, CSC rules and the final award notice", applicableDegree: "Undergraduate, Master, Doctoral, General Scholar, Senior Scholar",
    applicableProgram: "Eligible Wuhan University programs available through the applicant's bilateral route", amountText: "Full or partial Chinese Government Scholarship; no single award amount is published by Wuhan University",
    deadlineLabel: "Usually early December through the end of March; confirm with the home-country dispatching authority", applicationRound: "2026 bilateral intake",
    summary: "Government-to-government scholarship route submitted through the applicant's home-country dispatching authority.",
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Undergraduate", "High-school diploma and under 25"), info("Master", "Bachelor's degree and under 35"), info("Doctoral", "Master's degree and under 40"), info("General scholar", "High-school diploma or above and under 45"), info("Senior scholar", "Master's degree or associate-professor rank and under 50")],
    applicationMaterials: [info("CSC application form"), ...commonGraduateMaterials, info("CSCA score report for undergraduate applicants"), info("Pre-admission or supervisor invitation for relevant postgraduate/scholar routes")],
    applicationSteps: [info("Step 1", "Apply to the dispatching authority in the home country"), info("Step 2", "Request Wuhan University pre-admission where required"), info("Step 3", "Complete the CSC Type A application using the agency number supplied by the dispatching authority")],
  }),
  scholarship("whu-youth-of-excellence-scholarship-2026", {
    slug: "official-2026-whu-youth-of-excellence-scholarship", title: "Wuhan University 2026 Youth of Excellence Scheme of China Program", nameZh: "武汉大学2026年中国政府来华留学卓越奖学金项目",
    type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "China Scholarship Council / Wuhan University", fundingLevel: "Full",
    coverage: "Full Chinese Government Scholarship; the Wuhan University notice does not itemize monetary benefits", applicableDegree: "Master",
    applicableProgram: "English-taught Geospatial Information Technology or Public Health, two-year 1+1 mode", amountText: "Full scholarship; no itemized stipend amount is published by Wuhan University",
    deadlineDate: "2026-03-31", deadlineLabel: "WHU application by March 1, 2026; CSC application by March 31, 2026", applicationRound: "2026 intake",
    summary: "Two English-taught master's routes for experienced global-governance professionals, using one year at WHU and thesis work in the home country in year two.",
    eligibilityItems: [info("Non-Chinese citizen in good health and under 45"), info("Bachelor's degree or above"), info("At least three years of work experience"), info("Eligible government, enterprise, university/research or international-organization professional profile"), info("English", "TOEFL 80 or IELTS 6.0, subject to published exemptions")],
    applicationMaterials: [info("Passport"), info("Degree certificate and transcripts"), info("English proof"), info("Employment or work-experience proof"), info("CV and English research proposal of at least 1,000 words"), info("Two recommendation letters"), info("Physical examination and non-criminal record")],
    applicationSteps: [info("Step 1", "Apply to Wuhan University before March 1, 2026"), info("Step 2", "After WHU pre-admission, apply through CSC as Type A, agency code 1563, before March 31, 2026")],
  }),
  scholarship("whu-high-level-graduate-scholarship-2026", {
    slug: "official-2026-whu-high-level-graduate-scholarship", title: "Wuhan University 2026 Chinese Government Scholarship - High Level Graduate Program (Type B)", nameZh: "武汉大学2026年中国政府奖学金高水平研究生项目",
    type: "government", typeLabel: "Chinese Government Scholarship - High Level Graduate", providerNameEn: "China Scholarship Council / Wuhan University", fundingLevel: "Full",
    coverage: "Tuition and application fee waiver, accommodation, living allowance and comprehensive medical insurance; international travel is self-funded", applicableDegree: "Master, Doctoral",
    applicableProgram: "Eligible Wuhan University 2026 master's and doctoral programs", amountText: "Full scholarship; the Wuhan University notice does not itemize the living-allowance amount",
    deadlineDate: "2026-02-25", deadlineLabel: "February 25, 2026", applicationRound: "November 15, 2025 - February 25, 2026",
    summary: "Full CSC Type B graduate scholarship nominated by Wuhan University.",
    benefitItems: [benefit("Tuition and application fee waiver"), benefit("Accommodation"), benefit("Living allowance", "Amount not itemized by WHU"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Master", "Bachelor's degree and under 35"), info("Doctoral", "Master's degree and under 40"), info("Chinese-taught route", "HSK 4; HSK 5 permits direct major study under the published rule"), info("English-taught route", "TOEFL 80 or IELTS 6.0, subject to published exemptions"), info("Minimum GPA", "3.0/4.0, 3.75/5.0, or 75%"), info("Cannot hold another scholarship")],
    applicationMaterials: commonGraduateMaterials,
    applicationSteps: [info("Step 1", "Complete the CSC Type B application using WHU agency number 10486"), info("Step 2", "Complete the Wuhan University application and select Chinese Government Program Type B"), info("Step 3", "If nominated, return to CSC to add the WHU pre-admission notice when instructed")],
  }),
  scholarship("whu-china-studies-phd-fellowship-2026", {
    slug: "official-2026-whu-china-studies-phd-fellowship", title: "Wuhan University 2026-2027 China Studies Program Ph.D. Fellowships", nameZh: "武汉大学2026-2027学年中国研究博士项目奖学金",
    type: "government", typeLabel: "China Studies Program Ph.D. Fellowships", providerNameEn: "Center for Language Education and Cooperation / Wuhan University", fundingLevel: "Full",
    coverage: "Tuition, living expenses, international round-trip airfare, insurance and priority access to research funding opportunities", applicableDegree: "Joint Research Doctoral, Doctoral",
    applicableProgram: "China-related humanities and social-science research conducted in Chinese", amountText: "Full fellowship; the Wuhan University notice does not itemize stipend or research-funding amounts",
    deadlineDate: "2026-02-28", deadlineLabel: "February 28, 2026", applicationRound: "2026-2027 academic year",
    summary: "CLEC fellowship for registered overseas doctoral researchers or foreign master's graduates pursuing China-related doctoral study at WHU.",
    benefitItems: [benefit("Tuition"), benefit("Living expenses", "Amount not itemized by WHU"), benefit("International round-trip airfare"), benefit("Insurance"), benefit("Research funding opportunities", "Priority access")],
    eligibilityItems: [info("Research field", "China-related humanities or social sciences; research conducted in Chinese"), info("Joint Research Ph.D.", "Non-Chinese citizen, registered doctoral student abroad, HSK 3 or above"), info("Ph.D. in China", "Non-Chinese citizen, master's degree holder or graduating master's student, HSK 5 or above")],
    applicationMaterials: [info("Research plan and prior research results"), info("Degree/enrollment evidence and transcripts as applicable"), info("Two expert recommendation letters"), info("HSK report"), info("Passport"), info("Non-criminal record and physical examination"), info("WHU supervisor acceptance letter if available")],
    applicationSteps: [info("Step 1", "Apply in the China Studies Program Ph.D. system"), info("Step 2", "Submit the same application materials in the Wuhan University system"), info("Step 3", "Complete WHU review, expert review and CLEC online interview")],
  }),
];

const undergraduate = evidence.get("whu-undergraduate-guide-2026")!;
const postgraduate = evidence.get("whu-postgraduate-guide-2026")!;
const csca = evidence.get("whu-csca-instructions-2026")!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{ slug: citySlug, nameEn: "Wuhan", nameZh: "武汉", region: "Central China", province: "Hubei", status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt, sourceFieldLineage: { nameEn: "official WHU admissions-office address", province: "official WHU admissions-office address" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Wuhan University", nameZh: "武汉大学", citySlug, schoolType: "public", region: "Wuhan, Hubei, Central China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese or English depending on program",
    languageRequirement: "Chinese-taught programs generally require HSK 4 (180+); English-taught programs generally require TOEFL 80+, TOEFL Essentials 8+, or IELTS 6.0+, subject to published exemptions.",
    hskRequirement: "HSK 4 score 180 or above for Chinese-taught degree applications, subject to published prior-Chinese-medium exemptions.",
    englishRequirement: "TOEFL 80+, TOEFL Essentials 8+, or IELTS 6.0+, subject to published native-English or prior-English-medium exemptions.",
    deadlineSummary: "Self-funded autumn 2026: undergraduate June 30, 2026; master's and doctoral June 15, 2026. Scholarship deadlines vary by route.",
    applicationFee: "Postgraduate self-funded application: CNY 800 / USD 111; the collected undergraduate guide body does not state its application fee.",
    websiteUrl: "https://www.whu.edu.cn/", admissionsUrl: applicationUrl, cscaRequired: true,
    cscaRequirement: "All international undergraduate applicants must take CSCA from 2026. Subject combinations depend on liberal arts, science/engineering, medicine and teaching language.",
    cscaSubjects: ["Professional Chinese - Humanities", "Professional Chinese - STEM", "Mathematics", "Physics", "Chemistry"],
    subjectTags: ["Humanities", "Science", "Engineering", "Medicine", "Economics", "Law", "Management"], languageTags: ["Chinese", "English"],
    campusHighlights: ["Undergraduate programs normally last four to six years", "Master's programs normally last two to three years", "Doctoral programs normally last four years", "Six independently documented 2026 scholarship routes"],
    status: "draft", sourceUrl: undergraduate.url, sourceLabel: undergraduate.label, sourceSha256: undergraduate.sha256, capturedAt: undergraduate.fetchedAt,
    sourceFieldLineage: { nameEn: "official 2026 admissions-guide title and institution name", citySlug: "official admissions-office address", applicationLevel: "2026 undergraduate and postgraduate guide scope", languageRequirement: "2026 undergraduate and postgraduate eligibility sections", deadlineSummary: "2026 undergraduate and postgraduate application-period sections", applicationFee: "2026 postgraduate application-documents section", admissionsUrl: "official guide online-application section", cscaRequirement: `${csca.id} WHU test-subjects section` },
  }],
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`WHU candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: manifest.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: 0, scholarshipCount: scholarships.length, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch creates only new public institutional records and does not archive or overwrite an existing Wuhan University record." },
  reconciliation: { existingSchoolCount: 0, existingProgramCount: 0, existingScholarshipCount: 0, legacyProgramAliasesToArchive: [], legacyScholarshipAliasesToArchive: [], destructiveDeletion: false },
  unresolvedFields: [
    "Five official program-catalog DOCX links returned a CAPTCHA page to the registered collector; CAPTCHA solving and access-control bypass are prohibited, so this batch does not publish a program inventory.",
    "The fee attachments also require the protected download flow, so no undergraduate tuition schedule or full program-level fee table is published.",
    "The bilateral scholarship's exact deadline and award level depend on the home-country dispatching authority.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and nine publishable public official snapshots", note: "Only public institutional, admissions and scholarship information is included. Public staff names and direct staff contact details present on source pages were deliberately excluded. No applicant, account, passport, payment or uploaded-document data is present." },
  reviewNotes: ["The batch intentionally separates independently documented awards; it does not convert admissions notices into generic scholarship placeholders.", "Six scholarship records include eligibility, benefits, materials, steps, deadlines and official source lineage where directly published.", "No existing catalog record is archived, renamed or overwritten by this batch."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const review = { ...reviewBase, reviewHash, publicationReference: `standing-user-default-publication:${reviewHash}` };
await Promise.all([
  writeFile(candidatePath, candidateText),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, schoolCount: 1, scholarshipCount: scholarships.length, programRouteCount: 0, candidateSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
