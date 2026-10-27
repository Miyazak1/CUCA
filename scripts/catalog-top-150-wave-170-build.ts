import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type ExtractedRoute = { page: number; row: number; nameEn: string; degreeLevel: string; durationYears: number; durationText: string; schoolOrFaculty: string; teachingLanguage: string };

const root = process.cwd();
const evidenceRuns = [
  { run: "2026-10-26T10-35-21-503Z", locks: new Map([
    ["jxnu-international-home-current", "a27912fd85a13efeea9640df05fda5bdf0ebe7d635fc6ec2e6a55bc9e42f03ac"],
  ]) },
  { run: "2026-10-26T10-36-36-884Z", locks: new Map([
    ["jxnu-international-admission-brochure-pdf-2026", "5307300ebe9322279982fb2d8536353dbbabb6f3c857d296bb5dcb0673c5f768"],
    ["jxnu-international-major-catalog-pdf-current", "f2834b39363eab6b58e700eb2be16d3eacd60bcac9c17a69706dc1bae2876c23"],
    ["jxnu-international-fees-pdf-current", "f028bd126cd0850d26e645d3bd6d0e6424fbe05a0e1ca3efd2a2c57d54e36e65"],
    ["jxnu-international-scholarships-pdf-current", "ae7c8a4efcd455142aea11f078363554b44ca656f893d065929ef2e797c57473"],
  ]) },
  { run: "2026-10-26T10-39-37-332Z", locks: new Map([
    ["jxnu-international-english-bachelor-guide-page-2026", "87e529252e2c558aaebd590d5c94578871ab6ac003858b145548998faa253fad"],
    ["jxnu-cgs-high-level-graduate-page-2026-2027", "16bb1b6da197758ab6b0e41d36b88c9ef7c9bf233341cfd1a07e9a7ca1e2a118"],
  ]) },
  { run: "2026-10-26T10-40-48-719Z", locks: new Map([
    ["jxnu-international-english-bachelor-guide-pdf-2026", "1522a3385d54e2df6bbe8f1c2df527ad30c659763261d337a56320e768c7ca75"],
    ["jxnu-cgs-high-level-graduate-guide-pdf-2026-2027", "48269ba028be0f4683aacc72004654b15ea48ea7b6742eef69abe0d74336057c"],
  ]) },
  { run: "2026-10-27T03-18-26-291Z", locks: new Map([
    ["jxnu-international-chinese-language-teachers-scholarship-page-2026", "89c37024e23ec43c79fe3be51061463681b8eb636ae9a872a9b46f051a767192"],
    ["jxnu-international-chinese-language-teachers-scholarship-pdf-2026", "e1cc43259f46d13f28a850c72497a172fea34e12cf17cffa4645dc991d41aced"],
  ]) },
];

const sources = new Map<string, Source>();
for (const evidenceRun of evidenceRuns) {
  const directory = resolve(root, "work/catalog-official", evidenceRun.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const [id, expectedSha256] of evidenceRun.locks) {
    const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
    if (!source) throw new Error(`Missing locked JXNU source: ${id}`);
    const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
    if (actualSha256 !== expectedSha256) throw new Error(`JXNU evidence hash mismatch: ${id}`);
    sources.set(id, source);
  }
}

const home = sources.get("jxnu-international-home-current")!;
const guide = sources.get("jxnu-international-admission-brochure-pdf-2026")!;
const catalog = sources.get("jxnu-international-major-catalog-pdf-current")!;
const scholarshipOverview = sources.get("jxnu-international-scholarships-pdf-current")!;
const englishGuide = sources.get("jxnu-international-english-bachelor-guide-pdf-2026")!;
const iclts = sources.get("jxnu-international-chinese-language-teachers-scholarship-pdf-2026")!;
const cgs = sources.get("jxnu-cgs-high-level-graduate-guide-pdf-2026-2027")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "nanchang");
if (!city) throw new Error("Reviewed Nanchang dependency missing");

const extracted = JSON.parse(await readFile(resolve(root, "catalog-sources/jxnu-2026-programs.extracted.json"), "utf8")) as { source: { sha256: string }; counts: { total: number; duplicatesRemoved: number }; routes: ExtractedRoute[] };
if (extracted.source.sha256 !== catalog.sha256 || extracted.counts.total !== 174 || extracted.counts.duplicatesRemoved !== 6 || extracted.routes.length !== 174) {
  throw new Error("Unexpected JXNU extracted program contract");
}

const school = {
  slug: "jiangxi-normal-university",
  nameEn: "Jiangxi Normal University",
  nameZh: "江西师范大学",
  citySlug: "nanchang",
  schoolType: "Public comprehensive normal university",
  region: "Nanchang, Jiangxi, East China",
  applicationLevel: "The latest complete general international applicant brochure and major catalog are for the closed Fall 2026 cycle. The 2026 International Chinese Language Teachers Scholarship guide explicitly publishes one-semester study beginning in March 2027, but no general 2027 degree-admission guide is published.",
  languageOfInstruction: "Chinese for the general catalog, except three explicitly English-taught bachelor routes: Business Administration, International Economics and Trade, and Computer Science and Technology.",
  languageRequirement: "Closed 2026 general cycle: HSK 4 score 180 for science, engineering, economics, law, management, education and arts; HSK 6 score 180 for literature, history and philosophy. The three English bachelor routes require TOEFL iBT 80, IELTS 6.0, Duolingo 95, or prior English-medium study.",
  englishRequirement: "Program-specific 2026 English bachelor guide: TOEFL iBT 80, IELTS 6.0, Duolingo 95, or prior English-medium study. The general brochure says Duolingo 100; the lower program-specific threshold is retained only on the three named routes and the conflict is disclosed.",
  deadlineSummary: "No general 2027 degree deadline is published. The closed Fall 2026 general deadline was May 30, 2026. The language-teacher scholarship guide explicitly includes March 2027 one-semester entry but publishes no Spring 2027 deadline.",
  tuitionSummary: "Official 2026 annual tuition bands: doctoral CNY 22,000-33,000; master CNY 18,000-27,000; Chinese-taught bachelor CNY 14,000-21,000; English-taught bachelor CNY 8,000/year in years 1-2 and CNY 16,000/year in years 3-4; general scholar CNY 14,000/year or CNY 7,000/semester.",
  applicationFee: "CNY 400 registration fee in the official 2026 fee schedule",
  websiteUrl: home.finalUrl ?? home.url,
  admissionsUrl: guide.finalUrl ?? guide.url,
  cscaRequired: true,
  cscaRequirement: "Closed 2026 general brochure requires an undergraduate CSCA Mathematics transcript.",
  cscaSubjects: ["Mathematics"],
  subjectTags: ["Teacher Education", "Humanities", "Business", "Artificial Intelligence", "Science", "Engineering", "Arts"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "2026 tuition: CNY 8,000-33,000/year by route and year",
  campusHighlights: ["Public comprehensive normal university in Nanchang", "Official current catalog covers bachelor, master, doctoral and general-scholar study", "Specific scholarship guide confirms March 2027 one-semester language study"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: iclts.fetchedAt,
  ...sourceFields(guide),
  sourceFieldLineage: {
    nameEn: "official international admissions materials",
    nameZh: "official university identity",
    citySlug: "official address plus reviewed Nanchang dependency",
    schoolType: "official profile plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official 2026 general brochure, current catalog and explicit March 2027 language-scholarship route",
    languageOfInstruction: "official current catalog and program-specific English bachelor guide",
    languageRequirement: "official 2026 general brochure and program-specific English bachelor guide",
    englishRequirement: "program-specific guide with preserved conflict against general brochure",
    deadlineSummary: "official closed 2026 general deadline and explicit unresolved Spring 2027 deadline",
    tuitionSummary: "official 2026 tuition and fee schedule",
    applicationFee: "official 2026 tuition and fee schedule",
    websiteUrl: "official international student website",
    admissionsUrl: "official 2026 general brochure",
    cscaRequired: "official 2026 general brochure",
    cscaRequirement: "official 2026 general brochure",
    cscaSubjects: "official 2026 general brochure",
    subjectTags: "official current major catalog",
    languageTags: "official current major catalog",
    tuitionBandLabel: "official 2026 tuition and fee schedule",
    campusHighlights: "official current catalog and scholarship guide",
  },
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const tuitionText = (route: ExtractedRoute) => route.teachingLanguage === "English" && route.degreeLevel === "Bachelor"
  ? "Official 2026 English-taught bachelor tuition: CNY 8,000/year in years 1-2 and CNY 16,000/year in years 3-4."
  : route.degreeLevel === "Bachelor" ? "Official 2026 Chinese-taught bachelor tuition bands: CNY 14,000/year liberal arts; CNY 16,000/year science, engineering and management; CNY 21,000/year fine arts and physical education. The catalog does not map every route to a fee column, so no numeric amount is selected."
  : route.degreeLevel === "Master" ? "Official 2026 master tuition bands: CNY 18,000/year liberal arts; CNY 20,000/year science, engineering and management; CNY 27,000/year fine arts and physical education. The catalog does not map every route to a fee column, so no numeric amount is selected."
  : route.degreeLevel === "Doctoral" ? "Official 2026 doctoral tuition bands: CNY 22,000/year liberal arts; CNY 25,000/year science, engineering and management; CNY 33,000/year fine arts and physical education. The catalog does not map every route to a fee column, so no numeric amount is selected."
  : "Official 2026 general-scholar tuition: CNY 14,000/year or CNY 7,000/semester.";

const programs = extracted.routes.map((route) => {
  const source = route.teachingLanguage === "English" ? englishGuide : catalog;
  const suffix = `p${String(route.page).padStart(2, "0")}-r${String(route.row).padStart(2, "0")}`;
  const isBachelor = route.degreeLevel === "Bachelor";
  const isNonDegree = route.degreeLevel === "Non-degree";
  return {
    slug: `jiangxi-normal-university-${slugify(route.nameEn)}-${slugify(route.degreeLevel)}-${suffix}-2026`,
    schoolSlug: school.slug,
    citySlug: "nanchang",
    nameEn: route.nameEn,
    degreeLevel: route.degreeLevel,
    ...(isNonDegree ? { durationMonths: 6 } : { durationYears: route.durationYears }),
    fieldCategory: route.schoolOrFaculty,
    subjectArea: route.nameEn,
    teachingLanguage: route.teachingLanguage,
    ...(isBachelor ? { cscaSubjects: ["Mathematics"], cscaRequirement: "The closed 2026 general brochure requires an undergraduate CSCA Mathematics transcript." } : {}),
    ...(route.teachingLanguage === "English" ? { englishRequirement: "TOEFL iBT 80, IELTS 6.0, Duolingo 95, or prior English-medium study in the program-specific 2026 guide." } : {}),
    tuitionText: tuitionText(route),
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: `Official catalog page ${route.page}, ${route.schoolOrFaculty}; ${route.durationText}. The route is tied to the closed Fall 2026 general cycle and is not relabeled as a 2027 degree route.${isNonDegree && route.durationText === "0.5/1 year" ? " The source permits either one semester or one year; durationMonths records the minimum six-month option." : ""}`,
    hasScholarship: true,
    scholarshipText: "Official scholarship categories exist, but route-level award decisions and a general 2027 application window are not published.",
    badgeText: "Closed 2026 official route",
    displaySubjects: [route.nameEn, route.schoolOrFaculty],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "deterministic extraction from official current major catalog",
      degreeLevel: "official catalog level column",
      ...(isNonDegree ? { durationMonths: "official 0.5/1-year duration represented as the minimum six-month option" } : { durationYears: "official catalog years column" }),
      fieldCategory: "official faculty column",
      subjectArea: "official major name",
      teachingLanguage: route.teachingLanguage === "English" ? "program-specific official English bachelor guide" : "official general catalog and brochure",
      ...(isBachelor ? { cscaSubjects: "official 2026 general brochure", cscaRequirement: "official 2026 general brochure" } : {}),
      ...(route.teachingLanguage === "English" ? { englishRequirement: "program-specific 2026 English bachelor guide" } : {}),
      tuitionText: "official 2026 tuition schedule without unsupported route-to-fee-column inference",
      applicationUrl: route.teachingLanguage === "English" ? "program-specific English bachelor guide" : "official current major catalog",
      applicationNote: "official catalog location, duration and closed-cycle limitation",
      hasScholarship: "official scholarship overview",
      scholarshipText: "official scholarship overview with explicit scope limitation",
      badgeText: "official closed-cycle label",
    },
  };
});

const springSpecs = [
  { name: "International Chinese Language Education and Chinese Studies — One Semester", requirement: "HSK 3 score 180 plus an HSKK score for International Chinese Language Education, Chinese Language and Literature, Chinese History and Chinese Philosophy study." },
  { name: "Taiji Culture — One Semester", requirement: "An HSK score is required; an HSKK score is preferred." },
];
const springPrograms = springSpecs.map((spec, index) => ({
  slug: `jiangxi-normal-university-${slugify(spec.name)}-spring-2027`,
  schoolSlug: school.slug,
  citySlug: "nanchang",
  nameEn: spec.name,
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "International Chinese Language Education",
  subjectArea: spec.name,
  teachingLanguage: "Chinese",
  hskRequirement: spec.requirement,
  tuitionText: "Tuition is covered by the 2026 International Chinese Language Teachers Scholarship for awarded students; no self-funded Spring 2027 tuition is published in this guide.",
  applicationUrl: iclts.finalUrl ?? iclts.url,
  applicationNote: "The official 2026 scholarship guide explicitly permits a March 2027 start for one-semester study of up to five months. It publishes no Spring 2027 application deadline.",
  hasScholarship: true,
  scholarshipText: "International Chinese Language Teachers Scholarship: tuition, accommodation, living allowance and comprehensive medical insurance.",
  badgeText: "Explicit Spring 2027 route; deadline not published",
  displaySubjects: [spec.name],
  displayGroup: `spring-2027-${index + 1}`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: iclts.fetchedAt,
  ...sourceFields(iclts),
  sourceFieldLineage: { nameEn: "official scholarship qualification category", degreeLevel: "official one-semester non-degree category", durationMonths: "official duration up to five months", fieldCategory: "official scholarship category", subjectArea: "official study direction", teachingLanguage: "official Chinese-language study category", hskRequirement: "official category-specific qualification", tuitionText: "official scholarship coverage with explicit self-funded limitation", applicationUrl: "official scholarship guide", applicationNote: "explicit March 2027 start and absent deadline", hasScholarship: "official scholarship guide", scholarshipText: "official coverage section", badgeText: "official cycle and unresolved deadline" },
}));
programs.push(...springPrograms);

const closedIntakes = programs.slice(0, extracted.routes.length).map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-05-30T15:59:59.000Z",
  deadlineLabel: "Closed May 30, 2026 at the end of the Beijing calendar day.",
  applicationRound: "Closed Fall 2026 general international admission",
  status: "closed" as const,
  ...sourceFields(guide),
  sourceFieldLineage: { intakeTerm: "official Fall 2026 admission brochure", intakeYear: "official 2026 brochure", deadlineDate: "official May 30 deadline converted to end of Beijing day", deadlineLabel: "official closed deadline", applicationRound: "official general international admission brochure" },
}));
const springIntakes = springPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineLabel: "The official guide confirms March 2027 entry but does not publish a Spring 2027 application deadline.",
  applicationRound: "March 2027 one-semester International Chinese Language Teachers Scholarship route",
  status: "open" as const,
  ...sourceFields(iclts),
  sourceFieldLineage: { intakeTerm: "official March 2027 start", intakeYear: "official March 2027 start", deadlineLabel: "explicit unresolved deadline", applicationRound: "official one-semester scholarship route" },
}));
const programIntakes = [...closedIntakes, ...springIntakes];

const scholarshipBase = (source: Source) => ({ schoolSlug: school.slug, providerLocation: "Nanchang, Jiangxi, China", status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt, ...sourceFields(source) });
const scholarships = [
  {
    slug: "jiangxi-normal-university-international-chinese-language-teachers-scholarship-spring-2027",
    title: "International Chinese Language Teachers Scholarship — Spring 2027 One-Semester Study",
    nameZh: "国际中文教师奖学金2027年春季一学期研修项目",
    type: "government", typeLabel: "International Chinese Language Teachers Scholarship", providerName: "中外语言交流合作中心", providerNameEn: "Center for Language Education and Cooperation", fundingLevel: "Full scholarship", coverage: "Tuition, accommodation, living allowance and comprehensive medical insurance.", applicableDegree: "One-semester non-degree study", applicableProgram: "International Chinese Language Education, Chinese studies and Taiji Culture", amountText: "Full published coverage; the guide does not itemize a Spring 2027 monthly amount.", requirementText: "Applicants must meet the route-specific HSK/HSKK requirements in the official guide. A Spring 2027 deadline is not published.", benefitItems: [{ label: "Tuition", included: true }, { label: "Accommodation", included: true }, { label: "Living allowance", included: true }, { label: "Medical insurance", included: true }], eligibilityItems: [{ label: "Start", value: "March 2027" }, { label: "Duration", value: "Up to five months" }, { label: "Deadline", value: "Not published for Spring 2027" }], applicationMaterials: [], applicationSteps: [], actionLinks: [{ label: "Official scholarship guide", url: iclts.finalUrl ?? iclts.url, kind: "official-source" }], applicationRound: "March 2027 one-semester entry; deadline not published", summary: "The official 2026 guide explicitly includes March 2027 one-semester entry and full scholarship coverage.", ...scholarshipBase(iclts),
    sourceFieldLineage: { title: "official scholarship guide", coverage: "official coverage section", applicableDegree: "official one-semester category", applicableProgram: "official qualification categories", amountText: "official coverage with absent numeric Spring 2027 amount", requirementText: "official qualifications and absent Spring deadline", benefitItems: "official coverage section", eligibilityItems: "official March 2027 start and qualifications", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", applicationRound: "official March 2027 start and explicit unresolved deadline", summary: "official scholarship guide" },
  },
  {
    slug: "jiangxi-normal-university-cgs-high-level-graduate-2026-2027", title: "Chinese Government Scholarship High-Level Graduate Program at JXNU (2026-2027)", nameZh: "2026-2027学年江西师范大学中国政府奖学金高水平研究生项目", type: "government", typeLabel: "Chinese Government Scholarship — High-Level Graduate", providerName: "中国国家留学基金管理委员会", providerNameEn: "China Scholarship Council", fundingLevel: "Full scholarship under relevant regulations", coverage: "Implemented according to the relevant Chinese Government Scholarship regulations; the guide does not enumerate amounts.", applicableDegree: "Master and Doctoral", amountText: "Not itemized in the program guide.", requirementText: "Chinese-taught graduate study; HSK 4 score 180; master's applicants under 35 with a bachelor's degree; doctoral applicants under 40 with a master's degree.", deadlineDate: "2026-03-13", deadlineLabel: "Closed March 13, 2026.", applicationRound: "Closed 2026-2027 high-level graduate scholarship application", benefitItems: [{ label: "Scholarship", included: true, note: "Full scholarship under relevant regulations" }], eligibilityItems: [{ label: "Language", value: "HSK 4 score 180" }, { label: "Agency number", value: "10414; Type B" }], applicationMaterials: [], applicationSteps: [], actionLinks: [{ label: "Official project guide", url: cgs.finalUrl ?? cgs.url, kind: "official-source" }], summary: "Closed official 2026-2027 Chinese Government Scholarship high-level graduate route.", ...scholarshipBase(cgs),
    sourceFieldLineage: { title: "official project guide", coverage: "official guide's reference to relevant regulations", applicableDegree: "official project scope", amountText: "explicitly not itemized", requirementText: "official application conditions", deadlineDate: "official deadline converted to end of Beijing day", deadlineLabel: "official closed deadline", applicationRound: "official 2026-2027 project", benefitItems: "official funding statement", eligibilityItems: "official language and application route", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", summary: "official closed project guide" },
  },
  {
    slug: "jiangxi-normal-university-jiangxi-provincial-government-scholarship-current", title: "Jiangxi Provincial Government Scholarship for International Students at JXNU", nameZh: "江西省政府外国留学生奖学金", type: "government", typeLabel: "Jiangxi Provincial Government Scholarship", providerName: "江西省人民政府", providerNameEn: "Jiangxi Provincial Government", fundingLevel: "Annual award", coverage: "CNY 25,000/year for doctoral or master's students; CNY 20,000/year for undergraduate students.", applicableDegree: "Bachelor, Master and Doctoral", amountText: "Doctoral/Master CNY 25,000/year; Bachelor CNY 20,000/year.", requirementText: "Available only to self-funded students after enrollment and after tuition and fees have been paid in full.", deadlineLabel: "Current overview states October 15 without a cycle year.", applicationRound: "After-enrollment application; October 15 deadline without a published cycle year", benefitItems: [{ label: "Doctoral/Master", included: true, note: "CNY 25,000/year" }, { label: "Bachelor", included: true, note: "CNY 20,000/year" }], eligibilityItems: [{ label: "Applicant type", value: "Self-funded enrolled students after full tuition payment" }], applicationMaterials: [], applicationSteps: [], actionLinks: [{ label: "Official scholarship overview", url: scholarshipOverview.finalUrl ?? scholarshipOverview.url, kind: "official-source" }], summary: "Current official overview; no 2027 application cycle is inferred.", ...scholarshipBase(scholarshipOverview),
    sourceFieldLineage: { title: "official current scholarship overview", coverage: "official award table", applicableDegree: "official award table", amountText: "official award table", requirementText: "official notes column", deadlineLabel: "official month/day without inferred year", applicationRound: "official after-enrollment route with unresolved cycle", benefitItems: "official award table", eligibilityItems: "official notes column", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", summary: "official current overview with no-inference rule" },
  },
  {
    slug: "jiangxi-normal-university-scholarship-for-international-students-current", title: "Jiangxi Normal University Scholarship for International Students", nameZh: "江西师范大学来华留学生奖学金", type: "university", typeLabel: "Jiangxi Normal University Scholarship", providerName: "江西师范大学", providerNameEn: "Jiangxi Normal University", fundingLevel: "CNY 15,000/year", coverage: "CNY 15,000/year.", applicableDegree: "Bachelor, Master, Doctoral and language study", amountText: "CNY 15,000/year.", requirementText: "Available only to self-funded students after enrollment and after tuition and fees have been paid in full.", deadlineLabel: "Current overview states October 15 without a cycle year.", applicationRound: "After-enrollment application; October 15 deadline without a published cycle year", benefitItems: [{ label: "Annual award", included: true, note: "CNY 15,000/year" }], eligibilityItems: [{ label: "Applicant type", value: "Self-funded enrolled students after full tuition payment" }], applicationMaterials: [], applicationSteps: [], actionLinks: [{ label: "Official scholarship overview", url: scholarshipOverview.finalUrl ?? scholarshipOverview.url, kind: "official-source" }], summary: "Current official overview; no 2027 application cycle is inferred.", ...scholarshipBase(scholarshipOverview),
    sourceFieldLineage: { title: "official current scholarship overview", coverage: "official award table", applicableDegree: "official award table", amountText: "official award table", requirementText: "official notes column", deadlineLabel: "official month/day without inferred year", applicationRound: "official after-enrollment route with unresolved cycle", benefitItems: "official award table", eligibilityItems: "official notes column", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", summary: "official current overview with no-inference rule" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: iclts.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: iclts.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 126, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, explicitSpring2027Programs: springPrograms.length },
  evidence,
  extraction: { sourceSha256: extracted.source.sha256, totalRoutes: extracted.counts.total, repeatedRowsRemoved: extracted.counts.duplicatesRemoved, method: "deterministic ruled-table extraction plus rendered-page visual review" },
  unresolved: [
    "No general applicant-facing 2027 degree-admission guide, program list, tuition schedule or deadline is published. The 174 current-catalog routes and their intake rows remain explicitly tied to the closed Fall 2026 cycle.",
    "The International Chinese Language Teachers Scholarship guide explicitly permits March 2027 one-semester entry but does not publish a Spring 2027 deadline. The deadline fields remain empty.",
    "The general brochure states Duolingo 100 while the program-specific English bachelor guide states Duolingo 95. The program-specific 95 threshold is used only on the three named English bachelor routes and the conflict remains disclosed.",
    "The fee table publishes discipline bands but does not map each catalog route to a fee column. Numeric tuition is not inferred for individual general-catalog routes; only the published band text is retained.",
    "Six Mathematics and Statistics rows are repeated verbatim on catalog page 10 after appearing on page 8. The deterministic extractor removes only those six page-10 repeats. Other same-name rows are retained because the source distinguishes academic/professional directions.",
    "The Chinese Government Scholarship high-level program catalog attachment is titled as a 2025 list, so it is not imported as a 2027 program catalog.",
    "Applicant files, recipient lists, personal contacts, bank details and payment instructions are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant or recipient data is present. Personal contacts, bank details and payment instructions are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-170");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 170, candidateSha256, counts: validation.summary, explicitSpring2027Programs: springPrograms.length, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
