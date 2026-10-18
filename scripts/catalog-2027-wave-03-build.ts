import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const releasePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-03.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-03.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-03.review.json");
const expected: Record<string, string> = {
  "sjtu-english-engineering-cluster-2027": "fc43c9f6e140b7186cdf7bf5bbeb98f186b65ea9283093fd948bf97b86fb625d",
  "cau-undergraduate-admissions-2027": "7d6dd2f2c0462394c951cd7edabc12cea2e8cc8b95a9148760fced12be12855d",
  "cau-undergraduate-program-catalog-2027": "f76aad50dd8fa5697dc0f1522145ef369a9b7c3d6286f73dbe085de3aea9e285",
  "szu-doctoral-admissions-spring-2027": "dbdd01131f51aca29bc0f21971cf22f37c6be0ea074c12ea22b7464ea02809a8",
  "szu-doctoral-program-catalog-spring-2027": "64fb6abe2e9311d84390864fe1050ffdc25b75e0ca906905e6d0d9fda9995610",
};

const cauProgramRows: Record<string, number> = {
  "china-agricultural-university-undergraduate-agronomy-agronomy-and-biotechnology-chinese": 3,
  "china-agricultural-university-undergraduate-seed-science-and-engineering-agronomy-and-biotechnology-chinese": 4,
  "china-agricultural-university-undergraduate-horticultural-science-horticulture-chinese": 5,
  "china-agricultural-university-undergraduate-landscape-architecture-horticulture-chinese": 6,
  "china-agricultural-university-undergraduate-biological-sciences-biological-sciences-chinese": 7,
  "china-agricultural-university-undergraduate-biotechnology-biological-sciences-chinese": 8,
  "china-agricultural-university-undergraduate-resource-and-environmental-science-resources-and-environmental-sciences-chinese": 9,
  "china-agricultural-university-undergraduate-applied-meteorology-resources-and-environmental-sciences-chinese": 10,
  "china-agricultural-university-undergraduate-ecology-resources-and-environmental-sciences-chinese": 11,
  "china-agricultural-university-undergraduate-environmental-engineering-resources-and-environmental-sciences-chinese": 12,
  "china-agricultural-university-undergraduate-animal-science-animal-science-and-technology-chinese": 13,
  "china-agricultural-university-undergraduate-veterinary-medicine-veterinary-medicine-chinese": 14,
  "china-agricultural-university-undergraduate-food-science-and-engineering-food-science-and-nutritional-engineering-chinese": 15,
  "china-agricultural-university-undergraduate-food-quality-and-safety-food-science-and-nutritional-engineering-chinese": 16,
  "china-agricultural-university-undergraduate-viticulture-and-oenology-food-science-and-nutritional-engineering-chinese": 17,
  "china-agricultural-university-undergraduate-food-nutrition-and-health-food-science-and-nutritional-engineering-chinese": 18,
  "china-agricultural-university-undergraduate-electronic-information-engineering-catalog-row-19-chinese": 19,
  "china-agricultural-university-undergraduate-artificial-intelligence-catalog-row-20-chinese": 20,
  "china-agricultural-university-undergraduate-computer-science-and-technology-catalog-row-21-chinese": 21,
  "china-agricultural-university-undergraduate-aquaculture-science-yantai-institute-chinese": 22,
  "china-agricultural-university-undergraduate-facility-agriculture-science-and-engineering-yantai-institute-chinese": 23,
  "china-agricultural-university-undergraduate-viticulture-and-enology-yantai-institute-chinese": 24,
  "china-agricultural-university-undergraduate-bioengineering-yantai-institute-chinese": 25,
  "china-agricultural-university-undergraduate-biomass-science-and-engineering-yantai-institute-chinese": 26,
  "china-agricultural-university-undergraduate-animal-science-yantai-institute-chinese": 27,
  "china-agricultural-university-undergraduate-winemaking-engineering-yantai-institute-chinese": 28,
  "china-agricultural-university-undergraduate-urban-and-rural-planning-yantai-institute-chinese": 29,
  "china-agricultural-university-undergraduate-turfgrass-science-and-engineering-yantai-institute-chinese": 30,
  "china-agricultural-university-undergraduate-marketing-yantai-institute-chinese": 31,
  "china-agricultural-university-undergraduate-public-affairs-management-yantai-institute-chinese": 32,
  "china-agricultural-university-undergraduate-electronic-business-yantai-institute-chinese": 33,
};

const szuProgramRows = [
  { slug: "shenzhen-university-doctoral-education-faculty-of-education-chinese", nameEn: "Education", nameZh: "教育学", code: "040100", faculty: "Faculty of Education", durationYears: 4, teachingLanguage: "Chinese", fieldCategory: "Education" },
  { slug: "shenzhen-university-doctoral-psychology-school-of-psychology-chinese", nameEn: "Psychology", nameZh: "心理学", code: "040200", faculty: "School of Psychology", durationYears: 4, teachingLanguage: "Chinese", fieldCategory: "Social Sciences" },
  { slug: "shenzhen-university-doctoral-information-and-communications-engineering-electronics-information-engineering-english", nameEn: "Information and Communications Engineering", nameZh: "信息与通信工程", code: "081000", faculty: "College of Electronics and Information Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-optomechatronics-engineering-and-application-mechatronics-control-english", nameEn: "Optomechatronics Engineering and Application", nameZh: "光机电工程与应用", code: "0803Z2", faculty: "College of Mechatronics and Control Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-intelligent-system-and-manufacturing-mechatronics-control-english", nameEn: "Intelligent System and Manufacturing", nameZh: "智能系统与智能制造", code: "0812Z2", faculty: "College of Mechatronics and Control Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-electronic-science-and-technology-integrated-circuits-english", nameEn: "Electronic Science and Technology", nameZh: "电子科学与技术", code: "080900", faculty: "School of Integrated Circuits", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-computer-science-and-technology-computer-software-english", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", code: "081200", faculty: "College of Computer Science and Software Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Computer Science" },
  { slug: "shenzhen-university-doctoral-architecture-architecture-urban-planning-english", nameEn: "Architecture", nameZh: "建筑学", code: "081300", faculty: "School of Architecture and Urban Planning", durationYears: 4, teachingLanguage: "English", fieldCategory: "Architecture" },
  { slug: "shenzhen-university-doctoral-computer-science-and-technology-artificial-intelligence-english", nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", code: "081200", faculty: "School of Artificial Intelligence", durationYears: 4, teachingLanguage: "English", fieldCategory: "Computer Science" },
  { slug: "shenzhen-university-doctoral-mathematics-mathematical-science-english", nameEn: "Mathematics", nameZh: "数学", code: "070100", faculty: "School of Mathematical Science", durationYears: 4, teachingLanguage: "English", fieldCategory: "Science" },
  { slug: "shenzhen-university-doctoral-civil-engineering-civil-transportation-english", nameEn: "Civil Engineering", nameZh: "土木工程", code: "081400", faculty: "College of Civil and Transportation Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-optical-engineering-microscale-optoelectronics-english", nameEn: "Optical Engineering", nameZh: "光学工程", code: "080300", faculty: "Institute of Microscale Optoelectronics", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-optical-engineering-physics-optoelectronics-english", nameEn: "Optical Engineering", nameZh: "光学工程", code: "080300", faculty: "College of Physics and Optoelectronic Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-doctoral-physics-physics-optoelectronics-english", nameEn: "Physics", nameZh: "物理学", code: "070200", faculty: "College of Physics and Optoelectronic Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Science" },
  { slug: "shenzhen-university-doctoral-chemistry-chemistry-environmental-engineering-english", nameEn: "Chemistry", nameZh: "化学", code: "070300", faculty: "College of Chemistry and Environmental Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Science" },
  { slug: "shenzhen-university-doctoral-management-science-and-engineering-management-english", nameEn: "Management Science and Engineering", nameZh: "管理科学与工程", code: "120100", faculty: "College of Management", durationYears: 3, teachingLanguage: "English", fieldCategory: "Management" },
  { slug: "shenzhen-university-doctoral-biology-life-sciences-oceanography-english", nameEn: "Biology", nameZh: "生物学", code: "071000", faculty: "College of Life Sciences and Oceanography", durationYears: 4, teachingLanguage: "English", fieldCategory: "Science" },
  { slug: "shenzhen-university-professional-doctoral-integrated-circuit-engineering-electronics-information-engineering-english", nameEn: "Integrated Circuit Engineering", nameZh: "集成电路工程", code: "085403", faculty: "College of Electronics and Information Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-professional-doctoral-integrated-circuit-engineering-integrated-circuits-english", nameEn: "Integrated Circuit Engineering", nameZh: "集成电路工程", code: "085403", faculty: "School of Integrated Circuits", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
  { slug: "shenzhen-university-professional-doctoral-artificial-intelligence-artificial-intelligence-english", nameEn: "Artificial Intelligence", nameZh: "人工智能", code: "085410", faculty: "School of Artificial Intelligence", durationYears: 4, teachingLanguage: "English", fieldCategory: "Computer Science" },
  { slug: "shenzhen-university-professional-doctoral-optoelectronic-information-engineering-physics-optoelectronics-english", nameEn: "Optoelectronic Information Engineering", nameZh: "光电信息工程", code: "085408", faculty: "College of Physics and Optoelectronic Engineering", durationYears: 4, teachingLanguage: "English", fieldCategory: "Engineering" },
] as const;

const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status === 200 && expected[source.id] === source.sha256) evidence.set(source.id, { ...source, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 03 evidence: ${missing.join(", ")}`);
for (const source of evidence.values()) {
  const bytes = await readFile(resolve(source.runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
}

const release = JSON.parse(await readFile(releasePath, "utf8")) as CatalogSeedBundle;
const cauCatalogSource = evidence.get("cau-undergraduate-program-catalog-2027")!;
const cauGuideSource = evidence.get("cau-undergraduate-admissions-2027")!;
const sjtuSource = evidence.get("sjtu-english-engineering-cluster-2027")!;
const szuGuideSource = evidence.get("szu-doctoral-admissions-spring-2027")!;
const szuCatalogSource = evidence.get("szu-doctoral-program-catalog-spring-2027")!;
const allPrograms = release.programs ?? [];
const cauPrograms = allPrograms.filter((program) => program.slug in cauProgramRows);
if (cauPrograms.length !== 31 || Object.keys(cauProgramRows).length !== 31) {
  throw new Error(`Expected 31 CAU 2027 undergraduate programs, found ${cauPrograms.length}.`);
}
const existingCauUndergraduate = allPrograms.filter((program) => program.schoolSlug === "china-agricultural-university" && program.degreeLevel === "Undergraduate");
if (existingCauUndergraduate.length !== 31) throw new Error(`CAU undergraduate catalog drift: expected 31 existing rows, found ${existingCauUndergraduate.length}.`);

const refreshedCauPrograms: CatalogSeedProgram[] = cauPrograms.map((program) => ({
  ...program,
  tuitionAmount: 20000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 20,000 per academic year",
  sourceUrl: cauCatalogSource.finalUrl ?? cauCatalogSource.url,
  sourceLabel: cauCatalogSource.label,
  sourceSha256: cauCatalogSource.sha256,
  capturedAt: cauCatalogSource.fetchedAt,
  sourceFieldLineage: {
    ...(program.sourceFieldLineage ?? {}),
    nameEn: `2027 undergraduate program catalog, worksheet row ${cauProgramRows[program.slug]}`,
    cscaSubjects: `2027 undergraduate program catalog, worksheet row ${cauProgramRows[program.slug]}, CSCA Required Examination Subjects`,
    tuitionAmount: "2027 undergraduate admission guide, section 10 Fees",
  },
  verificationStatus: "verified",
  lastVerifiedAt: cauGuideSource.fetchedAt,
}));

const cauIntakes: CatalogSeedProgramIntake[] = refreshedCauPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-11-01T00:00:00.000Z",
  deadlineDate: "2027-05-31T15:59:59.000Z",
  deadlineLabel: "Application period: November 1, 2026 to May 31, 2027",
  applicationRound: "2027 China Agricultural University international undergraduate admission",
  status: "open",
  sourceUrl: cauGuideSource.finalUrl ?? cauGuideSource.url,
  sourceLabel: cauGuideSource.label,
  sourceSha256: cauGuideSource.sha256,
  capturedAt: cauGuideSource.fetchedAt,
  sourceFieldLineage: {
    intakeYear: "official guide title and sections 3-4",
    openDate: "official guide section 3, Application Period",
    deadlineDate: "official guide section 3, Application Period; end-of-day Beijing time normalized to UTC",
    status: "officially published application window",
  },
}));

const sjtuExisting = allPrograms.find((program) => program.slug === "shanghai-jiao-tong-university-engineering-cluster-english");
if (!sjtuExisting) throw new Error("Missing existing SJTU English Engineering Cluster program.");
const refreshedSjtuProgram: CatalogSeedProgram = {
  ...sjtuExisting,
  cscaSubjects: ["Mathematics"],
  cscaRequirement: "CSCA Mathematics is required; conditionally selected applicants must submit the CSCA score by June 30, 2027.",
  englishRequirement: "TOEFL iBT 90 for tests before January 21, 2026 or 4.5 thereafter; IELTS 6.0; Duolingo 120; the official page lists defined exemption routes.",
  tuitionAmount: 150000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 150,000/year (subject to governing-authority record filing)",
  applicationNote: "Apply through Common App first, then complete the SJTU portal procedure after preliminary review. Application fee: USD 75, non-refundable.",
  sourceUrl: sjtuSource.finalUrl ?? sjtuSource.url,
  sourceLabel: sjtuSource.label,
  sourceSha256: sjtuSource.sha256,
  capturedAt: sjtuSource.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official page title and program scope",
    cscaSubjects: "Application Materials, Test Scores section 1.1",
    englishRequirement: "Application Materials, English language requirements section 2",
    tuitionAmount: "Fees section",
    scholarshipText: "Scholarships section",
    applicationNote: "Online Application and Fees sections",
  },
  verificationStatus: "verified",
  lastVerifiedAt: sjtuSource.fetchedAt,
};
const sjtuIntake: CatalogSeedProgramIntake = {
  programSlug: refreshedSjtuProgram.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-03-31T15:59:59.000Z",
  deadlineLabel: "Early Action: November 1, 2026; regular application deadline: March 31, 2027",
  applicationRound: "2027 SJTU Undergraduate Engineering Cluster Program in English",
  status: "open",
  sourceUrl: sjtuSource.finalUrl ?? sjtuSource.url,
  sourceLabel: sjtuSource.label,
  sourceSha256: sjtuSource.sha256,
  capturedAt: sjtuSource.fetchedAt,
  sourceFieldLineage: {
    intakeYear: "official page title",
    deadlineDate: "Application Deadlines for 2027 Admission; regular deadline normalized to end-of-day Beijing time in UTC",
    deadlineLabel: "Application Deadlines for 2027 Admission",
    status: "published 2027 application route",
  },
};

const szuPrograms: CatalogSeedProgram[] = szuProgramRows.map((row) => ({
  slug: row.slug,
  schoolSlug: "shenzhen-university",
  citySlug: "shenzhen",
  nameEn: row.nameEn,
  nameZh: row.nameZh,
  degreeLevel: "Doctoral",
  durationYears: row.durationYears,
  fieldCategory: row.fieldCategory,
  subjectArea: row.nameEn,
  teachingLanguage: row.teachingLanguage,
  hskRequirement: row.teachingLanguage === "Chinese" ? "HSK 5 with a minimum score of 180" : undefined,
  englishRequirement: row.teachingLanguage === "English" ? "English proficiency certificate; native English speakers may be exempt after university review" : undefined,
  scholarshipText: "Eligible applicants may be considered for Guangdong Government, Shenzhen Universiade, or Liyuan International scholarships under the published 2027 guide.",
  hasScholarship: true,
  applicationUrl: "https://status.szu.edu.cn/szulxs/html/vue/stuBm.html?fxq=2027-03&lxslbm=10",
  applicationNote: `Official program code ${row.code}; ${row.faculty}; March 2027 intake. Applicants must first contact a potential supervisor and obtain the required recommendation letter.`,
  status: "active",
  sourceUrl: szuCatalogSource.finalUrl ?? szuCatalogSource.url,
  sourceLabel: szuCatalogSource.label,
  sourceSha256: szuCatalogSource.sha256,
  capturedAt: szuCatalogSource.fetchedAt,
  sourceFieldLineage: {
    nameEn: `official Spring 2027 doctoral program table, code ${row.code}, ${row.faculty}`,
    nameZh: `official Spring 2027 doctoral program table, code ${row.code}, ${row.faculty}`,
    degreeLevel: "official page title and degree section",
    durationYears: `official program table, code ${row.code}, ${row.faculty}`,
    teachingLanguage: "official catalog note: starred programs are Chinese-taught; all other programs are English-taught",
    ...(row.teachingLanguage === "Chinese" ? { hskRequirement: "admission guide, Eligibility section 3" } : {}),
    ...(row.teachingLanguage === "English" ? { englishRequirement: "admission guide, Eligibility section 3" } : {}),
    scholarshipText: "admission guide, Available Scholarship Grants section",
    applicationNote: "admission guide, Application Procedure; official catalog faculty and code columns",
  },
  verificationStatus: "verified",
  lastVerifiedAt: szuGuideSource.fetchedAt,
}));
if (szuPrograms.length !== 21 || new Set(szuPrograms.map((program) => program.slug)).size !== 21) {
  throw new Error(`Expected 21 unique SZU Spring 2027 doctoral routes, found ${szuPrograms.length}.`);
}
const szuIntakes: CatalogSeedProgramIntake[] = szuPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-10T00:00:00.000Z",
  deadlineDate: "2026-11-30T15:59:59.000Z",
  deadlineLabel: "Application period: October 10 to November 30, 2026",
  applicationRound: "Shenzhen University March 2027 international doctoral intake",
  status: "open",
  sourceUrl: szuGuideSource.finalUrl ?? szuGuideSource.url,
  sourceLabel: szuGuideSource.label,
  sourceSha256: szuGuideSource.sha256,
  capturedAt: szuGuideSource.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "official page title: March 2027 intake",
    intakeYear: "official page title",
    openDate: "Application Time section",
    deadlineDate: "Application Time section; end-of-day Beijing time normalized to UTC",
    status: "published and currently open application window",
  },
}));

const programs = [...refreshedCauPrograms, refreshedSjtuProgram, ...szuPrograms].sort((left, right) => left.slug.localeCompare(right.slug));
const programIntakes = [...cauIntakes, sjtuIntake, ...szuIntakes].sort((left, right) => left.programSlug.localeCompare(right.programSlug));
const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const schoolSlugs = new Set(programs.map((program) => program.schoolSlug));
const citySlugs = new Set(programs.map((program) => program.citySlug).filter((slug): slug is string => Boolean(slug)));
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (release.cities ?? []).filter((row) => citySlugs.has(row.slug)),
  schools: (release.schools ?? []).filter((row) => schoolSlugs.has(row.slug)),
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 03 validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: { schools: 10, completedThroughWave: 7 },
  scope: {
    schoolSlugs: [...schoolSlugs].sort(),
    refreshedPrograms: programs.length,
    new2027Intakes: programIntakes.length,
    cauUndergraduatePrograms: refreshedCauPrograms.length,
    sjtuEnglishEngineeringClusterPrograms: 1,
    szuSpringDoctoralPrograms: szuPrograms.length,
  },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "CAU rows are limited to the 31 programs explicitly listed in the official 2027 workbook; graduate routes remain at 2026.",
    "The SJTU rolling program page changed from 2026 to 2027. Tuition is refreshed from RMB 120,000 to RMB 150,000 and the 2027 CSCA deadline is retained.",
    "SZU adds only the 21 doctoral routes explicitly listed for the March 2027 intake; no undergraduate or master's route is rolled forward.",
    "Nankai's 2027 undergraduate page is not imported because its program attachment requires a CAPTCHA and the page does not enumerate the 46 program names.",
    "No applicant or account data is present.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  schools: [...schoolSlugs].sort(),
  refreshedPrograms: programs.length,
  new2027Intakes: programIntakes.length,
  candidatePath,
  validationPath,
  reviewPath,
  candidateSha256,
}, null, 2));
