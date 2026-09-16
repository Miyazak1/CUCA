import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = {
  primaryManifest: resolve(root, "work/catalog-official/shu-complete-batch-01/manifest.json"),
  englishManifest: resolve(root, "work/catalog-official/shu-en-program-guides-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/shu-complete-batch-01/parsed-programs.json"),
  base: resolve(root, "seeds/catalog.tongji-school-program-batch-01.approved.local.json"),
  draft: resolve(root, "seeds/catalog.shu-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.shu-complete-batch-01.validation.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [primaryText, englishText, parsedText, baseText] = await Promise.all([
  readFile(paths.primaryManifest, "utf8"), readFile(paths.englishManifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.base, "utf8"),
]);
const primary = JSON.parse(primaryText), english = JSON.parse(englishText), parsed = JSON.parse(parsedText), base = JSON.parse(baseText) as CatalogSeedBundle;
const expected: Record<string, string> = {
  "shu-international-application-overview-2026": "b4552634c743f69849c1e401652002b6f4d8a58f713bfe60e98cbff96716d310",
  "shu-undergraduate-guide-2026": "5803a7fe424847e113afa4eb4ef1b5cc0710063c7ca8b3870a5d6de35318e3d5",
  "shu-master-guide-2026": "b0c35489059f8ecd95310af13b41e474d27b9111b07819df2606f12fd89d7566",
  "shu-doctoral-guide-2026": "a6ec20085d0cbc54b1ad2cf9c1ba196fbbecfcbe29d23793c966452e910b7d11",
  "shu-scholarship-overview-2026": "a1fd771ad7fceae11ee20b9737d805284451bcefabad47153a09247888ae71ff",
  "shu-shanghai-government-scholarship-2026": "cb8373a336126511963e963965417e49d248e693044be3773fe3171f352de785",
  "shu-cgs-high-level-postgraduate-2026": "79650f8fc13542e7238aea34409c5e1e4ce3bd511b97c0640daf6234eb680cb9",
  "shu-cgs-bilateral-2026": "3946602565ba1637dc846751e6fd3af5080dd8991c844ee5a4aa41c0aabd390e",
  "shu-cgs-silk-road-2026": "fe85ff9200e62ac9e2e659075ca0fbda92148c5834fee44b507f10a4f1d1bfe1",
  "shu-international-chinese-language-teachers-scholarship-2026": "cb9703d6835e09db3391b4d8beedb5ab820a8484b9000a3277a48334731951c4",
  "shu-master-guide-en-2026": "b56f0ce6a96005c6b0a4fdd0eea88db5aee88da114cd7c3c2e8a7c607db09e64",
  "shu-doctoral-guide-en-2026": "817e07bd1ecb84636e8752c1a2b3a17163e3c6e9afc9bb586f7d295451a3e24f",
};
const evidence = new Map<string, any>();
for (const row of [...(primary.sources ?? []), ...(english.sources ?? [])]) {
  if (row.status === 200 && expected[row.id] === row.sha256) evidence.set(row.id, row);
}
if (evidence.size !== 12 || parsed.programCount !== 242) throw new Error("SHU evidence/parser mismatch.");
const city = base.cities?.find((row) => row.slug === "shanghai");
if (!city) throw new Error("Current Shanghai dependency missing.");

const schoolSlug = "shanghai-university";
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programSource = (row: any) => evidence.get(row.sourceId);
const programs: CatalogSeedProgram[] = parsed.programs.map((row: any) => {
  const source = programSource(row);
  const languageSlug = slugify(row.teachingLanguage);
  return {
    slug: `${schoolSlug}-${row.degreeLevel.toLowerCase()}-${languageSlug}-${slugify(row.college)}-${slugify(row.nameEn)}-${row.degreeCategory.toLowerCase()}`,
    schoolSlug,
    citySlug: "shanghai",
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    durationYears: Math.ceil(row.durationYears),
    fieldCategory: row.college,
    subjectArea: row.nameEn,
    teachingLanguage: row.teachingLanguage,
    cscaRequirement: row.degreeLevel === "Bachelor" ? `CSCA required: ${row.cscaSubjects}.` : "No CSCA requirement is published for this graduate route.",
    hskRequirement: row.teachingLanguage.includes("Chinese") ? "HSK 4 score 180 for Chinese Language/TCOL bachelor's routes; HSK 5 score 180 for science, engineering, economics, management and art; HSK 5 score 210 for humanities." : undefined,
    englishRequirement: row.teachingLanguage.includes("English") ? "IELTS Academic 6.5, TOEFL iBT 90, or recognized equivalent; exemptions apply to native speakers and prior degrees fully taught in English." : undefined,
    tuitionAmount: row.tuitionAmount,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `RMB ${row.tuitionAmount.toLocaleString("en-US")}/academic year`,
    scholarshipText: "Shanghai University publishes government, university and language-teacher scholarship routes separately; awards are competitive and not guaranteed.",
    applicationUrl: "https://apply.shu.edu.cn/",
    applicationNote: `${row.degreeCategory} ${row.degreeLevel.toLowerCase()} route offered by ${row.college}. Official published length: ${row.durationYears} years.`,
    hasScholarship: true,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: row.sourceLocator,
      degreeLevel: row.sourceLocator,
      durationYears: row.sourceLocator,
      fieldCategory: row.sourceLocator,
      teachingLanguage: row.sourceLocator,
      tuitionAmount: row.sourceLocator,
      cscaRequirement: row.degreeLevel === "Bachelor" ? row.sourceLocator : "2026-2027 graduate admission guide; no CSCA requirement published",
      ...(row.teachingLanguage.includes("English") ? { englishRequirement: "official international application overview, Language ability" } : {}),
      ...(row.teachingLanguage.includes("Chinese") ? { hskRequirement: "official international application overview, Language ability" } : {}),
    },
  };
});
if (programs.length !== 242 || new Set(programs.map((row) => row.slug)).size !== 242) throw new Error("SHU program slug/build mismatch.");

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const degreeMaterials = [
  info("Passport information page"), info("Recent ID photo"), info("Highest degree certificate or pre-graduation proof"), info("Official academic transcripts"),
  info("Valid language proficiency certificate"), info("Personal statement or research plan"), info("Certificate of no criminal record"),
];
const graduateMaterials = [...degreeMaterials, info("Two signed academic recommendation letters"), info("Prospective-supervisor acceptance where required"), info("Academic research evidence or art portfolio where required")];
function scholarship(sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship {
  const source = evidence.get(sourceId);
  return {
    schoolSlug,
    status: "draft",
    sourceUrl: source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    providerLocation: "Shanghai, China",
    targetCountries: [],
    targetRegions: [],
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "Shanghai University application system", url: "https://apply.shu.edu.cn/", kind: "official-application" }],
    sourceFieldLineage: { title: "official scholarship heading", fundingLevel: "official coverage section", coverage: "official coverage section", amountText: "official coverage section", applicableDegree: "official supporting-category section", eligibilityItems: "official eligibility section", applicationMaterials: "official application-documents section", applicationSteps: "official application-procedure section", deadlineLabel: "official application deadline" },
    ...value,
  };
}
const scholarships: CatalogSeedScholarship[] = [
  scholarship("shu-shanghai-government-scholarship-2026", {
    slug: "shanghai-university-2026-shanghai-government-scholarship", title: "Shanghai Government Scholarship at Shanghai University 2026", nameZh: "上海大学2026年上海市政府奖学金", type: "government", typeLabel: "Shanghai Government Scholarship", providerName: "上海市政府 / 上海大学", providerNameEn: "Shanghai Municipal Government / Shanghai University", fundingLevel: "Full / Partial", coverage: "Full: tuition, on-campus accommodation or monthly housing subsidy, stipend and comprehensive medical insurance. Partial: tuition and comprehensive medical insurance.", applicableDegree: "Bachelor, Master, Doctoral", applicableProgram: "All eligible Shanghai University degree programs; bachelor applicants may apply for partial funding, while graduate applicants may apply for full or partial funding.", amountText: "Full award: tuition waiver; stipend RMB 2,500/month bachelor, RMB 3,000/month master, RMB 3,500/month doctoral; off-campus housing subsidy RMB 700/month bachelor or master and RMB 1,000/month doctoral; medical insurance included.", deadlineDate: "2026-04-30", deadlineLabel: "April 30, 2026", applicationRound: "2026 Shanghai Government Scholarship",
    benefitItems: [benefit("Tuition waiver"), benefit("Accommodation or housing subsidy", "Full award only; RMB 700/month bachelor or master, RMB 1,000/month doctoral off campus"), benefit("Monthly stipend", "Full award only; RMB 2,500 bachelor, RMB 3,000 master, RMB 3,500 doctoral"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good physical and mental health"), info("Academic standing", "Pre-admission and excellent academic record required"), info("Age", "Under 25 bachelor; under 35 master; under 40 doctoral"), info("Other funding", "No other scholarship held at application")],
    applicationMaterials: degreeMaterials, applicationSteps: [info("Step 1", "Complete the Shanghai University online degree and scholarship application"), info("Step 2", "Complete university qualification assessment and interview where arranged"), info("Step 3", "University scholarship committee reviews candidates; proposed results are published from mid-to-late June 2026")], summary: "Full and partial Shanghai Government Scholarship route for new Shanghai University degree students in 2026.", sortOrder: 10,
  }),
  scholarship("shu-cgs-high-level-postgraduate-2026", {
    slug: "shanghai-university-2026-cgs-high-level-postgraduate-program", title: "Shanghai University 2026 Chinese Government Scholarship – High Level Postgraduate Program", nameZh: "上海大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship (Type B)", providerName: "国家留学基金管理委员会 / 上海大学", providerNameEn: "China Scholarship Council / Shanghai University", fundingLevel: "Full", coverage: "Tuition, on-campus dormitory or accommodation subsidy, monthly stipend and comprehensive medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "All eligible Shanghai University master's and doctoral programs", amountText: "Tuition waiver; accommodation or RMB 700/month master and RMB 1,000/month doctoral housing subsidy; stipend RMB 3,000/month master and RMB 3,500/month doctoral; medical insurance RMB 800/year.", deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "2026 CGS High Level Postgraduate Program",
    benefitItems: [benefit("Tuition waiver"), benefit("Accommodation or subsidy", "RMB 700/month master; RMB 1,000/month doctoral"), benefit("Monthly stipend", "RMB 3,000 master; RMB 3,500 doctoral"), benefit("Medical insurance", "RMB 800/year")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good physical and mental health"), info("Degree and age", "Bachelor's degree and under 35 for master; master's degree and under 40 for doctoral"), info("Academic fit", "Relevant prior academic background; GPA 2.5 master or GPA 3.0 doctoral"), info("Other funding", "No other scholarship held at application")],
    applicationMaterials: graduateMaterials, applicationSteps: [info("Step 1", "Apply in the Shanghai University system by February 15, 2026"), info("Step 2", "University reviews, interviews and nominates candidates by March 15"), info("Step 3", "Nominated candidates apply in the CSC system with agency 10280 by March 20"), info("Step 4", "CSC conducts final evaluation")], summary: "Full Chinese Government Scholarship for new international master's and doctoral students nominated by Shanghai University.", sortOrder: 20,
  }),
  scholarship("shu-cgs-bilateral-2026", {
    slug: "shanghai-university-2026-cgs-bilateral-program", title: "Shanghai University 2026 Chinese Government Scholarship – Bilateral Program", nameZh: "上海大学2026年中国政府奖学金国别双边项目", type: "government", typeLabel: "Chinese Government Scholarship (Type A)", providerName: "国家留学基金管理委员会 / 派遣机构", providerNameEn: "China Scholarship Council / Dispatching Authority", fundingLevel: "Full / Partial", coverage: "Full and partial awards are available. Full coverage includes tuition, university accommodation or subsidy, stipend and comprehensive medical insurance; partial coverage is set by the dispatching authority.", applicableDegree: "Bachelor, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "Eligible Shanghai University programs without a published major restriction", amountText: "Full award: tuition; accommodation or subsidy RMB 700/month for bachelor, master and general scholar, RMB 1,000/month for doctoral and senior scholar; stipend RMB 2,500 undergraduate, RMB 3,000 master/general scholar, RMB 3,500 doctoral/senior scholar; insurance RMB 800/year or RMB 400 for programs under six months.", deadlineLabel: "Generally November 2025 to February 2026; exact deadline is set by the home-country dispatching authority", applicationRound: "2026 CGS Bilateral Program",
    benefitItems: [benefit("Tuition", "Full award"), benefit("Accommodation or subsidy", "Full award"), benefit("Monthly stipend", "Full award; amount varies by study category"), benefit("Medical insurance", "Full award")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good health"), info("Nomination", "Apply through the home-country dispatching authority"), info("Language", "Meet the language threshold of the chosen program"), info("CSCA", "Bachelor applicants must obtain a valid CSCA score report")],
    applicationMaterials: degreeMaterials, applicationSteps: [info("Step 1", "Apply for Shanghai University pre-admission in the university system"), info("Step 2", "Apply through the home-country dispatching authority in the CSC Type A route"), info("Step 3", "Follow the dispatching authority's exact deadline and submission instructions")], summary: "Chinese Government Scholarship bilateral route administered through home-country dispatching authorities.", sortOrder: 30,
  }),
  scholarship("shu-cgs-silk-road-2026", {
    slug: "shanghai-university-2026-cgs-silk-road-program", title: "Shanghai University 2026 Chinese Government Scholarship – Silk Road Program", nameZh: "上海大学2026年中国政府奖学金丝绸之路项目", type: "government", typeLabel: "Chinese Government Scholarship (Silk Road)", providerName: "国家留学基金管理委员会 / 上海大学", providerNameEn: "China Scholarship Council / Shanghai University", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation or monthly subsidy, stipend and comprehensive medical insurance.", applicableDegree: "Master, Doctoral", applicableProgram: "Journalism and Communication (Chinese/English master), Communication (Chinese doctoral), Museum Studies (Chinese/English master), Cultural Heritage (Chinese doctoral), and Design Arts (Chinese master)", amountText: "Tuition waiver; housing or RMB 700/month master and RMB 1,000/month doctoral subsidy; stipend RMB 3,000/month master and RMB 3,500/month doctoral; medical insurance RMB 800/year.", deadlineDate: "2026-05-10", deadlineLabel: "May 10, 2026", applicationRound: "2026 CGS Silk Road Program",
    targetCountries: ["Vietnam", "Indonesia", "Russia", "Thailand", "Pakistan", "Mongolia", "Kazakhstan", "Uzbekistan", "Malaysia", "Cambodia"],
    benefitItems: [benefit("Tuition waiver"), benefit("Accommodation or subsidy", "RMB 700/month master; RMB 1,000/month doctoral"), benefit("Monthly stipend", "RMB 3,000 master; RMB 3,500 doctoral"), benefit("Medical insurance", "RMB 800/year")],
    eligibilityItems: [info("Country", "Applicants from the ten countries published in the guide"), info("Degree and age", "Bachelor's degree and under 35 for master; master's degree and under 40 for doctoral"), info("Language", "HSK 6 score 180 for Chinese routes; IELTS 6.5, TOEFL 90 or equivalent for English routes"), info("Other funding", "No other scholarship held at application")],
    applicationMaterials: graduateMaterials, applicationSteps: [info("Step 1", "Apply in the CSC system as Type B with Shanghai University agency 10280"), info("Step 2", "Apply in the Shanghai University system by May 10, 2026"), info("Step 3", "Complete university review, interview and supervisor/faculty review"), info("Step 4", "University nominates candidates and CSC makes the final decision")], summary: "Full 2026 Silk Road scholarship for specified cultural heritage, communication and creative-design graduate routes.", sortOrder: 40,
  }),
  scholarship("shu-international-chinese-language-teachers-scholarship-2026", {
    slug: "shanghai-university-2026-international-chinese-language-teachers-scholarship", title: "Shanghai University 2026 International Chinese Language Teachers Scholarship", nameZh: "上海大学2026年国际中文教师奖学金", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心 / 上海大学", providerNameEn: "Center for Language Education and Cooperation / Shanghai University", fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance (except the four-week program) and comprehensive medical insurance.", applicableDegree: "Bachelor, Master, Non-degree", applicableProgram: "International Chinese Language Education bachelor's and master's degrees plus published one-year, one-semester and four-week Chinese-language study routes", amountText: "Accommodation or RMB 700/month off-campus allowance for these categories; living allowance RMB 2,500/month for bachelor, one-year and one-semester students and RMB 3,000/month for International Chinese Language Education master's students; insurance RMB 100 four-week, RMB 400 one-semester, or RMB 800/year for programs over one year.", deadlineDate: "2026-05-15", deadlineLabel: "July intake: April 15; September intake: May 15; December intake: September 15; March 2027 intake: October 31 (Beijing Time)", applicationRound: "2026 International Chinese Language Teachers Scholarship",
    benefitItems: [benefit("Tuition"), benefit("Accommodation", "On-campus housing or approved off-campus allowance"), benefit("Living allowance", "Not provided for the four-week route"), benefit("Medical insurance", "Amount varies by program duration")],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen with a valid ordinary passport"), info("Age", "16-35 as of September 1, 2026; up to 45 for in-service Chinese teachers; bachelor applicants generally under 25"), info("Career intent", "Committed to Chinese-language education, teaching or related work"), info("Language", "HSK and HSKK thresholds vary by study category")],
    applicationMaterials: [info("Passport information page"), info("Recent ID photo"), info("Valid HSK/HSKK score reports"), info("Recommendation from a recommending institution"), info("Degree certificate and transcripts for degree routes"), info("Additional category-specific materials")],
    applicationSteps: [info("Step 1", "From March 1, apply through the International Chinese Language Teachers Scholarship website; degree applicants also apply to Shanghai University"), info("Step 2", "Recommending institution reviews the application"), info("Step 3", "Shanghai University reviews materials and interviews eligible degree applicants"), info("Step 4", "CLEC expert panel reviews and publishes the award result")], summary: "Full scholarship covering degree and short-term Chinese-language teacher education routes at Shanghai University.", sortOrder: 50,
  }),
  scholarship("shu-scholarship-overview-2026", {
    slug: "shanghai-university-new-international-student-scholarship-current", title: "Shanghai University New International Student Scholarship", nameZh: "上海大学新生奖学金", type: "university", typeLabel: "Shanghai University Scholarship", providerName: "上海大学", providerNameEn: "Shanghai University", fundingLevel: "Partial", coverage: "Tuition waiver. Accommodation, stipend and medical insurance are not included; designated on-campus housing may use the published scholarship-student preferential price.", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible Shanghai University master's and doctoral applicants not selected for the reviewed CSC Type B or Shanghai Government Scholarship routes", amountText: "Tuition waiver; no stipend or medical insurance. Published preferential on-campus housing price: RMB 700/month master and RMB 1,000/month doctoral.", deadlineLabel: "No separate application or deadline; recipients are selected from eligible CSC Type B and Shanghai Government Scholarship applicants", applicationRound: "Current Shanghai University new international student scholarship",
    benefitItems: [benefit("Tuition waiver"), { label: "Accommodation", included: false, note: "Preferential designated on-campus price may apply" }, { label: "Stipend", included: false }, { label: "Medical insurance", included: false }],
    eligibilityItems: [info("Nationality", "Non-Chinese citizen in good health"), info("Degree and age", "Bachelor's degree and under 35 for master; master's degree and under 40 for doctoral"), info("Selection pool", "Eligible applicants from CSC Type B and Shanghai Government Scholarship applications")],
    applicationMaterials: [info("No separate scholarship application", "Use the materials submitted for the eligible underlying scholarship route")], applicationSteps: [info("Step 1", "Apply for the eligible CSC Type B or Shanghai Government Scholarship route"), info("Step 2", "Shanghai University selects recipients; no separate application is required")], summary: "University-funded partial award selected from eligible graduate scholarship applicants without a separate application.", sortOrder: 60,
  }),
];

const overview = evidence.get("shu-international-application-overview-2026");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: primary.generatedAt,
  cities: [city],
  schools: [{
    slug: schoolSlug, nameEn: "Shanghai University", nameZh: "上海大学", citySlug: "shanghai", schoolType: "Public", region: "Shanghai, East China",
    applicationLevel: "Bachelor, Master, Doctoral", languageOfInstruction: "Chinese, English, and selected bilingual routes",
    hskRequirement: "HSK 4 score 180 for Chinese Language/TCOL bachelor's routes; HSK 5 score 180 for science, engineering, economics, management and art; HSK 5 score 210 for humanities.",
    englishRequirement: "IELTS Academic 6.5, TOEFL iBT 90, or a recognized equivalent; exemptions apply to native speakers and prior degrees fully taught in English.",
    deadlineSummary: "2026 degree applications: November 20, 2025 to June 30, 2026. Scholarship deadlines vary by route.",
    tuitionSummary: "Published 2026 route tuition ranges from RMB 21,000 to RMB 134,000 per academic year.", applicationFee: "See the official application system for the applicable route fee.", websiteUrl: "https://www.shu.edu.cn/", admissionsUrl: overview.url,
    cscaRequired: true, cscaRequirement: "Bachelor applicants must submit a valid CSCA score report; required subjects are published per route. No CSCA requirement is published for graduate routes.",
    subjectTags: ["Humanities", "Science", "Engineering", "Economics", "Management", "Arts", "Communication"], languageTags: ["Chinese", "English"], campusHighlights: ["Baoshan Campus", "Yanchang Campus", "Jiading Campus"], status: "draft",
    sourceUrl: overview.url, sourceLabel: overview.label, sourceSha256: overview.sha256, capturedAt: overview.fetchedAt,
    sourceFieldLineage: { nameEn: "official international application identity", nameZh: "official international application identity", citySlug: "official institutional address", applicationLevel: "2026-2027 degree guides", languageOfInstruction: "2026-2027 program tables", hskRequirement: "international application overview, Language ability", englishRequirement: "international application overview, Language ability", deadlineSummary: "2026-2027 degree guides", tuitionSummary: "2026-2027 program tables", cscaRequirement: "2026 undergraduate guide and international application overview" },
  }],
  programs,
  programIntakes: programs.map((program) => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-06-30T00:00:00.000Z", deadlineLabel: "June 30, 2026", applicationRound: "2026-2027 Shanghai University international degree admissions", status: "closed", sourceUrl: program.sourceUrl, sourceLabel: program.sourceLabel, sourceSha256: program.sourceSha256, capturedAt: program.capturedAt, sourceFieldLineage: { deadlineDate: "2026-2027 degree guide, Date of Application" } })),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
await Promise.all([
  writeFile(paths.draft, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify({ ...validation, primaryManifestSha256: sha(primaryText), englishManifestSha256: sha(englishText), parsedArtifactSha256: sha(parsedText) }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, summary: validation.summary, degreeCounts: parsed.degreeCounts, languageCounts: parsed.languageCounts, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, paths }, null, 2));
