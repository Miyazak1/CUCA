import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram, type CatalogSeedScholarship } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const schoolSlug = "university-of-electronic-science-and-technology-of-china";
const paths = {
  manifest: resolve(root, "work/catalog-official/uestc-complete-batch-01/manifest.json"),
  draft: resolve(root, "seeds/catalog.uestc-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.uestc-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.uestc-complete-batch-01.review.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(await readFile(paths.manifest, "utf8"));
const source = manifest.sources?.find((row: any) => row.id === "uestc-admission-brochure-en-2026");
if (!source || source.status !== 200 || source.contentType !== "application/pdf" || source.sha256 !== "cd4ea8f64f11474c569dcd6dd9a38960ccbc8fe9ae4a606ec59d066396418d70") {
  throw new Error("Locked UESTC 2026 brochure evidence is missing or changed.");
}
const sourceMeta = { sourceUrl: source.finalUrl, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Route = { name: string; degree: "Bachelor" | "Master" | "Doctoral"; language: "Chinese" | "English"; category: string };
const undergraduate = [
  ["Electronic Information Engineering", "Engineering", true],
  ["Communication Engineering", "Engineering", false],
  ["Computer Science and Technology", "Engineering", true],
  ["Software Engineering", "Engineering", true],
  ["Mechanical Design Manufacture and Automation", "Engineering", false],
  ["Electrical Engineering and Automation", "Engineering", false],
  ["Biomedical Engineering", "Engineering", false],
  ["Renewable Energy Materials and Devices", "Engineering", false],
  ["Biologic Technology", "Science", false],
  ["Nursing", "Medicine", false],
  ["Clinical Medicine", "Medicine", false],
] as const;
const graduate = [
  ["Electronic Science and Technology", "Engineering", true, true],
  ["Information and Communication Engineering", "Engineering", true, true],
  ["Computer Science and Technology", "Engineering", true, true],
  ["Optical Engineering", "Engineering", true, true],
  ["Software Engineering", "Engineering", true, true],
  ["Biomedical Engineering", "Engineering", true, true],
  ["Mechanical Engineering", "Engineering", true, true],
  ["Instrument Science and Technology", "Engineering", true, true],
  ["Control Science and Engineering", "Engineering", true, true],
  ["Materials Science and Engineering", "Engineering", true, true],
  ["Electrical Engineering", "Engineering", true, false],
  ["Physics", "Science", true, true],
  ["Mathematics", "Science", true, false],
  ["Management Science and Engineering", "Management", false, true],
  ["Business Administration", "Management", false, true],
  ["Public Management", "Management", true, false],
  ["Foreign Language and Literature", "Art", true, true],
] as const;
const routes: Route[] = [];
for (const [name, category, english] of undergraduate) {
  routes.push({ name, degree: "Bachelor", language: "Chinese", category });
  if (english) routes.push({ name, degree: "Bachelor", language: "English", category });
}
for (const [name, category, master, doctoral] of graduate) {
  if (master) routes.push({ name, degree: "Master", language: "English", category });
  if (doctoral) routes.push({ name, degree: "Doctoral", language: "English", category });
  if (master) routes.push({ name, degree: "Master", language: "Chinese", category });
  if (doctoral) routes.push({ name, degree: "Doctoral", language: "Chinese", category });
}
if (routes.length !== 72 || routes.filter((r) => r.language === "English").length !== 32) throw new Error("UESTC route transcription count changed.");

const programs: CatalogSeedProgram[] = routes.map((route) => {
  const isBachelor = route.degree === "Bachelor";
  const isClinical = route.name === "Clinical Medicine";
  const tuition = isBachelor
    ? route.language === "English" ? 20_000 : isClinical ? 45_000 : route.name === "Nursing" ? 33_000 : 15_000
    : route.degree === "Master" ? 25_000 : 34_000;
  const page = isBachelor ? "page 2" : "page 3";
  return {
    slug: `official-2026-uestc-${route.degree.toLowerCase()}-${slugify(route.name)}-${route.language.toLowerCase()}`,
    schoolSlug,
    citySlug: "chengdu",
    nameEn: route.name,
    degreeLevel: route.degree,
    durationYears: isBachelor ? (isClinical ? 5 : 4) : route.degree === "Master" ? 2 : 4,
    fieldCategory: route.category,
    subjectArea: route.name,
    teachingLanguage: route.language,
    ...(isBachelor ? { cscaRequirement: "A valid CSCA score report is required before the UESTC application deadline. Required subjects are published per program on UESTC's official undergraduate-program page." } : { cscaRequirement: "No CSCA requirement is published for this graduate route." }),
    ...(route.language === "Chinese" ? { hskRequirement: isBachelor ? "HSK 5 score 180 or above." : "HSK 6 score 180 or above." } : { englishRequirement: "TOEFL 80, IELTS 5.5 or an accepted equivalent." }),
    tuitionAmount: tuition,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: `RMB ${tuition.toLocaleString("en-US")}/year`,
    displayTuition: `RMB ${tuition.toLocaleString("en-US")}/year`,
    scholarshipText: "The official 2026 brochure publishes ten scholarship routes with degree-level availability; detailed award terms must be confirmed on the current official notice.",
    applicationUrl: "https://admission.uestc.edu.cn/",
    applicationNote: `Official UESTC 2026 admission guidebook ${page}. The route is transcribed from the marked language/degree cells without inferring an unmarked combination.`,
    hasScholarship: true,
    badgeText: "Official 2026 route",
    displayGroup: route.degree,
    displayGroupLabel: `${route.degree} programs`,
    status: "draft",
    ...sourceMeta,
    sourceFieldLineage: {
      nameEn: `${page}, official program table, Major column`,
      degreeLevel: `${page}, official degree marker`,
      teachingLanguage: `${page}, official language marker or graduate Chinese-route note`,
      durationYears: `${page}, program introduction`,
      tuitionAmount: "page 7, Fee Structure table",
      cscaRequirement: isBachelor ? "page 2, CSCA requirement notice" : "page 3, no graduate CSCA requirement published",
      ...(route.language === "Chinese" ? { hskRequirement: `${page}, Eligibility table` } : { englishRequirement: `${page}, Eligibility table` }),
    },
  };
});
if (new Set(programs.map((row) => row.slug)).size !== programs.length) throw new Error("UESTC program slugs are not unique.");

const info = (label: string, value?: string) => ({ label, ...(value ? { value } : {}) });
const availability = [
  ["cgs-chinese-university-program", "Chinese Government Scholarship - Chinese University Program", "Master, Doctoral", "Chinese Government Scholarship (CSC)", "government"],
  ["cgs-bilateral-program", "Chinese Government Scholarship - Bilateral Program", "Bachelor, Master, Doctoral, Non-degree", "Chinese Government Scholarship (CSC)", "government"],
  ["cgs-special-programs", "Chinese Government Scholarship - EU/AUN/PIF/Great Wall Programs", "Bachelor, Master, Doctoral, Non-degree", "Chinese Government Scholarship (CSC)", "government"],
  ["youth-of-excellence", "Youth of Excellence Scheme of China", "Master", "China Scholarship Council", "government"],
  ["china-link", "China Link Scholarship Program", "Non-degree", "China Scholarship Council", "government"],
  ["chengdu-sister-city", "Chengdu Sister City Scholarship", "Bachelor, Master, Doctoral", "Chengdu Municipal Government", "government"],
  ["chengdu-belt-and-road", "Chengdu Belt and Road Initiative Scholarship", "Bachelor, Master, Doctoral", "Chengdu Municipal Government", "government"],
  ["university-scholarship", "UESTC University Scholarship", "Master, Doctoral", "University of Electronic Science and Technology of China", "university"],
  ["excellent-phd", "UESTC International Excellent PhD Program", "Doctoral", "University of Electronic Science and Technology of China", "university"],
  ["international-chinese-language-teachers", "International Chinese Language Teachers Scholarship", "Non-degree", "Center for Language Education and Cooperation", "government"],
] as const;
const scholarships: CatalogSeedScholarship[] = availability.map(([suffix, title, degree, provider, type], index) => ({
  slug: `official-2026-uestc-${suffix}`,
  schoolSlug,
  title: `UESTC 2026 ${title}`,
  type,
  typeLabel: title,
  providerNameEn: provider,
  providerLocation: "Chengdu, Sichuan, China",
  fundingLevel: "Check",
  coverage: "The official 2026 UESTC brochure confirms this scholarship route and its degree-level availability, but does not publish the benefit package on the reviewed page.",
  applicableDegree: degree,
  applicableProgram: "Eligible UESTC programs within the degree categories marked in the official 2026 brochure.",
  amountText: "Not separately published in the official 2026 UESTC brochure.",
  deadlineLabel: "Use the current official scholarship notice; no route-specific deadline is published in the reviewed brochure.",
  applicationRound: "2026 UESTC scholarship catalog",
  targetCountries: [],
  targetRegions: [],
  eligibilityItems: [info("Published scope", `${degree}; route-specific eligibility is not restated in the 2026 brochure.`)],
  applicationMaterials: [info("Route-specific materials", "Not published in the reviewed brochure; use the current official scholarship notice and UESTC application system.")],
  applicationSteps: [info("Step 1", "Confirm the current route-specific official notice and eligibility."), info("Step 2", "Submit through the official UESTC and/or sponsor system stated by that notice.")],
  actionLinks: [{ label: "Official 2026 UESTC admission brochure", url: source.finalUrl, kind: "official-source" }, { label: "UESTC international application system", url: "https://admission.uestc.edu.cn/", kind: "official-application" }],
  bodySections: [{ title: "Publication boundary", body: "CUAC publishes only the route and degree availability confirmed by the 2026 brochure. Funding amounts, detailed benefits, deadlines and eligibility are intentionally not inferred." }],
  summary: `Official 2026 UESTC scholarship route for ${degree.toLowerCase()} study; detailed terms require the current route notice.`,
  sortOrder: (index + 1) * 10,
  status: "draft",
  ...sourceMeta,
  sourceFieldLineage: { title: "page 7, Scholarships table", applicableDegree: "page 7, degree/non-degree marker columns", providerNameEn: "page 7, scholarship category and route label", coverage: "page 7 does not publish a benefit package", amountText: "page 7 does not publish award amounts", deadlineLabel: "page 7 does not publish route-specific deadlines" },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{ slug: "chengdu", nameEn: "Chengdu", nameZh: "成都", region: "西南", status: "active", sourceUrl: "https://www.cscapilot.com/zh/study-china/cities/chengdu", sourceLabel: "CSCAPilot online city catalog recovery export", sourceFieldLineage: { nameEn: "city_guides.nameEn", nameZh: "city_guides.nameZh", region: "city_guides.region" } }],
  schools: [{
    slug: schoolSlug,
    nameEn: "University of Electronic Science and Technology of China",
    nameZh: "电子科技大学",
    citySlug: "chengdu",
    schoolType: "public",
    region: "Chengdu, Sichuan, China",
    applicationLevel: "Bachelor, Master, Doctoral",
    languageOfInstruction: "Chinese and English depending on route",
    languageRequirement: "Chinese routes require HSK; English routes require TOEFL, IELTS or an accepted equivalent. Route-specific standards apply.",
    hskRequirement: "Bachelor: HSK 5 score 180+. Master and Doctoral: HSK 6 score 180+.",
    englishRequirement: "TOEFL 80, IELTS 5.5 or an accepted equivalent.",
    deadlineSummary: "2026 undergraduate applications: December 1, 2025-June 30, 2026. Graduate applications: December 1, 2025-March 1, 2026. No spring degree intake is published.",
    tuitionSummary: "Official annual tuition: Chinese-taught bachelor RMB 15,000 (Clinical Medicine RMB 45,000; Nursing RMB 33,000), English-taught bachelor RMB 20,000, master RMB 25,000, doctoral RMB 34,000.",
    applicationFee: "RMB 420",
    websiteUrl: "https://en.uestc.edu.cn/",
    admissionsUrl: "https://admission.uestc.edu.cn/",
    cscaRequired: true,
    cscaRequirement: "A valid CSCA score report is required before the 2026 undergraduate application deadline; required subjects are published per program on the official UESTC undergraduate-program page.",
    cscaSubjects: ["Route-specific subjects published by UESTC"],
    subjectTags: [...new Set(programs.map((row) => row.fieldCategory).filter(Boolean))] as string[],
    languageTags: ["Chinese", "English"],
    tuitionBandLabel: "RMB 15,000-45,000/year",
    campusHighlights: ["72 official 2026 degree-language routes", "14 undergraduate routes", "58 graduate routes", "32 English-taught routes", "10 independently listed scholarship routes"],
    status: "draft",
    ...sourceMeta,
    sourceFieldLineage: { nameEn: "cover and page 1", citySlug: "cover contact address", applicationLevel: "pages 2-3", languageRequirement: "pages 2-3 eligibility tables", deadlineSummary: "pages 2-3 application-time sections", tuitionSummary: "page 7 fee table", applicationFee: "page 7 fee table", cscaRequirement: "page 2 CSCA notice" },
  }],
  programs,
  programIntakes: programs.map((program) => ({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2026,
    deadlineDate: program.degreeLevel === "Bachelor" ? "2026-06-30T00:00:00.000Z" : "2026-03-01T00:00:00.000Z",
    deadlineLabel: program.degreeLevel === "Bachelor" ? "December 1, 2025-June 30, 2026" : "December 1, 2025-March 1, 2026",
    applicationRound: "2026 UESTC international degree intake",
    status: "closed" as const,
    ...sourceMeta,
    sourceFieldLineage: { deadlineDate: program.degreeLevel === "Bachelor" ? "page 2 Application Time" : "page 3 Application Time" },
  })),
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`UESTC candidate validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = sha(candidateText);
const legacyProgramSlugs = [
  "university-of-electronic-science-and-technology-of-china-biomedical-engineering",
  "university-of-electronic-science-and-technology-of-china-mechanical-design-manufacture-and-automation",
  "university-of-electronic-science-and-technology-of-china-urban-management",
];
const legacyScholarshipSlugs = [
  "university-of-electronic-science-and-technology-of-china",
  "university-of-electronic-science-and-technology-of-china-58",
  "university-of-electronic-science-and-technology-of-china-59",
];
const reviewBase: any = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug, cityDependencyCount: 1, schoolOverwriteCount: 1, programRouteCount: 72, bachelorRouteCount: 14, masterRouteCount: 30, doctoralRouteCount: 28, englishRouteCount: 32, programIntakeCount: 72, scholarshipRouteCount: 10, archiveProgramAliasCount: 3, archiveScholarshipAliasCount: 3 },
  candidateSha256,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  evidence: [{ sourceId: source.id, sourceUrl: source.url, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType, byteLength: source.byteLength }],
  sourceReview: { result: "pass", pdfPagesReviewed: [1, 2, 3, 7, 8], note: "The complete 12-page PDF was text-extracted; the cover, undergraduate table, graduate table, fee/scholarship table and application flow were rendered or visually checked. Duplicate page content in the PDF export was not double-counted." },
  reconciliation: { destructiveDeletion: false, schoolOverwrite: { slug: schoolSlug, previousSource: "unverified third-party source", replacementSource: "verified UESTC 2026 official brochure" }, legacyProgramAliasesToArchive: legacyProgramSlugs, legacyScholarshipAliasesToArchive: legacyScholarshipSlugs },
  sourceQualityNotes: [{ field: "Scholarship detail", finding: "The 2026 brochure confirms ten routes and degree availability but does not publish route-specific amounts, benefits, eligibility or deadlines.", decision: "Publish explicit bounded records with missing details disclosed; do not infer funding terms." }, { field: "Two existing scholarship aliases", finding: "The titles belong to Guilin University of Electronic Technology and Xidian University but are attached to UESTC.", decision: "Propose archival rather than deletion; exact user approval required." }],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, admissions and scholarship information is included. Personal contacts from the brochure cover were intentionally excluded." },
  reviewNotes: ["The three legacy programs and three legacy scholarship aliases are proposed for archival, not deletion.", "The existing unverified school metadata is replaced with the official 2026 source.", "Standing default publication does not cover overwriting or archival; exact approval is required."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `product-owner-approved-uestc-complete-batch-01-${reviewHash}` };
await Promise.all([
  writeFile(paths.draft, candidateText, { encoding: "utf8", flag: "wx" }),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, { encoding: "utf8", flag: "wx" }),
  writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, { encoding: "utf8", flag: "wx" }),
]);
console.log(JSON.stringify({ ok: true, counts: reviewBase.scope, candidateSha256, candidateBundleSha256: validation.bundleSha256, reviewHash, publicationReference: review.publicationReference, paths }, null, 2));
