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
const runDir = resolve(root, "work/catalog-official/sysu-complete-batch-01");
const candidatePath = resolve(root, "seeds/catalog.sysu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sysu-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.sysu-complete-batch-01.review.json");
const schoolSlug = "sun-yat-sen-university";
const applicationUrl = "https://apply.sysu.edu.cn";

const expected: Record<string, string> = {
  "sysu-application-index-2026": "96351ce128bfd397ee15c4b6c05c1af8ca195d995a8f8754c538fc348d8932c6",
  "sysu-undergraduate-guide-2026": "e34c17821f3c6c4d19668199e0b3081b7f68cb836c6792a0bb234147f1c3b1a9",
  "sysu-undergraduate-programs-2026": "c718b84680d1874a98b724efde7b1af6c9a7c0fedee3b581147b026817b9e86b",
  "sysu-master-guide-2026": "efe8a16236004a325fcaba8a1b9cb636ab5ee2c95483fe97b190459078cb2c3f",
  "sysu-master-guide-pdf-2026": "7e22759155685ebe4c3438345ead588f70732ce2bf345f0def1e52cb3dcab9f8",
  "sysu-master-programs-2026": "57f43ce983f2fea0bc710448d37e07d10f5a5e7eee574f128736560a94cb2100",
  "sysu-doctoral-guide-2026": "b6e5e8747cc11212b768a1925f1cc5ff89e015f6f3d024e2b2f878e316378c66",
  "sysu-doctoral-guide-pdf-2026": "a87d4db9552f7add8fa2987f180d40a9cea8f78d730e2adaab35b2d2b1b2410f",
  "sysu-doctoral-programs-2026": "d65dc404518a0f0b6480260738506c0f7f2e8b5fadd6a61f1d92fa7d4e703033",
  "sysu-cambodia-aerospace-scholarship-2026": "24e3b38a0c4e467f99e8169424b4568e975a57e167e24d8184d99766dc24fa4b",
  "sysu-silk-road-scholarship-2026": "d11461b05a4b8bfe1e6e49dd7bb5faa4eebc7aff420026e6155a2c96c5a5cf78",
  "sysu-china-link-scholarship-2026": "225fb1e4fddf4a078942446e0a26516e24c5a0461a678dfac9d137dc4c2b8c77",
  "sysu-atomic-energy-scholarship-2026": "b3bd0f4641163fac3f00a096eb22eac900b45b812272e0a7d621782f355368ee",
  "sysu-international-chinese-language-teachers-scholarship-2026": "88c6ebc44f7bfed3c426d4d2357871f56ccbb84a9f61c124c37c791880db6cee",
  "sysu-high-level-graduate-scholarship-2026": "ce460f1cbda1b0cb99398a3b2a217ec42c3d922c71354b2130fba4b904b780dd",
  "sysu-bilateral-scholarship-2026": "1d5187b631e800b273afa159e2f1d78f41a6de24a139c8c024fcc151c296df29",
  "sysu-china-studies-phd-fellowship-2026": "c33ae7c26bf40b0b65baceb0f89edfb9238a234da5463e010976bb204b55c28f",
  "sysu-youth-of-excellence-scholarship-2026": "ff46f1eed5d071c3886349eeb8a9c023f2199cd4e3cfc145e62ef3f6cc2e7c48",
  "sysu-international-students-scholarship-2026": "543c183522ab1b04f5b9f98e7ae5cea10ad03e085fa3b83fba28e82f43d993a9",
};

const manifest = JSON.parse(await readFile(resolve(runDir, "manifest.json"), "utf8"));
const parsed = JSON.parse(await readFile(resolve(runDir, "parsed-routes.json"), "utf8"));
const evidence = new Map<string, any>();
for (const source of manifest.sources ?? []) {
  if (expected[source.id] !== source.sha256 || source.status !== 200) throw new Error(`Official snapshot mismatch: ${source.id}`);
  evidence.set(source.id, source);
}
if (evidence.size !== Object.keys(expected).length) throw new Error("The complete SYSU evidence set was not collected.");
if (parsed.counts?.undergraduate !== 67 || parsed.counts?.master !== 364 || parsed.counts?.doctoral !== 297) {
  throw new Error(`Unexpected SYSU program-route counts: ${JSON.stringify(parsed.counts)}`);
}

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cityForCampus = (campus: string) => /Shenzhen/i.test(campus) ? "shenzhen" : /Zhuhai/i.test(campus) ? "zhuhai" : "guangzhou";
const cscaSubjects = (text: string) => [
  /Humanities Chinese/i.test(text) ? "Humanities Chinese" : null,
  /STEM Chinese/i.test(text) ? "STEM Chinese" : null,
  /Mathematics/i.test(text) ? "Mathematics" : null,
  /Physics/i.test(text) ? "Physics" : null,
  /Chemistry/i.test(text) ? "Chemistry" : null,
].filter(Boolean) as string[];
const graduateTuition = (route: any) => {
  if (route.degree === "Master") {
    if (/Business Administration/i.test(route.major) && /English/i.test(route.language)) return 109000;
    if (/Medicine/i.test(route.disciplinaryCategory)) return 55000;
    if (/Humanities|Liberal Arts|Economics|Law|Education|Literature|History|Management|Philosophy/i.test(route.disciplinaryCategory)) return 30000;
    return 39000;
  }
  if (/^10/.test(route.majorNo)) return 65000;
  if (/^(01|02|03|04|05|06|12|13)/.test(route.majorNo)) return 34000;
  return 44200;
};
const sourceForRoute = (route: any) => evidence.get(route.sourceId)!;
const guideForRoute = (route: any) => evidence.get(route.degree === "Undergraduate" ? "sysu-undergraduate-guide-2026" : route.degree === "Master" ? "sysu-master-guide-2026" : "sysu-doctoral-guide-2026")!;
const usedSlugs = new Set<string>();
const programs: CatalogSeedProgram[] = parsed.routes.map((route: any, index: number) => {
  const source = sourceForRoute(route);
  const guide = guideForRoute(route);
  const noDirection = /No Designated Concentration|Regardless of professional direction/i.test(route.field ?? "");
  const nameEn = route.degree === "Undergraduate" ? route.major : noDirection ? route.major : `${route.major} - ${route.field}`;
  let slug = route.degree === "Undergraduate"
    ? `${schoolSlug}-undergraduate-${route.routeNo}-${slugify(route.major)}`
    : `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.majorNo)}-${slugify(route.fieldNo)}-${slugify(route.department)}-${slugify(route.language)}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${index + 1}`;
  usedSlugs.add(slug);
  const tuition = route.degree === "Undergraduate" ? route.tuitionAmount : graduateTuition(route);
  const subjects = route.degree === "Undergraduate" ? cscaSubjects(route.cscaRequirement) : [];
  const deadlineLabel = route.degree === "Undergraduate"
    ? "Final 2026 undergraduate application deadline: April 30, 2026"
    : `Final 2026 ${route.degree.toLowerCase()} application deadline: April 30, 2026`;
  return {
    slug, schoolSlug, citySlug: cityForCampus(route.campus), nameEn, degreeLevel: route.degree,
    durationYears: route.durationYears,
    fieldCategory: route.degree === "Undergraduate" ? route.department : (route.disciplinaryCategory || route.department),
    subjectArea: route.degree === "Undergraduate" ? route.major : route.major,
    teachingLanguage: route.language,
    ...(subjects.length ? { cscaSubjects: subjects, cscaRequirement: route.cscaRequirement } : {}),
    ...(route.language === "Chinese" ? { hskRequirement: route.degree === "Undergraduate" ? route.hskRequirement : "HSK Level 5, score 180 or above; published Chinese-medium exemptions may apply" } : {}),
    ...(route.language === "English" ? { englishRequirement: "TOEFL iBT 79 with at least 15 in each section, or IELTS Academic 6.5 with at least 5.5 in each component; published exemptions may apply" } : {}),
    tuitionAmount: tuition, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: `RMB ${Number(tuition).toLocaleString("en-US")}/academic year`,
    scholarshipText: "SYSU scholarship eligibility and covered-major scope are reviewed separately for each published award route.",
    applicationUrl, hasScholarship: true,
    applicationNote: [route.department, route.field && !noDirection ? `Field: ${route.field}` : null, route.degreeType, route.campus, route.note].filter(Boolean).join("; "),
    badgeText: route.degree === "Undergraduate" ? `Official route ${route.routeNo}` : `${route.majorNo}/${route.fieldNo}`,
    displayGroup: route.degree, displayGroupLabel: `${route.degree} programs`, status: "draft",
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `${source.id} page ${route.page} major/field row`, degreeLevel: `${source.id} catalog title`,
      fieldCategory: `${source.id} page ${route.page} department/category column`, teachingLanguage: `${source.id} page ${route.page} teaching-language column`,
      durationYears: `${source.id} page ${route.page} duration column`, tuitionAmount: route.degree === "Undergraduate" ? `${source.id} page ${route.page} tuition column` : `${guide.id} tuition table`,
      applicationUrl: `${guide.id} application procedure`, ...(subjects.length ? { cscaSubjects: `${source.id} page ${route.page} CSCA column` } : {}),
    },
  };
});

const cambodiaSource = evidence.get("sysu-cambodia-aerospace-scholarship-2026")!;
const cambodiaProgram: CatalogSeedProgram = {
  slug: `${schoolSlug}-master-cambodia-aerospace-information-engineering`, schoolSlug, citySlug: "shenzhen",
  nameEn: "Cambodia Aerospace Information Engineering Talent Program", degreeLevel: "Master", durationMonths: 30,
  fieldCategory: "Electronic Information", subjectArea: "Aerospace Information Engineering", teachingLanguage: "English",
  englishRequirement: "Meet the English-language requirement published for the Cambodia-targeted program",
  tuitionAmount: 80000, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 80,000/academic year, calculated over two years",
  scholarshipText: "The official notice explicitly states that participants are not eligible for the university's international student scholarship scheme.",
  applicationUrl, applicationNote: "Full-time professional master's degree; nomination by the Cambodian Academy of Digital Technology is required; School of Systems Science and Engineering; applicants must hold Cambodian nationality.",
  hasScholarship: false, badgeText: "Cambodia targeted program", displayGroup: "Master", displayGroupLabel: "Master programs", status: "draft",
  sourceUrl: cambodiaSource.url, sourceLabel: cambodiaSource.label, sourceSha256: cambodiaSource.sha256, capturedAt: cambodiaSource.fetchedAt,
  sourceFieldLineage: { nameEn: "official program title", degreeLevel: "training mode and degree awarded", durationMonths: "program duration", tuitionAmount: "fees and funding arrangements", scholarshipText: "fees and funding arrangements scholarship row", applicationNote: "eligibility and nomination sections" },
};
programs.push(cambodiaProgram);

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const commonDegreeMaterials = [info("Passport"), info("Degree certificate or expected-graduation proof"), info("Academic transcripts"), info("Language proficiency proof"), info("Physical examination form"), info("Non-criminal record certificate")];
const scholarship = (sourceId: string, value: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = evidence.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Guangzhou, Guangdong, China", status: "draft", sourceUrl: source.url, sourceLabel: source.label,
    sourceSha256: source.sha256, capturedAt: source.fetchedAt, targetCountries: [], targetRegions: [],
    sourceFieldLineage: { title: `${sourceId} article title`, fundingLevel: `${sourceId} coverage section`, coverage: `${sourceId} coverage section`, amountText: `${sourceId} coverage section`, applicableDegree: `${sourceId} scope and eligibility`, eligibilityItems: `${sourceId} eligibility section`, applicationMaterials: `${sourceId} application documents section`, applicationSteps: `${sourceId} application procedure`, ...(value.deadlineDate ? { deadlineDate: `${sourceId} deadline section` } : {}) },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "SYSU international student application system", url: applicationUrl, kind: "official-application" }],
    ...value,
  };
};

const scholarships: CatalogSeedScholarship[] = [
  scholarship("sysu-silk-road-scholarship-2026", {
    slug: "official-2026-sysu-silk-road-scholarship", title: "SYSU 2026 Silk Road Chinese Government Scholarship", type: "government", typeLabel: "Chinese Government Scholarship - Silk Road", providerNameEn: "China Scholarship Council / Sun Yat-sen University", fundingLevel: "Full",
    coverage: "Tuition, on-campus accommodation, living allowance and comprehensive medical insurance", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Majors in the official 2026 Silk Road attachment, subject to Ministry of Education approval", amountText: "Full scholarship; the SYSU notice does not itemize the stipend amount",
    deadlineDate: "2026-05-17", deadlineLabel: "SYSU invitation-letter application deadline: May 17, 2026", applicationRound: "2026 degree intake", targetCountries: ["Vietnam", "Pakistan", "Myanmar", "Laos", "Thailand", "Cambodia", "Indonesia", "Yemen", "Malaysia", "Kazakhstan"], targetRegions: ["Belt and Road partner countries"],
    benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Living allowance", "Amount follows CSC standards"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Nationality", "Citizen of one of the ten published target countries"), info("Undergraduate", "High-school diploma and under 25"), info("Master", "Bachelor's degree and under 35"), info("Doctoral", "Master's degree and under 40"), info("Chinese route", "Published HSK requirements and registration threshold"), info("Undergraduate CSCA", "Score report required")],
    applicationMaterials: [...commonDegreeMaterials, info("CSC application form"), info("Two recommendation letters"), info("Study and research plan for graduate applicants")], applicationSteps: [info("Step 1", "Complete the CSC Type B application using SYSU agency number 10558"), info("Step 2", "Complete the SYSU Silk Road application"), info("Step 3", "Complete SYSU assessment and CSC review")], summary: "Full CSC Type B award for specified programs and ten published Belt and Road partner countries.",
  }),
  scholarship("sysu-china-link-scholarship-2026", {
    slug: "official-2026-sysu-china-link-scholarship", title: "SYSU 2026 China Link Short-term Research Exchange Scholarship", type: "government", typeLabel: "China Link", providerNameEn: "China Scholarship Council / Sun Yat-sen University", fundingLevel: "Full",
    coverage: "Tuition waiver, on-campus accommodation, comprehensive medical insurance and monthly living allowance", applicableDegree: "General Scholar, Senior Scholar", applicableProgram: "One-to-twelve-month research in the published SYSU short-term research catalog", amountText: "General scholar RMB 3,000/month; senior scholar RMB 3,500/month, plus tuition, accommodation and insurance",
    deadlineDate: "2026-12-01", deadlineLabel: "May 1, 2026 for summer/autumn 2026; December 1, 2026 for spring/summer 2027", applicationRound: "Funding duration 1-12 months; start no later than August 31, 2027",
    benefitItems: [benefit("Tuition waiver"), benefit("On-campus accommodation"), benefit("Medical insurance"), benefit("General scholar stipend", "RMB 3,000/month"), benefit("Senior scholar stipend", "RMB 3,500/month")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Affiliation", "Full-time student at a CSC partner institution abroad"), info("Study field", "A major in the official SYSU short-term research catalog")], applicationMaterials: [info("Department recommendation letter"), ...commonDegreeMaterials, info("Study or research proposal")], applicationSteps: [info("Step 1", "Obtain a SYSU school or department nomination"), info("Step 2", "Complete the CSC Type B application, agency 10558"), info("Step 3", "Submit materials through the SYSU system before the applicable semester deadline")], summary: "Short-term full scholarship for eligible students at CSC partner institutions.",
  }),
  scholarship("sysu-atomic-energy-scholarship-2026", {
    slug: "official-2026-sysu-atomic-energy-scholarship", title: "SYSU 2026 Atomic Energy Scholarship Program of China", type: "government", typeLabel: "Atomic Energy Scholarship", providerNameEn: "China Atomic Energy Authority / Ministry of Education / China Scholarship Council", fundingLevel: "Full",
    coverage: "Tuition, university dormitory and comprehensive medical insurance", applicableDegree: "Master, Doctoral", applicableProgram: "Majors in the official 2026 Atomic Energy Scholarship catalog", amountText: "Full scholarship; the SYSU notice does not itemize a stipend and defers standards to CSC",
    deadlineDate: "2026-05-30", deadlineLabel: "May 30, 2026 (Beijing time)", applicationRound: "2026 degree intake", benefitItems: [benefit("Tuition"), benefit("University dormitory"), benefit("Comprehensive medical insurance")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Master", "Bachelor's degree, under 35"), info("Doctoral", "Master's degree, under 40"), info("English", "TOEFL iBT 79 with 15 per section or IELTS 6.5 with 5.5 per component, subject to published exemption")], applicationMaterials: [...commonDegreeMaterials, info("CSC application form"), info("Study plan", "At least 1,500 words for master or 3,000 for doctoral"), info("Two academic recommendation letters"), info("Applicant information form")], applicationSteps: [info("Step 1", "Apply in the CSC system as Type B, agency 10558"), info("Step 2", "Apply in the SYSU system and select the Atomic Energy route"), info("Step 3", "Complete school assessment and sponsor review")], summary: "CAEA/MOE/CSC graduate scholarship limited to the official atomic-energy major catalog.",
  }),
  scholarship("sysu-international-chinese-language-teachers-scholarship-2026", {
    slug: "official-2026-sysu-international-chinese-language-teachers-scholarship", title: "SYSU 2026 International Chinese Language Teachers Scholarship", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerNameEn: "Center for Language Education and Cooperation / Sun Yat-sen University", fundingLevel: "Full",
    coverage: "Tuition, accommodation, monthly living allowance and comprehensive medical insurance", applicableDegree: "Master", applicableProgram: "Master of Teaching Chinese to Speakers of Other Languages", amountText: "RMB 3,000/month living allowance plus tuition, accommodation and RMB 800/year medical insurance",
    deadlineDate: "2026-05-15", deadlineLabel: "May 15, 2026 (Beijing time)", applicationRound: "September 2026 intake; up to two academic years", benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance", "RMB 3,000/month"), benefit("Medical insurance", "RMB 800/academic year")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Age", "18-35; employed Chinese-language teachers may be up to 45"), info("Degree", "Bachelor's degree"), info("Chinese", "HSK 5 score 210 and HSKK Intermediate score 60")], applicationMaterials: [...commonDegreeMaterials, info("Two recommendation letters"), info("CLEC scholarship application form"), info("Prospective teaching contract where available")], applicationSteps: [info("Step 1", "Register in both the CLEC scholarship system and SYSU system"), info("Step 2", "Select the 2026 scholarship and submit signed materials"), info("Step 3", "Complete SYSU interview and CLEC review")], summary: "Full MTCSOL award for future or serving Chinese-language teachers.",
  }),
  scholarship("sysu-high-level-graduate-scholarship-2026", {
    slug: "official-2026-sysu-high-level-graduate-scholarship", title: "SYSU 2026 Chinese Government Scholarship - High-Level Graduate Program", type: "government", typeLabel: "Chinese Government Scholarship - High-Level Graduate", providerNameEn: "China Scholarship Council / Sun Yat-sen University", fundingLevel: "Full",
    coverage: "Tuition, accommodation, living expenses and comprehensive medical insurance", applicableDegree: "Master, Doctoral", applicableProgram: "Majors in the official 2026 High-Level Graduate attachment", amountText: "Full scholarship; funding details follow the corresponding CSC announcement",
    deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "2026 degree intake", benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living expenses", "Amount follows CSC standards"), benefit("Medical insurance")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Master", "Bachelor's degree and generally under 35"), info("Doctoral", "Master's degree and generally under 40"), info("Program and language requirements", "Meet the selected official major requirements")], applicationMaterials: [...commonDegreeMaterials, info("Study and research plan"), info("Two recommendation letters")], applicationSteps: [info("Step 1", "Apply in the SYSU system and select High-Level Graduate"), info("Step 2", "Pay the RMB 400 application fee"), info("Step 3", "Complete interview and CSC expert review")], summary: "CSC Type B full graduate scholarship nominated and assessed through SYSU.",
  }),
  scholarship("sysu-bilateral-scholarship-2026", {
    slug: "official-2026-sysu-bilateral-scholarship", title: "SYSU 2026 Chinese Government Scholarship - Bilateral Program", type: "government", typeLabel: "Chinese Government Scholarship - Bilateral", providerNameEn: "China Scholarship Council / home-country dispatching authority", fundingLevel: "Full",
    coverage: "Tuition, accommodation, living expenses and comprehensive medical insurance", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Eligible SYSU degree programs available through the applicant's bilateral route", amountText: "Full scholarship; specific standards follow the CSC award notice",
    deadlineLabel: "Invitation-letter rounds: January 12 and February 12, 2026; final CSC deadline must be confirmed with the home-country dispatching authority", applicationRound: "2026 bilateral intake", benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living expenses", "Amount follows CSC standards"), benefit("Medical insurance")],
    eligibilityItems: [info("Non-Chinese citizen in good health"), info("Undergraduate", "High-school diploma and generally under 25"), info("Master", "Bachelor's degree and generally under 35"), info("Doctoral", "Master's degree and generally under 40"), info("Undergraduate CSCA", "Score report required")], applicationMaterials: [info("Dispatching-authority recommendation"), info("CSC Type A application form"), ...commonDegreeMaterials], applicationSteps: [info("Step 1", "Apply through the home-country dispatching authority"), info("Step 2", "Request a SYSU invitation letter if required"), info("Step 3", "Complete the CSC Type A and SYSU applications")], summary: "Government-to-government full scholarship whose final deadline is controlled by the home-country dispatching authority.",
  }),
  scholarship("sysu-china-studies-phd-fellowship-2026", {
    slug: "official-2026-sysu-china-studies-phd-fellowship", title: "SYSU 2026 China Studies Program Ph.D. Fellowships", type: "government", typeLabel: "China Studies Program", providerNameEn: "Center for Language Education and Cooperation / Sun Yat-sen University", fundingLevel: "Full",
    coverage: "Tuition, living expenses and international travel, with possible priority access to additional research funding", applicableDegree: "Joint Research Ph.D., Doctoral", applicableProgram: "China-related humanities and social-science research conducted in Chinese", amountText: "Full fellowship; amounts are subject to the final CLEC announcement",
    deadlineDate: "2026-02-28", deadlineLabel: "February 28, 2026", applicationRound: "2026 intake", benefitItems: [benefit("Tuition"), benefit("Living expenses", "Amount follows CLEC standards"), benefit("International travel"), benefit("Additional research funding", "Priority opportunity")],
    eligibilityItems: [info("Research area", "Humanities or social sciences related to China; research must be conducted in Chinese"), info("Ph.D. in China", "Master's degree holder or current master's graduate"), info("Joint Research Ph.D.", "Registered doctoral student at a recognized foreign university"), info("Chinese", "HSK Level 5 score 180 or above for the degree route")], applicationMaterials: [...commonDegreeMaterials, info("Research proposal"), info("Two academic recommendation letters")], applicationSteps: [info("Step 1", "Apply in the CLEC China Studies Program system"), info("Step 2", "Complete the matching SYSU application and pay the RMB 400 fee"), info("Step 3", "Complete SYSU and CLEC review")], summary: "Two full fellowship routes for overseas China-studies doctoral candidates and master's graduates.",
  }),
  scholarship("sysu-youth-of-excellence-scholarship-2026", {
    slug: "official-2026-sysu-youth-of-excellence-scholarship", title: "SYSU 2026 Youth of Excellence Scheme of China Program", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerNameEn: "China Scholarship Council / Sun Yat-sen University", fundingLevel: "Full",
    coverage: "Full scholarship for one funded year; detailed standards follow the CSC announcement", applicableDegree: "Master", applicableProgram: "English-taught Master of International Business Administration, two-year 1+1 mode", amountText: "Full scholarship for one year; the SYSU notice does not itemize the monetary amount",
    deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "2026 intake", benefitItems: [benefit("Full scholarship", "One funded year; itemized amount not published by SYSU")],
    eligibilityItems: [info("Non-Chinese citizen in good health and under 45"), info("Bachelor's degree or higher"), info("Work experience", "At least three years"), info("Professional profile", "Eligible government, enterprise, university/research or international-organization role"), info("Pre-admission letter", "Required")], applicationMaterials: [...commonDegreeMaterials, info("Employment and work-experience evidence"), info("Pre-admission letter")], applicationSteps: [info("Step 1", "Apply to SYSU for the Youth of Excellence IMBA route"), info("Step 2", "Complete SYSU assessment and obtain pre-admission"), info("Step 3", "Complete the CSC Type A application")], summary: "Leadership-focused English IMBA scholarship using one year at SYSU and thesis work in the home country during year two.",
  }),
  scholarship("sysu-international-students-scholarship-2026", {
    slug: "official-2026-sysu-international-students-scholarship", title: "SYSU 2026 Scholarship for International Students", type: "university", typeLabel: "SYSU Scholarship", providerNameEn: "Sun Yat-sen University", fundingLevel: "First, second or third class",
    coverage: "First class: tuition waiver plus degree-level living allowance; second class: tuition waiver; third class: 50% tuition waiver", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "All 2026 international degree programs except MPA and MBA", amountText: "First class: undergraduate RMB 30,000/year, master RMB 36,000/year, doctoral RMB 42,000/year; second class tuition waiver; third class 50% tuition waiver",
    deadlineDate: "2026-04-30", deadlineLabel: "Undergraduate rounds: January 1-February 28 and March 1-April 30; graduate rounds: January 1-February 15 and February 16-April 30, 2026", applicationRound: "2026 degree intake",
    benefitItems: [benefit("First class", "Tuition waiver plus RMB 30,000/36,000/42,000 annual living allowance by degree"), benefit("Second class", "Tuition waiver"), benefit("Third class", "50% tuition waiver")],
    eligibilityItems: [info("Meet the relevant 2026 SYSU degree-admission requirements"), info("Outstanding academic performance"), info("Age", "Undergraduate under 25; master under 35; doctoral under 40"), info("Recommendation", "Recognized agency or SYSU international-student recruitment ambassador"), info("No concurrent listed government, CLEC or MOFCOM scholarship")], applicationMaterials: [...commonDegreeMaterials, info("Recognized agency or ambassador recommendation letter")], applicationSteps: [info("Step 1", "Complete the applicable 2026 SYSU degree application"), info("Step 2", "Select the SYSU Scholarship in the application system"), info("Step 3", "Complete qualification review and interview")], summary: "Three-tier university award covering all eligible 2026 degree programs except MPA and MBA.",
  }),
];

const guide = evidence.get("sysu-undergraduate-guide-2026")!;
const guangdongScholarship: CatalogSeedScholarship = {
  ...scholarship("sysu-international-students-scholarship-2026", {
    slug: "official-2026-sysu-guangdong-government-outstanding-international-student-scholarship", title: "SYSU 2026 Guangdong Government Outstanding International Student Scholarship", type: "local-government", typeLabel: "Guangdong Government Scholarship", providerNameEn: "Guangdong Provincial Government / Sun Yat-sen University", fundingLevel: "One-time award",
    coverage: "One-time degree-level award after enrollment and university evaluation", applicableDegree: "Undergraduate, Master, Doctoral", applicableProgram: "Newly admitted, enrolled non-government-scholarship students selected by SYSU", amountText: "Undergraduate RMB 10,000; master RMB 20,000; doctoral RMB 30,000, one-time",
    deadlineLabel: "No separate applicant deadline; SYSU selects eligible enrolled students", applicationRound: "2026 intake", benefitItems: [benefit("Undergraduate", "RMB 10,000 one-time"), benefit("Master", "RMB 20,000 one-time"), benefit("Doctoral", "RMB 30,000 one-time")], eligibilityItems: [info("Newly admitted and enrolled at SYSU"), info("Not receiving a government scholarship"), info("Selection", "Comprehensive evaluation of academic performance")], applicationMaterials: [info("No separate materials published; selection is made by SYSU after enrollment")], applicationSteps: [info("Step 1", "Enroll in an eligible SYSU degree program"), info("Step 2", "SYSU evaluates and recommends outstanding non-government-scholarship students")], summary: "One-time provincial award selected by SYSU after enrollment.",
  }),
  sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt,
  sourceFieldLineage: { title: "2026 undergraduate/master/doctoral guide scholarship table", fundingLevel: "guide scholarship table", coverage: "guide scholarship table", amountText: "degree-specific guide scholarship tables", applicableDegree: "degree-specific guide scholarship tables", eligibilityItems: "guide scholarship notes", applicationMaterials: "guide states university selection after enrollment", applicationSteps: "guide scholarship notes" },
};
scholarships.push(guangdongScholarship);

const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt,
  cities: [
    { slug: "guangzhou", nameEn: "Guangzhou", nameZh: "广州", region: "South China", province: "Guangdong", status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt, sourceFieldLineage: { nameEn: "official campus descriptions", province: "official university location" } },
    { slug: "zhuhai", nameEn: "Zhuhai", nameZh: "珠海", region: "South China", province: "Guangdong", status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt, sourceFieldLineage: { nameEn: "official campus descriptions", province: "official university location" } },
    { slug: "shenzhen", nameEn: "Shenzhen", nameZh: "深圳", region: "South China", province: "Guangdong", status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt, sourceFieldLineage: { nameEn: "official campus descriptions", province: "official university location" } },
  ],
  schools: [{
    slug: schoolSlug, nameEn: "Sun Yat-sen University", nameZh: "中山大学", citySlug: "guangzhou", schoolType: "public", region: "Guangzhou, Zhuhai and Shenzhen, Guangdong, South China",
    applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese and English depending on program",
    languageRequirement: "Chinese-taught routes use the published HSK threshold; English-taught graduate routes require TOEFL iBT 79 with 15 per section or IELTS Academic 6.5 with 5.5 per component, subject to published exemptions.",
    hskRequirement: "Undergraduate generally HSK 5 score 180; Chinese Language HSK 4 score 180. Chinese-taught master and doctoral programs require HSK 5 score 180, with MTCSOL requiring HSK 5 score 210 and HSKK Intermediate 60.",
    englishRequirement: "English-taught master and doctoral: TOEFL iBT 79 with at least 15 in each section, or IELTS Academic 6.5 with at least 5.5 in each component; published exemptions may apply.",
    deadlineSummary: "2026 undergraduate: January 1-February 28 and March 1-April 30. Master and doctoral: January 1-February 15 and February 16-April 30. Scholarship deadlines vary by route.",
    tuitionSummary: "Undergraduate RMB 26,000-48,000/year; master RMB 30,000 humanities, RMB 39,000 science/engineering/agriculture, RMB 55,000 medicine, IMBA RMB 109,000/year; doctoral RMB 34,000 humanities, RMB 44,200 science/engineering/agriculture, RMB 65,000 medicine.",
    applicationFee: "RMB 400", websiteUrl: "https://www.sysu.edu.cn/", admissionsUrl: guide.url, cscaRequired: true,
    cscaRequirement: "All applicants for Chinese-taught undergraduate programs must choose Chinese as the CSCA examination language. Required subjects are published per program and include Humanities or STEM Chinese, Mathematics, and for relevant disciplines Physics and/or Chemistry.",
    cscaSubjects: ["Humanities Chinese", "STEM Chinese", "Mathematics", "Physics", "Chemistry"],
    subjectTags: [...new Set(programs.map(program => program.subjectArea).filter(Boolean))] as string[], languageTags: ["Chinese", "English"], tuitionBandLabel: "RMB 26,000-65,000/year for standard routes; IMBA and targeted programs differ",
    campusHighlights: ["67 official undergraduate routes", "364 official master's major-field routes", "297 official doctoral major-field routes", "Campuses in Guangzhou, Zhuhai and Shenzhen", "Ten independently structured scholarship routes"],
    status: "draft", sourceUrl: guide.url, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt,
    sourceFieldLineage: { nameEn: "official 2026 admissions guide", citySlug: "official campus description", applicationLevel: "three official 2026 degree guides", languageRequirement: "degree-guide language sections", deadlineSummary: "degree-guide application-time sections", tuitionSummary: "degree-guide tuition tables", applicationFee: "degree-guide fee section", admissionsUrl: "registered official undergraduate guide", cscaRequirement: "2026 undergraduate program catalog CSCA columns and notes" },
  }],
  programs,
  programIntakes: programs.map(program => {
    const special = program.slug === cambodiaProgram.slug;
    const graduate = program.degreeLevel !== "Undergraduate";
    const source = special ? cambodiaSource : evidence.get(graduate ? program.degreeLevel === "Master" ? "sysu-master-guide-2026" : "sysu-doctoral-guide-2026" : "sysu-undergraduate-guide-2026")!;
    return { programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: special ? "2026-08-10T15:59:59.000Z" : "2026-04-30T15:59:59.000Z", deadlineLabel: special ? "Nomination deadline August 10, 2026; document submission August 11, 2026" : graduate ? "Final 2026 graduate application deadline: April 30, 2026" : "Final 2026 undergraduate application deadline: April 30, 2026", applicationRound: special ? "2026 Cambodia targeted intake" : graduate ? "January 1-February 15 and February 16-April 30, 2026" : "January 1-February 28 and March 1-April 30, 2026", status: "closed" as const, sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt, sourceFieldLineage: { deadlineDate: special ? "official targeted-program deadline section" : "official degree guide application-time section" } };
  }),
  scholarships,
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`SYSU candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: manifest.generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: programs.length, undergraduateRouteCount: 67, masterRouteCount: 365, doctoralRouteCount: 297, scholarshipCount: scholarships.length, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...evidence.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })),
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch creates only new public institutional records and does not archive or overwrite an existing Sun Yat-sen University record." },
  reconciliation: { existingSchoolCount: 0, existingProgramCount: 0, existingScholarshipCount: 0, legacyProgramAliasesToArchive: [], legacyScholarshipAliasesToArchive: [], destructiveDeletion: false },
  unresolvedFields: [
    "Program rows preserve the official English wording, including source spelling and capitalization inconsistencies.",
    "The master's and doctoral catalogs enumerate major-field routes; multiple fields under one major are deliberately represented as separate searchable routes.",
    "The Silk Road notice publishes a May 17 SYSU invitation-letter deadline but does not state one universal final CSC deadline.",
    "The Bilateral Program final deadline is controlled by each home-country dispatching authority.",
    "The Cambodia aerospace notice is classified as a program, not a scholarship, because it explicitly excludes participants from the university scholarship scheme.",
  ],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and official evidence snapshots", note: "Only public institutional, program, admissions and scholarship information is included. Supervisor names and public staff contact details in the source PDFs were deliberately excluded. No applicant, account, passport, payment or private-contact data is present." },
  reviewNotes: [
    "The candidate contains 729 program routes: 67 undergraduate, 365 master's including the Cambodia targeted program, and 297 doctoral.",
    "Ten scholarships are represented as independent rich records with coverage, eligibility, materials, steps, deadlines and source lineage.",
    "No combined scholarship placeholder is created, and no non-scholarship admissions notice is published as an award.",
    "No existing record is archived, renamed or overwritten by this batch.",
  ],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const review = { ...reviewBase, reviewHash, publicationReference: `standing-user-default-publication:${reviewHash}` };
await Promise.all([
  writeFile(candidatePath, candidateText),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, schoolCount: 1, programRouteCount: programs.length, scholarshipCount: scholarships.length, candidateSha256, reviewHash, candidatePath, validationPath, reviewPath }, null, 2));
