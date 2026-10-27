import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Master" | "Doctoral";
type Language = "Chinese" | "English" | "Chinese/English";
type ProgramSpec = { college: string; name: string; code: string; degrees: Degree[]; language: Language };

const root = process.cwd();
const run = "2026-10-26T10-14-19-227Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["fafu-university-home-current", "8ba646d94a7d1cc67452bab2732060fea5de09f52d01f1411480e10ccb33476a"],
  ["fafu-international-application-index-current", "1998ba3b537c74f65ade60b549706b31125144e9c610ab71c021ab662b9755c8"],
  ["fafu-international-application-guide-2026", "641c7b2b719b06c2cf02728af6f575a95e04a0eca1177cf140c22fb1a889ea56"],
  ["fafu-international-program-catalog-2026", "adb86c45c1da3799fdd9ec2db7cd273bdd72be0734e32d492dac34a04eef1065"],
  ["fafu-international-fees-current", "79dbe690d26fefb3dcab0f2c7059f2ccbab6a88c8f6989a6f2d2cdeb134b8cbb"],
  ["fafu-international-scholarships-current", "19c5a3a87ef6d81e2c8ce33b805e15a7e149e5c1015cc3ce6eaa1ac9a44b9dee"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked FAFU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`FAFU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const home = sources.get("fafu-university-home-current")!;
const applicationIndex = sources.get("fafu-international-application-index-current")!;
const guide = sources.get("fafu-international-application-guide-2026")!;
const catalog = sources.get("fafu-international-program-catalog-2026")!;
const fees = sources.get("fafu-international-fees-current")!;
const scholarshipPolicy = sources.get("fafu-international-scholarships-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "fuzhou");
if (!city) throw new Error("Reviewed Fuzhou dependency missing");

const school = {
  slug: "fujian-agriculture-and-forestry-university",
  nameEn: "Fujian Agriculture and Forestry University",
  nameZh: "福建农林大学",
  citySlug: "fuzhou",
  schoolType: "Public agricultural and forestry university",
  region: "Fuzhou, Fujian, East China",
  applicationLevel: "The latest complete official international applicant guide and program catalog are for the closed 2026 master and doctoral cycle. No applicant-facing 2027 international guide, route list or deadline is published on the current application index.",
  languageOfInstruction: "Chinese, English, or Chinese/English according to the official 2026 program catalog.",
  languageRequirement: "Closed 2026 cycle: HSK Level 5 for Chinese-taught programs; IELTS 6.5, TOEFL 85, or equivalent proof for English-taught programs unless English is the applicant's official-country language.",
  englishRequirement: "IELTS 6.5, TOEFL 85, or equivalent proof in the closed 2026 cycle; the guide exempts applicants from English-speaking countries for English-taught programs.",
  deadlineSummary: "No 2027 international deadline is published. The closed 2026 general deadline was April 30, 2026 Beijing time; the 2026 Chinese Government Scholarship high-level postgraduate deadline was February 15, 2026.",
  tuitionSummary: "Current official annual tuition: undergraduate CNY 20,000; master CNY 21,000; doctoral CNY 24,000. The captured 2026 international catalog contains master and doctoral routes only.",
  applicationFee: "CNY 500 or USD 80 after admission in the 2026 guide",
  websiteUrl: home.finalUrl ?? home.url,
  admissionsUrl: guide.finalUrl ?? guide.url,
  subjectTags: ["Agriculture", "Forestry", "Ecology", "Life Sciences", "Food Science", "Engineering", "Management"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Current degree tuition: CNY 20,000-24,000/year",
  campusHighlights: ["Agricultural, forestry and life-science strengths", "Official 2026 catalog publishes master and doctoral international routes", "Located in Fuzhou, Fujian"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: applicationIndex.fetchedAt,
  ...sourceFields(guide),
  sourceFieldLineage: {
    nameEn: "official English university and international application pages",
    nameZh: "official university identity",
    citySlug: "official address plus reviewed Fuzhou dependency",
    schoolType: "official profile plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "official current application index and closed 2026 guide",
    languageOfInstruction: "official 2026 program catalog",
    languageRequirement: "official 2026 eligibility requirements",
    englishRequirement: "official 2026 eligibility requirements",
    deadlineSummary: "official closed 2026 deadlines and current-index freshness check",
    tuitionSummary: "official current fee table",
    applicationFee: "official 2026 admission process",
    websiteUrl: "official university domain",
    admissionsUrl: "official international application guide",
    subjectTags: "official named program catalog",
    languageTags: "official teaching-language table",
    tuitionBandLabel: "official current fee table",
    campusHighlights: "official profile and program catalog",
  },
};

const specs: ProgramSpec[] = [
  { college: "College of Resources & Environmental Science", name: "Agricultural Resources and Environment", code: "090300", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Resources & Environmental Science", name: "Resource Utilization and Plant Protection", code: "095132", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Resources & Environmental Science", name: "Agricultural Resources and Environment", code: "090300", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Resources & Environmental Science", name: "Environmental Science & Engineering", code: "083000", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Resources & Environmental Science", name: "Resource Utilization and Plant Protection", code: "095132", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Resources & Environmental Science", name: "Resources and Environment", code: "085700", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Bee Science; College of Biomedical Sciences", name: "Biology", code: "071000", degrees: ["Doctoral"], language: "English" },
  { college: "College of Bee Science; College of Biomedical Sciences", name: "Pharmaceutical Engineering", code: "086002", degrees: ["Master"], language: "English" },
  { college: "College of Public Administration and Law", name: "Public Management", code: "120400", degrees: ["Master"], language: "Chinese" },
  { college: "College of Life Sciences", name: "Ecology", code: "071300", degrees: ["Doctoral"], language: "English" },
  { college: "College of Life Sciences", name: "Ecology", code: "071300", degrees: ["Master"], language: "English" },
  { college: "International College of Juncao Science", name: "JunCao Sciences", code: "0713J3", degrees: ["Master"], language: "English" },
  { college: "International College of Juncao Science", name: "Agronomy and Seed Industry (Prataculture Science)", code: "095131", degrees: ["Master"], language: "English" },
  { college: "College of Agriculture", name: "Crop Science", code: "090100", degrees: ["Doctoral"], language: "English" },
  { college: "College of Agriculture", name: "Crop Cultivation & Farming System", code: "090101", degrees: ["Master"], language: "English" },
  { college: "College of Agriculture", name: "Crop Genetics & Breeding", code: "090102", degrees: ["Master"], language: "English" },
  { college: "College of Plant Protection", name: "Plant Pathology", code: "090401", degrees: ["Master", "Doctoral"], language: "English" },
  { college: "College of Plant Protection", name: "Agricultural Entomology and Pest Control", code: "090402", degrees: ["Master", "Doctoral"], language: "English" },
  { college: "College of Plant Protection", name: "Pesticide Science", code: "090403", degrees: ["Master", "Doctoral"], language: "English" },
  { college: "College of Life Sciences (Haixia Institute of Science and Technology)", name: "Biology", code: "071000", degrees: ["Doctoral"], language: "English" },
  { college: "College of Transportation and Civil Engineering", name: "Civil Engineering", code: "085901", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Transportation and Civil Engineering", name: "Transportation Engineering", code: "086100", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Transportation and Civil Engineering", name: "Transportation Engineering", code: "082300", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Transportation and Civil Engineering", name: "Forest Engineering", code: "082901", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Transportation and Civil Engineering", name: "Forestry Engineering", code: "082900", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Food Science", name: "Food Science and Engineering", code: "083200", degrees: ["Doctoral"], language: "English" },
  { college: "College of Life Sciences", name: "Biology", code: "071000", degrees: ["Doctoral"], language: "English" },
  { college: "College of Life Sciences", name: "Biology", code: "071000", degrees: ["Master"], language: "English" },
  { college: "College of Economics and Management", name: "Agricultural and Forestry Economics and Management", code: "120300", degrees: ["Doctoral"], language: "English" },
  { college: "College of Economics and Management", name: "Agricultural and Forestry Economics and Management", code: "120300", degrees: ["Master"], language: "English" },
  { college: "College of Economics and Management", name: "Business Administration", code: "120200", degrees: ["Master"], language: "English" },
  { college: "College of Material Engineering", name: "Forestry Engineering", code: "082900", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Material Engineering", name: "Chemical Engineering and Technology", code: "081700", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Material Engineering", name: "Wood Science and Technology", code: "082902", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Material Engineering", name: "Forestry Chemical Processing Engineering", code: "082903", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Material Engineering", name: "Biomass Energy and Materials", code: "0829Z1", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Material Engineering", name: "Material and Chemical Industry", code: "085600", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Mechanical and Electrical Engineering", name: "Agricultural Engineering", code: "082800", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Mechanical and Electrical Engineering", name: "Agricultural Engineering", code: "082800", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Mechanical and Electrical Engineering", name: "Mechanical Engineering", code: "080200", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Animal Sciences", name: "Veterinary Science", code: "095200", degrees: ["Doctoral"], language: "Chinese" },
  { college: "College of Forestry", name: "Forest Genetics and Tree Breeding", code: "090701", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Silviculture", code: "090702", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Forest Protection", code: "090703", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Forest Management", code: "090704", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Wild Animal Plant Protection and Utilization", code: "090705", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Soil and Water Conservation and Desertification Combating", code: "090707", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Forestry", code: "095400", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Forest Genetics and Tree Breeding", code: "090701", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Silviculture", code: "090702", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Forest Protection", code: "090703", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Forest Management", code: "090704", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Wild Animal Plant Protection and Utilization", code: "090705", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Forestry", name: "Soil and Water Conservation and Desertification Combating", code: "090707", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Landscape Architecture and Art", name: "Landscape Architecture", code: "086200", degrees: ["Master"], language: "Chinese" },
  { college: "College of Landscape Architecture and Art", name: "Design", code: "140300", degrees: ["Master"], language: "Chinese" },
  { college: "College of Horticulture", name: "Pomology", code: "090201", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Vegetable Science", code: "090202", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Tea Science", code: "090203", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Ornamental Horticulture", code: "0902Z4", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Intelligent Horticulture", code: "0902Z5", degrees: ["Master"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Pomology", code: "090201", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Vegetable Science", code: "090202", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Tea Science", code: "090203", degrees: ["Doctoral"], language: "Chinese/English" },
  { college: "College of Horticulture", name: "Horticulture", code: "090200", degrees: ["Doctoral"], language: "Chinese/English" },
];

const expanded = specs.flatMap((spec) => spec.degrees.map((degree) => ({ ...spec, degree })));
if (specs.length !== 65 || expanded.length !== 68) throw new Error(`Expected 65 catalog rows expanding to 68 programs; got ${specs.length}/${expanded.length}`);
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const category = (name: string) => /business|econom|management|public administration/i.test(name) ? "Business and Social Sciences" : /biology|ecology|food|pharmaceutical|veterinary/i.test(name) ? "Life Sciences" : /agric|crop|plant|pesticide|forestry|forest|horticulture|pomology|vegetable|tea|silviculture|juncao/i.test(name) ? "Agriculture and Forestry" : /engineering|material|chemical|transportation|design|architecture/i.test(name) ? "Engineering and Design" : "Science";
const programs = expanded.map((spec) => {
  const tuition = spec.degree === "Master" ? 21000 : 24000;
  const hasChinese = spec.language.includes("Chinese");
  const hasEnglish = spec.language.includes("English");
  const collegeKey = slugify(spec.college).slice(0, 42).replace(/-+$/, "");
  return {
    slug: `fujian-agriculture-and-forestry-university-${slugify(spec.name)}-${spec.code.toLowerCase()}-${spec.degree.toLowerCase()}-${collegeKey}-2026`,
    schoolSlug: school.slug,
    citySlug: "fuzhou",
    nameEn: spec.name,
    degreeLevel: spec.degree,
    fieldCategory: category(spec.name),
    subjectArea: spec.name,
    teachingLanguage: spec.language,
    ...(hasChinese ? { hskRequirement: "HSK Level 5 for Chinese-taught study in the closed 2026 cycle." } : {}),
    ...(hasEnglish ? { englishRequirement: "IELTS 6.5, TOEFL 85, or equivalent proof in the closed 2026 cycle; waived for applicants from English-speaking countries." } : {}),
    tuitionAmount: tuition,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `Current official ${spec.degree.toLowerCase()} tuition is CNY ${tuition.toLocaleString("en-US")}/year; no 2027 effective period is published.`,
    applicationUrl: guide.finalUrl ?? guide.url,
    applicationNote: `Official 2026 catalog code ${spec.code}, ${spec.college}. The 2026 general application deadline closed April 30, 2026 Beijing time; no 2027 route or deadline is inferred.`,
    hasScholarship: true,
    scholarshipText: "The closed 2026 guide lists Chinese Government, Fujian Provincial Government and FAFU scholarships for eligible master's and doctoral applicants.",
    badgeText: "Closed 2026 official route",
    displayTuition: `CNY ${tuition.toLocaleString("en-US")}/year (current fee table)`,
    displaySubjects: [spec.name, spec.college],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: catalog.fetchedAt,
    ...sourceFields(catalog),
    sourceFieldLineage: {
      nameEn: "official 2026 program catalog",
      degreeLevel: "official degree column; combined Master/Doctor rows are expanded without changing the source meaning",
      fieldCategory: "CUAC taxonomy of official program name",
      subjectArea: "official program name",
      teachingLanguage: "official teaching-language column",
      ...(hasChinese ? { hskRequirement: "official 2026 eligibility requirements" } : {}),
      ...(hasEnglish ? { englishRequirement: "official 2026 eligibility requirements" } : {}),
      tuitionAmount: "official current fee table",
      tuitionText: "official current fee table with explicit unresolved 2027 period",
      applicationUrl: "official 2026 international application guide",
      applicationNote: "official catalog code, college and closed-cycle deadline",
      hasScholarship: "official 2026 scholarship section",
      scholarshipText: "official 2026 application guide and current scholarship policy",
      badgeText: "official closed-cycle label",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "2026 Admission",
  intakeYear: 2026,
  deadlineDate: "2026-04-30T15:59:59.000Z",
  deadlineLabel: "The general international application deadline closed April 30, 2026 at 24:00 Beijing time.",
  applicationRound: "2026 international master and doctoral admission",
  status: "closed" as const,
  ...sourceFields(guide),
  sourceFieldLineage: { intakeTerm: "official guide cycle without inferred semester", intakeYear: "official 2026 guide", deadlineDate: "official deadline converted from Beijing time", deadlineLabel: "official closed deadline", applicationRound: "official 2026 international admission guide" },
}));

const makeScholarship = (slug: string, title: string, nameZh: string, type: "government" | "university", providerName: string, providerNameEn: string, deadline: string, source: Source, coverage: string, amountText: string) => ({
  slug,
  title,
  nameZh,
  schoolSlug: school.slug,
  type,
  typeLabel: title,
  providerName,
  providerNameEn,
  providerLocation: "Fuzhou, Fujian, China",
  fundingLevel: "Full scholarship in the closed 2026 cycle",
  coverage,
  applicableDegree: "Master and Doctoral",
  amountText,
  requirementText: "Closed 2026 cycle: non-Chinese citizen in good health; master's applicants need a bachelor's degree and must be under 35, doctoral applicants need a master's degree and must be under 40. Program language requirements also apply.",
  benefitItems: [{ label: "Tuition", included: true, note: "Tuition waiver" }, { label: "Accommodation", included: true, note: "On-campus accommodation" }, { label: "Medical insurance", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: amountText }],
  eligibilityItems: [{ label: "Degree level", value: "Master and Doctoral" }, { label: "Cycle", value: "Closed 2026 application round" }, { label: "Deadline", value: deadline }],
  applicationMaterials: [],
  applicationSteps: [],
  actionLinks: [{ label: "Official 2026 application guide", url: guide.finalUrl ?? guide.url, kind: "official-source" }],
  applicationRound: `Closed 2026 application; ${deadline}`,
  summary: `${title} terms are retained only for the closed 2026 cycle; no 2027 application window is inferred.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields(source),
  sourceFieldLineage: { title: "official 2026 guide or current scholarship policy", coverage: "official scholarship coverage", applicableDegree: "official 2026 applicant category", amountText: "official current stipend table", requirementText: "official 2026 eligibility requirements", benefitItems: "official scholarship coverage", eligibilityItems: "official applicant category and closed cycle", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", applicationRound: "official closed 2026 cycle", summary: "official terms with explicit no-inference rule" },
});
const scholarships = [
  makeScholarship("fujian-agriculture-and-forestry-university-cgs-high-level-postgraduate-2026", "Chinese Government Scholarship High-Level Postgraduate Program at FAFU", "福建农林大学中国政府奖学金高水平研究生项目", "government", "中国国家留学基金管理委员会", "China Scholarship Council", "deadline February 15, 2026", guide, "Tuition, on-campus accommodation, comprehensive medical insurance and living allowance.", "Master CNY 3,000/month; doctoral CNY 3,500/month."),
  makeScholarship("fujian-agriculture-and-forestry-university-fujian-government-scholarship-2026", "Fujian Provincial Government Scholarship at FAFU", "福建省政府外国留学生奖学金", "government", "福建省人民政府", "Fujian Provincial Government", "general application deadline April 30, 2026", scholarshipPolicy, "Tuition, accommodation and insurance fee exemptions plus living allowance.", "Master CNY 2,000/month; doctoral CNY 2,500/month under the current FAFU-referenced standard."),
  makeScholarship("fujian-agriculture-and-forestry-university-scholarship-2026", "Fujian Agriculture and Forestry University Scholarship", "福建农林大学外国留学生奖学金", "university", "福建农林大学", "Fujian Agriculture and Forestry University", "general application deadline April 30, 2026", scholarshipPolicy, "Tuition, accommodation and insurance fee exemptions plus living allowance.", "Master CNY 2,000/month; doctoral CNY 2,500/month."),
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: applicationIndex.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: applicationIndex.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 122, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "No applicant-facing 2027 international admission guide, approved program list, tuition schedule or deadline is published on the current official application index. No 2026 field is relabeled as 2027.",
    "The official page title says Master's Program, but its degree column contains both master and doctoral rows. The three combined Master/Doctor rows are deterministically expanded, producing 68 program records from 65 source rows.",
    "All program and intake rows are explicitly tied to the closed 2026 international cycle. The guide does not state a semester, so the intake label remains '2026 Admission' rather than an inferred Fall term.",
    "The official fee page is current but does not publish a 2027 effective period; the candidate preserves the current degree tuition with that limitation.",
    "The scholarship policy page publishes current benefits, while the application guide limits applicant-facing eligibility and deadlines to the closed 2026 cycle. No current policy is converted into a 2027 application window.",
    "Applicant files, personal contacts, payment instructions, bank details and personal-data public notices are excluded from the candidate.",
    `The current fees page is separately hash-locked (${fees.sha256}); program records remain primarily sourced to the official 2026 catalog (${catalog.sha256}).`,
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant or recipient list is included. Applicant documents, personal contacts, payment instructions and bank details are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-167");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 167, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
