import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidatePath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.review.json");
const specs = [
  ["work/catalog-official/2026-09-11T07-59-20-792Z/manifest.json", "sjtu-medicine-chinese-undergraduate-2026", "83a3ecbaf04e449ff89cb7d08d1a3c858a24b76c895feed36e9582eabc4cce68"],
  ["work/catalog-official/2026-09-11T07-59-21-247Z/manifest.json", "sjtu-medicine-mbbs-2026", "925dfb9fc32be0ddde55713353b02900efcc6ef7a211344da2922bbae4b5a268"],
] as const;
const evidence = new Map<string, any>();
for (const [path, id, sha] of specs) {
  const item = JSON.parse(await readFile(resolve(root, path), "utf8")).sources?.[0];
  if (item?.id !== id || item?.sha256 !== sha || item?.status !== 200) throw new Error(`Official evidence mismatch: ${id}`);
  evidence.set(id, item);
}
const zh = evidence.get("sjtu-medicine-chinese-undergraduate-2026")!;
const en = evidence.get("sjtu-medicine-mbbs-2026")!;
const schoolSlug = "shanghai-jiao-tong-university-school-of-medicine";
const applyUrl = "https://www.shsmu.edu.cn/iso/ENGLISH/Admission/Undergraduate_Programs.htm";
const chineseBase = {
  schoolSlug, citySlug: "shanghai", degreeLevel: "Undergraduate", durationYears: 5, fieldCategory: "Medicine", teachingLanguage: "Chinese",
  cscaSubjects: ["Chinese (STEM)", "Mathematics"], cscaRequirement: "CSCA: Chinese (STEM) and Mathematics; a pre-admitted applicant may supplement the result by June 30, 2026.",
  hskRequirement: "HSK Level 5 score 200 or above; an applicant educated in Chinese at high school may request exemption with official proof.",
  tuitionAmount: 29000, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 29,000/year",
  scholarshipText: "The official guide lists the Chinese Government Scholarship bilateral route (Type A) and Shanghai Government Scholarship (Class B); eligibility must be checked separately.",
  hasScholarship: true, applicationUrl: applyUrl, status: "draft" as const, sourceUrl: zh.url, sourceLabel: zh.label, sourceSha256: zh.sha256, capturedAt: zh.fetchedAt,
  sourceFieldLineage: { durationYears: "Program Catalog", teachingLanguage: "Program Catalog", cscaSubjects: "Eligibility item 3 and Application Materials item 5", hskRequirement: "Eligibility item 2", tuitionAmount: "Fees item 2", scholarshipText: "Scholarships section", applicationUrl: "official HTTPS undergraduate admissions index" },
};
const programs: CatalogSeedProgram[] = [
  { ...chineseBase, slug: `${schoolSlug}-clinical-medicine`, nameEn: "Clinical Medicine", nameZh: "临床医学", subjectArea: "Clinical Medicine", sourceFieldLineage: { ...chineseBase.sourceFieldLineage, nameEn: "Program Catalog item 1 translated display name", nameZh: "Program Catalog item 1" } },
  { ...chineseBase, slug: `${schoolSlug}-oral-medicine-dentistry`, nameEn: "Stomatology", nameZh: "口腔医学", subjectArea: "Stomatology", sourceFieldLineage: { ...chineseBase.sourceFieldLineage, nameEn: "Program Catalog item 2 translated display name", nameZh: "Program Catalog item 2" } },
  {
    slug: `${schoolSlug}-mbbs`, schoolSlug, citySlug: "shanghai", nameEn: "Clinical Medicine (MBBS)", nameZh: "临床医学（MBBS，英文授课）",
    degreeLevel: "Undergraduate", durationYears: 6, fieldCategory: "Medicine", subjectArea: "Clinical Medicine", teachingLanguage: "English",
    cscaSubjects: ["Mathematics", "Physics", "Chemistry"], cscaRequirement: "CSCA: Mathematics, Physics and Chemistry; a valid score report is required by the application deadline.",
    englishRequirement: "IELTS 6.0 with no band below 5.0; TOEFL 90 with no section below 15; Cambridge English Advanced 170; or Duolingo 110. Official exemption routes apply.",
    tuitionAmount: 75000, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 75,000/year",
    scholarshipText: "The official guide lists the Shanghai Government Scholarship for International Students; eligibility must be checked separately.",
    hasScholarship: true, applicationUrl: applyUrl, applicationNote: "Admission includes an application review and interview. Application fee: RMB 800, non-refundable.", status: "draft",
    sourceUrl: en.url, sourceLabel: en.label, sourceSha256: en.sha256, capturedAt: en.fetchedAt,
    sourceFieldLineage: { nameEn: "Program Offered", nameZh: "editorial Chinese display translation of official English title", durationYears: "Program Offered", cscaSubjects: "Eligibility item 3.4", englishRequirement: "Application Documents item 5.4", tuitionAmount: "Fees item 9.2", scholarshipText: "Scholarships section", applicationNote: "Online Application Method and Interview sections" },
  },
];
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: zh.fetchedAt,
  cities: [{ slug: "shanghai", nameEn: "Shanghai", nameZh: "上海", region: "East China", province: "Shanghai", status: "draft", sourceUrl: zh.url, sourceLabel: zh.label, sourceSha256: zh.sha256, capturedAt: zh.fetchedAt, sourceFieldLineage: { nameEn: "official institution address context", province: "official institution address context" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Shanghai Jiao Tong University School of Medicine", nameZh: "上海交通大学医学院", citySlug: "shanghai", schoolType: "public", region: "East China",
    applicationLevel: "Undergraduate", languageOfInstruction: "Chinese and English", languageRequirement: "Chinese routes require HSK Level 5 score 200; MBBS uses its program-specific English threshold.",
    hskRequirement: "HSK Level 5 score 200 or above for Chinese-taught routes, subject to the official Chinese-medium high-school exemption.",
    englishRequirement: "MBBS accepts IELTS 6.0, TOEFL 90, Cambridge English Advanced 170 or Duolingo 110, with published sub-score and exemption rules.",
    deadlineSummary: "2026 Chinese-route applications closed March 10; MBBS applications closed April 30.", tuitionSummary: "Chinese-taught programs RMB 29,000/year; MBBS RMB 75,000/year.",
    applicationFee: "RMB 800, non-refundable", websiteUrl: "https://www.shsmu.edu.cn/", admissionsUrl: zh.url, cscaRequired: true,
    cscaRequirement: "Chinese routes require Chinese (STEM) and Mathematics; MBBS requires Mathematics, Physics and Chemistry.",
    cscaSubjects: ["Chinese (STEM)", "Mathematics", "Physics", "Chemistry"], subjectTags: ["Clinical Medicine", "Stomatology", "MBBS"], languageTags: ["Chinese-taught", "English-taught"],
    tuitionBandLabel: "RMB 29,000-75,000/year", campusHighlights: ["Independent international admissions", "Two Chinese-taught medical routes", "One six-year English MBBS route", "Program-specific CSCA and language requirements"],
    status: "draft", sourceUrl: zh.url, sourceLabel: zh.label, sourceSha256: zh.sha256, capturedAt: zh.fetchedAt,
    sourceFieldLineage: { nameEn: "official guide institution title", nameZh: "official guide institution title", languageOfInstruction: "two 2026 guides", languageRequirement: "Eligibility sections", deadlineSummary: "Online Application Period", tuitionSummary: "Fees sections", applicationFee: "Online Application Method", cscaRequirement: "Eligibility sections" },
  }],
  programs,
  programIntakes: programs.map((program, index) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, openDate: "2025-12-08T00:00:00.000Z", deadlineDate: index < 2 ? "2026-03-10T15:59:59.000Z" : "2026-04-30T15:59:59.000Z", deadlineLabel: index < 2 ? "March 10, 2026" : "April 30, 2026", applicationRound: "2026 international undergraduate admission", status: "closed" as const, sourceUrl: index < 2 ? zh.url : en.url, sourceLabel: index < 2 ? zh.label : en.label, sourceSha256: index < 2 ? zh.sha256 : en.sha256, capturedAt: index < 2 ? zh.fetchedAt : en.fetchedAt, sourceFieldLineage: { openDate: "Online Application Period", deadlineDate: "Online Application Period" } })),
  scholarships: [],
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`SJTU Medicine candidate invalid: ${validation.errors.join(" ")}`);
const canonical = JSON.stringify(candidate);
if ([/passport(?:Number)?/i, /personalEmail/i, /personalPhone/i, /cardNumber/i, /beneficiaryBank/i, /applicationNumber/i].some(pattern => pattern.test(canonical))) throw new Error("Prohibited-data marker found.");
const stableMatchingSlugs = [`${schoolSlug}-clinical-medicine`, `${schoolSlug}-oral-medicine-dentistry`];
const review = {
  version: 1, status: "awaiting_user_approval", generatedAt: zh.fetchedAt,
  scope: { schoolSlug, schoolCount: 1, chineseProgramCount: 2, englishProgramCount: 1, programCount: 3, intakeCount: 3 },
  officialEvidence: Object.fromEntries([...evidence.entries()].map(([id, item]) => [id, { sha256: item.sha256, fetchedAt: item.fetchedAt, contentType: item.contentType }])),
  reviewItems: [{ field: "institution boundary", result: "separate_entity", reason: "The medical school operates its own international application system and official 2026 guides; its three routes stay outside the SJTU main-school batch." }, { field: "applicant/document content", result: "excluded", reason: "Passport, family identity, banking, residence, contact and application-document instructions are not imported." }],
  reconciliation: { actionAfterApproval: "upsert_official_2026_medical_catalog", legacyAliasesToArchive: [], destructiveDeletion: false, stableMatchingSlugs },
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public program-level catalog fields are retained; no applicant or personal contact data is included." },
  candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
};
for (const [path, value] of [[candidatePath, candidate], [validationPath, validation], [reviewPath, review]] as const) await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"), summary: validation.summary, stableMatchingSlugs: stableMatchingSlugs.length }, null, 2));
