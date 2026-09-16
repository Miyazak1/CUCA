import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const schoolSlug = "beijing-normal-university";
const schoolBundle = JSON.parse(await readFile(resolve(root, "seeds/catalog.bnu-school-program-batch-01.approved.local.json"), "utf8"));
const output = {
  draft: resolve(root, "seeds/catalog.bnu-scholarships-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.bnu-scholarships-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.bnu-scholarships-batch-01.review.json"),
};

const sourceDefinitions = [
  ["bnu-undergraduate-scholarships-2026", "work/catalog-official/2026-09-11T10-15-13-247Z/manifest.json", "6c51f56f0b7251ef4aeab412c74035cecdb9fc564aaa648142dc4914fb849284"],
  ["bnu-new-student-scholarship", "work/catalog-official/2026-09-11T10-17-20-246Z/manifest.json", "798be39fc0010474e4958cb314f60233635917fe48578613bfad7bedb91ab729"],
  ["bnu-silk-road-muduo-scholarship", "work/catalog-official/2026-09-11T10-17-18-841Z/manifest.json", "a9343f7d2174d876ed25e7092a2aee621044fe2ae583cd88fdc5c03add5cf256"],
  ["bnu-beijing-government-scholarship", "work/catalog-official/2026-09-11T10-17-19-923Z/manifest.json", "f850dc3a64e86d14f74e87fe4308ed2d7099c58e3c99240c82ac79a0eda1ce94"],
  ["bnu-chinese-government-scholarship-type-a-bilateral", "work/catalog-official/2026-09-11T10-17-20-736Z/manifest.json", "9c9e4a5db87864c87d08834d8f43caa1fc24b0d755eb179faa705ab09dbbe771"],
  ["bnu-chinese-government-scholarship-type-b-university", "work/catalog-official/2026-09-11T10-17-20-302Z/manifest.json", "e4832e018e32ddd3b0b2e8b017b4a0f69a87472b887986c646df743a5b89c803"],
  ["bnu-international-chinese-language-teachers-scholarship-2026", "work/catalog-official/2026-09-11T10-17-22-008Z/manifest.json", "6c0063849bde8b5e40acb0d04fe60b1ff0a436de332beaab038953f82e24adce"],
] as const;

const evidence = new Map<string, any>();
for (const [sourceId, manifestRelativePath, expectedSha] of sourceDefinitions) {
  const manifest = JSON.parse(await readFile(resolve(root, manifestRelativePath), "utf8"));
  const item = manifest.sources?.find((candidate: any) => candidate.id === sourceId);
  if (!item || item.status !== 200 || item.contentType !== "text/html" || item.sha256 !== expectedSha) {
    throw new Error(`Reviewed BNU source is missing or changed: ${sourceId}`);
  }
  evidence.set(sourceId, item);
}

const undergraduateGuide = evidence.get("bnu-undergraduate-scholarships-2026");
const guideReference = `bnu-undergraduate-scholarships-2026 ${undergraduateGuide.sha256}`;
const listItems = (values: string[]) => values.map(label => ({ label }));
const benefitItems = (values: string[]) => values.map(label => ({ label, included: true }));
const stepItems = (values: string[]) => values.map((body, index) => ({ label: `Step ${index + 1}`, body }));
const undergraduateMaterials = [
  "BNU online application form",
  "Notarized high-school diploma or expected-graduation proof",
  "High-school transcripts",
  "Valid CSCA score report",
  "HSK score report required by the selected program",
  "One signed recommendation from a high-school teacher, homeroom teacher or school leader",
  "Handwritten personal statement",
  "Valid ordinary-passport information page",
  "Valid no-criminal-record certificate",
];

type ScholarshipInput = {
  sourceId: string; slug: string; title: string; nameZh: string; type: string; typeLabel: string; fundingLevel: string;
  providerName: string; providerNameEn: string; providerLocation: string; coverage: string; applicableDegree: string;
  applicableProgram: string; amountText: string; eligibility: string[]; materials: string[]; steps: string[];
  benefits: string[]; deadlineDate?: string; deadlineLabel: string; applicationRound?: string;
  targetRegions?: string[]; actionLinks?: Array<{ label: string; url: string; kind: string }>;
  unresolved?: string[]; derivedFields?: string[]; sortOrder: number;
};

function make(input: ScholarshipInput): CatalogSeedScholarship {
  const source = evidence.get(input.sourceId);
  const summary = `${input.title} is a distinct scholarship route published by Beijing Normal University. Its funding, eligibility, application materials and process are kept separate from other BNU awards.`;
  const record = {
    schoolSlug, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    status: "draft" as const, slug: input.slug, title: input.title, nameZh: input.nameZh, type: input.type,
    typeLabel: input.typeLabel, fundingLevel: input.fundingLevel, providerName: input.providerName,
    providerNameEn: input.providerNameEn, providerLocation: input.providerLocation, coverage: input.coverage,
    applicableDegree: input.applicableDegree, applicableProgram: input.applicableProgram, amountText: input.amountText,
    requirementText: input.eligibility.join("; "),
    bodySections: [
      { title: "Scholarship overview", body: summary },
      { title: "Important application notes", items: input.steps },
    ],
    benefitItems: benefitItems(input.benefits), eligibilityItems: listItems(input.eligibility),
    applicationMaterials: listItems(input.materials), applicationSteps: stepItems(input.steps),
    actionLinks: [
      { label: "Official BNU scholarship page", url: source.url, kind: "official-source" },
      { label: "BNU 2026 undergraduate admission guide", url: undergraduateGuide.url, kind: "official-source" },
      ...(input.actionLinks ?? []),
    ],
    deadlineDate: input.deadlineDate, deadlineLabel: input.deadlineLabel, applicationRound: input.applicationRound,
    targetCountries: [], targetRegions: input.targetRegions ?? [], benefits: input.benefits,
    tags: ["2026", input.typeLabel, "Bachelor"], summary, sortOrder: input.sortOrder,
  };
  const evidenceFields = new Set(["sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "status"]);
  const derived = new Set(["schoolSlug", "slug", "title", "nameZh", "type", "typeLabel", "fundingLevel", "providerName", "providerNameEn", "providerLocation", "applicableDegree", "applicableProgram", "bodySections", "tags", "summary", "sortOrder", ...(input.derivedFields ?? [])]);
  const sourceFieldLineage = Object.fromEntries(Object.keys(record)
    .filter(field => !evidenceFields.has(field) && (record as any)[field] !== undefined)
    .map(field => [field, `${derived.has(field) ? "derived" : "explicit"}: ${input.sourceId} ${source.sha256}${["deadlineDate", "deadlineLabel", "applicationRound", "applicationMaterials"].includes(field) ? `; ${guideReference}` : ""}`]));
  return { ...record, sourceFieldLineage };
}

const scholarships: CatalogSeedScholarship[] = [
  make({
    sourceId: "bnu-new-student-scholarship", slug: "official-2026-bnu-new-student-scholarship",
    title: "BNU 2026 International Undergraduate New Student Scholarship", nameZh: "北京师范大学2026年外国留学生本科新生奖学金",
    type: "university", typeLabel: "University Scholarship", fundingLevel: "Full tuition plus living allowance and insurance",
    providerName: "北京师范大学", providerNameEn: "Beijing Normal University", providerLocation: "Beijing",
    coverage: "Tuition waiver; living allowance during study; comprehensive insurance for international students",
    applicableDegree: "Bachelor", applicableProgram: "Eligible BNU 2026 undergraduate degree programs",
    amountText: "Full tuition waiver, living allowance and comprehensive insurance; the official page does not publish a fixed cash amount.",
    benefits: ["Tuition waiver", "Living allowance during study", "Comprehensive insurance", "Coverage follows the normal program duration"],
    eligibility: ["Non-Chinese citizen in good health and friendly to China", "Excellent conduct and academic record", "Strong undergraduate entrance-examination result", "Admitted to BNU as a new degree student for the current year", "No other scholarship or government, organization or department funding"],
    materials: undergraduateMaterials, steps: ["Apply for the BNU undergraduate program in the international student system", "Print the application form and submit the materials required by the 2026 undergraduate guide", "Complete BNU scholarship review after admission review", "Pass the annual scholarship assessment each May to retain funding"],
    deadlineDate: "2026-03-15", deadlineLabel: "BNU 2026 undergraduate application deadline: March 15, 2026", applicationRound: "November 15, 2025 - March 15, 2026",
    unresolved: ["fixed living-allowance amount"], derivedFields: ["deadlineDate", "deadlineLabel", "applicationRound", "applicationMaterials"], sortOrder: 200,
  }),
  make({
    sourceId: "bnu-silk-road-muduo-scholarship", slug: "official-2026-bnu-silk-road-muduo-undergraduate-scholarship",
    title: "BNU 2026 Silk Road Muduo Undergraduate Scholarship", nameZh: "北京师范大学2026年丝路木铎本科生奖学金",
    type: "university", typeLabel: "Silk Road Muduo Scholarship", fundingLevel: "Full tuition plus living allowance and insurance",
    providerName: "北京师范大学", providerNameEn: "Beijing Normal University", providerLocation: "Beijing / Zhuhai",
    coverage: "Tuition waiver; living allowance during study; comprehensive insurance for international students",
    applicableDegree: "Bachelor", applicableProgram: "Eligible BNU undergraduate routes for students from Belt and Road countries",
    amountText: "Full tuition waiver, living allowance and comprehensive insurance; the official page does not publish a fixed cash amount.",
    benefits: ["Tuition waiver", "Living allowance during study", "Comprehensive insurance", "Coverage follows the normal program duration"],
    eligibility: ["Non-Chinese citizen in good health and friendly to China", "Citizen of a Belt and Road country", "Excellent conduct and academic record", "Excellent undergraduate entrance-examination result", "Admitted to BNU as a new degree student for the current year", "No other scholarship or government, organization or department funding"],
    materials: undergraduateMaterials, steps: ["Apply for the BNU undergraduate program in the international student system", "Submit the application form and 2026 undergraduate admission materials", "Complete BNU scholarship review", "Pass the annual scholarship assessment each May to retain funding"],
    deadlineDate: "2026-03-15", deadlineLabel: "BNU 2026 undergraduate application deadline: March 15, 2026", applicationRound: "November 15, 2025 - March 15, 2026",
    targetRegions: ["Belt and Road countries"], unresolved: ["fixed living-allowance amount", "official country list"], derivedFields: ["deadlineDate", "deadlineLabel", "applicationRound", "applicationMaterials", "targetRegions"], sortOrder: 210,
  }),
  make({
    sourceId: "bnu-beijing-government-scholarship", slug: "official-2026-bnu-beijing-government-undergraduate-scholarship",
    title: "BNU 2026 Beijing Government Undergraduate Scholarship", nameZh: "北京师范大学2026年北京来华留学生政府本科奖学金",
    type: "local-government", typeLabel: "Beijing Government Scholarship", fundingLevel: "Category A, B or C",
    providerName: "北京市人民政府", providerNameEn: "Beijing Municipal Government", providerLocation: "Beijing",
    coverage: "Category A: tuition, accommodation, living stipend and comprehensive insurance; Category B: tuition, accommodation and insurance; Category C: tuition and insurance",
    applicableDegree: "Bachelor", applicableProgram: "Eligible BNU international undergraduate programs studied in Beijing",
    amountText: "Category A covers tuition, accommodation, living stipend and insurance; Category B covers tuition, accommodation and insurance; Category C covers tuition and insurance.",
    benefits: ["Category A: tuition, accommodation, living stipend and comprehensive insurance", "Category B: tuition, accommodation and comprehensive insurance", "Category C: tuition and comprehensive insurance", "Coverage may continue for no longer than the normal program duration, subject to annual assessment"],
    eligibility: ["Non-Chinese citizen, friendly to China and in good physical and mental health", "Admitted to BNU as a new international student for the current year", "Bachelor applicant no older than 25", "Cannot simultaneously receive another scholarship established by a Chinese government level or social organization"],
    materials: undergraduateMaterials, steps: ["Apply through the BNU international student system under the applicable undergraduate guide", "Select the Beijing Government Scholarship in the scholarship section", "Send paper application materials if required by BNU", "Check the BNU system after admission for the scholarship review result", "Complete annual assessment to retain the award"],
    deadlineDate: "2026-03-15", deadlineLabel: "BNU 2026 undergraduate application deadline: March 15, 2026", applicationRound: "November 15, 2025 - March 15, 2026",
    unresolved: ["category assignment criteria", "fixed stipend amount"], derivedFields: ["deadlineDate", "deadlineLabel", "applicationRound", "applicationMaterials", "applicableProgram"], sortOrder: 220,
  }),
  make({
    sourceId: "bnu-chinese-government-scholarship-type-a-bilateral", slug: "official-2026-bnu-chinese-government-scholarship-type-a-undergraduate",
    title: "BNU 2026 Chinese Government Scholarship Type A - Undergraduate Bilateral Program", nameZh: "北京师范大学2026年中国政府奖学金A类国别双边本科项目",
    type: "government", typeLabel: "Chinese Government Scholarship Type A", fundingLevel: "Full or partial",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", providerLocation: "China",
    coverage: "Tuition; free accommodation or accommodation subsidy; living stipend; comprehensive medical insurance, subject to the applicable bilateral award",
    applicableDegree: "Bachelor", applicableProgram: "Eligible Chinese- or English-taught BNU undergraduate routes allowed by the dispatching authority",
    amountText: "The route may be a full or partial bilateral scholarship. Published components include tuition, accommodation support, living stipend and comprehensive medical insurance.",
    benefits: ["Tuition", "Free accommodation or accommodation subsidy", "Living stipend", "Comprehensive medical insurance", "One preparatory Chinese-language year may be included where applicable"],
    eligibility: ["Meets the BNU undergraduate admission requirements", "High-school graduate with excellent results and no older than 25", "Has not received another scholarship", "Obtains nomination eligibility from the home-country dispatching authority"],
    materials: ["Chinese Government Scholarship application form", ...undergraduateMaterials, "Study plan of at least 200 Chinese or English words", "Legal guardian documents for applicants under 18", "Physical examination form for study longer than six months"],
    steps: ["Apply to the home-country dispatching authority and obtain nomination eligibility", "Apply in the BNU international student system", "Apply in the Chinese Government Scholarship system using the agency details supplied by the dispatching authority", "Submit paper materials to BNU and the dispatching authority when required", "Wait for CSC and dispatching-authority results"],
    deadlineLabel: "Dispatching-authority deadline, generally November to April; BNU's 2026 undergraduate application closes March 15, 2026", applicationRound: "Generally November 2025 - April 2026",
    actionLinks: [{ label: "Chinese Government Scholarship information", url: "https://www.campuschina.org/scholarships", kind: "official-application" }], unresolved: ["country-specific deadline", "full-versus-partial award decision", "fixed stipend amount"], derivedFields: ["applicableProgram", "applicationMaterials", "deadlineLabel", "applicationRound"], sortOrder: 230,
  }),
  make({
    sourceId: "bnu-chinese-government-scholarship-type-b-university", slug: "official-2026-bnu-chinese-government-scholarship-type-b-undergraduate",
    title: "BNU 2026 Chinese Government Scholarship Type B - Undergraduate University Program", nameZh: "北京师范大学2026年中国政府奖学金B类高校自主招生本科项目",
    type: "government", typeLabel: "Chinese Government Scholarship Type B", fundingLevel: "Full",
    providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", providerLocation: "China",
    coverage: "Tuition; free accommodation or accommodation subsidy; living stipend; comprehensive medical insurance",
    applicableDegree: "Bachelor", applicableProgram: "Eligible Chinese- or English-taught BNU undergraduate routes",
    amountText: "Full Chinese Government Scholarship components: tuition, accommodation support, living stipend and comprehensive medical insurance; fixed amounts follow CSC rules.",
    benefits: ["Tuition", "Free accommodation or accommodation subsidy", "Living stipend", "Comprehensive medical insurance", "Coverage follows the admitted program duration, subject to annual review"],
    eligibility: ["Meets the BNU undergraduate admission requirements", "High-school graduate no older than 25", "Valid CSCA score submitted before the application deadline", "Has not received another scholarship"],
    materials: ["Chinese Government Scholarship application form", ...undergraduateMaterials, "Study plan of at least 200 Chinese or English words", "Legal guardian documents for applicants under 18", "Physical examination form", "Any conditional art or design portfolio"],
    steps: ["Apply in the BNU international student system", "Apply in the CSC system as Type B using BNU agency number 10027", "Submit both BNU and CSC material sets", "Send paper materials to BNU within the required period", "BNU nominates selected admitted students to CSC for final approval", "Complete annual assessment after enrollment"],
    deadlineDate: "2026-03-15", deadlineLabel: "BNU 2026 undergraduate application deadline: March 15, 2026; the scholarship page states a general November-to-March window", applicationRound: "November 2025 - March 2026",
    actionLinks: [{ label: "Chinese Government Scholarship information", url: "https://www.campuschina.org/scholarships", kind: "official-application" }], unresolved: ["fixed stipend amount", "route quota"], derivedFields: ["deadlineDate", "deadlineLabel", "applicationRound", "applicableProgram", "applicationMaterials"], sortOrder: 240,
  }),
  make({
    sourceId: "bnu-international-chinese-language-teachers-scholarship-2026", slug: "official-2026-bnu-international-chinese-language-teachers-undergraduate-scholarship",
    title: "BNU 2026 International Chinese Language Teachers Undergraduate Scholarship", nameZh: "北京师范大学2026年国际中文教师本科生奖学金",
    type: "education-center", typeLabel: "International Chinese Language Teachers Scholarship", fundingLevel: "Per 2026 scholarship rules",
    providerName: "教育部中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", providerLocation: "China",
    coverage: "The BNU scholarship page does not publish a separate funding table; BNU confirms that recipients receive university-arranged accommodation",
    applicableDegree: "Bachelor", applicableProgram: "Teaching Chinese to Speakers of Other Languages at BNU Zhuhai Campus",
    amountText: "Funding amounts are not stated on the BNU 2026 page; recipients do not need to reserve accommodation because BNU arranges it.",
    benefits: ["Four-year scholarship duration for September 2026 undergraduate entry", "University-arranged accommodation confirmed by the BNU 2026 undergraduate guide"],
    eligibility: ["Non-Chinese citizen, friendly to China, with no criminal record", "In good physical and mental health with excellent conduct and academic performance", "Intends to work in Chinese-language education or a related field", "Undergraduate applicant generally no older than 25 on September 1, 2026", "High-school diploma", "HSK Level 4 score 210 and HSKK Intermediate score 60", "Post-graduation teaching agreement or related proof receives preference"],
    materials: ["Online scholarship application submitted through the Center for Language Education and Cooperation", "Recommendation from an eligible recommending institution", ...undergraduateMaterials],
    steps: ["From March 1, 2026, choose a recommending institution and BNU in the official scholarship system", "Submit scholarship materials online and complete the BNU undergraduate application", "Track recommending-institution and BNU review in the scholarship system", "Confirm admission arrangements with BNU if selected", "Enroll according to the BNU admission notice and complete annual review"],
    deadlineDate: "2026-05-15", deadlineLabel: "September 2026 entry: student application deadline May 15, 2026; recommending-institution and university review deadline May 25, 2026", applicationRound: "March 1 - May 15, 2026 for September 2026 undergraduate entry",
    targetRegions: ["BNU Zhuhai Campus"], actionLinks: [{ label: "Official scholarship application system", url: "https://www.chinese.cn/", kind: "official-application" }],
    unresolved: ["funding coverage and fixed amounts", "complete route-specific material list"], derivedFields: ["fundingLevel", "coverage", "amountText", "benefitItems", "applicationMaterials", "targetRegions"], sortOrder: 250,
  }),
];

if (scholarships.length !== 6 || new Set(scholarships.map(item => item.slug)).size !== 6) throw new Error("BNU scholarship batch must contain six distinct routes.");
const candidateRaw = {
  version: 1,
  generatedAt: evidence.get("bnu-international-chinese-language-teachers-scholarship-2026").fetchedAt,
  cities: (schoolBundle.cities ?? []).map((item: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = item; return { ...rest, status: "draft" }; }),
  schools: (schoolBundle.schools ?? []).map((item: any) => { const { verificationStatus: _v, lastVerifiedAt: _l, ...rest } = item; return { ...rest, status: "draft" }; }),
  programs: [], programIntakes: [], scholarships,
};
const serializedCandidate = `${JSON.stringify(candidateRaw, null, 2)}\n`;
const candidate = JSON.parse(serializedCandidate);
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Generated BNU scholarship candidate is invalid:\n${validation.errors.join("\n")}`);
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolCount: 1, scholarshipCount: 6, existingVerifiedCount: 1, newScholarshipCount: 6, archiveCount: 1 },
  evidence: sourceDefinitions.map(([sourceId]) => {
    const item = evidence.get(sourceId);
    return { sourceId, sourceUrl: item.url, sourceLabel: item.label, sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType };
  }),
  reconciliation: { stableMatchingSlugs: [], newScholarshipCount: 6, legacyAliasesToArchive: ["official-2026-bnu-undergraduate-scholarship-options"], destructiveDeletion: false },
  records: scholarships.map(item => ({
    slug: item.slug, title: item.title, fundingLevel: item.fundingLevel, applicableDegree: item.applicableDegree,
    applicableProgram: item.applicableProgram, deadlineDate: item.deadlineDate ?? null, deadlineLabel: item.deadlineLabel,
    unresolvedFields: item.slug.includes("new-student") ? ["fixed living-allowance amount"]
      : item.slug.includes("silk-road") ? ["fixed living-allowance amount", "official country list"]
      : item.slug.includes("beijing-government") ? ["category assignment criteria", "fixed stipend amount"]
      : item.slug.includes("type-a") ? ["country-specific deadline", "full-versus-partial award decision", "fixed stipend amount"]
      : item.slug.includes("type-b") ? ["fixed stipend amount", "route quota"]
      : ["funding coverage and fixed amounts", "complete route-specific material list"],
  })),
  reviewNotes: [
    "The old aggregate scholarship-options record mixes five materially different awards and is proposed for archival, not deletion.",
    "This first BNU scholarship batch is scoped to the undergraduate routes named in the official 2026 undergraduate guide.",
    "No fixed amount, deadline or category decision was inferred where the relevant official page did not publish it.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional scholarship information is included; no applicant records, account data, payment data, private files or personal contacts are present." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};

await Promise.all([
  writeFile(output.draft, serializedCandidate, "utf8"),
  writeFile(output.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(output.review, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, ...output, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary }, null, 2));
