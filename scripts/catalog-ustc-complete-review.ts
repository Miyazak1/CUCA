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
const runDir = resolve(root, process.env.CUAC_USTC_MANIFEST_DIR || "work/catalog-official/ustc-current-complete-20260914-v2");
const parsedPath = resolve(root, "work/catalog-official/ustc-complete-batch-01/parsed-routes.json");
const candidatePath = resolve(root, "seeds/catalog.ustc-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ustc-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.ustc-complete-batch-01.review.json");
const basePath = resolve(root, "seeds/catalog.cscalite-online-20260910.published.json");
const schoolSlug = "university-of-science-and-technology-of-china";
const applicationUrl = "https://isa.ustc.edu.cn/xs/login_scho.asp";

const expected: Record<string, string> = {
  "ustc-admissions-overview-2026": "87725e44822d4c5009e40b789f20082a083fa07b547aa99ff32c8fb97f4bcf52",
  "ustc-undergraduate-programs-2026": "5c948a9946309e9c8fe1a9094f4f7ea609c16c0ebaad4abe129bae2fc4f88470",
  "ustc-undergraduate-guide-2026": "afa122b41b39ab485e42ab1137a6842699e02c19a259a953135929085fbb507e",
  "ustc-postgraduate-programs-2026": "d6a54a349f94fa7b549f696d8718ac7f2482a8b660f2db554bd3bfef02c1bff2",
  "ustc-doctoral-programs-english-2026": "5923918ba5ac92366e8df8ea31a1d387c39ca064dfe6c08e46cbb781f9fd2870",
  "ustc-doctoral-programs-chinese-2026": "e4583dc3e11ede99be96b81d4eb2314123718c22e37bfb5f5222aa4212ffcfa0",
  "ustc-master-programs-english-2026": "5a0427dd322caa2d094603e7208397d4cfa770a07391e125cd7c2313399c456b",
  "ustc-master-programs-chinese-2026": "59db76f72f302d5933ceeb759e952aea7d3dc7abc38ec2b5ed5b5dcacc690e6d",
  "ustc-postgraduate-guide-2026": "d6ac8f5c025dd162f5c8df2da6dd2989ca9d4f59af24b0c24f4ea9b4db731890",
  "ustc-undergraduate-fellowship-2026": "ea6c892acec6c01147ed81270f435e4d8053b051086176848b963dfbafbcf7e6",
  "ustc-master-fellowship-2026": "1710bcbbc62dbb54bd2d96c1e5ce2535dd6570b1f8ee88a28b22069ab7bc4653",
  "ustc-doctoral-fellowship-2026": "a3f761d3bf84ab934729f0aee369e0e2e49a7a93d6ddca6d89574fe55e974d56",
  "ustc-youth-of-excellence-2026": "11c14a883e3dfd936f5e8f97b04f94df79f2d0cd498c2524a036bac7ba6648df",
  "ustc-cas-anso-scholarship-2026": "fe215812690e2bf9bb48ea421cd72d9fa3b3dd035510b063e7bc837dbe83420f",
  "ustc-international-home-current": "957a8ef54782041336fc6109bb9b26174d7f83d1650206917a43fc1750af986c",
};

const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
const parsed = JSON.parse(await readFile(parsedPath, "utf8"));
const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const evidence = new Map<string, any>();
for (const source of manifest.sources ?? []) {
  if (expected[source.id] !== source.sha256 || source.status !== 200) throw new Error(`Official snapshot mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
if (evidence.size !== Object.keys(expected).length) throw new Error("The complete USTC evidence set was not collected.");
if (parsed.summary?.Master?.Chinese !== 76 || parsed.summary?.Master?.English !== 15 || parsed.summary?.Doctoral?.Chinese !== 89 || parsed.summary?.Doctoral?.English !== 72) {
  throw new Error(`Unexpected USTC postgraduate route counts: ${JSON.stringify(parsed.summary)}`);
}

const undergraduateGroups: Record<string, string[]> = {
  Mathematics: ["Pure and Applied Mathematics", "Information and Computing Sciences"],
  Physics: ["Physics", "Applied Physics", "Photoelectric Information Science and Engineering", "Astronomy", "Quantum Information Science"],
  "Materials Science": ["Materials Physics", "Materials Chemistry", "Polymer Materials and Engineering"],
  Chemistry: ["Chemistry"],
  "Life Sciences": ["Bioscience", "Biotechnology"],
  "Engineering Science": ["Theory and Applied Mechanics", "Mechanical Design, Manufacture and Automation", "Energy and Power Engineering", "Safety Engineering"],
  "Electronic Information": ["Electronic Information Engineering", "Automation", "Artificial Intelligence"],
  "Computer Science": ["Computer Science and Technology"],
  Geophysics: ["Geophysics", "Space Science and Technology", "Geochemistry", "Planetary Science"],
  "Management Science": ["Management Science", "Statistics", "Finance", "Business Administration"],
  "Nuclear Engineering": ["Engineering Physics", "Nuclear Engineering and Nuclear Technology"],
  Cybersecurity: ["Information Security", "Cybersecurity"],
  "Electronic Information - Microelectronics": ["Electronic Science and Technology"],
  "Environmental Science and Engineering": ["Environmental Science and Engineering"],
};
const undergraduateRoutes = Object.entries(undergraduateGroups).flatMap(([major, names]) => names.map((nameEn) => ({
  degree: "Undergraduate", language: "Chinese", major, researchField: nameEn,
  sourceId: "ustc-undergraduate-programs-2026", page: null,
})));
if (undergraduateRoutes.length !== 35) throw new Error(`Unexpected USTC undergraduate detail count: ${undergraduateRoutes.length}`);
const routes = [...undergraduateRoutes, ...parsed.routes];

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const used = new Set<string>();
const programs: CatalogSeedProgram[] = routes.map((route: any, index: number) => {
  const source = evidence.get(route.sourceId)!;
  const isUndergraduate = route.degree === "Undergraduate";
  const guide = evidence.get(isUndergraduate ? "ustc-undergraduate-guide-2026" : "ustc-postgraduate-guide-2026")!;
  let slug = `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.researchField)}-${slugify(route.major)}-${slugify(route.language)}`;
  if (used.has(slug)) slug = `${slug}-${index + 1}`;
  used.add(slug);
  const tuition = isUndergraduate ? 26000 : route.degree === "Doctoral" ? 35000 : /Master of Business Administration/i.test(route.researchField) ? 150000 : 30000;
  const cscaSubjects = isUndergraduate ? ["Professional Chinese - STEM", "Mathematics", "Physics or Chemistry"] : [];
  const languageRequirement = isUndergraduate
    ? "New HSK Level 5 or above; published language-of-schooling exemptions may apply"
    : route.language === "Chinese"
      ? "New HSK Level 4 or above; published language-of-study exemptions may apply"
      : "Proof of English language proficiency; the official guide does not publish a universal minimum score";
  return {
    slug, schoolSlug, citySlug: "hefei", nameEn: route.researchField,
    degreeLevel: route.degree, fieldCategory: route.major, subjectArea: route.major,
    teachingLanguage: route.language,
    ...(cscaSubjects.length ? { cscaSubjects, cscaRequirement: "CSCA compulsory: Professional Chinese (STEM) and Mathematics; choose Physics or Chemistry. Results must be submitted with the online application." } : {}),
    ...(route.language === "Chinese" ? { hskRequirement: languageRequirement } : { englishRequirement: languageRequirement }),
    tuitionAmount: tuition, tuitionCurrency: "RMB", tuitionPeriod: isUndergraduate || tuition !== 150000 ? "year" : "program",
    tuitionText: tuition === 150000 ? "CNY 150,000 per MBA student" : `CNY ${tuition.toLocaleString("en-US")}/year`,
    scholarshipText: "USTC Fellowship eligibility is degree-level and route-specific; the final award level is decided by USTC.",
    applicationUrl, hasScholarship: true, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: isUndergraduate ? "ustc-undergraduate-programs-2026 enumerated program item" : `${route.sourceId} page ${route.page} research-field row`,
      degreeLevel: isUndergraduate ? "ustc-undergraduate-programs-2026 section" : `${route.sourceId} title`,
      fieldCategory: isUndergraduate ? "ustc-undergraduate-programs-2026 discipline grouping" : `${route.sourceId} page ${route.page} first-level-discipline column`,
      teachingLanguage: isUndergraduate ? "ustc-undergraduate-guide-2026 HSK/CSCA route" : `${route.sourceId} title`,
      tuitionAmount: `${guide.id} fees section`, applicationUrl: `${guide.id} application procedure`,
      ...(cscaSubjects.length ? { cscaSubjects: "ustc-undergraduate-guide-2026 CSCA test-subject row" } : {}),
    },
  };
});

const item = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const commonMaterials = [item("Passport"), item("Degree certificate or expected-graduation proof and academic transcripts"), item("Study or research proposal of at least 1,000 words"), item("Curriculum vitae"), item("Two recommendation letters"), item("Language proficiency proof"), item("Foreigner Physical Examination Form")];
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Hefei, Anhui, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: {
      title: `${sourceId} title`, fundingLevel: `${sourceId} introduction`, coverage: `${sourceId} introduction/coverage`,
      amountText: `${sourceId} introduction/coverage`, applicableDegree: `${sourceId} eligibility`,
      ...(value.deadlineDate ? { deadlineDate: `${sourceId} application time` } : {}),
      eligibilityItems: `${sourceId} eligibility`, applicationMaterials: `${sourceId} application materials`, applicationSteps: `${sourceId} application guideline`,
    },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "USTC online application system", url: applicationUrl, kind: "official-application" }],
    ...value,
  };
};
const scholarships: CatalogSeedScholarship[] = [
  scholarship("ustc-undergraduate-fellowship-2026", {
    slug: "official-2026-ustc-undergraduate-fellowship", title: "USTC Fellowship for Undergraduate Programs 2026", nameZh: "中国科学技术大学2026年本科生奖学金",
    type: "university", typeLabel: "USTC Fellowship", providerNameEn: "University of Science and Technology of China",
    fundingLevel: "Full or tuition waiver", coverage: "Level A: tuition, medical insurance, CNY 2,500 monthly stipend and accommodation subsidy; Level B: tuition waiver",
    applicableDegree: "Undergraduate", applicableProgram: "Published USTC 2026 undergraduate programs", amountText: "Level A includes CNY 2,500/month plus tuition, insurance and accommodation subsidy; Level B waives tuition",
    deadlineDate: "2026-03-31", deadlineLabel: "March 31, 2026", applicationRound: "November 14, 2025 - March 31, 2026",
    summary: "Two-level USTC undergraduate fellowship awarded after comprehensive evaluation.",
    benefitItems: [benefit("Tuition waiver"), benefit("Medical insurance", "Level A"), benefit("Monthly stipend", "CNY 2,500, Level A"), benefit("Accommodation subsidy", "Level A")],
    eligibilityItems: [item("Non-Chinese citizen in good health"), item("High-school diploma by July 2026"), item("Under age 30 by September 1, 2026"), item("New HSK Level 5 or above, unless an official exemption applies"), item("Cannot concurrently hold another Chinese scholarship or fund for 2026-2027")],
    applicationMaterials: [item("Undergraduate application form"), item("Passport"), item("High-school diploma or expected-graduation proof and transcripts"), item("HSK proof or qualifying exemption evidence"), item("Physical examination form"), item("High-school recommendation letter"), item("Guardian statement if under 18")],
    applicationSteps: [item("Step 1", "Create an account in the USTC system"), item("Step 2", "Complete the undergraduate application and select the fellowship level(s)"), item("Step 3", "Monitor email for review and interview notices")],
  }),
  scholarship("ustc-master-fellowship-2026", {
    slug: "official-2026-ustc-master-fellowship", title: "USTC Fellowship for Master's Programs 2026", nameZh: "中国科学技术大学2026年硕士生奖学金",
    type: "university", typeLabel: "USTC Fellowship", providerNameEn: "Ministry of Education / Chinese Academy of Sciences / USTC",
    fundingLevel: "Full or tuition waiver", coverage: "Level A: tuition, medical insurance, CNY 3,000 monthly stipend and accommodation subsidy; Level B: tuition waiver with TA/RA subsidy available after enrollment",
    applicableDegree: "Master", applicableProgram: "Published USTC 2026 master's programs", amountText: "Level A includes CNY 3,000/month plus tuition, insurance and accommodation subsidy; Level B waives tuition",
    deadlineDate: "2026-01-31", deadlineLabel: "January 31, 2026", applicationRound: "October 16, 2025 - January 31, 2026",
    summary: "Two-level USTC master's fellowship funded through CSC, CAS-ANSO or USTC sources.",
    benefitItems: [benefit("Tuition waiver"), benefit("Medical insurance", "Level A"), benefit("Monthly stipend", "CNY 3,000, Level A"), benefit("Accommodation subsidy", "Level A"), benefit("TA/RA subsidy eligibility", "Level B, after enrollment")],
    eligibilityItems: [item("Non-Chinese citizen in good health"), item("Bachelor's degree"), item("Under age 35 by September 1, 2026"), item("HSK 4 for Chinese-taught routes or English proficiency proof for English-taught routes"), item("Cannot take other assignments during the scholarship")],
    applicationMaterials: commonMaterials,
    applicationSteps: [item("Step 1", "Apply in the USTC system and select one or both fellowship levels"), item("Step 2", "Complete school/department online assessment"), item("Step 3", "USTC determines the final fellowship level")],
  }),
  scholarship("ustc-doctoral-fellowship-2026", {
    slug: "official-2026-ustc-doctoral-fellowship", title: "USTC Fellowship for Doctoral Programs 2026", nameZh: "中国科学技术大学2026年博士生奖学金",
    type: "university", typeLabel: "USTC Fellowship", providerNameEn: "Chinese Academy of Sciences / Ministry of Education / USTC",
    fundingLevel: "Full or tuition waiver", coverage: "Level A: tuition, medical insurance and stipend up to CNY 7,000/month; Level B: tuition, medical insurance, CNY 3,500/month and accommodation subsidy; Level C: tuition waiver with TA/RA subsidy eligibility",
    applicableDegree: "Doctoral", applicableProgram: "Published USTC 2026 doctoral programs", amountText: "Up to CNY 7,000/month at Level A; CNY 3,500/month at Level B; Level C waives tuition",
    deadlineDate: "2026-01-31", deadlineLabel: "January 31, 2026", applicationRound: "October 16, 2025 - January 31, 2026",
    summary: "Three-level USTC doctoral fellowship combining CAS-ANSO, CSC and university funding routes.",
    benefitItems: [benefit("Tuition waiver"), benefit("Medical insurance", "Levels A and B"), benefit("Monthly stipend", "Up to CNY 7,000 at Level A; CNY 3,500 at Level B"), benefit("Accommodation subsidy", "Level B"), benefit("TA/RA subsidy eligibility", "Level C, after enrollment")],
    eligibilityItems: [item("Non-Chinese citizen in good health"), item("Master's degree"), item("Level A under age 35; Levels B/C under age 40 by September 1, 2026"), item("HSK 4 for Chinese-taught routes or English proficiency proof for English-taught routes"), item("Current doctoral students in China are not eligible for Level A"), item("Level A applicants cannot simultaneously apply to UCAS for CAS-ANSO")],
    applicationMaterials: commonMaterials,
    applicationSteps: [item("Step 1", "Apply in the USTC system and select one or more fellowship levels"), item("Step 2", "Complete school/department online assessment"), item("Step 3", "USTC determines the final fellowship level")],
  }),
  scholarship("ustc-cas-anso-scholarship-2026", {
    slug: "official-2026-ustc-cas-anso-degree-scholarship", title: "CAS-ANSO Scholarship Degree Program 2026 at USTC", nameZh: "中国科学技术大学2026年CAS-ANSO奖学金学位项目",
    type: "government", typeLabel: "CAS-ANSO Scholarship", providerNameEn: "Chinese Academy of Sciences / ANSO",
    fundingLevel: "Full", coverage: "Tuition, monthly stipend, health insurance, application fee, one international trip and one-time visa/residence-permit allowance subject to sponsor rules",
    applicableDegree: "Master, Doctoral", applicableProgram: "Eligible USTC 2026 postgraduate programs", amountText: "Master CNY 3,000/month up to 36 months; PhD CNY 6,000 or 7,000/month up to 48 months, plus published benefits",
    deadlineDate: "2026-01-31", deadlineLabel: "January 31, 2026", applicationRound: "Opened October 15, 2025; applicants and referees due January 31, 2026",
    summary: "Full CAS-ANSO degree scholarship, including the ANSO-CAS-TWAS/UNESCO PhD sub-category.",
    benefitItems: [benefit("Tuition waiver"), benefit("Monthly stipend", "Master CNY 3,000; PhD CNY 6,000 or 7,000"), benefit("Health insurance"), benefit("Application fee waiver"), benefit("International travel", "One trip, subject to sponsor rules"), benefit("Visa/residence permit allowance", "One-time, subject to sponsor rules")],
    eligibilityItems: [item("Non-Chinese citizen proficient in English or Chinese"), item("Master applicants born on or after January 1, 1996"), item("PhD applicants born on or after January 1, 1991"), item("Meet USTC admission criteria and hold no other assignment during funding"), item("Do not apply simultaneously to both USTC and UCAS")],
    applicationMaterials: commonMaterials,
    applicationSteps: [item("Step 1", "Submit the USTC graduate application"), item("Step 2", "Select CAS-ANSO Scholarship in the application system"), item("Step 3", "Optionally request consideration for the ANSO-CAS-TWAS/UNESCO PhD category")],
  }),
  scholarship("ustc-youth-of-excellence-2026", {
    slug: "official-2026-ustc-youth-of-excellence", title: "USTC 2026 Youth of Excellence Scheme of China - Scientific Management Leaders", nameZh: "中国科学技术大学2026年中国政府来华留学卓越奖学金科学管理人才项目",
    type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "China Scholarship Council / University of Science and Technology of China",
    fundingLevel: "Full", coverage: "Full scholarship for the published English-taught 1+1 MBA route; the USTC notice does not itemize monetary benefits",
    applicableDegree: "Master", applicableProgram: "English-taught MBA, 1+1 mode", amountText: "Full scholarship; no itemized stipend amount is published on the USTC notice",
    deadlineDate: "2026-02-15", deadlineLabel: "USTC materials due February 15, 2026; CSC application due March 31, 2026", applicationRound: "September 2026 intake",
    summary: "English-taught Scientific Management Leaders MBA: one year on campus and thesis work in the home country during year two.",
    eligibilityItems: [item("Non-Chinese citizen under age 45 by September 1, 2026"), item("Bachelor's degree or above and more than three years of work experience"), item("Eligible government, enterprise, university/research or international-organization professional profile"), item("Meet USTC international admission criteria")],
    applicationMaterials: [item("Passport"), item("Study or research proposal of at least 1,000 words"), item("Curriculum vitae"), item("Two signed recommendation letters"), item("English proficiency proof"), item("Degree certificates and transcripts"), item("Physical examination and non-criminal certificates")],
    applicationSteps: [item("Step 1", "Send the required materials to the published USTC addresses by February 15"), item("Step 2", "Complete the USTC interview and obtain a pre-admission letter"), item("Step 3", "Apply in the CSC system as Type A, agency 1563, by March 31")],
  }),
];

const guide = evidence.get("ustc-undergraduate-guide-2026")!;
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [{ slug: "hefei", nameEn: "Hefei", nameZh: "合肥", region: "East China", province: "Anhui", status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt, sourceFieldLineage: { nameEn: "official USTC address", province: "official USTC address" } }],
  schools: [{
    slug: schoolSlug, nameEn: "University of Science and Technology of China", nameZh: "中国科学技术大学", citySlug: "hefei", schoolType: "public", region: "Hefei, Anhui, East China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English, depending on program",
    languageRequirement: "Undergraduate routes require Chinese proficiency; postgraduate routes are available in Chinese and English according to the program tables.",
    hskRequirement: "Undergraduate: new HSK Level 5 or above. Chinese-taught postgraduate: new HSK Level 4 or above. Published exemptions may apply.",
    englishRequirement: "English-taught postgraduate programs require proof of English proficiency; USTC does not publish one universal minimum score.",
    deadlineSummary: "2026 undergraduate deadline: March 31, 2026; 2026 postgraduate deadline: January 31, 2026; scholarship deadlines vary by route.",
    tuitionSummary: "Undergraduate CNY 26,000/year; Master CNY 30,000/year except MBA CNY 150,000/program; Doctoral CNY 35,000/year. Insurance CNY 800/year and campus accommodation CNY 500-1,000/month.",
    websiteUrl: "https://www.ustc.edu.cn/", admissionsUrl: guide.url, cscaRequired: true,
    cscaRequirement: "2026 undergraduate applicants must submit CSCA results: Professional Chinese (STEM), Mathematics, plus Physics or Chemistry.",
    cscaSubjects: ["Professional Chinese - STEM", "Mathematics", "Physics", "Chemistry"],
    subjectTags: [...new Set(routes.map((route: any) => route.major))], languageTags: ["Chinese", "English"],
    tuitionBandLabel: "CNY 26,000-35,000/year for standard degree routes", campusHighlights: ["35 undergraduate programs explicitly enumerated on the detail page", "78 master's research fields", "89 doctoral research fields", "Five independently structured scholarship routes"],
    status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt,
    sourceFieldLineage: { nameEn: "official USTC admissions site", citySlug: "official USTC address", applicationLevel: "2026 program pages", languageRequirement: "2026 application guidelines and language-specific program tables", deadlineSummary: "2026 application guidelines", tuitionSummary: "2026 application guidelines fees sections", admissionsUrl: "registered official undergraduate guide", cscaRequirement: "2026 undergraduate application guideline CSCA row" },
  }],
  programs,
  programIntakes: programs.map((program) => {
    const isUndergraduate = program.degreeLevel === "Undergraduate";
    const source = evidence.get(isUndergraduate ? "ustc-undergraduate-guide-2026" : "ustc-postgraduate-guide-2026")!;
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: isUndergraduate ? "2026-03-31T15:59:59.000Z" : "2026-01-31T15:59:59.000Z", deadlineLabel: isUndergraduate ? "Application deadline: March 31, 2026" : "Application deadline: January 31, 2026", applicationRound: "2026 degree intake", status: "closed", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: `${source.id} application period` } };
  }),
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`USTC candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const existingPrograms = (base.programs ?? []).filter((program) => program.schoolSlug === schoolSlug);
const existingScholarships = (base.scholarships ?? []).filter((scholarship) => scholarship.schoolSlug === schoolSlug);
const legacyScholarshipAliasesToArchive = existingScholarships.map((scholarship) => scholarship.slug);
const reviewBase = {
  version: 1, status: "awaiting_user_approval", generatedAt: manifest.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: programs.length, undergraduateRouteCount: undergraduateRoutes.length, masterRouteCount: parsed.summary.Master.Chinese + parsed.summary.Master.English, doctoralRouteCount: parsed.summary.Doctoral.Chinese + parsed.summary.Doctoral.English, uniqueMasterFieldCount: 78, uniqueDoctoralFieldCount: 89, scholarshipCount: scholarships.length, existingProgramCount: existingPrograms.length, existingScholarshipCount: existingScholarships.length, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: legacyScholarshipAliasesToArchive.length },
  candidateSha256,
  evidence: [...evidence.values()].map((source) => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  reconciliation: { stableProgramSlugs: [], newProgramRoutes: programs.length, legacyProgramAliasesToArchive: [], stableScholarshipSlugs: [], newScholarshipRoutes: scholarships.length, legacyScholarshipAliasesToArchive, destructiveDeletion: false },
  unresolvedFields: [
    "The USTC admissions overview states 38 undergraduate programs, while the official Schools & Programs detail page currently enumerates 35. This batch publishes only the 35 directly enumerated programs and flags the three-item discrepancy instead of inventing entries.",
    "The four official postgraduate program PDFs are image-based. All 11 pages were rendered and reviewed; OCR preserves 91 master's language routes covering 78 unique research fields and 161 doctoral language routes covering 89 unique research fields, matching the official overview's unique-field totals.",
    "The official postgraduate guide publishes no universal numeric English-language score. English routes therefore retain a proof-of-proficiency requirement without an inferred threshold.",
    "The Youth of Excellence notice describes a full scholarship but does not itemize stipend, tuition, accommodation or insurance values; no monetary amount is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence snapshots", note: "Only public institutional, program, admissions and scholarship information is included. Public staff contact details appearing in source pages are not copied into catalog records. No applicant, account, passport, payment or private-contact data is present." },
  reviewNotes: [
    "The candidate contains 287 program-language routes: 35 undergraduate, 91 master's and 161 doctoral.",
    "Five scholarships are represented as independent structured awards; USTC Fellowship degree levels are not collapsed into one vague overview.",
    "Three prior third-party scholarship placeholders are proposed for archival and replacement by the five official 2026 records.",
    "No catalog record is published or archived by this review command.",
  ],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const approvalPhrase = `批准发布中国科学技术大学学校、项目与奖学金第一批（审核哈希 ${reviewHash}），并归档 3 条旧奖学金记录`;
const review = { ...reviewBase, reviewHash, approvalPhrase };
await Promise.all([
  writeFile(candidatePath, candidateText),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, programRouteCount: programs.length, undergraduateRouteCount: undergraduateRoutes.length, masterRouteCount: parsed.summary.Master.Chinese + parsed.summary.Master.English, doctoralRouteCount: parsed.summary.Doctoral.Chinese + parsed.summary.Doctoral.English, scholarshipCount: scholarships.length, archiveScholarshipAliasCount: legacyScholarshipAliasesToArchive.length, candidateSha256, reviewHash, approvalPhrase, candidatePath, validationPath, reviewPath }, null, 2));
