import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const schoolBundlePath = resolve(root, "seeds/catalog.bit-school-program-batch-01.approved.local.json");
const manifestPath = resolve(root, "work/catalog-official/2026-09-11T09-19-34-830Z/manifest.json");
const draftPath = resolve(root, "seeds/catalog.bit-scholarships-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.bit-scholarships-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.bit-scholarships-batch-01.review.json");
const sourceId = "bit-admission-scholarship-book-2026";
const sourceUrl = "https://isc.bit.edu.cn/docs/2025-11/b59c4c1d2b41494f9e2edc2c0993742b.pdf";
const sourceLabel = "Beijing Institute of Technology 2026 Admission and Scholarship Book";
const schoolSlug = "beijing-institute-of-technology";

const [schoolBundle, manifest] = await Promise.all([
  readFile(schoolBundlePath, "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
]);
const evidence = manifest.sources?.find((item: any) => item.id === sourceId);
if (!evidence || evidence.url !== sourceUrl || evidence.status !== 200 || evidence.contentType !== "application/pdf") {
  throw new Error("The reviewed BIT scholarship PDF snapshot is missing or no longer matches the registered source.");
}
if (evidence.sha256 !== "b0b66ba49c95ea86d2efcb0099aaf7a585ab3f0f34d56e6ec0161199001d3195") {
  throw new Error("The BIT scholarship PDF checksum changed after review.");
}

const common = {
  schoolSlug,
  sourceUrl,
  sourceLabel,
  sourceSha256: evidence.sha256,
  capturedAt: evidence.fetchedAt,
  status: "draft" as const,
};
const links = (extras: Array<{ label: string; url: string; kind: string }> = []) => [
  { label: "Official BIT admission and scholarship book", url: sourceUrl, kind: "official-source" },
  ...extras,
];
const sections = (summary: string, notes: string[]) => [
  { title: "Program overview", body: summary },
  { title: "Important application notes", items: notes },
];
const items = (values: string[]) => values.map(label => ({ label }));
const benefits = (values: string[]) => values.map(label => ({ label, included: true }));
const steps = (values: string[]) => values.map((body, index) => ({ label: `Step ${index + 1}`, body }));

const scholarships: CatalogSeedScholarship[] = [
  make({
    slug: "official-2026-bit-chinese-government-scholarship",
    title: "BIT 2026 Chinese Government Scholarship - University Program",
    nameZh: "北京理工大学2026年中国政府奖学金高校项目",
    type: "government", typeLabel: "Chinese Government Scholarship", fundingLevel: "Full",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会",
    providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", providerLocation: "China",
    applicableDegree: "Master, Doctoral", applicableProgram: "High-level Graduate Program, Silk Road Program and other approved Type B routes",
    amountText: "Tuition and accommodation covered; CNY 3,000/month master's or CNY 3,500/month doctoral stipend; CNY 800/year insurance.",
    benefitValues: ["Tuition waiver", "University dormitory or accommodation subsidy", "CNY 3,000 monthly master's stipend", "CNY 3,500 monthly doctoral stipend", "CNY 800 annual medical insurance"],
    eligibilityValues: ["Bachelor's degree for master's applicants", "Master's degree in the same or a related field for doctoral applicants", "Proficient in Chinese or English", "HSK 5 score 180+ for Chinese-taught study or TOEFL 85/IELTS 6.0 for English-taught study"],
    materialValues: ["BIT online application form", "Passport information page", "Statement of purpose, study plan and CV", "Notarized highest diploma and transcripts", "Language test result", "Two academic recommendations and BIT adviser recommendation form for graduate applicants", "Physical examination record", "CSC application in the national system"],
    stepValues: ["Apply first in the CSC system as Type B using BIT agency number 10007", "Apply in the BIT system and upload required documents", "Submit by the applicable round deadline", "Maintain scholarship through the required annual review after admission"],
    deadlineDate: "2026-04-15", deadlineLabel: "Round 1: February 15, 2026; Round 2: April 15, 2026", applicationRound: "October 15, 2025 - April 15, 2026",
    pages: "pages 17-18", sortOrder: 100,
  }),
  make({
    slug: "official-2026-bit-chinese-government-scholarship-bilateral-program",
    title: "BIT 2026 Chinese Government Scholarship - Bilateral Program",
    nameZh: "北京理工大学2026年中国政府奖学金国别双边项目",
    type: "government", typeLabel: "Chinese Government Scholarship - Bilateral Program", fundingLevel: "Set by the scholarship authority",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会",
    providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", providerLocation: "China",
    applicableDegree: "Eligible BIT degree routes", applicableProgram: "Programs permitted by the bilateral agreement and home-country dispatching authority",
    amountText: "The BIT guide does not publish a separate award amount or coverage table for Type A; terms follow the applicable bilateral agreement and dispatching authority.",
    benefitValues: ["Award coverage is determined by the applicable bilateral agreement and scholarship authority"],
    eligibilityValues: ["Applicant must be eligible under a cooperation or exchange agreement between China and the applicant's home country or institution", "Applicant must meet the chosen BIT program's admission requirements"],
    materialValues: ["Materials required by the applicant's home-country dispatching department", "BIT admission materials required for the chosen degree route"],
    stepValues: ["Contact the dispatching department in the applicant's home country", "Apply according to the dispatching department's timetable and procedure", "Complete BIT admission steps if instructed by the dispatching authority or BIT"],
    deadlineLabel: "Set by the dispatching department in the applicant's home country", applicationRound: "2026 bilateral-program intake",
    pages: "page 18", unresolved: ["coverage and amount", "central deadline", "route-specific materials"],
    derivedFields: ["coverage", "amountText", "benefitItems", "applicationMaterials", "applicationSteps", "deadlineLabel", "applicationRound"], sortOrder: 110,
  }),
  make({
    slug: "official-2026-bit-international-chinese-language-teachers-scholarship",
    title: "BIT 2026 International Chinese Language Teachers Scholarship",
    nameZh: "北京理工大学2026年国际中文教师奖学金",
    type: "education-center", typeLabel: "International Chinese Language Teachers Scholarship", fundingLevel: "Per scholarship authority rules",
    providerName: "教育部中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", providerLocation: "China",
    applicableDegree: "Master", applicableProgram: "International Chinese Language Education only",
    amountText: "The BIT guide confirms the supported master's program but refers applicants to the official program page for current funding terms.",
    benefitValues: ["Funding follows the International Chinese Language Teachers Scholarship rules published for the route"],
    eligibilityValues: ["Apply to the master's program in International Chinese Language Education", "Meet the admission and scholarship conditions published for the route"],
    materialValues: ["BIT graduate admission materials", "Additional scholarship documents listed on the official program page"],
    stepValues: ["Review the official BIT International Chinese Language Teachers Scholarship page", "Complete the scholarship and BIT admission applications required for the route"],
    deadlineLabel: "Not stated in the BIT admission book; verify on the official program page",
    actionExtras: [{ label: "Official BIT scholarship program page", url: "https://isc.bit.edu.cn/admissionsaid/cip/index.htm", kind: "official-application" }],
    pages: "page 18", unresolved: ["2026 deadline", "coverage and amount", "route-specific materials"],
    derivedFields: ["coverage", "amountText", "requirementText", "benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "deadlineLabel"], sortOrder: 120,
  }),
  make({
    slug: "official-2026-bit-beijing-government-scholarship",
    title: "BIT 2026 Beijing Government Scholarship",
    nameZh: "北京理工大学2026年北京市政府奖学金",
    type: "local-government", typeLabel: "Beijing Government Scholarship", fundingLevel: "Category A, B or C",
    providerName: "北京市人民政府", providerNameEn: "Beijing Municipal Government", providerLocation: "Beijing",
    applicableDegree: "Eligible BIT international degree routes", applicableProgram: "Beijing campus only",
    amountText: "Category A covers tuition, university accommodation, stipend and insurance; Category B covers tuition, accommodation and insurance; Category C covers tuition and insurance.",
    benefitValues: ["Category A: tuition, university accommodation, stipend and comprehensive insurance", "Category B: tuition, university accommodation and comprehensive insurance", "Category C: tuition and comprehensive insurance"],
    eligibilityValues: ["Apply for an eligible BIT international degree route", "Study at BIT's Beijing campus", "Meet the scholarship and admission requirements for the selected route"],
    materialValues: ["BIT admission materials for the selected degree route", "Any additional Beijing Government Scholarship documents requested in the current procedure"],
    stepValues: ["Review the official Beijing scholarship information page", "Complete the applicable BIT admission and scholarship procedure by the deadline"],
    deadlineDate: "2026-05-01", deadlineLabel: "May 1, 2026", applicationRound: "2026 intake",
    actionExtras: [{ label: "Official Beijing scholarship information", url: "https://english.beijing.gov.cn/studyinginbeijing/index.html", kind: "official-source" }],
    pages: "pages 18-19", unresolved: ["category assignment criteria", "route-specific materials"],
    derivedFields: ["applicableDegree", "requirementText", "eligibilityItems", "applicationMaterials", "applicationSteps"], sortOrder: 130,
  }),
  make({
    slug: "official-2026-bit-guangdong-government-outstanding-international-student-scholarship",
    title: "BIT 2026 Guangdong Government Outstanding International Student Scholarship",
    nameZh: "北京理工大学2026年广东省政府优秀来华留学生奖学金",
    type: "local-government", typeLabel: "Guangdong Government Outstanding International Student Scholarship", fundingLevel: "Fixed award by degree level",
    providerName: "广东省人民政府", providerNameEn: "Guangdong Provincial Government", providerLocation: "Guangdong",
    applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "Zhuhai campus only",
    amountText: "CNY 10,000 per undergraduate student; CNY 20,000 per master's student; CNY 30,000 per doctoral student.",
    benefitValues: ["Undergraduate award: CNY 10,000 per student", "Master's award: CNY 20,000 per student", "Doctoral award: CNY 30,000 per student"],
    eligibilityValues: ["Apply for or study in an eligible BIT degree route", "Study at BIT's Zhuhai campus", "Meet the scholarship and admission requirements for the selected route"],
    materialValues: ["BIT admission materials for the selected degree route", "Any additional Guangdong scholarship documents requested in the current procedure"],
    stepValues: ["Review the Guangdong government scholarship policy cited by BIT", "Complete the applicable BIT admission and scholarship procedure by the deadline"],
    deadlineDate: "2026-05-01", deadlineLabel: "May 1, 2026", applicationRound: "2026 intake",
    actionExtras: [{ label: "Official Guangdong scholarship policy cited by BIT", url: "https://www.gd.gov.cn/zwgk/gongbao/2013/28/content/post_3364046.html", kind: "official-source" }],
    pages: "page 19", unresolved: ["route-specific materials", "selection procedure"],
    derivedFields: ["requirementText", "eligibilityItems", "applicationMaterials", "applicationSteps"], sortOrder: 140,
  }),
  make({
    slug: "official-2026-bit-international-student-scholarship",
    title: "BIT 2026 International Student Scholarship",
    nameZh: "北京理工大学2026年国际学生奖学金",
    type: "university", typeLabel: "University Scholarship", fundingLevel: "Full-length or one-year tiered award",
    providerName: "北京理工大学", providerNameEn: "Beijing Institute of Technology", providerLocation: "Beijing / Zhuhai",
    applicableDegree: "Eligible BIT degree students", applicableProgram: "Eligible BIT international degree routes",
    amountText: "Full-length: first prize covers tuition, accommodation, stipend and insurance; second covers tuition and accommodation; third covers tuition. One-year: first covers tuition and accommodation; second covers tuition; third covers 50% tuition; fourth covers 25% tuition.",
    benefitValues: ["Full-length first prize: tuition, university accommodation, stipend and comprehensive insurance", "Full-length second prize: tuition and university accommodation", "Full-length third prize: tuition", "One-year first prize: tuition and university accommodation", "One-year second prize: tuition", "One-year third prize: 50% tuition", "One-year fourth prize: 25% tuition"],
    eligibilityValues: ["Apply for or study in an eligible BIT international degree route", "Full-length recipients must pass the annual review to retain benefits for the following academic year"],
    materialValues: ["BIT admission materials for the selected degree route", "Any additional scholarship documents requested by BIT during award review"],
    stepValues: ["Complete the applicable BIT international student application", "Submit any scholarship materials requested by BIT by May 1, 2026", "Complete annual review each year if awarded a full-length scholarship"],
    deadlineDate: "2026-05-01", deadlineLabel: "May 1, 2026", applicationRound: "2026 intake",
    actionExtras: [{ label: "BIT international student application system", url: "https://apply.isc.bit.edu.cn", kind: "official-application" }],
    pages: "page 19", unresolved: ["award selection criteria", "route-specific materials"],
    derivedFields: ["applicableDegree", "applicableProgram", "requirementText", "eligibilityItems", "applicationMaterials", "applicationSteps"], sortOrder: 150,
  }),
];

function make(input: {
  slug: string; title: string; nameZh: string; type: string; typeLabel: string; fundingLevel: string;
  providerName: string; providerNameEn: string; providerLocation: string; applicableDegree: string; applicableProgram: string;
  amountText: string; benefitValues: string[]; eligibilityValues: string[]; materialValues: string[]; stepValues: string[];
  deadlineDate?: string; deadlineLabel: string; applicationRound?: string;
  actionExtras?: Array<{ label: string; url: string; kind: string }>; pages: string; unresolved?: string[]; derivedFields?: string[]; sortOrder: number;
}): CatalogSeedScholarship {
  const summary = `${input.title} is a scholarship route named in BIT's official 2026 admission and scholarship book. Published funding, scope, deadline and application details are recorded below without filling unresolved fields by inference.`;
  const record = {
    ...common,
    slug: input.slug, title: input.title, nameZh: input.nameZh,
    type: input.type, typeLabel: input.typeLabel, fundingLevel: input.fundingLevel,
    providerName: input.providerName, providerNameEn: input.providerNameEn, providerLocation: input.providerLocation,
    coverage: input.benefitValues.join("; "), applicableDegree: input.applicableDegree, applicableProgram: input.applicableProgram,
    amountText: input.amountText, requirementText: input.eligibilityValues.join("; "),
    bodySections: sections(summary, input.stepValues), benefitItems: benefits(input.benefitValues),
    eligibilityItems: items(input.eligibilityValues), applicationMaterials: items(input.materialValues),
    applicationSteps: steps(input.stepValues), actionLinks: links(input.actionExtras),
    deadlineDate: input.deadlineDate, deadlineLabel: input.deadlineLabel, applicationRound: input.applicationRound,
    targetCountries: [], targetRegions: [], benefits: input.benefitValues,
    tags: ["2026", input.typeLabel, input.applicableDegree], summary, sortOrder: input.sortOrder,
  };
  const evidenceFields = new Set(["sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "status"]);
  const derivedFields = new Set([
    "slug", "nameZh", "type", "typeLabel", "fundingLevel", "providerName", "providerNameEn", "providerLocation",
    "schoolSlug", "applicableDegree", "applicableProgram", "bodySections", "tags", "summary", "sortOrder",
    ...(input.derivedFields ?? []),
  ]);
  const sourceFieldLineage = Object.fromEntries(Object.keys(record)
    .filter(field => !evidenceFields.has(field) && (record as any)[field] !== undefined)
    .map(field => [field, `${derivedFields.has(field) ? "derived" : "explicit"}: BIT 2026 Admission and Scholarship Book ${input.pages}`]));
  return { ...record, sourceFieldLineage };
}

if (scholarships.length !== 6 || new Set(scholarships.map(item => item.slug)).size !== 6) throw new Error("BIT scholarship batch must contain exactly six distinct schemes.");
const candidateRaw = {
  version: 1,
  generatedAt: evidence.fetchedAt,
  cities: (schoolBundle.cities ?? []).map((item: any) => {
    const { verificationStatus: _verificationStatus, lastVerifiedAt: _lastVerifiedAt, ...rest } = item;
    return { ...rest, status: "draft" };
  }),
  schools: (schoolBundle.schools ?? []).map((item: any) => {
    const { verificationStatus: _verificationStatus, lastVerifiedAt: _lastVerifiedAt, ...rest } = item;
    return { ...rest, status: "draft" };
  }),
  programs: [], programIntakes: [], scholarships,
};
const serializedCandidate = `${JSON.stringify(candidateRaw, null, 2)}\n`;
const candidate = JSON.parse(serializedCandidate);
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Generated BIT scholarship candidate is invalid:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt: evidence.fetchedAt,
  scope: { schoolSlug, schoolCount: 1, scholarshipCount: 6, existingVerifiedCount: 1, newScholarshipCount: 5 },
  evidence: { sourceId, sourceUrl, sourceLabel, sha256: evidence.sha256, fetchedAt: evidence.fetchedAt, contentType: evidence.contentType, pagesReviewed: [17, 18, 19] },
  reconciliation: { stableMatchingSlugs: ["official-2026-bit-chinese-government-scholarship"], newScholarshipCount: 5, legacyAliasesToArchive: [], destructiveDeletion: false },
  records: scholarships.map(item => ({
    slug: item.slug, title: item.title, fundingLevel: item.fundingLevel, applicableDegree: item.applicableDegree,
    applicableProgram: item.applicableProgram, deadlineDate: item.deadlineDate ?? null, deadlineLabel: item.deadlineLabel,
    unresolvedFields: item.slug.endsWith("bilateral-program") ? ["coverage and amount", "central deadline", "route-specific materials"]
      : item.slug.endsWith("language-teachers-scholarship") ? ["2026 deadline", "coverage and amount", "route-specific materials"]
      : item.slug.endsWith("beijing-government-scholarship") ? ["category assignment criteria", "route-specific materials"]
      : item.slug.endsWith("outstanding-international-student-scholarship") ? ["route-specific materials", "selection procedure"]
      : item.slug.endsWith("international-student-scholarship") ? ["award selection criteria", "route-specific materials"] : [],
  })),
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional scholarship information is included; no applicant, account, payment, private-file or personal-contact data is present." },
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
};
await Promise.all([
  writeFile(draftPath, serializedCandidate, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true, draftPath, validationPath, reviewPath,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"),
  summary: validation.summary,
}, null, 2));
