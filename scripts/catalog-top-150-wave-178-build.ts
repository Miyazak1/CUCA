import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral";
type Spec = { name: string; degree: Degree; category: string };

const root = process.cwd();
const run = "2026-10-26T12-02-32-422Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["nxu-international-degree-index-current", "ec76003e2ca6e3dc4145fd66f6013d2b9368f938e5f60e44acd8d7ea3262d660"],
  ["nxu-international-guide-2026", "31cf1da1fd6d874f230f7b268c60d24944afebd66952b6f0905a86256505983a"],
  ["nxu-international-guide-pdf-2026", "6a3c294d043e8b55f71ae3b18a2be949009aa237842fa8a4ea1d4c4ef9a274ab"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked NXU source: ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`NXU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const index = sources.get("nxu-international-degree-index-current")!;
const guidePage = sources.get("nxu-international-guide-2026")!;
const guide = sources.get("nxu-international-guide-pdf-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
if (base.cities?.some((entry) => entry.slug === "yinchuan")) throw new Error("Yinchuan city already exists in the reviewed base; remove the new city record.");
if (base.schools?.some((entry) => entry.slug === "ningxia-university")) throw new Error("Ningxia University already exists in the reviewed base.");

const city = {
  slug: "yinchuan",
  nameEn: "Yinchuan",
  nameZh: "银川",
  province: "Ningxia",
  region: "Northwest China",
  tags: ["Ningxia", "Northwest China", "official-school-evidence"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official English guide address and university profile",
    nameZh: "official university location standardized to Chinese city name",
    province: "official university location",
    region: "CUAC geographic taxonomy derived from the verified Ningxia location",
    tags: "CUAC geographic classification and evidence-stage marker",
  },
};

const school = {
  slug: "ningxia-university",
  nameEn: "Ningxia University",
  nameZh: "宁夏大学",
  citySlug: city.slug,
  schoolType: "Public comprehensive university",
  region: "Yinchuan, Ningxia, Northwest China",
  applicationLevel: "The current official degree-education index publishes a closed 2026 international guide covering bachelor, master and doctoral study. No applicant-facing 2027 guide was found on the captured current index.",
  languageOfInstruction: "Chinese for all degree routes listed in the official 2026 guide.",
  languageRequirement: "Closed 2026: bachelor applicants required HSK 4 with a score above 240; master and doctoral applicants required HSK 5 with a score above 180.",
  hskRequirement: "Closed 2026: HSK 4 above 240 for bachelor study; HSK 5 above 180 for master and doctoral study.",
  deadlineSummary: "Closed Autumn 2026: January 1-May 30 application window; Chinese Government Scholarship deadline March 25 and other scholarship deadline May 30.",
  tuitionSummary: "Closed 2026 annual tuition: bachelor CNY 14,000; master CNY 16,000; doctoral CNY 18,000. Registration CNY 400 and insurance CNY 800/year.",
  applicationFee: "Registration fee CNY 400; the guide does not label a separate application fee",
  websiteUrl: "https://www.nxu.edu.cn/",
  admissionsUrl: index.finalUrl ?? index.url,
  cscaRequired: true,
  cscaRequirement: "Closed 2026: all bachelor applicants required CSCA Mathematics. Chinese-taught routes required the subject-specific Chinese test, with the published HSK 4 exemption for Chinese Language and Literature. The listed science, engineering, agriculture and environment routes additionally required either Physics or Chemistry.",
  subjectTags: ["Humanities", "Law", "Mathematics", "Electronic Engineering", "Agriculture", "Hydraulic Engineering", "Chemical Engineering"],
  languageTags: ["Chinese"],
  tuitionBandLabel: "Closed 2026: CNY 14,000-18,000/year by degree level",
  campusHighlights: ["Official 2026 guide lists 41 degree routes", "All listed degree routes are Chinese-taught", "Current official index has not yet published a 2027 guide"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: index.fetchedAt,
  ...sf(guide),
  sourceFieldLineage: {
    nameEn: "official English guide title",
    nameZh: "official current index and guide",
    citySlug: "official guide address and university profile",
    schoolType: "official university profile plus CUAC taxonomy",
    region: "official location plus CUAC taxonomy",
    applicationLevel: "current official index and closed 2026 guide",
    languageOfInstruction: "official study-duration section",
    languageRequirement: "official HSK requirements",
    hskRequirement: "official HSK requirements",
    deadlineSummary: "official application, admission and registration period",
    tuitionSummary: "official tuition and fees table",
    applicationFee: "official fee table terminology retained",
    websiteUrl: "official university domain",
    admissionsUrl: "current official degree-education index",
    cscaRequired: "official CSCA instructions",
    cscaRequirement: "official route-grouped CSCA subject rules",
    subjectTags: "official program tables",
    languageTags: "official teaching-language statement",
    tuitionBandLabel: "official fee table",
    campusHighlights: "official current index and guide",
  },
};

const specs: Spec[] = [
  ["Chinese Language and Literature (International Chinese Language Education)", "Bachelor", "Literature"],
  ["Tourism Management", "Bachelor", "Management"], ["Law", "Bachelor", "Law"], ["Administrative Management", "Bachelor", "Management"],
  ["Mathematics and Applied Mathematics (Financial Mathematics)", "Bachelor", "Science"], ["Information and Computational Science", "Bachelor", "Science"], ["Applied Statistics", "Bachelor", "Science"],
  ["Electronic and Information Engineering", "Bachelor", "Engineering"], ["Electrical Engineering and Automation", "Bachelor", "Engineering"], ["Communication Engineering", "Bachelor", "Engineering"],
  ["Food Science and Engineering", "Bachelor", "Engineering"], ["Civil Engineering", "Bachelor", "Engineering"], ["Agronomy", "Bachelor", "Agriculture Science"], ["Agricultural Resource and Environment", "Bachelor", "Agriculture Science"],
  ["Mechanical Engineering", "Bachelor", "Engineering"], ["Process Equipment and Control Engineering", "Bachelor", "Engineering"], ["English Language and Literature - International English Teacher Direction", "Bachelor", "Literature"],
  ["Chinese Language and Literature", "Master", "Humanities"], ["Philosophy", "Master", "Humanities"], ["Law", "Master", "Law"], ["Mathematics", "Master", "Mathematics"], ["Mechanics", "Master", "Mechanics"],
  ["Electronic Science and Technology", "Master", "Electronic Engineering"], ["New Generation Electronic Information Technology", "Master", "Electronic Engineering"], ["Communication Engineering", "Master", "Electronic Engineering"],
  ["Computer Science and Technology", "Master", "Computer Science"], ["Food Science and Engineering", "Master", "Food Science"], ["Civil Engineering", "Master", "Civil Engineering"], ["Hydraulic Engineering", "Master", "Hydraulic Engineering"],
  ["Geography", "Master", "Geography"], ["Crop Science", "Master", "Agriculture"], ["Agricultural Resource and Environment", "Master", "Agriculture"], ["Agricultural Entomology and Pest Control", "Master", "Agriculture"],
  ["Mechanical Engineering", "Master", "Mechanical Engineering"], ["Chemistry", "Master", "Chemistry"], ["Chemical Engineering and Technology", "Master", "Chemical Engineering"],
  ["Ethnology", "Doctoral", "Humanities"], ["Mathematics", "Doctoral", "Mathematics"], ["Hydraulic Engineering", "Doctoral", "Hydraulic Engineering"], ["Mechanical Engineering", "Doctoral", "Mechanical Engineering"], ["Chemical Engineering and Technology", "Doctoral", "Chemical Engineering"],
].map(([name, degree, category]) => ({ name, degree: degree as Degree, category }));
if (specs.length !== 41) throw new Error(`Expected 41 NXU routes, found ${specs.length}`);

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const scienceBachelor = new Set(["Information and Computational Science", "Applied Statistics", "Electronic and Information Engineering", "Electrical Engineering and Automation", "Communication Engineering", "Food Science and Engineering", "Civil Engineering", "Agronomy", "Agricultural Resource and Environment"]);
const programs: CatalogSeedProgram[] = specs.map((item, indexValue) => {
  const durationYears = item.degree === "Master" ? 3 : 4;
  const tuitionAmount = item.degree === "Bachelor" ? 14000 : item.degree === "Master" ? 16000 : 18000;
  const csca = item.degree !== "Bachelor" ? undefined : scienceBachelor.has(item.name)
    ? "Closed 2026: Mathematics, subject-specific Chinese, and either Physics or Chemistry."
    : item.name.startsWith("Chinese Language and Literature")
      ? "Closed 2026: Mathematics; subject-specific Chinese could be exempted with a valid HSK 4 report."
      : "Closed 2026: Mathematics and the applicable subject-specific Chinese test.";
  return {
    slug: `ningxia-university-${slugify(item.name)}-${item.degree.toLowerCase()}-${String(indexValue + 1).padStart(3, "0")}-2026`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: item.name,
    degreeLevel: item.degree,
    durationYears,
    fieldCategory: item.category,
    subjectArea: item.name,
    teachingLanguage: "Chinese",
    ...(csca ? { cscaRequirement: csca } : {}),
    hskRequirement: item.degree === "Bachelor" ? "HSK 4 with a score above 240." : "HSK 5 with a score above 180.",
    tuitionText: `Closed 2026 ${item.degree.toLowerCase()} tuition: CNY ${tuitionAmount.toLocaleString("en-US")}/year; registration CNY 400 and insurance CNY 800/year.`,
    applicationUrl: guidePage.finalUrl ?? guidePage.url,
    applicationNote: "Listed in the official Autumn 2026 international guide. The January 1-May 30 application window is closed; this route is not relabeled as 2027.",
    hasScholarship: true,
    scholarshipText: "The closed 2026 guide lists the Chinese Government Scholarship and Ningxia University Scholarship; applicants had to follow the applicable scholarship deadline and system.",
    badgeText: "Closed Autumn 2026 official route",
    displaySubjects: [item.name],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: guide.fetchedAt,
    ...sf(guide),
    sourceFieldLineage: {
      nameEn: "official program tables",
      degreeLevel: "official program grouping",
      durationYears: "official study-duration section",
      fieldCategory: "official undergraduate classification or graduate school context",
      subjectArea: "official program tables",
      teachingLanguage: "official all-program teaching-language statement",
      ...(csca ? { cscaRequirement: "official CSCA route-group rules" } : {}),
      hskRequirement: "official HSK requirements by degree level",
      tuitionText: "official tuition and fees table",
      applicationUrl: "official guide landing page",
      applicationNote: "official 2026 application period and present closed status",
      hasScholarship: "official scholarship table",
      scholarshipText: "official scholarship table and deadline wording",
      badgeText: "official closed-cycle status",
    },
  };
});

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-05-30T15:59:59.000Z",
  deadlineLabel: "Applications closed May 30, 2026.",
  applicationRound: "Closed Autumn 2026 international admission",
  status: "closed" as const,
  ...sf(guide),
  sourceFieldLineage: { intakeTerm: "official autumn-semester wording", intakeYear: "official guide title and admission period", deadlineDate: "official application period", deadlineLabel: "official application period and present closed status", applicationRound: "official guide cycle" },
}));

const scholarshipBase = { schoolSlug: school.slug, providerNameEn: "Ningxia University", providerLocation: "Yinchuan, Ningxia, China", applicationMaterials: [], applicationSteps: [], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: guide.fetchedAt, ...sf(guide) };
const scholarshipLineage = { title: "official scholarship table", coverage: "official scholarship table", applicableDegree: "official stipend categories", applicableProgram: "official degree-program scope", amountText: "official stipend amounts", requirementText: "official application-period wording", benefitItems: "official scholarship table", eligibilityItems: "official quota and deadline wording", applicationMaterials: "intentionally excluded", applicationSteps: "intentionally excluded", deadlineDate: "official scholarship deadline", deadlineLabel: "official scholarship deadline and present closed status", applicationRound: "official guide cycle", summary: "official scholarship scope and quota" };
const scholarships = [
  {
    ...scholarshipBase,
    slug: "ningxia-university-chinese-government-scholarship-2026",
    title: "Chinese Government Scholarship - Ningxia University 2026",
    nameZh: "宁夏大学中国政府奖学金（2026）",
    type: "government",
    typeLabel: "Chinese Government Scholarship",
    providerName: "China Scholarship Council / Ningxia University",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, monthly stipend and comprehensive medical insurance.",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Degree programs listed in the official 2026 guide, subject to scholarship eligibility.",
    amountText: "CNY 2,500/month for bachelor, CNY 3,000/month for master and CNY 3,500/month for doctoral study, paid for 12 months.",
    requirementText: "Closed 2026 award with a 20-student quota; applications were required in both the CSC and university systems.",
    benefitItems: [{ label: "Tuition", included: true, note: "Covered" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "CNY 2,500-3,500/month by level for 12 months" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
    eligibilityItems: [{ label: "Quota", value: "20 students" }, { label: "Cycle", value: "Closed 2026" }],
    actionLinks: [{ label: "Official 2026 guide", url: guidePage.finalUrl ?? guidePage.url, kind: "official-source" }],
    deadlineDate: "2026-03-25",
    deadlineLabel: "Applications closed March 25, 2026.",
    applicationRound: "Closed 2026 Chinese Government Scholarship",
    summary: "Closed 2026 full scholarship with a published 20-student quota and level-based monthly stipend.",
    sourceFieldLineage: scholarshipLineage,
  },
  {
    ...scholarshipBase,
    slug: "ningxia-university-scholarship-2026",
    title: "Ningxia University Scholarship 2026",
    nameZh: "宁夏大学奖学金（2026）",
    type: "university",
    typeLabel: "University scholarship",
    providerName: "Ningxia University",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, accommodation, monthly stipend and comprehensive medical insurance.",
    applicableDegree: "Bachelor, Master, Doctoral",
    applicableProgram: "Degree programs listed in the official 2026 guide, subject to scholarship eligibility.",
    amountText: "CNY 2,500/month for bachelor, CNY 3,000/month for master and CNY 3,500/month for doctoral study, paid for 12 months.",
    requirementText: "Closed 2026 award with a 20-student quota; applications were submitted in the university system.",
    benefitItems: [{ label: "Tuition", included: true, note: "Covered" }, { label: "Accommodation", included: true, note: "Covered" }, { label: "Living allowance", included: true, note: "CNY 2,500-3,500/month by level for 12 months" }, { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" }],
    eligibilityItems: [{ label: "Quota", value: "20 students" }, { label: "Cycle", value: "Closed 2026" }],
    actionLinks: [{ label: "Official 2026 guide", url: guidePage.finalUrl ?? guidePage.url, kind: "official-source" }],
    deadlineDate: "2026-05-30",
    deadlineLabel: "Applications closed May 30, 2026.",
    applicationRound: "Closed 2026 Ningxia University Scholarship",
    summary: "Closed 2026 full university scholarship with a published 20-student quota and level-based monthly stipend.",
    sourceFieldLineage: scholarshipLineage,
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: guide.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: guide.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 137, schoolSlugs: [school.slug], newSchools: 1, newCities: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The current official degree-education index lists the 2026 guide as its newest applicant-facing guide; no 2027 international guide, application window or 2027 program table was found.",
    "All 41 degree routes are retained as closed Autumn 2026 records and are not relabeled as 2027.",
    "The scanned guide includes tutor names and email addresses in the graduate tables; all personal contact data is deliberately excluded.",
    "The source repeats the same general eligibility paragraph twice and does not publish an English-language admission alternative for the listed degree routes.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Tutor names, personal email addresses, applicant data, payment details and private application materials are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-178");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 178, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
