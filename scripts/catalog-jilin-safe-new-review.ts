import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const schoolSlug = "jilin-university";
const paths = {
  parsed: resolve(root, "work/catalog-official/jilin-graduate-catalog-batch-01/parsed-programs.json"),
  manifest: resolve(root, "work/catalog-official/jilin-complete-batch-01/manifest.json"),
  catalogManifest: resolve(root, "work/catalog-official/jilin-graduate-catalog-batch-01/manifest.json"),
  draft: resolve(root, "seeds/catalog.jilin-safe-new-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.jilin-safe-new-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.jilin-safe-new-batch-01.review.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const parsedText = await readFile(paths.parsed, "utf8");
if (sha(parsedText) !== "789f2f1c390a8d3af8aa4253be053a0a5df18ab2ddbe130775dc0f51c79ef729") throw new Error("Parsed Jilin artifact changed after review preparation.");
const parsed = JSON.parse(parsedText);
if (parsed.programCount !== 244 || JSON.stringify(parsed.counts) !== JSON.stringify({ "Master:Chinese": 102, "Master:English": 41, "Doctoral:Chinese": 67, "Doctoral:English": 34 })) throw new Error("Jilin parsed counts mismatch.");

const expected: Record<string, string> = {
  "jilin-bilateral-scholarship-2026": "73f06866114620bc609e4cb5ff58e864d7dbbf832297455f0289ac7fbadc0b16",
  "jilin-graduate-admissions-2026": "3ebbed029297a6af0f56f1ef9624d54d78287ee1bc2aedd0f182562ba4d65100",
  "jilin-high-level-graduate-program-catalog-2026": "f67f995f5dd8797d1a69e222dd5986f6de880bb7d4b725a7ed3b48968fdbdb4f",
  "jilin-high-level-postgraduate-scholarship-2026": "d4a9b657c9641e8c7a5fe6905166311d9f58a11a478eec4d009464bdca5a5048",
  "jilin-international-chinese-language-teachers-scholarship-2026": "52d85413ac3fd139dd8a3ac90e9fa950ef7dd247755344738a5876824788a692",
  "jilin-microbiology-excellence-scholarship-2026": "6b8cd94d5528ccb0da7fb45bf42433354e746f88076b44b532ff95b03f30b694",
  "jilin-northeast-asia-law-excellence-scholarship-2026": "536cda13ee831271f700a4f4a4de6fb7242835132f9dc3de26bc492f669fce8b",
  "jilin-pharmacology-excellence-scholarship-2026": "f5d11e718da389a490ba6d9da456f04c592c3ca9d8b9e8593b2ee61cf55a077f",
};
const manifests = [JSON.parse(await readFile(paths.manifest, "utf8")), JSON.parse(await readFile(paths.catalogManifest, "utf8"))];
const evidence = new Map<string, any>();
for (const manifest of manifests) for (const row of manifest.sources ?? []) if (expected[row.id] === row.sha256 && row.status === 200) evidence.set(row.id, row);
const missing = Object.keys(expected).filter(id => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked Jilin evidence: ${missing.join(", ")}`);

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const catalogSource = evidence.get("jilin-high-level-graduate-program-catalog-2026");
const admissionsSource = evidence.get("jilin-graduate-admissions-2026");
const typeBSource = evidence.get("jilin-high-level-postgraduate-scholarship-2026");
const programs: CatalogSeedProgram[] = parsed.programs.map((row: any) => {
  const english = row.teachingLanguage === "English";
  const tuition = row.degreeLevel === "Master"
    ? "RMB 21,000-33,000/year depending on discipline, college and language route"
    : "RMB 25,000-36,000/year depending on discipline, college and language route";
  return {
    slug: `${schoolSlug}-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-${slugify(row.collegeEn)}-${row.catalogId}`,
    schoolSlug,
    citySlug: "changchun",
    nameEn: row.nameEn,
    nameZh: row.nameZh || undefined,
    degreeLevel: row.degreeLevel,
    durationYears: row.durationYears,
    fieldCategory: row.collegeEn,
    subjectArea: row.collegeZh || row.collegeEn,
    teachingLanguage: row.teachingLanguage,
    ...(english ? { englishRequirement: "Meet the academic and language requirements applied by Jilin University and the teaching unit; the catalog does not publish one universal English-test threshold." } : { hskRequirement: "HSK Level 4 or above for the 2026/2027 High-level Graduate scholarship route." }),
    cscaRequirement: "No CSCA requirement is published for this graduate route.",
    tuitionText: tuition,
    displayTuition: tuition,
    scholarshipText: "Listed in Jilin University's official 2026/2027 Chinese Government Scholarship High-level Graduate program catalog.",
    applicationUrl: "https://apply.jlu.edu.cn",
    applicationNote: `${row.studyMode}; ${row.collegeEn}; ${row.sourceLocator}. This is a verified Type B catalog route, not a claim of exhaustive self-funded-program coverage.`,
    hasScholarship: true,
    badgeText: "Official 2026 Type B route",
    displayGroup: row.degreeLevel,
    displayGroupLabel: `${row.degreeLevel} programs`,
    status: "draft",
    sourceUrl: catalogSource.url,
    sourceLabel: catalogSource.label,
    sourceSha256: catalogSource.sha256,
    capturedAt: catalogSource.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${row.sourceLocator}, Major column`,
      nameZh: `${row.sourceLocator}, Major column`,
      degreeLevel: "official PDF section heading",
      fieldCategory: `${row.sourceLocator}, College column`,
      teachingLanguage: "official PDF section heading",
      durationYears: `${row.sourceLocator}, Year column`,
      tuitionText: `${admissionsSource.label}, tuition table`,
      ...(english ? { englishRequirement: `${typeBSource.label}, eligibility section does not publish a universal English-test score` } : { hskRequirement: `${typeBSource.label}, eligibility section` }),
    },
  };
});
if (programs.length !== 244 || new Set(programs.map(row => row.slug)).size !== 244) throw new Error("Jilin program routes/slugs mismatch.");

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const commonMaterials = [info("Passport information page"), info("Highest diploma or expected-graduation proof"), info("Academic transcripts"), info("Language proficiency evidence"), info("Study or research plan"), info("Recommendation letters where required"), info("Physical examination record"), info("No-criminal-record report")];
function scholarship(sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship {
  const source = evidence.get(sourceId);
  return {
    schoolSlug,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    providerLocation: "China",
    targetCountries: [],
    targetRegions: [],
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "JLU international application system", url: "https://apply.jlu.edu.cn", kind: "official-application" }],
    sourceFieldLineage: { title: "official notice title", fundingLevel: "official scholarship-coverage section", coverage: "official scholarship-coverage section", amountText: "official scholarship-coverage section", applicableDegree: "official supported-category section", applicableProgram: "official program-form section", eligibilityItems: "official eligibility section", applicationMaterials: "official application-process section", applicationSteps: "official application-process section", ...(value.deadlineDate ? { deadlineDate: "official deadline section" } : {}) },
    ...value,
  };
}
const excellenceMaterials = [...commonMaterials, info("Evidence of research achievements where applicable"), info("JLU and CSC online forms")];
const excellenceEligibility = [info("Nationality", "Non-Chinese citizen, physically and mentally healthy"), info("Age", "45 or younger"), info("Education", "Bachelor's degree or above"), info("Experience", "At least three years of work experience"), info("Applicant profile", "Public-sector official, senior manager, university/research administrator, or person with international-organization experience")];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("jilin-bilateral-scholarship-2026", { slug: "official-2026-jilin-chinese-government-bilateral-scholarship", title: "Jilin University 2026/2027 Chinese Government Scholarship - Bilateral Program (Type A)", nameZh: "吉林大学2026/2027学年中国政府奖学金国别双边项目（Type A）", type: "government", typeLabel: "Chinese Government Scholarship Type A", providerName: "中华人民共和国教育部 / 国家留学基金管理委员会", providerNameEn: "Ministry of Education of the PRC / China Scholarship Council", fundingLevel: "Full or partial", coverage: "Application fee and tuition, living allowance, accommodation subsidy and comprehensive medical insurance for full-award recipients; final category follows the bilateral allocation", applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "JLU programs accepted under the applicant's bilateral dispatch route", amountText: "Accommodation subsidy: CNY 700/month for undergraduate and master's students and CNY 1,000/month for doctoral students; other support follows the awarded bilateral category.", deadlineLabel: "Generally early January-April; exact deadline is set by the dispatching authority", applicationRound: "2026/2027 Chinese Government Scholarship Bilateral Program", benefitItems: [benefit("Application fee and tuition"), benefit("Living allowance"), benefit("Accommodation subsidy", "CNY 700/month undergraduate/master; CNY 1,000/month doctoral"), benefit("Comprehensive medical insurance")], eligibilityItems: [info("Nationality", "Non-Chinese citizen in good physical and mental health"), info("Bachelor", "High-school diploma, under 25 and CSCA participation"), info("Master", "Bachelor's degree and under 35"), info("Doctoral", "Master's degree and under 40"), info("Chinese-medium degree", "HSK Level 4 or above in principle")], applicationMaterials: commonMaterials, applicationSteps: [info("Step 1", "Apply through the dispatching authority in the home country"), info("Step 2", "Submit the CSC online application and select JLU as first choice, agency number 10183"), info("Step 3", "Await CSC and JLU review and electronic admission documents")], bodySections: [{ title: "Application route", body: "This is a country-dispatched Type A route. The dispatching authority determines the local deadline and award allocation." }], summary: "JLU's 2026/2027 bilateral Chinese Government Scholarship route for degree and non-degree study.", sortOrder: 20 }),
  scholarship("jilin-microbiology-excellence-scholarship-2026", { slug: "official-2026-jilin-microbiology-youth-of-excellence-scholarship", title: "Jilin University 2026/2027 Microbiology Youth of Excellence Scholarship", nameZh: "吉林大学2026/2027学年见“微”知著—微生物学卓越人才培养项目", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation while studying in China, living allowance and comprehensive medical insurance", applicableDegree: "Master", applicableProgram: "Two-year English-taught Microbiology master's program using a 1+1 format", amountText: "Full award; the notice publishes covered items but no numeric stipend amount.", deadlineDate: "2026-01-09", deadlineLabel: "January 9, 2026", applicationRound: "2026/2027 Microbiology Youth of Excellence", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation during study in China"), benefit("Living allowance"), benefit("Comprehensive medical insurance")], eligibilityItems: excellenceEligibility, applicationMaterials: excellenceMaterials, applicationSteps: [info("Step 1", "Submit a complete application in JLU's system by January 9"), info("Step 2", "Complete college review and interview or written test"), info("Step 3", "After pre-admission, submit the CSC application by March 20"), info("Step 4", "Await CSC final expert review")], bodySections: [{ title: "Study model", body: "Two-year English-medium master's degree using a 1+1 format: the first year is based at JLU and the second year is completed in the home country with the required thesis and defense." }, { title: "Research fields", items: ["Microbial diversity and genetic resources", "Bioinformatics in pathogen and cancer genomics", "Viral pathogenesis and antiviral development", "Infection, immunity and host interaction"] }], summary: "A full two-year English-medium microbiology master's award under the Youth of Excellence Scheme.", sortOrder: 30 }),
  scholarship("jilin-pharmacology-excellence-scholarship-2026", { slug: "official-2026-jilin-pharmacology-youth-of-excellence-scholarship", title: "Jilin University 2026/2027 Pharmacology Youth of Excellence Scholarship", nameZh: "吉林大学2026/2027学年“一带一路”沿线国家药理学卓越人才培养项目", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation while studying in China, living allowance and comprehensive medical insurance", applicableDegree: "Master", applicableProgram: "Two-year English-taught Pharmacology master's program using a 1+1 format", amountText: "Full award; the notice publishes covered items but no numeric stipend amount.", deadlineDate: "2026-01-09", deadlineLabel: "January 9, 2026", applicationRound: "2026/2027 Pharmacology Youth of Excellence", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation during study in China"), benefit("Living allowance"), benefit("Comprehensive medical insurance")], eligibilityItems: excellenceEligibility, applicationMaterials: excellenceMaterials, applicationSteps: [info("Step 1", "Submit a complete application in JLU's system by January 9"), info("Step 2", "Complete college review and interview or written test"), info("Step 3", "After pre-admission, submit the CSC application by March 20"), info("Step 4", "Await CSC final expert review")], bodySections: [{ title: "Study model", body: "Two-year English-medium master's degree using a 1+1 format." }, { title: "Research fields", items: ["Mechanisms and intervention for chronic diseases of ageing", "Nano-oncology pharmacology", "Cardiovascular and cerebrovascular disease mechanisms and translation"] }], summary: "A full two-year English-medium pharmacology master's award under the Youth of Excellence Scheme.", sortOrder: 40 }),
  scholarship("jilin-northeast-asia-law-excellence-scholarship-2026", { slug: "official-2026-jilin-northeast-asia-law-youth-of-excellence-scholarship", title: "Jilin University 2026/2027 Northeast Asia Legal Talents Youth of Excellence Scholarship", nameZh: "吉林大学2026/2027学年东北亚法治卓越人才培养项目", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, living allowance and comprehensive medical insurance during study in China", applicableDegree: "Master", applicableProgram: "One-year English-taught Juris Master programs for law and non-law backgrounds", amountText: "Full award; the notice publishes covered items but no numeric stipend amount.", deadlineDate: "2026-01-09", deadlineLabel: "January 9, 2026", applicationRound: "2026/2027 Northeast Asia Legal Talents Youth of Excellence", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Living allowance"), benefit("Comprehensive medical insurance")], eligibilityItems: excellenceEligibility, applicationMaterials: excellenceMaterials, applicationSteps: [info("Step 1", "Submit a complete application in JLU's system by January 9"), info("Step 2", "Complete teaching-unit review and interview or written test"), info("Step 3", "After pre-admission, submit the CSC application by March 20"), info("Step 4", "Await CSC final expert review")], bodySections: [{ title: "Study model", body: "A one-year, 12-month English-medium master's route completed at JLU, including coursework, thesis review and defense." }], summary: "A full one-year English-medium legal master's award focused on Northeast Asian legal practice.", sortOrder: 50 }),
  scholarship("jilin-international-chinese-language-teachers-scholarship-2026", { slug: "official-2026-jilin-international-chinese-language-teachers-scholarship", title: "Jilin University International Chinese Language Teachers Scholarship 2026", nameZh: "吉林大学2026年国际中文教师奖学金", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", fundingLevel: "Official scholarship support", coverage: "Support is provided for the published master's, one-year, one-semester and four-week categories; detailed coverage standards are in the official attachment and are not inferred here", applicableDegree: "Master and non-degree language-study categories", applicableProgram: "International Chinese Language Education and specified Chinese language, literature, history, philosophy, traditional Chinese medicine and Taiji routes", amountText: "The captured guide does not state numeric award amounts; consult the official coverage appendix.", deadlineDate: "2026-05-15", deadlineLabel: "April 15 for July; May 15 for September; September 15 for December; October 31 for March 2027", applicationRound: "2026 International Chinese Language Teachers Scholarship", benefitItems: [benefit("Master category", "Up to two academic years"), benefit("One-year category", "Up to 11 months"), benefit("One-semester category", "Up to five months"), benefit("Four-week category", "Up to four weeks")], eligibilityItems: [info("Nationality", "Non-Chinese citizen"), info("Age", "Generally 16-35 on September 1, 2026; up to 45 for in-service teachers"), info("Master", "Bachelor's degree, HSK 5 score 210 and HSKK Intermediate score 60"), info("One-year Chinese education", "HSK 3 score 270 and HSKK score"), info("One-semester", "Program-specific HSK/HSKK requirements apply")], applicationMaterials: [info("Online scholarship application"), info("Passport information page"), info("HSK and HSKK score reports"), info("Recommending-institution documents"), info("Employment proof and employer recommendation for in-service teachers where applicable")], applicationSteps: [info("Step 1", "Apply online at the International Chinese Language Teachers Scholarship website from March 1"), info("Step 2", "Select a recommending institution and JLU as host institution"), info("Step 3", "Track expert review and scholarship result online"), info("Step 4", "Confirm with JLU and register according to the admission notice")], bodySections: [{ title: "Published categories", items: ["Master's Degree in International Chinese Language Education", "One-Year Study Program", "One-Semester Study Program", "Four-Week Study Program"] }, { title: "Important limitation", body: "Applicants who received a similar scholarship within the prior three years are generally ineligible for the one-semester or one-year category." }], summary: "JLU's 2026 scholarship route for prospective and in-service international Chinese-language teachers.", sortOrder: 60 }),
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: evidence.get("jilin-high-level-graduate-program-catalog-2026").fetchedAt,
  cities: [{ slug: "changchun", nameEn: "Changchun", nameZh: "长春", region: "东北", status: "active", sourceUrl: "https://www.cscapilot.com/zh/study-china/cities/changchun", sourceLabel: "CSCAPilot online city catalog recovery export", sourceSha256: "0a72b63c8e8f332ad6894b2b433f59b8bd752ceb7841fa943d5c5833a73c1139", capturedAt: "2026-07-14T05:17:47.163Z", sourceFieldLineage: { nameEn: "city_guides.nameEn", nameZh: "city_guides.nameZh", region: "city_guides.region" } }],
  schools: [{ slug: schoolSlug, nameEn: "Jilin University", nameZh: "吉林大学", citySlug: "changchun", schoolType: "regular", region: "Changchun, Northeast China", applicationLevel: "本科", languageOfInstruction: "Chinese, English", hskRequirement: "HSK4 可免专业中文；未通过需读预科。", deadlineSummary: "Round 1 closes 2026-07-15; Round 1 deadline 本科项目截止：2026 年 7 月 15 日。", tuitionSummary: "¥19,000 - ¥33,000/年。", websiteUrl: "https://www.jlu.edu.cn/", cscaRequired: true, cscaRequirement: "数学必考。", cscaSubjects: ["中文(文科)", "数学", "物理", "化学"], subjectTags: ["Law", "MBBS", "Economics"], languageTags: ["英文授课", "中文授课"], status: "active", sourceUrl: "https://csca.app/zh/universities/jilin-university", sourceLabel: "csca-reference-screenshot", sourceSha256: "1266c95cf3dfbcc2483b733ec7917f04de6a81795bd41e6a31fda4d2ffc8ce69", capturedAt: "2026-05-13T00:00:00Z", sourceFieldLineage: { nameEn: "schools.nameEn", nameZh: "schools.nameZh", citySlug: "schools.citySlug", schoolType: "schools.schoolType", region: "schools.region", applicationLevel: "schools.applicationLevel", languageOfInstruction: "schools.languageOfInstruction", hskRequirement: "schools.hskRequirement", deadlineSummary: "schools.deadlineSummary", tuitionSummary: "schools.tuitionSummary", websiteUrl: "schools.websiteUrl", cscaRequired: "schools.cscaRequired", cscaRequirement: "schools.cscaRequirement", cscaSubjects: "schools.cscaSubjects", subjectTags: "schools.subjectTags", languageTags: "schools.languageTags" } }],
  programs,
  programIntakes: programs.map(program => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-03-01T00:00:00.000Z", deadlineLabel: "High-level Graduate scholarship application deadline: March 1, 2026", applicationRound: "2026/2027 Chinese Government Scholarship High-level Graduate Program", status: "closed" as const, sourceUrl: typeBSource.url, sourceLabel: typeBSource.label, sourceSha256: typeBSource.sha256, capturedAt: typeBSource.fetchedAt, sourceFieldLineage: { deadlineDate: "official application-and-review process; date-only value normalized to ISO UTC" } })),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Jilin candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = sha(candidateText);
const reviewBase: any = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug, programRouteCount: 244, masterRouteCount: 143, doctoralRouteCount: 101, programIntakeCount: 244, newScholarshipCount: 5, cityOverwriteCount: 0, schoolOverwriteCount: 0, stableScholarshipUpdateCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(row => ({ sourceId: row.id, sourceUrl: row.url, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", pdfPagesReviewed: 8, parsedProgramRowsReviewed: 244, note: "All eight PDF pages were rendered; the two-column tables were parsed panel-by-panel and locked to the official 102/41/67/34 section counts." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], excludedExistingScholarshipSlug: "official-2026-jilin-high-level-postgraduate-scholarship" },
  coverageLimitations: ["The CAPTCHA-protected full 2026/2027 program attachment was not bypassed.", "The 244 routes are the exact official High-level Graduate scholarship catalog subset, not the entire self-funded catalog.", "No undergraduate route is created in this safe-new batch because the full undergraduate names remain blocked behind the official attachment CAPTCHA.", "The existing verified Type B scholarship is not overwritten in this standing-authorized batch."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, admissions and scholarship data are included. Contact persons, personal telephone/email details, applicant data, accounts and payment data are excluded." },
  visualReview: { result: "pass", artifact: "work/catalog-official/jilin-graduate-catalog-batch-01/rendered", note: "Rendered first and final pages were visually inspected; section layout, columns and continuation behavior match the parser." },
  reviewNotes: ["This batch only inserts new records and therefore fits the user's standing default-publication authorization.", "The three legacy undergraduate programs, one legacy Golden Bean scholarship, city record, school record and existing Type B scholarship remain unchanged."]
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-jilin-safe-new-batch-01-${reviewHash}` };
await Promise.all([
  writeFile(paths.draft, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, candidateBundleSha256: validation.bundleSha256, reviewHash, publicationReference: review.publicationReference, paths }, null, 2));
