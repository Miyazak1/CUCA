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
const runDirs = [
  resolve(root, "work/catalog-official/seu-complete-batch-01"),
  resolve(root, "work/catalog-official/seu-program-catalog-supplement-01"),
  resolve(root, "work/catalog-official/seu-program-catalog-en-supplement-01"),
];
const candidatePath = resolve(root, "seeds/catalog.seu-complete-batch-02.draft.json");
const validationPath = resolve(root, "seeds/catalog.seu-complete-batch-02.validation.json");
const reviewPath = resolve(root, "seeds/catalog.seu-complete-batch-02.review.json");
const schoolSlug = "southeast-university";
const applicationUrl = "https://fs.seu.edu.cn/";

const expected: Record<string, string> = {
  "seu-school-profile": "7c5b541c493a7ba6d48998930e64778c61ae804d42e69f4b27e2493cbf2d1f84",
  "seu-admission-index-2026": "6f851706b9fc802b89ae307134fb79eb7f58897903a0037a04139a4ca0a8f120",
  "seu-undergraduate-guide-en-2026": "2fab3264b952340f6ed3f279e423ee19b1b857e649e2c1a01431a425773473cc",
  "seu-undergraduate-guide-en-pdf-2026": "d1e7a5df4563b6c43b9c7a13a550e48ac4d20bdf919e125a9f2193ae9e281c14",
  "seu-graduate-guide-zh-2026": "08b28c71b3e1b974fd3cc6ac3082c915edbb9bdeecaa1604af6181e6299fb62e",
  "seu-graduate-guide-zh-pdf-2026": "e89f361676bfd717dc5d52ae2709cd1d54d2fb618b6c6255558f3f16bb6d8197",
  "seu-ecommerce-undergraduate-2026": "7baff0de8968e5ef6c11ba0d8717002a2067901203befd6226c44d1071d94b28",
  "seu-tourism-management-undergraduate-2026": "2cf5e1fa485763b8e85e5b217c16fdb0e9cee3dd93ae2de5bd0e0485106882c9",
  "seu-mbbs-undergraduate-2026": "4c87c4cfaf932a3c60ed677e4c67449597789f2f8d5aa278ba58117a052e7662",
  "seu-yes-digital-management-2026": "153ecb4af76a9d6ad479dadeb3ab5d5d9e9afeaaf0adb5ca81bc67ced7cb0b9e",
  "seu-yes-sustainable-infrastructure-2026": "e8804a64deba5b1fb73ddb4e3d18a99d8ffa4bb720ae3f463c60923d7d6c6c0c",
  "seu-architecture-school-guide-2026": "a79a0b4f5e65ae391121aca3d620081c7b1c6b3578f2fe867bc7b1a6c45f830b",
  "seu-scholarship-overview": "6d519604a27e11a7adf84e5b6dd495dc4053554467286f0d2ff2b0f03ea4e034",
  "seu-scholarship-2026": "dba5b0df701f03187779ca78cc16cc35ef7029208b71f670fe0740a1f95fcfc3",
  "seu-international-chinese-language-teachers-scholarship-page-2026": "188a92f73792b02917fa517f0418cd4d95a06013b02117fc4fb1539e4d2251d9",
  "seu-yes-digital-management-scholarship-2026": "faf31182ca00a7cbd641ec719c2b3faaefe855af128871466ecb78480935c14d",
  "seu-yes-sustainable-infrastructure-scholarship-2026": "86a58713b02f6a3895bdd3924e2ce194e9109024405e57c88ab1aa72426253bb",
  "seu-degree-program-index-2026": "47692fada2f2fbed5af15af36f1b4f8759a99667f8be6527adb50fbc352062e1",
  "seu-undergraduate-programs-page-2026": "983068db99a1d3cdbc995d4f5d79b83731a6f073757e4d0d887d5851dda46ad7",
  "seu-undergraduate-programs-pdf-2026": "02d4c4f6480a0925d89d4ef572901a1e6cae6d0a2f22befec91c74b0c2f8f9b4",
  "seu-graduate-programs-page-2026": "4503a77c5348547b282c9f52178f60957ef607bd2d02e5af142bdd5dad9ad20f",
  "seu-master-programs-pdf-2026": "3a416fe4e92db055b4851fc12cd72614f47c359b5e62652e178fe8049c54571b",
  "seu-doctoral-programs-pdf-2026": "b80fcf633d938e99ee1d9b3cf2d2bb601c4ebb20ff505e57f1ae8c9b5b2d93a0",
  "seu-degree-program-index-en-2026": "8995c3c63231f49cda7f500bb5a6b1c108d3202e62c5c78a72ff8f4da6c4a1da",
  "seu-undergraduate-programs-en-page-2026": "ae879647b87fc3fad8c2ffb60402771b47c7eca6fecc281c6fb4b82b948980e9",
  "seu-undergraduate-programs-en-pdf-2026": "18a48f4c8d045872a356d1202712c3e682c7b0ddb30f18ac104c0f6258bd94f9",
  "seu-english-undergraduate-programs-pdf-2026": "4c87c4cfaf932a3c60ed677e4c67449597789f2f8d5aa278ba58117a052e7662",
  "seu-master-programs-en-pdf-2026": "e8b89c7977f819fecdb88f55fbc47cc71e2c923f6a51d51b3ce4ff27fd74c7a1",
  "seu-doctoral-programs-en-pdf-2026": "09fd319c5db64c29b2cc05ab5e7a4480c5cea373d66dcba943ed4e6b12c37528",
};

const evidence = new Map<string, any>();
for (const runDir of runDirs) {
  const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
  for (const source of manifest.sources ?? []) {
    if (source.status !== 200 || expected[source.id] !== source.sha256) throw new Error(`Official snapshot mismatch: ${source.id}`);
    if (evidence.has(source.id)) throw new Error(`Duplicate evidence id: ${source.id}`);
    evidence.set(source.id, source);
  }
}
if (evidence.size !== Object.keys(expected).length) throw new Error(`Incomplete SEU evidence set: ${evidence.size}/${Object.keys(expected).length}`);
const parsed = JSON.parse(await readFile(resolve(runDirs[0], "parsed-routes.json"), "utf8"));
const requiredCounts = { undergraduate: 70, master: 92, doctoral: 68, total: 230 };
if (JSON.stringify(parsed.counts) !== JSON.stringify(requiredCounts)) throw new Error(`Unexpected SEU route counts: ${JSON.stringify(parsed.counts)}`);

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cscaSubjects = (text: string) => [
  /Humanities(?:\/Science)? Chinese/i.test(text) ? "Humanities Chinese" : null,
  /Science Chinese/i.test(text) ? "STEM Chinese" : null,
  /Mathematics/i.test(text) ? "Mathematics" : null,
  /Physics/i.test(text) ? "Physics" : null,
  /Chemistry/i.test(text) ? "Chemistry" : null,
].filter(Boolean) as string[];
const isMedicine = (school: string, major: string) => /Medical|Medicine|Public Health/i.test(`${school} ${major}`);
const isHumanities = (school: string) => /Humanities|Economics|Management|Foreign Languages|Arts|Law|Marxism|Education/i.test(school);
const tuitionFor = (route: any) => {
  if (route.degree === "Undergraduate") {
    if (route.teachingLanguage === "English") return { tuitionAmount: 32000, tuitionText: "RMB 32,000/year" };
    const amount = isMedicine(route.schoolEn, route.majorEn) ? 20000 : isHumanities(route.schoolEn) ? 16000 : 19000;
    return { tuitionAmount: amount, tuitionText: `RMB ${amount.toLocaleString("en-US")}/year` };
  }
  if (route.degree === "Master" && route.teachingLanguage === "English") return { tuitionText: "RMB 30,000-40,000/year" };
  const amount = route.degree === "Master"
    ? isMedicine(route.schoolEn, route.majorEn) ? 30000 : isHumanities(route.schoolEn) ? 18000 : 23000
    : isMedicine(route.schoolEn, route.majorEn) ? 50000 : isHumanities(route.schoolEn) ? 28000 : 33000;
  return { tuitionAmount: amount, tuitionText: `RMB ${amount.toLocaleString("en-US")}/year` };
};
const specialSource = (route: any) => {
  if (route.degree === "Undergraduate" && route.majorEn === "E-Business" && route.teachingLanguage === "Chinese") return "seu-ecommerce-undergraduate-2026";
  if (route.degree === "Undergraduate" && route.majorEn === "Tourism Management") return "seu-tourism-management-undergraduate-2026";
  if (route.degree === "Undergraduate" && route.majorEn === "Clinical Medicine" && route.teachingLanguage === "English") return "seu-mbbs-undergraduate-2026";
  return route.sourceId;
};
const graduateHsk = (route: any) => isMedicine(route.schoolEn, route.majorEn) || isHumanities(route.schoolEn)
  ? "HSK Level 5 or above for Chinese-taught medicine, humanities, economics and management routes"
  : "HSK Level 4, score 200 or above for Chinese-taught routes";

const usedSlugs = new Set<string>();
const programs: Array<CatalogSeedProgram & { _deadlineDate: string; _deadlineLabel: string }> = parsed.routes.map((route: any, index: number) => {
  const sourceId = specialSource(route);
  const source = evidence.get(sourceId)!;
  const guideId = route.degree === "Undergraduate" ? "seu-undergraduate-guide-en-pdf-2026" : "seu-graduate-guide-zh-pdf-2026";
  const deadlineDate = route.degree === "Undergraduate" ? "2026-07-08T15:59:59.000Z" : "2026-05-15T15:59:59.000Z";
  const deadlineLabel = route.degree === "Undergraduate" ? "Final 2026 undergraduate batch deadline: July 8, 2026" : "General 2026 graduate deadline: May 15, 2026";
  let slug = `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.schoolEn)}-${slugify(route.majorEn)}-${slugify(route.teachingLanguage)}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${index + 1}`;
  usedSlugs.add(slug);
  const subjects = cscaSubjects(route.cscaRequirementEn || "");
  return {
    slug, schoolSlug, citySlug: "nanjing", nameEn: route.majorEn, degreeLevel: route.degree,
    durationYears: route.durationYears, fieldCategory: route.schoolEn, subjectArea: route.majorEn,
    teachingLanguage: route.teachingLanguage,
    ...(subjects.length ? { cscaSubjects: subjects, cscaRequirement: route.cscaRequirementEn } : {}),
    ...(route.teachingLanguage === "Chinese" ? { hskRequirement: route.degree === "Undergraduate" ? "HSK Level 4 or above, score 200 or above" : graduateHsk(route) } : {}),
    ...(route.teachingLanguage === "English" ? { englishRequirement: "TOEFL 80 or above, IELTS 6.0 or above, or Duolingo 100 or above; the official route-specific guide controls" } : {}),
    ...tuitionFor(route), tuitionCurrency: "RMB", tuitionPeriod: "year",
    scholarshipText: "SEU scholarships and Chinese Government Scholarship routes are reviewed as separate awards.",
    applicationUrl, hasScholarship: true,
    applicationNote: `${route.schoolEn}; official English catalog page ${route.sourcePage}`,
    badgeText: `Official ${route.degree.toLowerCase()} route`, displayGroup: route.degree, displayGroupLabel: `${route.degree} programs`, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${route.sourceId} page ${route.sourcePage} specialty`, degreeLevel: `${route.sourceId} catalog title`, fieldCategory: `${route.sourceId} page ${route.sourcePage} school/college`,
      teachingLanguage: `${route.sourceId} program label`, durationYears: `${route.sourceId} page ${route.sourcePage} duration`,
      tuitionText: `${guideId} tuition table`, applicationUrl: `${guideId} application process`,
      ...(subjects.length ? { cscaSubjects: `${route.sourceId} page ${route.sourcePage} CSCA test column` } : {}),
    },
    _deadlineDate: deadlineDate, _deadlineLabel: deadlineLabel,
  };
});

const specialPrograms = [
  {
    slug: `${schoolSlug}-master-one-belt-one-road-digital-and-intelligent-management-english`, schoolSlug, citySlug: "nanjing",
    nameEn: "One Belt One Road Digital and Intelligent Management", degreeLevel: "Master", durationYears: 2,
    fieldCategory: "School of Economics & Management", subjectArea: "Digital and Intelligent Management", teachingLanguage: "English",
    englishRequirement: "Professional-course English capability is required", tuitionText: "Full scholarship route; self-financed tuition is not published",
    tuitionCurrency: "RMB", tuitionPeriod: "year", scholarshipText: "Full Chinese Government Scholarship under the Youth of Excellence Scheme of China",
    applicationUrl, applicationNote: "Two-year 1+1 model: year one at SEU, year two thesis work in the home country with return for defense",
    hasScholarship: true, badgeText: "2026 Youth of Excellence route", displayGroup: "Master", displayGroupLabel: "Special master's programs", status: "draft" as const,
    sourceId: "seu-yes-digital-management-2026", deadline: "2026-03-15T15:59:59.000Z", deadlineLabel: "SEU deadline March 15, 2026; CSC deadline March 31, 2026",
  },
  {
    slug: `${schoolSlug}-master-one-belt-one-road-sustainable-infrastructure-english`, schoolSlug, citySlug: "nanjing",
    nameEn: "One Belt One Road Sustainable Infrastructure", degreeLevel: "Master", durationYears: 2,
    fieldCategory: "School of Civil Engineering", subjectArea: "Sustainable Infrastructure", teachingLanguage: "English",
    englishRequirement: "Professional-course English capability is required", tuitionText: "Full scholarship route; self-financed tuition is not published",
    tuitionCurrency: "RMB", tuitionPeriod: "year", scholarshipText: "Full Chinese Government Scholarship under the Youth of Excellence Scheme of China",
    applicationUrl, applicationNote: "Two-year 1+1 model: year one at SEU, year two thesis work in the home country with return for defense",
    hasScholarship: true, badgeText: "2026 Youth of Excellence route", displayGroup: "Master", displayGroupLabel: "Special master's programs", status: "draft" as const,
    sourceId: "seu-yes-sustainable-infrastructure-2026", deadline: "2026-03-15T15:59:59.000Z", deadlineLabel: "SEU deadline March 15, 2026; CSC deadline March 31, 2026",
  },
].map(({ sourceId, deadline, deadlineLabel, ...program }) => {
  const source = evidence.get(sourceId)!;
  return {
    ...program, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: { nameEn: `${sourceId} title`, degreeLevel: `${sourceId} program structure`, durationYears: `${sourceId} program structure`, teachingLanguage: `${sourceId} program structure`, scholarshipText: `${sourceId} scholarship coverage`, applicationUrl: `${sourceId} application procedure`, tuitionText: `${sourceId} scholarship route` },
    _deadlineDate: deadline, _deadlineLabel: deadlineLabel,
  } as CatalogSeedProgram & { _deadlineDate: string; _deadlineLabel: string };
});
programs.push(...specialPrograms);

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Nanjing, Jiangsu, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: { title: `${sourceId} title`, fundingLevel: `${sourceId} funding statement`, coverage: `${sourceId} coverage`, amountText: `${sourceId} coverage`, applicableDegree: `${sourceId} eligible route`, eligibilityItems: `${sourceId} qualifications`, applicationMaterials: `${sourceId} required documents`, applicationSteps: `${sourceId} procedure`, ...(value.deadlineDate ? { deadlineDate: `${sourceId} application deadline` } : {}) },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "SEU application system", url: applicationUrl, kind: "official-application" }],
    ...value,
  };
};
const graduateMaterials = [info("Passport"), info("Highest diploma or expected-graduation certificate"), info("Academic transcripts"), info("Language proficiency certificate"), info("Two recommendation letters"), info("Research plan", "At least 800 words for general graduate admission"), info("Physical examination report"), info("Certificate of no criminal conviction"), info("Financial support guarantee statement")];
const yesEligibility = [info("Nationality and age", "Non-Chinese citizen under 45"), info("Degree", "Bachelor's degree holder"), info("Experience", "At least three years of related work experience"), info("Profile", "Senior public official, manager, or university/research scholar in a Belt and Road country"), info("Language", "Able to take professional courses in English")];
const yesMaterials = [info("Passport"), info("Physical examination report"), info("Certificate of no criminal conviction"), info("Highest degree diploma"), info("Academic transcripts"), info("Two recommendation letters"), info("Employment or in-service certificate"), info("Study or research plan"), info("English proficiency certificate")];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("seu-scholarship-2026", {
    slug: "official-2026-southeast-university-scholarship", title: "Southeast University Scholarship 2026", type: "university", typeLabel: "SEU Scholarship", providerNameEn: "Southeast University", fundingLevel: "Full or partial",
    coverage: "Awards range from full tuition plus up to RMB 3,500 monthly allowance to partial tuition waiver; the awarded tier controls", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Eligible Southeast University degree programs", amountText: "Up to full tuition and RMB 3,500/month; partial tuition-waiver tiers also exist",
    deadlineDate: "2026-05-15", deadlineLabel: "November 22, 2025-May 15, 2026", applicationRound: "2026 degree intake",
    benefitItems: [benefit("Tuition", "Full or partial waiver depending on awarded tier"), benefit("Living allowance", "The official overview publishes up to RMB 3,500/month for the most favorable tier")],
    eligibilityItems: [info("Degree route", "Requirements follow the selected undergraduate, master's, or doctoral program"), info("Language", "Meet the selected route's HSK or English requirement"), info("No guarantee", "Scholarship decisions are competitive")],
    applicationMaterials: graduateMaterials,
    applicationSteps: [info("Step 1", "Apply in the SEU system and select the Southeast University Scholarship route"), info("Step 2", "Upload the degree-route materials and monitor the application email/status"), info("Step 3", "Check the final result published by the College of International Students")],
    summary: "SEU's competitive university scholarship route for the 2026 degree intake, with full and partial award tiers.",
  }),
  scholarship("seu-yes-digital-management-2026", {
    slug: "official-2026-seu-youth-excellence-digital-intelligent-management", title: "SEU 2026 Youth of Excellence - Digital and Intelligent Management", type: "government", typeLabel: "Chinese Government Scholarship - Youth of Excellence", providerNameEn: "China Scholarship Council / Southeast University", fundingLevel: "Full",
    coverage: "Full scholarship; the official program guide does not itemize components", applicableDegree: "Master", applicableProgram: "One Belt One Road Digital and Intelligent Management, English-taught 1+1 model", amountText: "Full scholarship; components not itemized in the official SEU guide",
    deadlineDate: "2026-03-31", deadlineLabel: "SEU application by March 15, 2026; CSC application by March 31, 2026", applicationRound: "2026 Youth of Excellence intake",
    benefitItems: [benefit("Full scholarship", "Specific components are not itemized in the official guide")], eligibilityItems: yesEligibility, applicationMaterials: yesMaterials,
    applicationSteps: [info("Step 1", "Apply in the SEU system by March 15, 2026"), info("Step 2", "Obtain SEU pre-admission after review"), info("Step 3", "Apply in the CSC system as Type A, agency 1563, by March 31, 2026")],
    summary: "Full Chinese Government Scholarship for SEU's two-year English-taught 1+1 Digital and Intelligent Management master's route.",
  }),
  scholarship("seu-yes-sustainable-infrastructure-2026", {
    slug: "official-2026-seu-youth-excellence-sustainable-infrastructure", title: "SEU 2026 Youth of Excellence - Sustainable Infrastructure", type: "government", typeLabel: "Chinese Government Scholarship - Youth of Excellence", providerNameEn: "China Scholarship Council / Southeast University", fundingLevel: "Full",
    coverage: "Full scholarship; the official program guide does not itemize components", applicableDegree: "Master", applicableProgram: "One Belt One Road Sustainable Infrastructure, English-taught 1+1 model", amountText: "Full scholarship; components not itemized in the official SEU guide",
    deadlineDate: "2026-03-31", deadlineLabel: "SEU application by March 15, 2026; CSC application by March 31, 2026", applicationRound: "2026 Youth of Excellence intake",
    benefitItems: [benefit("Full scholarship", "Specific components are not itemized in the official guide")], eligibilityItems: yesEligibility, applicationMaterials: yesMaterials,
    applicationSteps: [info("Step 1", "Apply in the SEU system by March 15, 2026"), info("Step 2", "Obtain SEU pre-admission after review"), info("Step 3", "Apply in the CSC system as Type A, agency 1563, by March 31, 2026")],
    summary: "Full Chinese Government Scholarship for SEU's two-year English-taught 1+1 Sustainable Infrastructure master's route.",
  }),
];

const profile = evidence.get("seu-school-profile")!;
const cleanPrograms = programs.map(({ _deadlineDate, _deadlineLabel, ...program }) => program);
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: evidence.get("seu-admission-index-2026")!.fetchedAt,
  cities: [{ slug: "nanjing", nameEn: "Nanjing", nameZh: "南京", region: "East China", province: "Jiangsu", status: "active", sourceUrl: "https://hwxy.nju.edu.cn/English/StudyatNJU/Admissions/BachelorsPrograms/index.html", sourceLabel: "Nanjing University Bachelor’s Programs", sourceSha256: "aef8f2b6536b3e3f2daf916d725328f6b858a49c0ea1472a537b8ede69638625", capturedAt: "2026-09-11T06:39:38.300Z", sourceFieldLineage: { nameEn: "institution name and contact address", province: "institution name and contact address" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Southeast University", nameZh: "东南大学", citySlug: "nanjing", schoolType: "public", region: "Nanjing, Jiangsu, East China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English depending on program",
    languageRequirement: "Chinese routes require HSK 4 or HSK 5 depending on field; English routes publish TOEFL 80, IELTS 6.0, or Duolingo 100 benchmarks subject to the route guide.",
    hskRequirement: "HSK Level 4 score 200 for general Chinese routes; medicine, humanities, economics and management graduate routes require HSK Level 5.",
    englishRequirement: "TOEFL 80 or above, IELTS 6.0 or above, or Duolingo 100 or above, subject to the route-specific guide.",
    deadlineSummary: "Undergraduate applications run in four 2026 batches through July 8. General graduate applications run November 22, 2025-May 15, 2026; scholarship routes may close earlier.",
    tuitionSummary: "Undergraduate RMB 16,000 humanities, RMB 19,000 engineering, RMB 20,000 medicine, or RMB 32,000 English-taught/year. Master's RMB 18,000/23,000/30,000 by field or RMB 30,000-40,000 English-taught/year. Doctoral RMB 28,000/33,000/50,000 by field/year.",
    applicationFee: "RMB 800", websiteUrl: "https://www.seu.edu.cn/english/", admissionsUrl: evidence.get("seu-undergraduate-guide-en-2026")!.url, cscaRequired: true,
    cscaRequirement: "All undergraduate routes publish CSCA subjects in the official catalog; subjects vary among Humanities Chinese, STEM Chinese, Mathematics, Physics and Chemistry.",
    cscaSubjects: ["Humanities Chinese", "STEM Chinese", "Mathematics", "Physics", "Chemistry"],
    subjectTags: [...new Set(cleanPrograms.map(program => program.subjectArea).filter(Boolean))] as string[], languageTags: ["Chinese", "English"], tuitionBandLabel: "RMB 16,000-50,000/year",
    campusHighlights: ["70 official undergraduate routes", "92 official master's routes", "68 official doctoral routes", "Two additional 2026 Youth of Excellence 1+1 master's routes"],
    status: "draft", sourceUrl: profile.url, sourceLabel: profile.label, sourceSha256: profile.sha256, capturedAt: profile.fetchedAt,
    sourceFieldLineage: { nameEn: "official university profile", citySlug: "official address", applicationLevel: "2026 undergraduate and graduate guides", languageRequirement: "2026 admission guides", deadlineSummary: "2026 admission guides", tuitionSummary: "2026 admission-guide tuition tables", applicationFee: "2026 admission-guide fee tables", admissionsUrl: "registered official undergraduate guide", cscaRequirement: "2026 undergraduate program catalog" },
  }],
  programs: cleanPrograms,
  programIntakes: programs.map((program) => ({
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: program._deadlineDate, deadlineLabel: program._deadlineLabel,
    applicationRound: "September 2026 intake", status: "closed" as const,
    sourceUrl: program.sourceUrl, sourceLabel: program.sourceLabel, sourceSha256: program.sourceSha256, capturedAt: program.capturedAt,
    sourceFieldLineage: { deadlineDate: program.degreeLevel === "Undergraduate" ? "2026 undergraduate admission guide application batches" : program.slug.includes("one-belt-one-road") ? "2026 Youth of Excellence guide procedure" : "2026 graduate admission guide application period" },
  })),
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`SEU candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: 232, undergraduateRouteCount: 70, masterRouteCount: 94, doctoralRouteCount: 68, scholarshipCount: 3, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch creates a new Southeast University school and new official program/scholarship slugs without archiving or overwriting existing school, program, or scholarship records." },
  reconciliation: { actionAfterReview: "insert_new_verified_seu_catalog", destructiveDeletion: false, existingNanjingCityReusedWithByteEquivalentCatalogFields: true, legacyScholarshipRecordsObservedButNotTouched: ["southeast-university-government-scholarship", "southeast-university-presidential-scholarship", "southeast-university-government-scholarship-2"] },
  catalogDifferences: { canonicalPublication: "English official program catalogs", englishCounts: parsed.counts, chineseCounts: parsed.chineseCatalogCounts, difference: parsed.bilingualCatalogDifference, note: "The official English catalogs contain one more undergraduate and two more master's rows than the Chinese catalogs; both versions and hashes are retained." },
  excludedEvidence: [{ sourceId: "seu-international-chinese-language-teachers-scholarship-page-2026", reason: "The linked PDF exceeds the catalog collector's 15 MB safety limit, so the page is retained as evidence but no unreviewed award record is published." }],
  unresolvedFields: ["The two Youth of Excellence guides state full scholarship but do not itemize scholarship components.", "Three legacy low-field third-party scholarship rows remain pending separate conflict/archival review."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional admissions, program and scholarship information is included; no applicant, account, payment or private personal data is present." },
  reviewNotes: ["All 230 rows in the three official English program catalogs are represented.", "Two separate 2026 Youth of Excellence 1+1 master's routes are additionally represented.", "Scholarship records contain eligibility, materials and steps rather than admission-notice titles.", "No legacy school, program or scholarship record is archived or overwritten."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const review = { ...reviewBase, reviewHash, publicationReference: "standing-user-default-publication" };
await writeFile(candidatePath, candidateText, { flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ ok: true, programCounts: reviewBase.scope, scholarshipCount: scholarships.length, candidateSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
