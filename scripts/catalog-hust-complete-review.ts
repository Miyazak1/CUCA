import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const runDir = resolve(root, "work/catalog-official/hust-complete-batch-01");
const candidatePath = resolve(root, "seeds/catalog.hust-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.hust-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.hust-complete-batch-01.review.json");
const basePath = resolve(root, "seeds/catalog.cscalite-online-20260910.published.json");
const schoolSlug = "huazhong-university-of-science-and-technology";
const applicationUrl = "https://admission.hust.edu.cn/";

const expected: Record<string, string> = {
  "hust-youth-of-excellence-scholarship-2026": "884149521722d13b7f9189a494820c2ebcd874b4ff7542ee51aecfe973678097",
  "hust-admissions-overview-2026": "b3ea14ea6708f31a82059472f02a5ccbbcc11414fac0b32b11bf982dc0c9e4a4",
  "hust-undergraduate-guide-2026": "1cec0171dd9acff5c8bd79ef8f3132d818c2e0a16d2e22464bc08df670c16181",
  "hust-undergraduate-programs-2026": "011b999d5ba4ca41eceb715de65725ad9ac26c4e8f26c430736ca0741c461b86",
  "hust-graduate-guide-2026": "7c0c7c8c88371e1479a8844c4dbdc14aa1d9ae284f0b38581f1021630aefee29",
  "hust-master-programs-2026": "530955146fcee9b183f87b04c4288d5c649e0cc4e18ddf01b0cce87ae2cb10e4",
  "hust-medical-postgraduate-programs-2026": "20869fdf92066cb7c30b94230f73500f6661b8a98dbe27b4e45bdf655eeee662",
  "hust-english-postgraduate-programs-2026": "d1ee2697b7b236a9c0627786f0d6dcec36db3963b228db6bbba73f4fc44fa8b8",
  "hust-doctoral-programs-2026": "64e43766ad86ae5ae0cc445f962d3e93ff6717f25e2fcb6ddf35737248b12c0c",
  "hust-scholarship-information-2026": "73b2b22cd55458c1740c003562c3c6fea0ab7a401f19f5f4fbcf9e73ff49fe9c",
  "hust-silk-road-scholarship-2026": "8b297303f287c3e1c2796f1e52b12f7bace9d0d762eac41486ed3c0efb16a2e9",
  "hust-international-chinese-teachers-scholarship-2026": "5641c761f60666f4d3d3bec29b97d94e4622357b58ae6930dfc90dd8027ea789",
  "hust-eu-window-scholarship-2026": "cbec4f4832b23df0fdb3e5df4646771e7327bf86fd623aa3d899b41bc3d8a98e",
  "hust-china-link-scholarship-2025-2026": "41a0380c7381380c0e6fb75cab44c361bf415acad82d58754e2ac4d4e09168bd",
};

const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
const parsed = JSON.parse(await readFile(resolve(runDir, "parsed-routes.json"), "utf8"));
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const evidence = new Map<string, any>();
for (const source of manifest.sources ?? []) {
  if (expected[source.id] !== source.sha256 || source.status !== 200) throw new Error(`Official snapshot mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
if (evidence.size !== Object.keys(expected).length) throw new Error("The complete HUST evidence set was not collected.");
if (parsed.counts.undergraduate !== 44 || parsed.counts.master !== 215 || parsed.counts.doctoral !== 207) {
  throw new Error(`Unexpected HUST route counts: ${JSON.stringify(parsed.counts)}`);
}

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stable: Record<string, string> = {
  "Undergraduate|Clinical Medicine|English": `${schoolSlug}-clinical-medicine-mbbs-english`,
  "Undergraduate|Pharmacy|English": `${schoolSlug}-pharmacy-english`,
  "Undergraduate|Telecommunications Engineering|English": `${schoolSlug}-communication-engineering-english`,
  "Undergraduate|Mechanical Design, Manufacturing and Automation|English": `${schoolSlug}-mechanical-design-and-manufacturing-english`,
  "Undergraduate|Biomedical Engineering|English": `${schoolSlug}-biomedical-engineering-english`,
  "Undergraduate|Mechanical Design, Manufacturing and Automation|Chinese": `${schoolSlug}-mechanical-engineering`,
  "Undergraduate|Electrical Engineering and Automation|Chinese": `${schoolSlug}-electrical-engineering`,
  "Undergraduate|Electronic and Information Engineering|Chinese": `${schoolSlug}-electronic-information-engineering`,
  "Undergraduate|Computer Science and Technology|Chinese": `${schoolSlug}-computer-science-and-technology`,
  "Undergraduate|Software Engineering|Chinese": `${schoolSlug}-software-engineering`,
  "Undergraduate|Automation|Chinese": `${schoolSlug}-automation`,
  "Undergraduate|Artificial Intelligence|Chinese": `${schoolSlug}-artificial-intelligence`,
  "Undergraduate|Civil Engineering|Chinese": `${schoolSlug}-civil-engineering`,
  "Undergraduate|Architecture|Chinese": `${schoolSlug}-architecture`,
};
const legacyProgramAliasesToArchive = [`${schoolSlug}-communication-engineering`];

const isMedicine = (route: any) => route.sourceId === "hust-medical-postgraduate-programs-2026" || /Medicine|Hospital|Stomatology|Pharmacy|Nursing/i.test(route.school);
const isHumanities = (route: any) => /Economics|Management|Humanities|Law|Design|Education|Sociology|Foreign Languages|Journalism|Public Administration/i.test(route.school);
const tuitionFor = (route: any) => {
  if (route.degree === "Undergraduate") {
    if (route.language === "English") return /Clinical Medicine/i.test(route.nameEn) ? 40000 : /Pharmacy/i.test(route.nameEn) ? 35000 : 30000;
    return isMedicine(route) ? 33000 : isHumanities(route) ? 18000 : 25000;
  }
  if (route.degree === "Master") return isMedicine(route) ? 40000 : route.language === "English" ? (isHumanities(route) ? 33000 : 38000) : (isHumanities(route) ? 25000 : 30000);
  return isMedicine(route) ? 50000 : route.language === "English" ? (isHumanities(route) ? 38000 : 50000) : (isHumanities(route) ? 30000 : 42000);
};
const cscaFor = (route: any): string[] => {
  if (route.degree !== "Undergraduate") return [];
  if (route.language === "English") {
    return /Telecommunications|Mechanical Design/i.test(route.nameEn) ? ["Mathematics", "Physics"] : ["Mathematics", "Chemistry"];
  }
  if (isMedicine(route) || /Life Science/i.test(route.school)) return ["Professional Chinese - Science and Engineering", "Mathematics", "Chemistry"];
  if (isHumanities(route)) return ["Professional Chinese - Liberal Arts", "Mathematics"];
  return ["Professional Chinese - Science and Engineering", "Mathematics", "Physics"];
};
const languageRequirement = (route: any) => {
  if (route.language === "English") return route.degree === "Undergraduate" ? "TOEFL 80, IELTS 5.5, or an accepted equivalent; published exemptions may apply" : "TOEFL 80, IELTS 6.0, GRE 310, or an accepted equivalent; published exemptions may apply";
  if (route.degree === "Undergraduate") return isHumanities(route) || /Artificial Intelligence/i.test(route.school) ? "HSK 5 score 180 or above; published exemptions may apply" : "HSK 4 score 180 or above; published exemptions may apply";
  if (/Union Hospital/i.test(route.school)) return "HSK 5 score 200 or above; published exemptions may apply";
  return isHumanities(route) || /Tongji Hospital/i.test(route.school) ? "HSK 5 score 180 or above; published exemptions may apply" : "HSK 4 score 180 or above; published exemptions may apply";
};

const used = new Set<string>();
const programs: CatalogSeedProgram[] = parsed.routes.map((route: any, index: number) => {
  const source = evidence.get(route.sourceId)!;
  const guide = evidence.get(route.degree === "Undergraduate" ? "hust-undergraduate-guide-2026" : "hust-graduate-guide-2026")!;
  const key = `${route.degree}|${route.nameEn}|${route.language}`;
  let slug = stable[key] ?? `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.nameEn)}-${slugify(route.school)}-${slugify(route.language)}-${slugify(route.awardType ?? "degree")}`;
  if (used.has(slug)) slug = `${slug}-${index + 1}`;
  used.add(slug);
  const tuition = tuitionFor(route);
  const subjects = cscaFor(route);
  const notes = [route.awardType, route.supervisorLetterRequired ? "Prospective-supervisor acceptance letter required" : null, route.interviewRequired ? "School-level online interview required" : null, route.note].filter(Boolean).join("; ");
  return {
    slug, schoolSlug, citySlug: "wuhan", nameEn: route.nameEn, ...(route.nameZh ? { nameZh: route.nameZh } : {}),
    degreeLevel: route.degree, durationYears: route.durationYears, fieldCategory: route.school, subjectArea: route.school,
    teachingLanguage: route.language, cscaSubjects: subjects, ...(subjects.length ? { cscaRequirement: `CSCA: ${subjects.join(", ")}` } : {}),
    ...(route.language === "Chinese" ? { hskRequirement: languageRequirement(route) } : { englishRequirement: languageRequirement(route) }),
    tuitionAmount: tuition, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `CNY ${tuition.toLocaleString("en-US")}/year under the official 2026 discipline-and-language fee table`,
    scholarshipText: "Scholarship eligibility is route-specific and must be checked against the published HUST award record.",
    applicationUrl, ...(notes ? { applicationNote: notes } : {}), hasScholarship: true, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${route.sourceId} program table`, ...(route.nameZh ? { nameZh: `${route.sourceId} bilingual program row` } : {}),
      degreeLevel: `${route.sourceId} degree heading`, teachingLanguage: `${route.sourceId} C/E marker`, durationYears: `${guide.id} duration table`,
      tuitionAmount: `${guide.id} tuition table mapped by published discipline/language`, applicationUrl: `${guide.id} application process`,
      ...(subjects.length ? { cscaSubjects: "hust-undergraduate-guide-2026 embedded official CSCA subject table" } : {}),
      ...(notes ? { applicationNote: `${route.sourceId} degree/interview/acceptance-letter markers` } : {}),
    },
  };
});

const item = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Wuhan, Hubei, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: { title: `${sourceId} title`, fundingLevel: `${sourceId} funding section`, coverage: `${sourceId} coverage section`, amountText: `${sourceId} coverage section`, applicableDegree: `${sourceId} eligibility/scope`, ...(value.deadlineDate ? { deadlineDate: `${sourceId} deadline` } : value.deadlineLabel ? { deadlineLabel: `${sourceId} published timing` } : {}), eligibilityItems: `${sourceId} eligibility`, applicationMaterials: `${sourceId} documents`, applicationSteps: `${sourceId} application process` },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "HUST online application system", url: applicationUrl, kind: "official-application" }],
    ...value,
  };
};
const scholarships: CatalogSeedScholarship[] = [
  scholarship("hust-scholarship-information-2026", { slug: "official-2026-hust-csc-bilateral-program", title: "HUST 2026 Chinese Government Scholarship - Bilateral Program", nameZh: "华中科技大学2026年中国政府奖学金国别双边项目", type: "government", typeLabel: "Chinese Government Scholarship - Bilateral", providerNameEn: "China Scholarship Council / home-country dispatching authority", fundingLevel: "Full or partial", coverage: "Coverage follows the bilateral agreement and final CSC award", applicableDegree: "Undergraduate, Master, Doctoral, General Scholar, Senior Scholar, Chinese Language Student", amountText: "Full or partial scholarship; exact benefits depend on the bilateral agreement", deadlineLabel: "Late November to early April; exact deadline differs by dispatching authority", applicationRound: "2026 intake", summary: "Type A route administered through the applicant's home-country dispatching authority.", eligibilityItems: [item("Apply through the responsible dispatching authority in the applicant's home country")], applicationMaterials: [item("Documents required by the applicable dispatching authority and CSC")], applicationSteps: [item("Step 1", "Contact the home-country dispatching authority"), item("Step 2", "Request a HUST pre-admission document where required"), item("Step 3", "Complete the Type A process using the authority's agency number")] }),
  scholarship("hust-graduate-guide-2026", { slug: "official-2026-hust-csc-chinese-university-program", title: "HUST 2026 Chinese Government Scholarship - Chinese University Program", nameZh: "华中科技大学2026年中国政府奖学金高校项目", type: "government", typeLabel: "Chinese Government Scholarship - Chinese University Program", providerNameEn: "China Scholarship Council / Huazhong University of Science and Technology", fundingLevel: "Full", coverage: "Tuition, accommodation, living stipend and comprehensive medical insurance", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible HUST 2026 graduate programs", amountText: "Full scholarship; the HUST guide does not itemize a stipend amount", deadlineDate: "2026-03-01", deadlineLabel: "March 1, 2026", applicationRound: "October 15, 2025 - March 1, 2026", summary: "HUST-nominated CSC Type B full graduate scholarship.", benefitItems: [item("Tuition"), item("Accommodation"), item("Living stipend"), item("Comprehensive medical insurance")], eligibilityItems: [item("Meet the selected HUST graduate program requirements"), item("Master applicants", "Bachelor's degree and under 35"), item("Doctoral applicants", "Master's degree and under 40")], applicationMaterials: [item("HUST graduate application materials"), item("Chinese Government Scholarship application form")], applicationSteps: [item("Step 1", "Apply to HUST and pass academic review"), item("Step 2", "Use the pre-admission letter to complete CSC Type B application, agency 10487"), item("Step 3", "Wait for HUST nomination and CSC decision")] }),
  scholarship("hust-silk-road-scholarship-2026", { slug: "official-2026-hust-csc-silk-road-undergraduate", title: "HUST 2026 Chinese Government Scholarship - Silk Road Undergraduate Program", nameZh: "华中科技大学2026年中国政府奖学金丝绸之路本科项目", type: "government", typeLabel: "Chinese Government Scholarship - Silk Road", providerNameEn: "China Scholarship Council / Huazhong University of Science and Technology", fundingLevel: "Full", coverage: "Tuition, accommodation, CNY 2,500 monthly stipend and CNY 800 annual medical insurance", applicableDegree: "Undergraduate", applicableProgram: "Software Engineering or Architecture, Chinese-taught", amountText: "CNY 2,500/month plus tuition, accommodation and CNY 800/year medical insurance", deadlineDate: "2026-05-20", deadlineLabel: "May 20, 2026", applicationRound: "2026 intake", targetCountries: ["Russia", "Malaysia", "Mongolia", "Laos", "Indonesia", "Cambodia", "Thailand", "Bangladesh", "Vietnam", "Pakistan"], summary: "Full undergraduate Silk Road route for two Chinese-taught programs and ten designated countries.", benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Monthly stipend", "CNY 2,500"), benefit("Medical insurance", "CNY 800/year")], eligibilityItems: [item("Citizen of one of the ten designated countries"), item("High-school graduate under 25"), item("HSK 4 score 180 or above"), item("CSCA", "Professional Chinese, Mathematics and Physics")], applicationMaterials: [item("Graduation certificate or expected-graduation proof"), item("Transcript"), item("CSCA score report"), item("Personal statement and one-minute video"), item("Passport, physical examination and no-criminal-record certificate"), item("CSC application form")], applicationSteps: [item("Step 1", "Apply in the HUST system"), item("Step 2", "Pay CNY 600 / USD 100 application fee after the test"), item("Step 3", "Complete the CSC Type B form using agency 10487"), item("Step 4", "Wait for school and CSC review")] }),
  scholarship("hust-youth-of-excellence-scholarship-2026", { slug: "official-2026-hust-youth-of-excellence", title: "HUST 2026 Youth of Excellence Scheme of China Program", nameZh: "华中科技大学2026年中国政府来华留学卓越奖学金项目", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "China Scholarship Council / Huazhong University of Science and Technology", fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance for the funded first year in China", applicableDegree: "Master", applicableProgram: "International Business or Public Administration, English-taught, 1+1 mode", amountText: "Full scholarship; the HUST page does not itemize a stipend amount", deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026", applicationRound: "2026 intake", summary: "One funded year in China within HUST's two-year 1+1 English master's route.", eligibilityItems: [item("Under 45 and in good health"), item("Bachelor's degree or above with at least three years of work experience"), item("Published public-sector, enterprise, university, research or international-organization profile")], applicationMaterials: [item("CSC application form"), item("Passport"), item("Diploma, transcript, research proposal and work-experience materials")], applicationSteps: [item("Step 1", "Apply through the CSC system as Type A, agency 1563"), item("Step 2", "Select HUST International Business or Public Administration Youth of Excellence route"), item("Step 3", "Complete HUST academic review")] }),
  scholarship("hust-international-chinese-teachers-scholarship-2026", { slug: "official-2026-hust-international-chinese-language-teachers-scholarship", title: "HUST 2026 International Chinese Language Teachers Scholarship", nameZh: "华中科技大学2026年国际中文教师奖学金", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerNameEn: "Center for Language Education and Cooperation / Huazhong University of Science and Technology", fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance except for four-week programs, and comprehensive medical insurance", applicableDegree: "Bachelor, Master, Doctoral, one-year, one-semester or four-week study", applicableProgram: "International Chinese Language Education, Chinese Language and Literature, or published language-study routes", amountText: "Tuition, accommodation, living allowance and insurance; the HUST page does not itemize allowance amounts", deadlineDate: "2026-10-31", deadlineLabel: "July: Apr 15; September: May 15; December: Sep 15; March 2027: Oct 31", applicationRound: "2026-2027 intakes", summary: "Degree and non-degree scholarship routes for prospective international Chinese-language teachers.", eligibilityItems: [item("Age", "Normally 16-35; in-service teachers may be under 45"), item("Program-specific HSK and HSKK thresholds apply")], applicationMaterials: [item("Passport photo page"), item("Valid HSK/HSKK reports"), item("Recommending-institution reference"), item("Diploma or expected-graduation proof and transcript"), item("Physical examination and no-criminal-record certificate"), item("Employment proof for in-service teachers")], applicationSteps: [item("Step 1", "Apply through the official scholarship system and select HUST"), item("Step 2", "Apply in the HUST system and upload the scholarship form"), item("Step 3", "Wait for recommending-institution, HUST and CLEC review")] }),
  scholarship("hust-eu-window-scholarship-2026", { slug: "official-2026-hust-eu-window-scholarship", title: "HUST 2026-2027 EU Window Scholarship", nameZh: "华中科技大学2026-2027学年欧盟之窗奖学金", type: "government", typeLabel: "EU Window Chinese Government Scholarship", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Tuition, accommodation, medical insurance and monthly stipend", applicableDegree: "General Scholar, Senior Scholar", applicableProgram: "Up to 12 months in all disciplines, English or Chinese", amountText: "General scholar CNY 3,000/month; senior scholar CNY 3,500/month, plus tuition, accommodation and insurance", deadlineDate: "2026-02-01", deadlineLabel: "February 1, 2026", applicationRound: "2026-2027 academic year", targetRegions: ["European Union"], summary: "Full academic exchange and research scholarship exclusively for EU nationals.", eligibilityItems: [item("EU Member State citizen in good health"), item("General scholar", "High-school diploma or above, under 45"), item("Senior scholar", "Master's degree or associate-professor rank or above, under 50")], applicationMaterials: [item("Documents listed in the official EU Window application appendix")], applicationSteps: [item("Step 1", "Contact HUST for an invitation letter"), item("Step 2", "Complete CSC Type A application using agency 00006") ] }),
  scholarship("hust-china-link-scholarship-2025-2026", { slug: "official-2025-2026-hust-china-link-scholarship", title: "HUST 2025-2026 China Link Scholarship Program", nameZh: "华中科技大学2025-2026学年China Link奖学金项目", type: "government", typeLabel: "China Link Scholarship", providerNameEn: "China Scholarship Council / Huazhong University of Science and Technology", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, medical insurance and monthly stipend", applicableDegree: "General Scholar, Senior Scholar", applicableProgram: "One to twelve months of study or research in all disciplines except Chinese language", amountText: "General scholar CNY 3,000/month; senior scholar CNY 3,500/month, plus tuition, accommodation and insurance", deadlineLabel: "No single deadline published; study or research must start no later than August 31, 2026", applicationRound: "2025-2026 academic year", summary: "Short-term full scholarship for students or academic staff at CSC foreign partner institutions.", eligibilityItems: [item("Non-Chinese citizen in good health"), item("Full-time student or academic staff at a CSC foreign partner institution"), item("General scholar under 45; senior scholar under 50")], applicationMaterials: [item("HUST invitation or pre-admission materials"), item("CSC application documents")], applicationSteps: [item("Step 1", "Contact HUST for an invitation letter"), item("Step 2", "Complete the CSC application using HUST agency 10487"), item("Step 3", "Coordinate nomination through the home partner institution") ] }),
];

const guide = evidence.get("hust-undergraduate-guide-2026")!;
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: "wuhan", nameEn: "Wuhan", nameZh: "武汉", region: "Central China", province: "Hubei", status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt, sourceFieldLineage: { nameEn: "official HUST address", province: "official HUST address" } }],
  schools: [{ slug: schoolSlug, nameEn: "Huazhong University of Science and Technology", nameZh: "华中科技大学", citySlug: "wuhan", schoolType: "public", region: "Wuhan, Hubei, Central China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English, depending on program", languageRequirement: "Program-level language requirements are recorded on each route.", hskRequirement: "Undergraduate: HSK 4 score 180 for science, engineering and medicine; HSK 5 score 180 for economics, management, humanities, arts, law and AI. Graduate thresholds vary by discipline and hospital.", englishRequirement: "Undergraduate: TOEFL 80 or IELTS 5.5; Graduate: TOEFL 80, IELTS 6.0 or GRE 310. Published exemptions may apply.", deadlineSummary: "2026 undergraduate deadline: June 15, 2026; graduate deadline: March 1, 2026; scholarship deadlines vary by route.", tuitionSummary: "Undergraduate CNY 18,000-40,000/year; Master CNY 25,000-40,000/year except Executive MBA CNY 324,000/2 years; Doctoral CNY 30,000-50,000/year.", applicationFee: "CNY 600 / USD 100", websiteUrl: "https://www.hust.edu.cn/", admissionsUrl: guide.url, cscaRequired: true, cscaRequirement: "2026 undergraduate applicants must submit CSCA results for the exact subjects published by teaching language and discipline.", cscaSubjects: ["Professional Chinese - Liberal Arts", "Professional Chinese - Science and Engineering", "Mathematics", "Physics", "Chemistry"], subjectTags: [...new Set(parsed.routes.map((route: any) => route.school))], languageTags: ["Chinese", "English"], tuitionBandLabel: "CNY 18,000-50,000/year for standard degree routes", campusHighlights: ["44 undergraduate routes", "215 master's routes", "207 doctoral routes", "Seven independently structured scholarship routes"], status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt, sourceFieldLineage: { nameEn: "official HUST admissions pages", citySlug: "official HUST address", applicationLevel: "2026 undergraduate and graduate program tables", languageRequirement: "2026 application guides", deadlineSummary: "2026 application guides", tuitionSummary: "2026 undergraduate and graduate fee tables", applicationFee: "2026 application guides", admissionsUrl: "registered official undergraduate guide", cscaRequirement: "official CSCA subject table embedded in the 2026 undergraduate guide" } }],
  programs,
  programIntakes: programs.map(program => {
    const isUg = program.degreeLevel === "Undergraduate";
    const source = evidence.get(isUg ? "hust-undergraduate-guide-2026" : "hust-graduate-guide-2026")!;
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: isUg ? "2026-06-15T15:59:59.000Z" : "2026-03-01T15:59:59.000Z", deadlineLabel: isUg ? "Application deadline: June 15, 2026" : "Application deadline: March 1, 2026", applicationRound: "2026 degree intake", status: "closed", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: `${source.id} application period` } };
  }),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`HUST candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const existingPrograms = (base.programs ?? []).filter(program => program.schoolSlug === schoolSlug);
const existingScholarships = (base.scholarships ?? []).filter(item => item.schoolSlug === schoolSlug);
const reviewBase = {
  version: 1, status: "awaiting_user_approval", generatedAt: manifest.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: programs.length, ...parsed.counts, scholarshipCount: scholarships.length, existingProgramCount: existingPrograms.length, existingScholarshipCount: existingScholarships.length, archiveProgramAliasCount: legacyProgramAliasesToArchive.length, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })).concat([
    { sourceId: "hust-csca-subjects-en", sourceUrl: guide.url, sourceLabel: "Official embedded HUST CSCA subject table (English)", sha256: "39c84b4e2e85e761e31ca35759e21cec044543e50bac4b437e5775bfcc1c5993", fetchedAt: manifest.generatedAt },
    { sourceId: "hust-csca-subjects-zh", sourceUrl: guide.url, sourceLabel: "Official embedded HUST CSCA subject table (Chinese)", sha256: "8a3231de11e2dd1be37dbc8613c36bfec237139b542b445a7b02371d8a0daa96", fetchedAt: manifest.generatedAt },
  ]),
  reconciliation: { stableProgramSlugs: Object.values(stable), newProgramRoutes: programs.length - Object.values(stable).length, legacyProgramAliasesToArchive, stableScholarshipSlugs: [], newScholarshipRoutes: scholarships.length, legacyScholarshipAliasesToArchive: [], destructiveDeletion: false },
  unresolvedFields: ["The official doctoral program PDF is image-based; its two pages were rendered and visually transcribed, then cross-checked against the separate English-medium postgraduate table.", "The HUST scholarship overview states that the 2026 Silk Road route covers five undergraduate and graduate programs, while the later dedicated May 2026 guide details only two undergraduate programs; this batch publishes the two specifically detailed routes and does not infer the other three.", "The 2025-2026 China Link page publishes no single application deadline, only that study/research must begin no later than August 31, 2026.", "The official fee table assigns tuition by broad discipline category. The candidate maps clearly named schools to those published categories; ambiguous Executive MBA tuition is kept out of the standard per-program amount and retained in the school summary."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence snapshots", note: "Only public institutional, program, admissions and scholarship information is included. No applicant, account, passport, payment or private-contact data is present." },
  reviewNotes: ["The 466 routes preserve language, academic/professional degree markers, interview flags and supervisor-letter requirements as published.", "Fourteen existing stable undergraduate slugs are preserved; one obsolete Chinese Communication Engineering alias is proposed for archival because the 2026 catalog lists Telecommunications Engineering only in English.", "Seven scholarships are separate structured records; no combined scholarship overview is published as an award.", "No catalog record is published or archived by this review command."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const approvalPhrase = `批准发布华中科技大学学校、项目与奖学金第一批（审核哈希 ${reviewHash}），并归档 1 条旧项目别名`;
const review = { ...reviewBase, reviewHash, approvalPhrase };
await Promise.all([
  writeFile(candidatePath, candidateText),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, routeCounts: parsed.counts, programRouteCount: programs.length, scholarshipCount: scholarships.length, archiveProgramAliasCount: legacyProgramAliasesToArchive.length, candidateSha256, reviewHash, approvalPhrase, candidatePath, validationPath, reviewPath }, null, 2));
