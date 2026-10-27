import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T03-40-58-190Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { generatedAt: string; sources: ManifestSource[] };
const expected = new Map([
  ["suda-international-chinese-language-teachers-scholarship-2026-2027", "24ea2a9779889d450a7fd71fbef8f69225013e4517fea57533478d7762da21a4"],
  ["suda-csca-international-preparatory-program-2026-2027", "f92ccc37455af3f90f7feff5d661267066418e507c361846848b8f9e74b11dbd"],
  ["upc-cgs-master-doctoral-2027", "af6d5c3dc1f79316a9fd8ca4b92918fa6c4ae5d8748787ed0df598eb7f301c6f"],
  ["upc-cgs-application-materials-2027", "1b767bf8b30f38b9a96acaaec5cbd9e3766f24d70582d7a516c7d8272c4a9008"],
  ["upc-international-entry-requirements-current", "16728ec4015aa4e0bdeced4a96bdbc50e9b2f2ea80335cab14cc94559fffc3c6"],
]);
const evidence = new Map<string, ManifestSource>();
for (const [id, sha256] of expected) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked official evidence ${id} at ${sha256}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  evidence.set(id, source);
}

const sourceFields = (id: string) => {
  const source = evidence.get(id);
  if (!source) throw new Error(`Missing source ${id}.`);
  return {
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
  };
};
const sudaScholarshipId = "suda-international-chinese-language-teachers-scholarship-2026-2027";
const upcScholarshipId = "upc-cgs-master-doctoral-2027";
const upcMaterialsId = "upc-cgs-application-materials-2027";
const upcRequirementsId = "upc-international-entry-requirements-current";
const sudaScholarshipSource = evidence.get(sudaScholarshipId)!;
const upcScholarshipSource = evidence.get(upcScholarshipId)!;

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
for (const schoolSlug of ["soochow-university", "china-university-of-petroleum-east-china"]) {
  if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error(`${schoolSlug} is already present in the 100-school base.`);
}
const qingdao = dependency.cities?.find((row) => row.slug === "qingdao");
if (!qingdao) throw new Error("Qingdao city dependency is missing.");

const suzhou = {
  slug: "suzhou",
  nameEn: "Suzhou",
  nameZh: "苏州",
  region: "East China",
  province: "Jiangsu",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: sudaScholarshipSource.fetchedAt,
  ...sourceFields(sudaScholarshipId),
  sourceFieldLineage: {
    nameEn: "official scholarship guide contact address",
    nameZh: "official scholarship guide contact address",
    region: "official Jiangsu address plus CUAC geographic taxonomy",
    province: "official scholarship guide contact address",
  },
};

const schools = [
  {
    slug: "soochow-university",
    nameEn: "Soochow University",
    nameZh: "苏州大学",
    citySlug: "suzhou",
    schoolType: "Public",
    region: "Suzhou, Jiangsu, East China",
    applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
    languageOfInstruction: "Chinese and English, by program",
    languageRequirement: "The March 2027 one-semester scholarship route requires the published HSK and HSKK evidence for the selected subject direction.",
    hskRequirement: "For March 2027 International Chinese Language Education, Chinese Language and Literature, Chinese History or Chinese Philosophy: HSK Level 3 score 180 plus an HSKK result. Traditional Chinese Medicine and Taiji Culture require an HSK result, with HSKK preferred.",
    deadlineSummary: "The March 2027 International Chinese Language Teachers Scholarship application closes October 31, 2026. General 2027 degree deadlines are not established by the captured sources.",
    tuitionSummary: "The March 2027 scholarship covers tuition, accommodation, living allowance and comprehensive medical insurance. The separately captured CSCA preparatory guide publishes CNY 10,000 for one semester and CNY 18,000 for one academic year, but does not explicitly label a 2027 degree cycle.",
    websiteUrl: "https://oversea.suda.edu.cn/oversea_en/",
    admissionsUrl: "https://oversea.suda.edu.cn/oversea_en/11343/list.htm",
    subjectTags: ["Chinese Language", "Chinese Literature", "Chinese History", "Chinese Philosophy", "Traditional Chinese Medicine", "Taiji Culture"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["March 2027 one-semester International Chinese Language Teachers Scholarship route", "Current CSCA international Chinese preparatory program"],
    contactNotes: "School of Overseas Education, Main Campus, No. 333 Ganjiang Road, Suzhou, Jiangsu; +86-512-65223787; wjxia@suda.edu.cn.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: sudaScholarshipSource.fetchedAt,
    ...sourceFields(sudaScholarshipId),
    sourceFieldLineage: {
      nameEn: "official English scholarship guide title and contact section",
      nameZh: "official Chinese preparatory guide title",
      citySlug: "official scholarship guide contact address",
      schoolType: "official institutional identity",
      region: "official contact address plus CUAC geographic taxonomy",
      applicationLevel: "official site program navigation; exact 2027 evidence is limited to one-semester non-degree study",
      languageOfInstruction: "official site program navigation and captured scholarship/preparatory guides",
      languageRequirement: "official scholarship guide, Scholarship Types and Qualifications",
      hskRequirement: "official scholarship guide, one-semester route",
      deadlineSummary: "official scholarship guide, March 2027 deadline",
      tuitionSummary: "official scholarship guide coverage and captured preparatory guide fee table",
      websiteUrl: "official School of Overseas Education English domain",
      admissionsUrl: "official application index",
      campusHighlights: "captured official scholarship and preparatory guides",
      contactNotes: "official scholarship guide contact section",
    },
  },
  {
    slug: "china-university-of-petroleum-east-china",
    nameEn: "China University of Petroleum (East China)",
    nameZh: "中国石油大学（华东）",
    citySlug: "qingdao",
    schoolType: "Public",
    region: "Qingdao, Shandong, East China",
    applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
    languageOfInstruction: "Chinese and English, by program",
    languageRequirement: "Current general entry requirements publish HSK Level 5 score 180 for Chinese-taught graduate admission and IELTS 6.5 or TOEFL 85 for English-taught graduate admission. The 2027 scholarship material separately states a minimum HSK Level 4 for Chinese-taught graduate scholarship applications; applicants must satisfy the university's applicable program requirement.",
    hskRequirement: "Current general graduate entry requirement: HSK Level 5 score 180 or accepted Chinese-medium evidence. The 2027 Chinese Government Scholarship material states HSK Level 4 as the scholarship application minimum for Chinese-taught master's and doctoral study.",
    englishRequirement: "Current general graduate entry requirement: IELTS 6.5, TOEFL 85, an equivalent recognized test, accepted prior English-medium evidence, or a published exemption for applicants whose native/common/working/official language is English or who pass the interview.",
    deadlineSummary: "The 2027 Chinese Government Scholarship master's and doctoral application window is October 16 through December 15, 2026. General self-funded 2027 deadlines are not established by the captured sources.",
    tuitionSummary: "The 2027 Chinese Government Scholarship waives tuition and provides accommodation, stipend and medical insurance. General self-funded tuition remains unresolved in this wave.",
    websiteUrl: "https://cie.upc.edu.cn/admission_en/",
    admissionsUrl: "https://cie.upc.edu.cn/admission_en/Admission/Entry_Requirements.htm",
    subjectTags: ["Engineering", "Energy", "Science", "Management", "Humanities"],
    languageTags: ["Chinese", "English"],
    campusHighlights: ["2027 Chinese Government Scholarship master's and doctoral route", "Chinese- and English-taught international study pathways"],
    contactNotes: "College of International Education, 66 Changjiang West Road, Qingdao West Coast New Area, Shandong; +86-532-86983201/86981298; admission@upc.edu.cn.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: upcScholarshipSource.fetchedAt,
    ...sourceFields(upcScholarshipId),
    sourceFieldLineage: {
      nameEn: "official scholarship guide contact section",
      nameZh: "official current Chinese admissions site identity",
      citySlug: "official scholarship guide contact address",
      schoolType: "official institutional identity",
      region: "official contact address plus CUAC geographic taxonomy",
      applicationLevel: "official current entry-requirements categories",
      languageOfInstruction: "official scholarship guide supporting categories and current entry requirements",
      languageRequirement: "official current entry requirements cross-checked against official 2027 scholarship materials",
      hskRequirement: "official current entry requirements and official 2027 scholarship materials; both thresholds retained",
      englishRequirement: "official current entry requirements",
      deadlineSummary: "official scholarship guide, Application Time",
      tuitionSummary: "official scholarship guide, Scholarship Coverage",
      websiteUrl: "official international admissions domain",
      admissionsUrl: "official current entry requirements",
      campusHighlights: "official scholarship guide and current international admissions taxonomy",
      contactNotes: "official scholarship guide contact section",
    },
  },
];

const programs = [{
  slug: "soochow-university-international-chinese-language-teachers-one-semester",
  schoolSlug: "soochow-university",
  citySlug: "suzhou",
  nameEn: "International Chinese Language Teachers Scholarship One-Semester Study Program",
  nameZh: "国际中文教师奖学金一学期研修生",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Language",
  subjectArea: "International Chinese Language Education, Chinese Language and Literature, Chinese History, Chinese Philosophy, Traditional Chinese Medicine or Taiji Culture",
  teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 3 score 180 plus an HSKK result for International Chinese Language Education, Chinese Language and Literature, Chinese History or Chinese Philosophy. Traditional Chinese Medicine and Taiji Culture require an HSK result; HSKK is preferred.",
  tuitionText: "Tuition is covered for scholarship recipients.",
  scholarshipText: "Full International Chinese Language Teachers Scholarship covering tuition, accommodation, CNY 2,500 monthly living allowance and comprehensive medical insurance.",
  applicationUrl: "https://www.chinese.cn",
  applicationNote: "Apply through the International Chinese Language Teachers Scholarship portal and select Soochow University as first choice.",
  hasScholarship: true,
  badgeText: "Spring 2027",
  displayTuition: "Full scholarship",
  displaySubjects: ["Chinese Language", "Chinese Literature", "Chinese History", "Chinese Philosophy", "Traditional Chinese Medicine", "Taiji Culture"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: sudaScholarshipSource.fetchedAt,
  ...sourceFields(sudaScholarshipId),
  sourceFieldLineage: {
    nameEn: "official scholarship guide, one-semester study program",
    nameZh: "official Chinese-language guide, one-semester route",
    degreeLevel: "official five-month study-program classification",
    durationMonths: "official scholarship guide, one-semester duration",
    subjectArea: "official scholarship guide, one-semester eligible directions",
    teachingLanguage: "official HSK/HSKK requirements and program scope",
    hskRequirement: "official scholarship guide, one-semester qualifications",
    tuitionText: "official scholarship guide coverage",
    scholarshipText: "official scholarship guide coverage and stipend",
    applicationUrl: "official scholarship guide application procedure",
    applicationNote: "official scholarship guide application procedure and contact instructions",
  },
}];

const programIntakes = [{
  programSlug: programs[0].slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-10-31T15:59:59.000Z",
  deadlineLabel: "Student applications close October 31, 2026; recommending and host institution reviews close November 10, 2026.",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship",
  status: "open" as const,
  ...sourceFields(sudaScholarshipId),
  sourceFieldLineage: {
    intakeTerm: "official scholarship guide, March 2027 admission",
    intakeYear: "official scholarship guide, March 2027 admission",
    deadlineDate: "official scholarship guide, March 2027 deadline",
    deadlineLabel: "official scholarship guide, Deadlines",
    applicationRound: "official scholarship guide title and one-semester route",
  },
}];

const scholarships = [
  {
    slug: "soochow-university-international-chinese-language-teachers-spring-2027",
    schoolSlug: "soochow-university",
    programSlug: programs[0].slug,
    title: "International Chinese Language Teachers Scholarship at Soochow University — Spring 2027",
    nameZh: "苏州大学国际中文教师奖学金（2027年春季）",
    type: "government",
    typeLabel: "International Chinese Language Teachers Scholarship",
    providerName: "中外语言交流合作中心 / 苏州大学",
    providerNameEn: "Center for Language Education and Cooperation / Soochow University",
    providerLocation: "Suzhou, Jiangsu, China",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, CNY 2,500 monthly living allowance and comprehensive medical insurance.",
    applicableDegree: "One-semester non-degree study",
    applicableProgram: "International Chinese Language Education, Chinese Language and Literature, Chinese History, Chinese Philosophy, Traditional Chinese Medicine and Taiji Culture directions published for the March 2027 route.",
    amountText: "CNY 2,500 monthly living allowance; tuition, accommodation and comprehensive medical insurance are also covered.",
    requirementText: "Applicants must be non-Chinese citizens, normally age 16-35 as of September 1, 2026 (up to 45 for in-service Chinese teachers), in good health and committed to Chinese-language education or related work. Route-specific HSK/HSKK requirements apply.",
    benefitItems: [
      { label: "Tuition", included: true, note: "Covered" },
      { label: "Accommodation", included: true, note: "Covered" },
      { label: "Living allowance", included: true, note: "CNY 2,500 per month" },
      { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
    ],
    eligibilityItems: [
      { label: "Nationality", value: "Non-Chinese citizen" },
      { label: "Age", value: "16-35 as of September 1, 2026; up to 45 for in-service Chinese-language teachers" },
      { label: "Main language route", value: "HSK Level 3 score 180 plus an HSKK result" },
      { label: "TCM / Taiji route", value: "An HSK result is required; HSKK is preferred" },
    ],
    applicationMaterials: [
      { label: "Identity", value: "Passport photo page" },
      { label: "Language", value: "Valid HSK and HSKK score reports as applicable" },
      { label: "Recommendation", value: "Recommendation letter from the head of the recommending institution" },
      { label: "Education", value: "Highest diploma or expected-graduation certificate and academic transcript" },
      { label: "Statement", value: "Chinese personal statement of at least 500 Chinese characters" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Apply through the International Chinese Language Teachers Scholarship section of chinese.cn" },
      { label: "Step 2", value: "Select Soochow University as first choice and provide the published university contact information" },
      { label: "Step 3", value: "Submit by October 31, 2026 and track host-institution and centralized review" },
    ],
    actionLinks: [{ label: "Official Soochow University scholarship guide", url: sourceFields(sudaScholarshipId).sourceUrl, kind: "official-source" }],
    deadlineDate: "2026-10-31",
    deadlineLabel: "Student applications close October 31, 2026; recommending and host institution reviews close November 10, 2026.",
    applicationRound: "March 2027 one-semester study",
    summary: "Five-month Spring 2027 scholarship route at Soochow University with tuition, accommodation, stipend and medical-insurance coverage.",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: sudaScholarshipSource.fetchedAt,
    ...sourceFields(sudaScholarshipId),
    sourceFieldLineage: {
      title: "official guide title and March 2027 route",
      coverage: "official guide, scholarship coverage",
      applicableDegree: "official guide, one-semester study program",
      applicableProgram: "official guide, one-semester eligible directions",
      amountText: "official guide, monthly allowance and coverage",
      requirementText: "official guide, eligibility and qualifications",
      benefitItems: "official guide, scholarship coverage",
      eligibilityItems: "official guide, eligibility and qualifications",
      applicationMaterials: "official guide, application material list",
      applicationSteps: "official guide, application procedures",
      deadlineDate: "official guide, March 2027 deadline",
      applicationRound: "official guide, March 2027 admission",
      summary: "official guide scope and coverage",
    },
  },
  {
    slug: "china-university-of-petroleum-east-china-cgs-master-doctoral-2027",
    schoolSlug: "china-university-of-petroleum-east-china",
    title: "Chinese Government Scholarship for Master's and Doctoral Programs at China University of Petroleum (East China) — 2027",
    nameZh: "中国石油大学（华东）2027年中国政府奖学金硕博项目",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B",
    providerName: "国家留学基金管理委员会 / 中国石油大学（华东）",
    providerNameEn: "China Scholarship Council / China University of Petroleum (East China)",
    providerLocation: "Qingdao, Shandong, China",
    fundingLevel: "Full scholarship",
    coverage: "Tuition waiver, free on-campus accommodation, stipend and CNY 800 per year comprehensive medical insurance.",
    applicableDegree: "Master and Doctoral",
    applicableProgram: "Chinese- or English-taught master's and doctoral programs meeting the university's admission requirements.",
    amountText: "Master's stipend CNY 36,000/year; doctoral stipend CNY 42,000/year; medical insurance CNY 800/year.",
    requirementText: "Master's applicants must hold a bachelor's degree and be under 35; doctoral applicants must hold a master's degree and be under 40. The scholarship materials require HSK Level 4 for Chinese-taught study, while current university graduate admission rules publish HSK Level 5 score 180; applicants must meet the applicable university requirement. English-taught graduate admission currently publishes IELTS 6.5 or TOEFL 85 plus listed alternatives/exemptions.",
    benefitItems: [
      { label: "Tuition", included: true, note: "Waived" },
      { label: "Accommodation", included: true, note: "Free on-campus living" },
      { label: "Master's stipend", included: true, note: "CNY 36,000 per year" },
      { label: "Doctoral stipend", included: true, note: "CNY 42,000 per year" },
      { label: "Medical insurance", included: true, note: "CNY 800 per year" },
    ],
    eligibilityItems: [
      { label: "Master's applicant", value: "Bachelor's degree holder under age 35" },
      { label: "Doctoral applicant", value: "Master's degree holder under age 40" },
      { label: "Chinese-taught study", value: "Scholarship materials state HSK Level 4; current UPC graduate admission rules publish HSK Level 5 score 180, so the stricter applicable university requirement must be met" },
      { label: "English-taught study", value: "Current UPC graduate admission rules publish IELTS 6.5 or TOEFL 85, with listed equivalent evidence and exemptions" },
    ],
    applicationMaterials: [
      { label: "Education", value: "Notarized highest diploma and transcripts from undergraduate study onward" },
      { label: "Research plan", value: "Chinese or English study/research plan of at least 1,000 words" },
      { label: "Recommendations", value: "Two Chinese- or English-language letters from professors or associate professors" },
      { label: "Pre-admission", value: "UPC graduate supervisor acceptance letter / university-recognized pre-admission material" },
      { label: "Identity and language", value: "Passport valid beyond September 2027 and required language certificate" },
      { label: "Health and conduct", value: "Foreigner Physical Examination Form and recent non-criminal record" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Complete the CSC Type B application using China University of Petroleum agency number 10425" },
      { label: "Step 2", value: "Complete the UPC International Student Online Application System scholarship application" },
      { label: "Step 3", value: "Submit during the October 16-December 15, 2026 application window" },
    ],
    actionLinks: [
      { label: "Official UPC scholarship guide", url: sourceFields(upcScholarshipId).sourceUrl, kind: "official-source" },
      { label: "Official 2027 application-material specification", url: sourceFields(upcMaterialsId).sourceUrl, kind: "official-source" },
      { label: "Official current entry requirements", url: sourceFields(upcRequirementsId).sourceUrl, kind: "official-source" },
    ],
    deadlineDate: "2026-12-15",
    deadlineLabel: "Applications are accepted from October 16 through December 15, 2026.",
    applicationRound: "2027 Chinese Government Scholarship master's and doctoral enrollment",
    summary: "Full 2027 Chinese Government Scholarship route for eligible Chinese- or English-taught master's and doctoral study at China University of Petroleum (East China).",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: upcScholarshipSource.fetchedAt,
    ...sourceFields(upcScholarshipId),
    sourceFieldLineage: {
      title: "official scholarship guide title plus official application materials establishing enrollment no earlier than September 2027",
      coverage: "official scholarship guide, Scholarship Coverage",
      applicableDegree: "official scholarship guide, Supporting Categories",
      applicableProgram: "official scholarship guide and current entry requirements",
      amountText: "official scholarship guide, Scholarship Coverage",
      requirementText: "official scholarship guide, official 2027 materials and current entry requirements; threshold conflict retained explicitly",
      benefitItems: "official scholarship guide, Scholarship Coverage",
      eligibilityItems: "official scholarship guide, official 2027 materials and current entry requirements",
      applicationMaterials: "official scholarship guide and official application-material PDF",
      applicationSteps: "official scholarship guide, Application Procedures and Application Time",
      actionLinks: "captured official source URLs",
      deadlineDate: "official scholarship guide, Application Time",
      applicationRound: "official application materials require enrollment no earlier than September 2027",
      summary: "official guide scope and coverage",
    },
  },
];

const generatedAt = manifest.sources.map((row) => row.fetchedAt).sort().at(-1) ?? manifest.generatedAt;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [suzhou, qingdao],
  schools,
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 103 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: schools.map((row) => row.slug), newSchools: schools.length, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "Soochow University's captured source explicitly establishes the March 2027 scholarship/non-degree route, but does not establish a general 2027 undergraduate, master's or doctoral admissions cycle; those deadlines and program-level details remain blank.",
    "The separately captured Soochow University CSCA preparatory guide publishes current fees and a December 31, 2026 one-semester application deadline, but does not explicitly print a 2027 intake year; no 2027 intake record is inferred from it.",
    "UPC's general self-funded 2027 program catalogs, tuition and deadlines remain unresolved. This wave includes only the explicitly source-bounded 2027 scholarship route and current school-level entry rules.",
    "UPC's 2027 scholarship material states HSK Level 4 for Chinese-taught graduate scholarship applications, while the current university entry-requirements page states HSK Level 5 score 180. Both are preserved and the candidate instructs applicants to meet the applicable university requirement rather than silently choosing one.",
    "The UPC English admissions index fetch failed after the scholarship, materials and entry-requirements pages were captured. The failed index fetch is not treated as missing content and is not required for the structured rows in this wave.",
    "Beijing Jiaotong University was rechecked; indexed 2027 results are domestic graduate admissions rather than inbound international-student admissions. No international 2027 candidate is claimed.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-103");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 103, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
