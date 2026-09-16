import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

type Snapshot = { id: string; label: string; url: string; finalUrl: string; status: number; contentType: string; sha256: string; fetchedAt: string };
type Route = { degree: "Undergraduate" | "Master" | "Doctoral"; schoolZh: string; schoolEn: string; nameZh: string; nameEn: string; teachingLanguage: string; durationYears: number; cscaRequirement: string | null; researchFieldsZh: string[]; researchFieldsEn: string[]; notesZh: string[]; notesEn: string[]; sourceWorkbook: string; sourceSheet: string };

const root = process.cwd();
const guidesManifestPath = resolve(root, "work/catalog-official/csu-guides-2026/manifest.json");
const scholarshipsManifestPath = resolve(root, "work/catalog-official/csu-scholarships-2026/manifest.json");
const registryPath = resolve(root, "catalog-sources/official-sources.json");
const routesPath = resolve(root, "work/catalog-official/csu-complete-batch-01/manual/program-routes.json");
const manualDir = resolve(root, "work/catalog-official/csu-complete-batch-01/manual");
const candidatePath = resolve(root, "seeds/catalog.csu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.csu-complete-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.csu-complete-batch-01.review.json");
const schoolSlug = "central-south-university";
const citySlug = "changsha";
const applicationUrl = "https://csu.17gz.org/";

const expectedSnapshots: Record<string, string> = {
  "csu-chinese-undergraduate-guide-2026": "1b6bfff7b6fec1866c2aa1192af4a9fd99b04bb3d7f0ab505ab472360bc6f28b",
  "csu-english-undergraduate-guide-2026": "9d3b7ead5f216c50c6785ff3ff379c29f91f26ca057c08b6c441b3fcb18b2ccd",
  "csu-graduate-guide-2026": "477105520eda6c206b73ee3e926647796c8b8ce0913ee3aab9dc0438bf469ea7",
  "csu-international-student-scholarship-2026": "efac394feb8c9d4216deb1de73dc46098be1401b623216303040e6ab84909d88",
  "csu-silk-road-scholarship-2026": "6d418f8164c14d5d23fb69e18bbd1467a2c9392ced8b43fc6df98dd1784761e2",
  "csu-bilateral-scholarship-2026": "0728c651514ac3f6f97a5dcb452c3e8bdc42fee4032795aeff8faea0650eec22",
  "csu-youth-excellence-scholarship-2026": "7e3c725771fce1a615b010ba43f70caddc82e8b58003b7327aac0f5990570ccd",
  "csu-high-level-graduate-scholarship-2026": "c83be4fe9324892c2f82a472ed8e75041a3d8916d1aef4ab65680e8e4bccfcb5",
  "csu-international-chinese-language-teachers-scholarship-2026": "c821ce3e44fa348015eb3200e3ae18175b355287e5197537d9b0f7355ace08df",
  "csu-china-link-scholarship-2026": "c1139f7b8dbe033c5d5f4a13fbd3d2cf5bafea293f7bd88ca29c4fae6611f5d9",
};
const expectedManual: Record<string, string> = {
  "csu-chinese-undergraduate-programs-2026.xlsx": "a0e72fcd0cae22ac4ca67658a470b877333aba7a45242acf2682bbcf9cbc7ee8",
  "csu-english-undergraduate-programs-2026.xlsx": "72e5830c78f875cf81236f981fe7a3d20a7c3bb03d59548da45cc3403e4d3717",
  "csu-graduate-programs-2026.xlsx": "a83d3d86ca3c9324ed31b1c73c651297b47078e9159413784d38b1961017d979",
  "csu-charging-standards-2026.pdf": "fb4df8d56508f3631e424d12519c8927171910566eca6d11c3364b4b24b48a09",
};
const shaFile = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");

const [guideManifest, scholarshipManifest, registry, routeData] = await Promise.all([
  readFile(guidesManifestPath, "utf8").then(JSON.parse),
  readFile(scholarshipsManifestPath, "utf8").then(JSON.parse),
  readFile(registryPath, "utf8").then(JSON.parse),
  readFile(routesPath, "utf8").then(JSON.parse),
]);
const snapshotById = new Map<string, Snapshot>();
for (const source of [...guideManifest.sources, ...scholarshipManifest.sources]) snapshotById.set(source.id, source);
for (const [id, hash] of Object.entries(expectedSnapshots)) {
  const source = snapshotById.get(id);
  if (!source || source.sha256 !== hash || source.status !== 200 || source.contentType !== "text/html" || source.url !== source.finalUrl) throw new Error(`Official snapshot mismatch: ${id}`);
}
const registryById = new Map<string, any>(registry.sources.map((source: any) => [source.id, source]));
const manualIds: Record<string, string> = {
  "csu-chinese-undergraduate-programs-2026.xlsx": "csu-chinese-undergraduate-programs-2026",
  "csu-english-undergraduate-programs-2026.xlsx": "csu-english-undergraduate-programs-2026",
  "csu-graduate-programs-2026.xlsx": "csu-graduate-programs-2026",
  "csu-charging-standards-2026.pdf": "csu-chinese-undergraduate-fees-2026",
};
const manualEvidence = new Map<string, any>();
for (const [name, hash] of Object.entries(expectedManual)) {
  const path = resolve(manualDir, name);
  if (await shaFile(path) !== hash) throw new Error(`Official manual attachment mismatch: ${name}`);
  const source = registryById.get(manualIds[name]);
  if (!source?.url?.startsWith("https://intl.csu.edu.cn/")) throw new Error(`Missing registered official attachment URL: ${name}`);
  manualEvidence.set(name, { name, sha256: hash, sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, capturedAt: (await stat(path)).mtime.toISOString() });
}
const routes = routeData.routes as Route[];
const routeCounts = Object.fromEntries(["Undergraduate", "Master", "Doctoral"].map(degree => [degree, routes.filter(route => route.degree === degree).length]));
if (routes.length !== 370 || routeCounts.Undergraduate !== 84 || routeCounts.Master !== 166 || routeCounts.Doctoral !== 120) throw new Error(`Unexpected CSU route counts: ${JSON.stringify(routeCounts)}`);

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stableUndergraduate: Record<string, string> = {
  "Chinese Language and Literature": "central-south-university-chinese-language-and-literature",
  "Digital Publishing": "central-south-university-digital-publishing",
  Philosophy: "central-south-university-philosophy",
  Architecture: "central-south-university-architecture",
  "Urban and Rural Planning": "central-south-university-urban-and-rural-planning",
  "Dance Performance": "central-south-university-dance-performance",
  "Musical Performance": "central-south-university-musical-performance",
  "Art and Technology": "central-south-university-art-and-technology",
  "Business Administration": "central-south-university-business-administration",
  "Information Management and Information System": "central-south-university-information-management-and-information-system",
};
const duplicatedEnglishKeys = new Set<string>();
const englishKeyCount = new Map<string, number>();
for (const route of routes) {
  const key = `${route.degree}|${route.schoolEn}|${route.nameEn}|${route.teachingLanguage}`;
  englishKeyCount.set(key, (englishKeyCount.get(key) ?? 0) + 1);
}
for (const [key, count] of englishKeyCount) if (count > 1) duplicatedEnglishKeys.add(key);
const cscaSubjects = (text: string | null) => {
  if (!text) return [];
  const values: string[] = [];
  if (/Chinese for Humanities/i.test(text)) values.push("Chinese for Humanities");
  if (/Chinese for STEM/i.test(text)) values.push("Chinese for STEM");
  if (/Mathematics/i.test(text)) values.push("Mathematics");
  if (/Physics/i.test(text)) values.push("Physics");
  if (/Chemistry/i.test(text)) values.push("Chemistry");
  return values;
};
const sourceForRoute = (route: Route) => manualEvidence.get(route.sourceWorkbook)!;
const guideForRoute = (route: Route) => snapshotById.get(route.degree === "Undergraduate" ? (route.teachingLanguage === "English" ? "csu-english-undergraduate-guide-2026" : "csu-chinese-undergraduate-guide-2026") : "csu-graduate-guide-2026")!;
const tuitionText = (route: Route) => {
  if (route.degree === "Undergraduate" && route.teachingLanguage === "English") return "CNY 69,000/year";
  if (route.degree === "Undergraduate") return "CNY 20,000-30,000/year by published discipline category";
  if (route.degree === "Master" && route.teachingLanguage === "Chinese") return "CNY 25,000-39,000/year by published discipline category";
  if (route.degree === "Master") return "CNY 30,000-48,000/year by published discipline category";
  if (route.degree === "Doctoral" && route.teachingLanguage === "Chinese") return "CNY 32,000-49,000/year by published discipline category";
  return "CNY 37,000-55,000/year by published discipline category";
};
const usedSlugs = new Set<string>();
const programs: CatalogSeedProgram[] = routes.map((route, index) => {
  const englishKey = `${route.degree}|${route.schoolEn}|${route.nameEn}|${route.teachingLanguage}`;
  const professional = route.notesEn.some(note => /Practice-oriented/i.test(note));
  let slug = route.degree === "Undergraduate" && route.teachingLanguage === "Chinese" ? stableUndergraduate[route.nameEn] : undefined;
  slug ??= `${schoolSlug}-${route.degree.toLowerCase()}-${slugify(route.nameEn)}-${slugify(route.schoolEn)}-${slugify(route.teachingLanguage)}${duplicatedEnglishKeys.has(englishKey) ? `-${professional ? "professional" : "academic"}` : ""}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${createHash("sha1").update(`${route.nameZh}|${index}`).digest("hex").slice(0, 8)}`;
  usedSlugs.add(slug);
  const source = sourceForRoute(route); const guide = guideForRoute(route); const subjects = cscaSubjects(route.cscaRequirement);
  const details = [
    route.researchFieldsEn.length ? `Published research fields: ${route.researchFieldsEn.join("; ")}` : null,
    route.notesEn.length ? `Official notes: ${route.notesEn.join("; ")}` : null,
  ].filter(Boolean).join("\n");
  return {
    slug, schoolSlug, citySlug, nameEn: route.nameEn, nameZh: route.nameZh, degreeLevel: route.degree,
    durationYears: route.durationYears, fieldCategory: route.schoolEn, subjectArea: route.schoolEn,
    teachingLanguage: route.teachingLanguage, cscaSubjects: subjects,
    ...(route.cscaRequirement ? { cscaRequirement: `CSCA: ${route.cscaRequirement}` } : {}),
    ...(route.teachingLanguage.includes("Chinese") ? { hskRequirement: "Science and engineering: HSK 4 (260); arts, social science and medicine: HSK 5 (200). Prior Chinese-medium degree may qualify for exemption." } : {}),
    ...(route.teachingLanguage.includes("English") ? { englishRequirement: "IELTS 6.0 or TOEFL 85; published prior-English-medium/first-language exemptions may apply." } : {}),
    ...(route.degree === "Undergraduate" && route.teachingLanguage === "English" ? { tuitionAmount: 69000, tuitionCurrency: "RMB", tuitionPeriod: "year" } : {}),
    tuitionText: tuitionText(route), scholarshipText: "Separate CSU and Chinese Government Scholarship routes are available; funding is not guaranteed and final support follows the admission or award notice.",
    applicationUrl, applicationNote: details || undefined, hasScholarship: true, status: "draft",
    sourceUrl: source.sourceUrl, sourceLabel: source.sourceLabel, sourceSha256: source.sha256, capturedAt: source.capturedAt,
    sourceFieldLineage: {
      nameEn: `${route.sourceWorkbook} / ${route.sourceSheet} / Major`, nameZh: `${route.sourceWorkbook} / ${route.sourceSheet} / 专业`,
      fieldCategory: `${route.sourceWorkbook} / ${route.sourceSheet} / School`, teachingLanguage: `${route.sourceWorkbook} / ${route.sourceSheet} / Teaching Language`,
      durationYears: `${route.sourceWorkbook} / ${route.sourceSheet} / Duration`, ...(route.cscaRequirement ? { cscaSubjects: `${route.sourceWorkbook} / ${route.sourceSheet} / CSCA Test Subjects` } : {}),
      tuitionText: "Charging Standards of Central South University, pages 1-2; ranges preserve unresolved discipline-category mapping",
      applicationUrl: `${guide.id} application procedure`, ...(details ? { applicationNote: `${route.sourceWorkbook} aggregated Research Field and Note rows` } : {}),
    },
  };
});
if (programs.length !== usedSlugs.size) throw new Error("Generated CSU program slugs are not unique");
for (const [name, slug] of Object.entries(stableUndergraduate)) if (!programs.some(program => program.nameEn === name && program.slug === slug)) throw new Error(`Stable CSU slug was not preserved: ${slug}`);

const info = (label: string, body?: string) => ({ label, ...(body ? { body } : {}) });
const benefit = (label: string, note?: string) => ({ label, included: true, ...(note ? { note } : {}) });
const scholarship = (sourceId: string, data: Partial<CatalogSeedScholarship> & Pick<CatalogSeedScholarship, "slug" | "title" | "fundingLevel" | "coverage" | "applicableDegree" | "amountText">): CatalogSeedScholarship => {
  const source = snapshotById.get(sourceId)!;
  return {
    schoolSlug, providerLocation: "Changsha, Hunan, China", status: "draft", targetCountries: [], targetRegions: [],
    sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
    sourceFieldLineage: { title: "official page title", fundingLevel: "official scholarship coverage section", coverage: "official scholarship coverage section", amountText: "official scholarship coverage and stipend section", applicableDegree: "official supporting category/program section", deadlineLabel: "official application time/procedure section", eligibilityItems: "official eligibility section", applicationMaterials: "official application-materials section", applicationSteps: "official application procedure" },
    actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }, { label: "CSU international application system", url: applicationUrl, kind: "official-application" }],
    ...data,
  };
};
const commonGraduateMaterials = [info("Passport information page"), info("Highest diploma and stamped transcripts"), info("Language proficiency proof"), info("Study or research plan"), info("Two recommendation letters"), info("Physical examination record"), info("No-criminal-record certificate")];
const scholarships: CatalogSeedScholarship[] = [
  scholarship("csu-international-student-scholarship-2026", {
    slug: "official-2026-csu-international-student-scholarship", title: "Central South University 2026 Scholarship for International Students", nameZh: "中南大学2026年国际学生奖学金", type: "university", typeLabel: "University Scholarship", providerName: "中南大学", providerNameEn: "Central South University", fundingLevel: "Full or partial", coverage: "Full: tuition, on-campus accommodation and monthly stipend; partial: tuition", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible CSU 2026 graduate programs", amountText: "Full award covers tuition, on-campus accommodation and monthly stipend; partial award covers tuition. Final support follows the admission notice.", deadlineDate: "2026-05-31", deadlineLabel: "May 31, 2026", applicationRound: "2026 intake", summary: "CSU-funded graduate award with separately published full and partial tiers.", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation", "Full award"), benefit("Monthly stipend", "Full award")], eligibilityItems: [info("Excellent non-Chinese citizen in good health and without a criminal record"), info("Master applicants", "Bachelor's degree; age 18-35"), info("Doctoral applicants", "Master's degree; age 18-40"), info("Chinese-taught language", "HSK 4 score 260 for science and engineering, or HSK 5 score 200 for arts, social science and medicine"), info("English-taught language", "IELTS 6.0 or TOEFL 85")], applicationMaterials: [...commonGraduateMaterials, info("One-minute self-introduction video"), info("Statement of no other funding"), info("Supervisor acceptance letter"), info("CV and research outputs")], applicationSteps: [info("Step 1", "Apply in the CSU international student system"), info("Step 2", "Pass initial review and pay the CNY 500 fee within two weeks"), info("Step 3", "Complete the relevant school's academic review"), info("Step 4", "Check the system and email for the final result and funding in the admission notice")],
  }),
  scholarship("csu-silk-road-scholarship-2026", {
    slug: "official-2026-csu-silk-road-scholarship", title: "Central South University 2026 Chinese Government Scholarship - Silk Road Program", nameZh: "中南大学2026年中国政府奖学金丝绸之路项目", type: "government", typeLabel: "Chinese Government Scholarship - Silk Road", providerName: "国家留学基金管理委员会 / 中南大学", providerNameEn: "China Scholarship Council / Central South University", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend", applicableDegree: "Master, Doctoral", applicableProgram: "Five graduate majors published by CSU for the 2026 Silk Road route", amountText: "Master CNY 3,000/month; Doctoral CNY 3,500/month, plus tuition, accommodation and insurance", deadlineDate: "2026-05-20", deadlineLabel: "May 20, 2026", applicationRound: "2026 intake", targetCountries: ["Pakistan", "Bangladesh", "Nigeria", "Yemen", "Ethiopia", "Afghanistan", "Indonesia", "Turkmenistan", "Tanzania", "Russia"], targetRegions: ["Published Silk Road target countries"], summary: "Full CSC Silk Road graduate scholarship for CSU's published target countries and majors.", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Comprehensive medical insurance"), benefit("Master stipend", "CNY 3,000/month"), benefit("Doctoral stipend", "CNY 3,500/month")], eligibilityItems: [info("Citizen of a published target country"), info("Master applicant", "Bachelor's degree and under 35"), info("Doctoral applicant", "Master's degree and under 40"), info("Meet the selected program's academic and language requirements")], applicationMaterials: commonGraduateMaterials, applicationSteps: [info("Step 1", "Apply to CSU and select the published Silk Road route"), info("Step 2", "Complete the CSC Type B application as instructed by CSU"), info("Step 3", "Undergo CSU nomination and CSC final review")],
  }),
  scholarship("csu-bilateral-scholarship-2026", {
    slug: "official-2026-csu-bilateral-program", title: "Central South University 2026 Chinese Government Scholarship - Bilateral Program", nameZh: "中南大学2026年中国政府奖学金国别双边项目", type: "government", typeLabel: "Chinese Government Scholarship - Bilateral", providerName: "中华人民共和国教育部 / 派遣国主管部门", providerNameEn: "Ministry of Education of the PRC / home-country dispatching authority", fundingLevel: "Full or partial", coverage: "Coverage follows the bilateral agreement and CSC award result", applicableDegree: "Undergraduate, Master, Doctoral, General Scholar, Senior Scholar", applicableProgram: "Programs available to the applicant's bilateral route; CSU should be selected as first option", amountText: "Full or partial Chinese Government Scholarship; exact support follows the bilateral agreement and award notice", deadlineLabel: "Usually early January to early April; confirm the exact deadline with the home-country dispatching authority", applicationRound: "2026 bilateral intake", summary: "Government-to-government scholarship route administered through the applicant's home-country dispatching authority.", eligibilityItems: [info("Non-Chinese citizen in good health"), info("Undergraduate", "High-school graduate under 25"), info("Master", "Bachelor's degree holder under 35"), info("Doctoral", "Master's degree holder under 40"), info("General scholar", "Under 45 with high-school diploma or above"), info("Senior scholar", "Under 50 with master's degree or associate-professor rank or above")], applicationMaterials: [info("Chinese Government Scholarship application form"), ...commonGraduateMaterials, info("CSCA score report for undergraduate applicants"), info("Age-appropriate guardian documents if under 18"), info("Portfolio for music or fine-arts applicants where applicable")], applicationSteps: [info("Step 1", "Apply to the dispatching authority in the home country"), info("Step 2", "Request CSU pre-admission and select CSU as first option"), info("Step 3", "Complete the CSC online application"), info("Step 4", "Submit all documents to the dispatching authority before its deadline")],
  }),
  scholarship("csu-youth-excellence-scholarship-2026", {
    slug: "official-2026-csu-youth-of-excellence", title: "Central South University 2026 Youth of Excellence Scheme of China Program", nameZh: "中南大学2026年中国政府来华留学卓越奖学金项目", type: "government", typeLabel: "Youth of Excellence Scheme of China", providerName: "国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full", coverage: "Full Chinese Government Scholarship under the published Youth of Excellence scheme", applicableDegree: "Master", applicableProgram: "English-taught mineral and metallurgical talent, civil engineering infrastructure construction and maintenance, and traffic and transportation talent programs", amountText: "Full Chinese Government Scholarship; the CSU page does not itemize a separate stipend amount", deadlineDate: "2026-03-15", deadlineLabel: "CSU pre-admission materials: February 15, 2026 at 24:00; CSC application: March 15, 2026", applicationRound: "2026 intake", summary: "Three English-taught master's routes using CSU's published 1+1 study model.", eligibilityItems: [info("Non-Chinese citizen under 45 in good health"), info("Bachelor's degree or above and at least three years of work experience"), info("Program-related study or work background preferred"), info("Must fit one of the four professional categories published by CSC"), info("CSU pre-admission letter required")], applicationMaterials: [...commonGraduateMaterials, info("CV and employment certificate"), info("Other supporting achievements")], applicationSteps: [info("Step 1", "Send CSU pre-admission materials by February 15, 2026"), info("Step 2", "Receive the CSU pre-admission letter"), info("Step 3", "Submit the CSC Type A application using agency code 1563 by March 15, 2026"), info("Step 4", "Wait for CSC expert review")],
  }),
  scholarship("csu-high-level-graduate-scholarship-2026", {
    slug: "official-2026-csu-high-level-graduate-program", title: "Central South University 2026 Chinese Government Scholarship - High Level Graduate Student Program", nameZh: "中南大学2026年中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship - High Level Graduate", providerName: "国家留学基金管理委员会 / 中南大学", providerNameEn: "China Scholarship Council / Central South University", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend", applicableDegree: "Master, Doctoral", applicableProgram: "Eligible CSU 2026 graduate programs", amountText: "Master CNY 3,000/month; Doctoral CNY 3,500/month, plus tuition, accommodation and insurance", deadlineDate: "2026-02-15", deadlineLabel: "February 15, 2026", applicationRound: "2026 intake", summary: "Full CSC Type B graduate route nominated by CSU.", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Comprehensive medical insurance"), benefit("Master stipend", "CNY 3,000/month"), benefit("Doctoral stipend", "CNY 3,500/month")], eligibilityItems: [info("Non-Chinese citizen in good health"), info("Master applicant", "Bachelor's degree and under 35"), info("Doctoral applicant", "Master's degree and under 40"), info("Meet the selected CSU program's language and academic requirements")], applicationMaterials: commonGraduateMaterials, applicationSteps: [info("Step 1", "Complete the CSU application"), info("Step 2", "Complete the CSC Type B application using CSU's published instructions"), info("Step 3", "Undergo school assessment and CSU nomination"), info("Step 4", "Wait for CSC final review")],
  }),
  scholarship("csu-international-chinese-language-teachers-scholarship-2026", {
    slug: "official-2026-csu-international-chinese-language-teachers-scholarship", title: "Central South University 2026 International Chinese Language Teachers Scholarship", nameZh: "中南大学2026年国际中文教师奖学金", type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心 / 中南大学", providerNameEn: "Center for Language Education and Cooperation / Central South University", fundingLevel: "Full", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance", applicableDegree: "Non-degree Chinese-language study", applicableProgram: "One-academic-year or one-semester Chinese-language study", amountText: "CNY 2,500/month stipend; insurance CNY 800 for one academic year or CNY 400 for one semester, plus tuition and accommodation", deadlineDate: "2026-10-31", deadlineLabel: "September 2026 intake: May 15, 2026; March 2027 intake: October 31, 2026", applicationRound: "September 2026 or March 2027 intake", summary: "Five- or eleven-month Chinese-language scholarship route for prospective international Chinese-language teachers.", benefitItems: [benefit("Tuition"), benefit("Accommodation"), benefit("Living allowance", "CNY 2,500/month"), benefit("Medical insurance", "CNY 800/year or CNY 400/semester")], eligibilityItems: [info("Non-Chinese citizen in good physical and mental health"), info("Age", "Normally 16-35; in-service Chinese-language teachers may be under 45"), info("One academic year", "HSK 3 score 210"), info("One semester", "HSK 3 score 180 and an HSKK result")], applicationMaterials: [info("Passport information page"), info("HSK and HSKK score reports as applicable"), info("Recommendation from an eligible recommending institution"), info("In-service teacher certificate where applicable")], applicationSteps: [info("Step 1", "Apply through the official scholarship system and select CSU"), info("Step 2", "Submit CSU-required supporting documents"), info("Step 3", "Wait for CSU and scholarship-authority review")],
  }),
  scholarship("csu-china-link-scholarship-2026", {
    slug: "official-2026-csu-china-link-scholarship", title: "Central South University 2026 China Link Short-term Scientific Exchange Scholarship Program", nameZh: "中南大学2026年中国政府奖学金China Link短期科研交流项目", type: "government", typeLabel: "China Link Scholarship", providerName: "国家留学基金管理委员会 / 中南大学", providerNameEn: "China Scholarship Council / Central South University", fundingLevel: "Full", coverage: "Tuition, on-campus accommodation, comprehensive medical insurance and monthly stipend", applicableDegree: "General Scholar, Senior Scholar", applicableProgram: "One-to-twelve-month study or research in all disciplines except Chinese language", amountText: "General scholar CNY 3,000/month; senior scholar CNY 3,500/month, plus tuition, accommodation and insurance", deadlineLabel: "Submit at least three months before the intended study start; no single common deadline is published", applicationRound: "2026 short-term intake", summary: "Short-term non-degree study and research route for partner-institution participants.", benefitItems: [benefit("Tuition"), benefit("On-campus accommodation"), benefit("Comprehensive medical insurance"), benefit("General scholar stipend", "CNY 3,000/month"), benefit("Senior scholar stipend", "CNY 3,500/month")], eligibilityItems: [info("Citizen of a country other than the PRC in good health"), info("Registered full-time student or academic staff at a CSC foreign partner institution"), info("General scholar", "Undergraduate or master's student under 45"), info("Senior scholar", "Doctoral student or academic staff under 50")], applicationMaterials: [info("Passport information page"), info("Certificate of current study or employment at a CSC partner institution"), info("CSU pre-admission document"), info("Study or research plan"), info("Physical examination materials where required")], applicationSteps: [info("Step 1", "Contact an eligible CSU host and obtain pre-admission"), info("Step 2", "Submit through the home institution and CSC process"), info("Step 3", "Apply at least three months before the intended start")],
  }),
];

const generatedAt = scholarshipManifest.generatedAt;
const schoolGuide = snapshotById.get("csu-graduate-guide-2026")!;
const candidateRaw: CatalogSeedBundle = {
  version: 1, generatedAt,
  cities: [{ slug: citySlug, nameEn: "Changsha", nameZh: "长沙", region: "Central China", province: "Hunan", status: "draft", sourceUrl: schoolGuide.url, sourceLabel: schoolGuide.label, sourceSha256: schoolGuide.sha256, capturedAt: schoolGuide.fetchedAt, sourceFieldLineage: { nameEn: "official CSU location and address", province: "official CSU location and address" } }],
  schools: [{
    slug: schoolSlug, nameEn: "Central South University", nameZh: "中南大学", citySlug, schoolType: "public", region: "Changsha, Hunan, Central China", applicationLevel: "Undergraduate, Master, Doctoral", languageOfInstruction: "Chinese, English, or Chinese/English depending on program", languageRequirement: "Program-level Chinese and English requirements are recorded on each route.", hskRequirement: "Chinese-taught science and engineering: HSK 4 (260); arts, social science and medicine: HSK 5 (200). Published prior-Chinese-medium exemptions may apply.", englishRequirement: "English-taught programs: IELTS 6.0 or TOEFL 85; published first/official-language or prior-English-medium exemptions may apply.", deadlineSummary: "Self-sponsored undergraduate and graduate applications: May 31, 2026. Scholarship deadlines vary by route.", tuitionSummary: "Bachelor CNY 20,000-30,000/year in Chinese or CNY 69,000/year for the published English dual-degree routes; Master CNY 25,000-48,000/year; Doctoral CNY 32,000-55,000/year, by language and discipline category.", applicationFee: "CNY 500", websiteUrl: "https://www.csu.edu.cn/", admissionsUrl: schoolGuide.url, cscaRequired: true, cscaRequirement: "2026 undergraduate applicants must submit the CSCA subjects listed for their program; Chinese Language and Literature applicants with HSK 4 score 180 may be exempt from Chinese for Humanities.", cscaSubjects: ["Chinese for Humanities", "Chinese for STEM", "Mathematics", "Physics", "Chemistry"], subjectTags: [...new Set(routes.map(route => route.schoolEn))], languageTags: ["Chinese", "English", "Chinese/English"], tuitionBandLabel: "CNY 20,000-69,000/year", campusHighlights: ["84 undergraduate program routes", "166 master's program routes", "120 doctoral program routes", "Seven independently detailed scholarship routes"], status: "draft", sourceUrl: schoolGuide.url, sourceLabel: schoolGuide.label, sourceSha256: schoolGuide.sha256, capturedAt: schoolGuide.fetchedAt, sourceFieldLineage: { nameEn: "official CSU admissions pages", citySlug: "official CSU location", applicationLevel: "2026 undergraduate and graduate catalogs", languageRequirement: "2026 degree application guides", deadlineSummary: "2026 degree application guides", tuitionSummary: "Charging Standards of Central South University, pages 1-2", applicationFee: "Charging Standards of Central South University, page 3 and application guides", admissionsUrl: "registered official graduate admissions guide", cscaRequirement: "2026 undergraduate guides and catalogs" },
  }],
  programs,
  programIntakes: programs.map(program => ({ programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026, deadlineDate: "2026-05-31T15:59:59.000Z", deadlineLabel: "Application deadline: May 31, 2026", applicationRound: "2026 self-sponsored degree intake", status: "closed", sourceUrl: guideForRoute(routes[programs.indexOf(program)]).url, sourceLabel: guideForRoute(routes[programs.indexOf(program)]).label, sourceSha256: guideForRoute(routes[programs.indexOf(program)]).sha256, capturedAt: guideForRoute(routes[programs.indexOf(program)]).fetchedAt, sourceFieldLineage: { deadlineDate: "official 2026 degree guide Application Deadline" } })),
  scholarships,
};
const candidateText = `${JSON.stringify(candidateRaw, null, 2)}\n`;
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`CSU candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "awaiting_user_approval", generatedAt,
  scope: { schoolSlug, schoolCount: 1, programRouteCount: programs.length, undergraduateRouteCount: 84, chineseUndergraduateRouteCount: 79, englishUndergraduateRouteCount: 5, masterRouteCount: 166, doctoralRouteCount: 120, scholarshipCount: scholarships.length, existingProgramCount: 10, existingScholarshipCount: 1, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  evidence: [...snapshotById.values()].map(source => ({ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt })).concat([...manualEvidence.values()]),
  reconciliation: { stableUndergraduateSlugs: Object.values(stableUndergraduate), newProgramRoutes: programs.length - Object.values(stableUndergraduate).length, legacyProgramAliasesToArchive: [], stableScholarshipSlugs: ["official-2026-csu-international-student-scholarship"], newScholarshipRoutes: 6, legacyScholarshipAliasesToArchive: [], destructiveDeletion: false },
  unresolvedFields: ["The charging-standard PDF defines tuition by broad discipline category but the program workbooks do not map every school or major to a category; affected program records therefore publish the official range rather than an inferred exact fee.", "The CSU graduate guide mentions MOFCOM support, but no current standalone 2026 detailed application guide was found in the reviewed registered sources, so no MOFCOM scholarship record is included.", "Bilateral-program eligibility and the exact deadline depend on the applicant's home-country dispatching authority."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle and manually downloaded official attachments", note: "Only public institutional, program, fee and scholarship information is included. No applicant, account, payment, passport, private-contact or uploaded document data is present." },
  reviewNotes: ["The official attachments downloaded by the user were hash-checked and kept only in the ignored evidence workspace.", "Graduate research-field rows are aggregated into one route per degree, school, Chinese major, English major and teaching language; research fields remain visible in applicationNote.", "The corrected total is 370 routes. Five master's and two doctoral pairs share an English label but have distinct Chinese academic/professional degree names; these are preserved as separate routes.", "The existing ten Chinese undergraduate slugs and the existing CSU international-student scholarship slug are preserved.", "No catalog record is published or archived by this review command."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const approvalPhrase = `批准发布中南大学学校、项目与奖学金第一批（审核哈希 ${reviewHash}）`;
const review = { ...reviewBase, reviewHash, approvalPhrase };
await Promise.all([writeFile(candidatePath, candidateText), writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`), writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)]);
console.log(JSON.stringify({ ok: true, routeCounts, programRouteCount: programs.length, scholarshipCount: scholarships.length, candidateSha256, reviewHash, approvalPhrase, candidatePath, validationPath, reviewPath }, null, 2));
