import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const identityPath = resolve(root, "seeds/catalog.school-identity-replacements-batch-01.draft.json");
const manifestPath = resolve(root, "work/catalog-official/nanning-city-batch-01-school/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.gxmu-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.gxmu-complete-batch-01.validation.json");
const [identityText, manifestText] = await Promise.all([readFile(identityPath, "utf8"), readFile(manifestPath, "utf8")]);
const identity = JSON.parse(identityText) as CatalogSeedBundle;
const manifest = JSON.parse(manifestText) as { generatedAt: string; sources: { id: string; label: string; url: string; sha256: string; status: number }[] };
const city = identity.cities.find((row) => row.slug === "nanning");
const school = identity.schools.find((row) => row.slug === "guangxi-medical-university");
if (!city || !school) throw new Error("Missing Nanning/GXMU identity dependencies");
const source = manifest.sources.find((row) => row.id === "nanning-gxmu-undergraduate-admission-2026" && row.status === 200);
if (!source) throw new Error("Missing successful GXMU admissions evidence");

type Definition = { slug: string; name: string; duration: number; field: string; language?: "English" };
const definitions: Definition[] = [
  { slug: "official-2026-gxmu-clinical-medicine-chinese", name: "Clinical Medicine", duration: 5, field: "Medicine" },
  { slug: "guangxi-medical-university-mbbs", name: "Clinical Medicine (MBBS in English)", duration: 6, field: "Medicine", language: "English" },
  { slug: "official-2026-gxmu-pediatrics", name: "Pediatrics", duration: 5, field: "Medicine" },
  { slug: "official-2026-gxmu-anesthesiology", name: "Anesthesiology", duration: 5, field: "Medicine" },
  { slug: "official-2026-gxmu-medical-imaging", name: "Medical Imaging", duration: 5, field: "Medicine" },
  { slug: "guangxi-medical-university-stomatology", name: "Stomatology", duration: 5, field: "Medicine" },
  { slug: "official-2026-gxmu-preventive-medicine", name: "Preventive Medicine", duration: 5, field: "Medicine" },
  { slug: "official-2026-gxmu-maternal-child-health-medicine", name: "Maternal and Child Health Medicine", duration: 5, field: "Medicine" },
  { slug: "official-2026-gxmu-medical-laboratory-science", name: "Medical Laboratory Science", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-therapeutic-recreation", name: "Therapeutic Recreation", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-medical-experimental-technology", name: "Medical Experimental Technology", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-exercise-rehabilitation", name: "Exercise Rehabilitation", duration: 4, field: "Medical Science" },
  { slug: "guangxi-medical-university-nursing", name: "Nursing", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-sanitary-inspection-quarantine", name: "Sanitary Inspection and Quarantine", duration: 4, field: "Medical Science" },
  { slug: "guangxi-medical-university-pharmacology", name: "Pharmacology", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-traditional-chinese-pharmacy", name: "Traditional Chinese Pharmacy", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-biotechnology", name: "Biotechnology", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-medical-insurance", name: "Medical Insurance", duration: 4, field: "Medical Science" },
  { slug: "official-2026-gxmu-intelligent-medical-engineering", name: "Intelligent Medical Engineering", duration: 4, field: "Engineering" },
  { slug: "guangxi-medical-university-biomedical-engineering", name: "Biomedical Engineering", duration: 4, field: "Engineering" },
  { slug: "official-2026-gxmu-medical-information-engineering", name: "Medical Information Engineering", duration: 4, field: "Engineering" },
  { slug: "official-2026-gxmu-information-management-system", name: "Information Management and Information System", duration: 4, field: "Administration" },
  { slug: "guangxi-medical-university-public-affairs-administration-direction-of-public-health-management", name: "Public Affairs Administration - Specialization in Public Health Management", duration: 4, field: "Administration" },
  { slug: "official-2026-gxmu-health-services-management", name: "Health Services and Management", duration: 4, field: "Administration" },
  { slug: "official-2026-gxmu-elderly-care-service-management", name: "Elderly Care Service Management", duration: 4, field: "Administration" },
];
if (definitions.length !== 25) throw new Error(`Unexpected GXMU catalog count: ${definitions.length}`);
const sourceBase = { status: "draft", sourceUrl: source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: manifest.generatedAt };
const programs = definitions.map((row) => {
  const language = row.language ?? "Chinese";
  const csca = language === "English" ? ["Mathematics", "Chemistry"] : ["Mathematics", "Chemistry", "Chinese (STEM)"];
  return {
    slug: row.slug,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: row.name,
    degreeLevel: "Undergraduate",
    durationYears: row.duration,
    fieldCategory: row.field,
    subjectArea: row.field,
    teachingLanguage: language,
    hskRequirement: language === "Chinese" ? "HSK Level 4: total score above 200 and each section above 60" : undefined,
    englishRequirement: language === "English" ? "IELTS above 5.5 overall with each section above 5; TOEFL iBT at least 70; TOEFL ITP at least 450; Duolingo above 90; or another English score recognized by GXMU." : undefined,
    cscaSubjects: csca,
    cscaRequirement: `CSCA required; subjects: ${csca.join(", ")}. Self-funded applicants must submit results by July 30, 2026.`,
    tuitionAmount: language === "English" ? 35000 : 28000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "academic_year",
    tuitionText: language === "English" ? "CNY 35,000 per year" : "CNY 28,000 per year",
    displayTuition: language === "English" ? "CNY 35,000/year" : "CNY 28,000/year",
    applicationUrl: "https://gxmu.at0086.cn/StuApplication/Login.aspx",
    applicationNote: "Fall 2026 applications ran from January 1 to August 15. Applicants must satisfy the published academic, language, CSCA, health, security and financial requirements.",
    displaySubjects: csca,
    displayGroup: "2026-international-undergraduate",
    displayGroupLabel: "2026 international undergraduate programs",
    ...sourceBase,
    sourceFieldLineage: {
      nameEn: "official 2026 bachelor's program catalog",
      degreeLevel: "official 2026 bachelor's program catalog",
      durationYears: "official 2026 bachelor's program catalog",
      fieldCategory: "official catalog degree grouping",
      subjectArea: "official catalog degree grouping",
      teachingLanguage: "official note: all routes except six-year MBBS are Chinese-taught",
      hskRequirement: language === "Chinese" ? "official language-score section" : undefined,
      englishRequirement: language === "English" ? "official language-score section" : undefined,
      cscaSubjects: "official CSCA materials section",
      cscaRequirement: "official CSCA materials section",
      tuitionAmount: "official fee structure",
      tuitionCurrency: "official fee structure",
      tuitionPeriod: "official fee structure",
      tuitionText: "official fee structure",
      applicationUrl: "official application portal section",
      applicationNote: "official application period and general requirements",
    },
  };
});
const programIntakes = definitions.map((row) => ({
  programSlug: row.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-08-15T00:00:00.000Z",
  deadlineLabel: "August 15, 2026 — closed",
  applicationRound: "GXMU 2026 international undergraduate admission",
  status: "closed",
  sourceUrl: source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: manifest.generatedAt,
  sourceFieldLineage: { intakeTerm: "explicit: fall term", intakeYear: "explicit: 2026 brochure", deadlineDate: "explicit: January 1 to August 15 application period", deadlineLabel: "explicit period; closed derived from capture date", applicationRound: "explicit brochure context", status: "derived: deadline predates evidence capture" },
}));
const scholarshipBase = { schoolSlug: school.slug, ...sourceBase, providerLocation: "China", targetCountries: [], targetRegions: [], actionLinks: [{ label: source.label, url: source.url, kind: "official-source" }] };
const scholarshipLineage = { title: "official financial-aid section", fundingLevel: "official financial-aid section", coverage: "official financial-aid section; unsupported amounts intentionally omitted", applicableDegree: "official program restrictions", applicableProgram: "official program restrictions", eligibilityItems: "official financial-aid requirements", applicationSteps: "official application-channel text" };
const scholarships = [
  {
    ...scholarshipBase,
    slug: "official-2026-gxmu-cgs-type-a-bilateral",
    title: "GXMU 2026 Chinese Government Scholarship — Type A Bilateral Program",
    nameZh: "广西医科大学2026年中国政府奖学金国别双边项目（A类）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type A",
    providerName: "国家留学基金管理委员会",
    providerNameEn: "China Scholarship Council",
    fundingLevel: "Subject to the bilateral CSC award",
    coverage: "Coverage follows the applicable bilateral CSC award; the GXMU brochure does not publish one universal amount",
    applicableDegree: "Undergraduate",
    applicableProgram: "Chinese-taught GXMU undergraduate programs",
    amountText: "The brochure does not publish a universal benefit amount.",
    deadlineLabel: "Usually November to February; exact deadline follows the Chinese embassy announcement",
    applicationRound: "2026 CSC Type A Bilateral Program",
    benefitItems: [{ label: "Bilateral CSC award coverage", included: true }],
    eligibilityItems: [{ label: "Program language", value: "Chinese-taught programs only" }, { label: "Preparation", value: "Applicants without Chinese foundations follow the stated preparatory route and must pass Chinese CSCA and HSK 4" }],
    applicationMaterials: [{ label: "Materials required by the embassy and CSC" }],
    applicationSteps: [{ label: "Step 1", value: "Apply through the Chinese embassy or designated authority in the applicant's country" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "GXMU's 2026 undergraduate Type A bilateral Chinese Government Scholarship route.",
    sortOrder: 10,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-gxmu-cgs-type-b-moe-guangxi",
    title: "GXMU 2026 Chinese Government Scholarship — Type B MOE-Guangxi Program",
    nameZh: "广西医科大学2026年中国政府奖学金教育部—广西项目（B类）",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B — MOE-Guangxi",
    providerName: "国家留学基金管理委员会 / 广西壮族自治区",
    providerNameEn: "China Scholarship Council / Guangxi Zhuang Autonomous Region",
    fundingLevel: "Official Type B award",
    coverage: "Coverage follows the official Type B award; the GXMU brochure does not publish fixed benefit amounts",
    applicableDegree: "Undergraduate",
    applicableProgram: "Chinese-taught GXMU undergraduate programs",
    amountText: "The brochure does not publish fixed benefit amounts.",
    deadlineLabel: "Usually December to March; exact dates follow the GXMU announcement",
    applicationRound: "2026 CSC Type B MOE-Guangxi Program",
    benefitItems: [{ label: "Official Type B award coverage", included: true }],
    eligibilityItems: [{ label: "Nationality", value: "ASEAN countries only" }, { label: "Academic requirements", value: "Chinese-taught route, CSCA Mathematics/Chemistry/STEM Chinese and HSK 4 total at least 220 with each section above 70" }],
    applicationMaterials: [{ label: "GXMU and CSC application materials" }],
    applicationSteps: [{ label: "Step 1", value: "Follow the current GXMU scholarship announcement" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "GXMU's 2026 Type B MOE-Guangxi undergraduate scholarship route for ASEAN applicants.",
    sortOrder: 20,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-gxmu-guangxi-government-full-asean",
    title: "GXMU 2026 Guangxi Government Full Scholarship for ASEAN Students",
    nameZh: "广西医科大学2026年广西政府东盟国家留学生全额奖学金",
    type: "government",
    typeLabel: "Guangxi Government Full Scholarship",
    providerName: "广西壮族自治区人民政府",
    providerNameEn: "People's Government of Guangxi Zhuang Autonomous Region",
    fundingLevel: "Full",
    coverage: "Full scholarship; the brochure does not itemize benefit amounts",
    applicableDegree: "Undergraduate",
    applicableProgram: "Chinese-taught GXMU undergraduate programs",
    amountText: "Full scholarship; fixed benefit amounts are not published in the brochure.",
    deadlineLabel: "Usually March to May; exact dates follow the GXMU announcement",
    applicationRound: "2026 Guangxi Government Full Scholarship for ASEAN Students",
    benefitItems: [{ label: "Full scholarship", included: true }],
    eligibilityItems: [{ label: "Nationality", value: "ASEAN countries only" }, { label: "Academic route", value: "Chinese-taught program; direct entry with stated CSCA and HSK scores, otherwise one preparatory year and required tests" }],
    applicationMaterials: [{ label: "Materials required by the current GXMU announcement" }],
    applicationSteps: [{ label: "Step 1", value: "Follow the current GXMU scholarship announcement" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "GXMU's 2026 full Guangxi Government undergraduate scholarship for ASEAN students.",
    sortOrder: 30,
  },
  {
    ...scholarshipBase,
    slug: "official-2026-gxmu-president-scholarship-freshmen",
    title: "GXMU 2026 President Scholarship for Freshmen",
    nameZh: "广西医科大学2026年国际学生新生校长奖学金",
    type: "university",
    typeLabel: "GXMU President Scholarship",
    providerName: "广西医科大学",
    providerNameEn: "Guangxi Medical University",
    fundingLevel: "Merit-ranked freshman award",
    coverage: "Benefit level is determined by GXMU; the brochure does not publish an amount",
    applicableDegree: "Undergraduate",
    applicableProgram: "Self-funded GXMU undergraduate programs",
    amountText: "The brochure does not publish the award amount.",
    deadlineLabel: "Automatic ranking after annual enrollment and registration",
    applicationRound: "2026 GXMU President Scholarship for Freshmen",
    benefitItems: [{ label: "University freshman merit award", included: true }],
    eligibilityItems: [{ label: "Automatic eligibility", value: "Officially admitted self-funded undergraduates who register and pay all fees are ranked by overall admission score" }],
    applicationMaterials: [{ label: "No separate application stated; admission and registration records determine automatic inclusion" }],
    applicationSteps: [{ label: "Step 1", value: "Complete admission, registration and all required fee payments" }, { label: "Step 2", value: "GXMU ranks eligible freshmen by overall admission score" }],
    sourceFieldLineage: scholarshipLineage,
    summary: "GXMU's automatically considered freshman merit scholarship for registered self-funded undergraduates.",
    sortOrder: 40,
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 25 || validation.summary.programIntakes !== 25 || validation.summary.scholarships !== 4) throw new Error(`GXMU bundle invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "Twenty-five undergraduate routes are transcribed from the official 2026 catalog; the six-year English MBBS route remains distinct from the Chinese-taught Clinical Medicine route.",
      "All Fall 2026 routes are closed at the published August 15 deadline; no 2027 intake is inferred.",
      "Six legacy program slugs are reused only where the official route is exact or a clearly identifiable current title expansion.",
      "Four financial-aid routes preserve nationality, language and application-channel restrictions without inventing unpublished benefit amounts or fixed dates.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([writeFile(candidatePath, candidateText, "utf8"), writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
