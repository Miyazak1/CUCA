import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const schoolSlug = "shanghai-jiao-tong-university";
const schoolBundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.sjtu-school-program-batch-01.approved.local.json"), "utf8"));
const paths = {
  draft: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.review.json"),
};

const sourceDefinitions = [
  ["sjtu-international-graduate-scholarships-2026", "work/catalog-official/2026-09-11T10-41-10-075Z/manifest.json", "ba6b3f1cd05c9968ccd1d72817fb6538e63a63b0d558d231ead151bef45142f9"],
  ["sjtu-international-master-admissions-scholarships-2026", "work/catalog-official/2026-09-11T10-44-01-870Z/manifest.json", "a0d58b4ee456352bba5a9422615e875e4206de665d2cfd4d89c957a4a616b499"],
  ["sjtu-graduate-scholarships-overview", "work/catalog-official/2026-09-11T10-42-23-542Z/manifest.json", "a2739b8cbb576448dd48b1bb16002b2f74a57295c88b1e1ee0fbb8ffbdd4be6a"],
  ["sjtu-excellence-scholarship", "work/catalog-official/2026-09-11T10-42-26-708Z/manifest.json", "c2656ffe347223fcbc689efd22af511f304d34e01961f5c1aeb9102091d8d392"],
  ["sjtu-shanghai-government-scholarship", "work/catalog-official/2026-09-11T10-42-25-841Z/manifest.json", "7a08305aef960818eead9d6aec7a9a59d30c932f182eb3f1125260bb7900e9b1"],
] as const;
const evidence = new Map<string, any>();
for (const [sourceId, manifestPath, expectedSha] of sourceDefinitions) {
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), "utf8"));
  const item = manifest.sources?.find((source: any) => source.id === sourceId);
  if (!item || item.status !== 200 || item.contentType !== "text/html" || item.sha256 !== expectedSha) throw new Error(`Reviewed SJTU source is missing or changed: ${sourceId}`);
  evidence.set(sourceId, item);
}

const master = evidence.get("sjtu-international-master-admissions-scholarships-2026");
const doctoral = evidence.get("sjtu-international-graduate-scholarships-2026");
const listItems = (values: string[]) => values.map(label => ({ label }));
const benefitItems = (values: string[]) => values.map(label => ({ label, included: true }));
const stepItems = (values: string[]) => values.map((body, index) => ({ label: `Step ${index + 1}`, body }));
const graduateMaterials = [
  "SJTU international graduate online application form",
  "Highest degree certificate or expected-graduation proof",
  "Complete academic transcripts",
  "Language-proficiency evidence required by the selected program",
  "Personal statement and study or research plan",
  "Two academic recommendation letters",
  "Any supervisor acceptance letter required by the selected school or program",
];

type Input = {
  sourceId: string; supportingSourceIds?: string[]; slug: string; title: string; nameZh: string; type: string; typeLabel: string;
  fundingLevel: string; providerName: string; providerNameEn: string; coverage: string; applicableDegree: string;
  applicableProgram: string; amountText: string; eligibility: string[]; materials: string[]; steps: string[]; benefits: string[];
  deadlineDate: string; deadlineLabel: string; applicationRound: string; tags: string[]; unresolved: string[]; sortOrder: number;
};

function make(input: Input): CatalogSeedScholarship {
  const source = evidence.get(input.sourceId);
  const supporting = (input.supportingSourceIds ?? []).map(id => evidence.get(id));
  const summary = `${input.title} is recorded as a distinct scholarship route in SJTU's official scholarship and 2026 international graduate admissions pages. Award levels remain subject to the published review process.`;
  const record = {
    schoolSlug, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    status: "draft" as const, slug: input.slug, title: input.title, nameZh: input.nameZh, type: input.type,
    typeLabel: input.typeLabel, fundingLevel: input.fundingLevel, providerName: input.providerName,
    providerNameEn: input.providerNameEn, providerLocation: "Shanghai, China", coverage: input.coverage,
    applicableDegree: input.applicableDegree, applicableProgram: input.applicableProgram, amountText: input.amountText,
    requirementText: input.eligibility.join("; "),
    bodySections: [
      { title: "Scholarship overview", body: summary },
      { title: "Important application notes", items: input.steps },
    ],
    benefitItems: benefitItems(input.benefits), eligibilityItems: listItems(input.eligibility),
    applicationMaterials: listItems(input.materials), applicationSteps: stepItems(input.steps),
    actionLinks: [
      { label: source.label, url: source.url, kind: "official-source" },
      ...supporting.map(item => ({ label: item.label, url: item.url, kind: "official-source" })),
      { label: "SJTU international application system", url: "https://apply.sjtu.edu.cn/", kind: "official-application" },
    ],
    deadlineDate: input.deadlineDate, deadlineLabel: input.deadlineLabel, applicationRound: input.applicationRound,
    targetCountries: [], targetRegions: [], benefits: input.benefits, tags: ["2026", ...input.tags], summary, sortOrder: input.sortOrder,
  };
  const evidenceFields = new Set(["sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "status"]);
  const derivedFields = new Set(["schoolSlug", "slug", "title", "nameZh", "type", "typeLabel", "providerName", "providerNameEn", "providerLocation", "bodySections", "actionLinks", "targetCountries", "targetRegions", "tags", "summary", "sortOrder"]);
  const reference = [source, ...supporting].map(item => `${item.id} ${item.sha256}`).join("; ");
  const sourceFieldLineage = Object.fromEntries(Object.keys(record)
    .filter(field => !evidenceFields.has(field))
    .map(field => [field, `${derivedFields.has(field) ? "derived" : "explicit"}: ${reference}`]));
  return { ...record, sourceFieldLineage };
}

const scholarships: CatalogSeedScholarship[] = [
  make({
    sourceId: "sjtu-international-master-admissions-scholarships-2026", supportingSourceIds: ["sjtu-international-graduate-scholarships-2026", "sjtu-graduate-scholarships-overview"],
    slug: "official-2026-sjtu-chinese-government-scholarship-type-b-graduate", title: "SJTU 2026 Chinese Government Scholarship Type B - International Graduate Route", nameZh: "上海交通大学2026年中国政府奖学金B类国际研究生项目",
    type: "government", typeLabel: "Chinese Government Scholarship Type B", fundingLevel: "Award grade determined under CSC review",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council",
    coverage: "The 2026 SJTU admissions pages do not publish a fixed component table; the final scholarship grade and disbursement follow the competent authority's rules.",
    applicableDegree: "Master, Doctoral", applicableProgram: "Eligible SJTU 2026 international graduate programs",
    amountText: "No fixed amount is published on the reviewed SJTU pages.",
    benefits: ["Scholarship grade follows the applicable Chinese Government Scholarship decision", "Accommodation support follows the awarded scholarship grade", "Annual review is required after enrollment"],
    eligibility: ["Non-Chinese citizen in good physical and mental health", "No other scholarship funding", "Master applicant no older than 35", "Doctoral applicant no older than 40", "Meets the academic and language requirements of the selected SJTU graduate program"],
    materials: [...graduateMaterials, "Chinese Government Scholarship Type B application using SJTU agency number 10248"],
    steps: ["Apply in the SJTU international student system and choose the university scholarship application route", "Apply in the CSC system as Type B using SJTU agency number 10248", "Submit the required graduate admission and scholarship materials", "Await SJTU nomination and the final scholarship decision", "Complete annual review after enrollment"],
    deadlineDate: "2026-02-15", deadlineLabel: "Final university-route Chinese Government Scholarship deadline: February 15, 2026; first round closed December 15, 2025", applicationRound: "First round to December 15, 2025; final round to February 15, 2026",
    tags: ["Chinese Government Scholarship", "Master", "Doctoral"], unresolved: ["fixed funding amount", "final scholarship grade", "route quota"], sortOrder: 300,
  }),
  make({
    sourceId: "sjtu-shanghai-government-scholarship", supportingSourceIds: ["sjtu-international-master-admissions-scholarships-2026", "sjtu-international-graduate-scholarships-2026"],
    slug: "official-2026-sjtu-shanghai-government-scholarship", title: "SJTU 2026 Shanghai Government Scholarship", nameZh: "上海交通大学2026年上海市外国留学生政府奖学金",
    type: "local-government", typeLabel: "Shanghai Government Scholarship", fundingLevel: "Category A full or Category B partial",
    providerName: "上海市人民政府", providerNameEn: "Shanghai Municipal Government",
    coverage: "Category A covers tuition, accommodation, living allowance and comprehensive medical insurance; Category B covers tuition and comprehensive medical insurance.",
    applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "Eligible SJTU international degree programs; this batch records the 2026 graduate deadline",
    amountText: "Category A: tuition, accommodation, living allowance and insurance. Category B: tuition and insurance. Fixed cash amounts are not published on the reviewed page.",
    benefits: ["Category A tuition waiver", "Category A accommodation and living allowance", "Category A comprehensive medical insurance", "Category B tuition waiver", "Category B comprehensive medical insurance"],
    eligibility: ["Foreign citizen in good health", "Bachelor applicant: high-school graduate and no older than 25", "Master applicant: bachelor's degree and no older than 35", "Doctoral applicant: master's degree and no older than 40", "Meets the language and academic requirements of the selected program", "Does not concurrently receive another Chinese government scholarship"],
    materials: graduateMaterials,
    steps: ["Read the applicable SJTU degree-program admission guide", "Apply in the SJTU international student system", "Select the Shanghai Government Scholarship route where available", "Submit admission and scholarship materials by the applicable deadline", "Complete annual review if awarded"],
    deadlineDate: "2026-03-31", deadlineLabel: "SJTU 2026 international graduate Shanghai Government Scholarship deadline: March 31, 2026", applicationRound: "2026 international graduate admissions",
    tags: ["Shanghai Government Scholarship", "Bachelor", "Master", "Doctoral"], unresolved: ["fixed living-allowance amount", "category assignment", "undergraduate route-specific deadline in this batch"], sortOrder: 310,
  }),
  make({
    sourceId: "sjtu-international-master-admissions-scholarships-2026", supportingSourceIds: ["sjtu-international-graduate-scholarships-2026", "sjtu-graduate-scholarships-overview"],
    slug: "official-2026-sjtu-university-and-college-graduate-scholarships", title: "SJTU 2026 University and College Scholarships for International Graduate Students", nameZh: "上海交通大学2026年国际研究生校级及学院奖学金",
    type: "university", typeLabel: "SJTU University and College Scholarships", fundingLevel: "Full or partial tuition support",
    providerName: "上海交通大学及相关学院", providerNameEn: "Shanghai Jiao Tong University and participating schools",
    coverage: "University scholarships, tuition-waiver scholarships and college scholarships may cover full or partial tuition; accommodation allowance follows the awarded grade.",
    applicableDegree: "Master, Doctoral", applicableProgram: "Eligible SJTU 2026 international graduate programs",
    amountText: "Full or partial tuition support; fixed amounts and the final grade are shown in the SJTU application system or award decision, not on the public page.",
    benefits: ["Full or partial tuition support", "Accommodation allowance according to the awarded scholarship grade", "Scholarship duration follows the award and normally is not extended"],
    eligibility: ["Non-Chinese citizen in good physical and mental health", "No other scholarship funding", "Master applicant no older than 35", "Doctoral applicant no older than 40", "Meets the selected graduate program's admission requirements"],
    materials: graduateMaterials,
    steps: ["Apply in the SJTU international student system", "Choose the university scholarship application route", "Submit the selected program's admission materials", "SJTU and the relevant school assess the scholarship grade", "Confirm the exact award coverage and complete annual review after enrollment"],
    deadlineDate: "2026-03-31", deadlineLabel: "SJTU university and college scholarship deadline: March 31, 2026", applicationRound: "2026 international graduate admissions",
    tags: ["University Scholarship", "Master", "Doctoral"], unresolved: ["fixed amount", "school-specific coverage", "final award grade", "route quota"], sortOrder: 320,
  }),
  make({
    sourceId: "sjtu-excellence-scholarship", supportingSourceIds: ["sjtu-international-master-admissions-scholarships-2026"],
    slug: "official-2026-sjtu-chinese-government-excellence-scholarship", title: "SJTU 2026 Chinese Government Scholarship - Youth of Excellence Scheme", nameZh: "上海交通大学2026年中国政府来华留学卓越奖学金项目",
    type: "government", typeLabel: "Youth of Excellence Scheme of China Program", fundingLevel: "Full",
    providerName: "国家留学基金管理委员会 / 上海交通大学", providerNameEn: "China Scholarship Council / Shanghai Jiao Tong University",
    coverage: "Full scholarship for a 1+1 master's model: the first year is full-time study and research preparation at SJTU; the second year is completed from the applicant's home country with return to SJTU for the degree defence.",
    applicableDegree: "Master", applicableProgram: "International Business MBA; LL.M. Program in Chinese Law; Master in China Politics and Economy",
    amountText: "Full scholarship; the reviewed page does not publish a fixed cash component table.",
    benefits: ["Full scholarship", "1+1 master's cultivation model", "First-year full-time study and research preparation at SJTU", "Degree defence conducted according to SJTU requirements"],
    eligibility: ["Non-Chinese citizen in good physical and mental health", "No older than 45", "Bachelor's degree or above", "At least three years of work experience", "Member of one of the four eligible professional groups published by the program", "Meets the admission requirements of one of the three named English-taught master's programs"],
    materials: [...graduateMaterials, "SJTU pre-admission notice before the CSC application", "CSC Type A application for the Youth of Excellence Scheme using receiving agency code 1563"],
    steps: ["Apply to one of the three named SJTU master's programs", "Obtain an SJTU pre-admission notice", "Apply in the CSC system as Type A using receiving agency code 1563", "Select the Youth of Excellence Scheme of China Program", "Submit all materials by March 31, 2026"],
    deadlineDate: "2026-03-31", deadlineLabel: "SJTU and CSC application deadline: March 31, 2026", applicationRound: "2026 Youth of Excellence Scheme",
    tags: ["Chinese Government Scholarship", "Youth of Excellence", "Master"], unresolved: ["fixed cash component amounts", "program quota"], sortOrder: 330,
  }),
];

if (scholarships.length !== 4 || new Set(scholarships.map(item => item.slug)).size !== 4) throw new Error("SJTU scholarship batch must contain four distinct routes.");
const candidateRaw = {
  version: 1,
  generatedAt: master.fetchedAt,
  cities: (schoolBundle.cities ?? []).map((item: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = item; return { ...rest, status: "draft" }; }),
  schools: (schoolBundle.schools ?? []).map((item: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = item; return { ...rest, status: "draft" }; }),
  programs: [], programIntakes: [], scholarships,
};
const serializedCandidate = `${JSON.stringify(candidateRaw, null, 2)}\n`;
const candidate = JSON.parse(serializedCandidate);
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Generated SJTU scholarship candidate is invalid:\n${validation.errors.join("\n")}`);
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolCount: 1, scholarshipCount: 4, existingVerifiedCount: 1, newScholarshipCount: 4, archiveCount: 1 },
  evidence: sourceDefinitions.map(([sourceId]) => { const item = evidence.get(sourceId); return { sourceId, sourceUrl: item.url, sourceLabel: item.label, sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType }; }),
  reconciliation: { stableMatchingSlugs: [], newScholarshipCount: 4, legacyAliasesToArchive: ["official-2026-sjtu-international-graduate-scholarships"], destructiveDeletion: false },
  records: scholarships.map(item => ({
    slug: item.slug, title: item.title, fundingLevel: item.fundingLevel, applicableDegree: item.applicableDegree,
    applicableProgram: item.applicableProgram, deadlineDate: item.deadlineDate, deadlineLabel: item.deadlineLabel,
    unresolvedFields: item.slug.includes("type-b") ? ["fixed funding amount", "final scholarship grade", "route quota"]
      : item.slug.includes("shanghai-government") ? ["fixed living-allowance amount", "category assignment", "undergraduate route-specific deadline in this batch"]
      : item.slug.includes("university-and-college") ? ["fixed amount", "school-specific coverage", "final award grade", "route quota"]
      : ["fixed cash component amounts", "program quota"],
  })),
  reviewNotes: [
    "The existing aggregate mixes government, municipal and university awards and is proposed for archival, not deletion.",
    "The registered legacy source URL is the 2026 doctoral admission guide; this review also captures the matching master's guide and scholarship-specific official pages.",
    "The Shanghai Government Scholarship supports multiple degree levels, but this batch uses the explicitly published March 31, 2026 SJTU graduate deadline.",
    "No fixed amount, award grade or quota was inferred where the official pages did not publish it.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional scholarship information and generic application requirements are included; no applicant records, personal contacts, account data, payment data or private files are present." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};

await Promise.all([
  writeFile(paths.draft, serializedCandidate, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, ...paths, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary }, null, 2));
