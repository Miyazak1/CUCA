import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type Degree = "Bachelor" | "Master" | "Doctoral";
type ProgramSpec = { name: string; degree: Degree; durationYears: number; tuition: number; field: string; cscaSubjects?: string[] };

const root = process.cwd();
const run = "2026-10-26T09-54-11-176Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["swpu-university-home-current", "964dcc0f7ae2bd8268a7e6fe91fa96ad0aba5e4eccffdcdd8819910e3d65b1f0"],
  ["swpu-international-office-home-current", "ee277be19a772ee4c049e061a44876776aa3b88b3f9520f8e37c3a60d76e9745"],
  ["swpu-international-admission-guide-2026", "cb9b290408a2a2f7653a58967b1c2f0216b3b0c922d9ac905b4ae0f50962b860"],
  ["swpu-international-enrollment-planning-2027", "bc6838e38536ce0e93e51f048ec8ef005dfed1ece8860fbbb68a8b301de1bddd"],
  ["swpu-international-scholarship-policy-current", "fc1248197cfa2dda86db63c1e347a6ce64747a63cc067630e006ba4aa3c125c4"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha256);
  if (!source) throw new Error(`Missing locked SWPU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`SWPU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const guide = sources.get("swpu-international-admission-guide-2026")!;
const planning2027 = sources.get("swpu-international-enrollment-planning-2027")!;
const scholarshipPolicy = sources.get("swpu-international-scholarship-policy-current")!;
const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "chengdu");
if (!city) throw new Error("Reviewed Chengdu dependency missing");

const school = {
  slug: "southwest-petroleum-university",
  nameEn: "Southwest Petroleum University",
  nameZh: "西南石油大学",
  citySlug: "chengdu",
  schoolType: "Public petroleum and engineering university",
  region: "Chengdu, Sichuan, Southwest China",
  applicationLevel: "The latest complete international guide is the closed 2026 cycle and publishes bachelor, master and doctoral English-taught routes. The university announced that 2027 international enrollment planning has started, but no applicant-facing 2027 guide or approved program list is published.",
  languageOfInstruction: "English for all routes named in the latest complete 2026 international guide.",
  languageRequirement: "The latest complete 2026 guide accepts TOEFL, IELTS or proof of English proficiency from the applicant's previous degree; no numeric score threshold is published.",
  englishRequirement: "TOEFL, IELTS or previous-degree English proficiency evidence in the closed 2026 cycle; no numeric threshold published.",
  deadlineSummary: "No applicant-facing 2027 deadline is published. The latest complete 2026 international application deadline was May 30, 2026.",
  tuitionSummary: "Latest complete 2026 annual tuition: bachelor CNY 16,000; master CNY 20,000; doctoral CNY 25,000. Insurance was CNY 1,000/year and registration fee CNY 600.",
  applicationFee: "CNY 600 registration fee in the 2026 guide",
  websiteUrl: "https://www.swpu.edu.cn/",
  admissionsUrl: guide.finalUrl ?? guide.url,
  subjectTags: ["Petroleum Engineering", "Geology", "Chemical Engineering", "Mechanical Engineering", "Materials Science", "Computer Science"],
  languageTags: ["English"],
  tuitionBandLabel: "Latest 2026 degree tuition: CNY 16,000-25,000/year",
  campusHighlights: ["Petroleum and Natural Gas Engineering is the university's signature discipline", "Latest complete guide publishes 24 English-taught degree routes", "Official 2027 international enrollment planning has started"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: planning2027.fetchedAt,
  ...sourceFields(guide),
  sourceFieldLineage: {
    nameEn: "official bilingual 2026 international guide",
    nameZh: "official bilingual 2026 international guide",
    citySlug: "official campus address plus reviewed Chengdu dependency",
    schoolType: "official institutional profile plus CUAC taxonomy",
    region: "official campus address plus CUAC taxonomy",
    applicationLevel: "official 2026 guide plus official 2027 enrollment-planning notice",
    languageOfInstruction: "official English Teaching Program section",
    languageRequirement: "official 2026 requirements tables",
    englishRequirement: "official 2026 requirements tables",
    deadlineSummary: "official 2026 deadline plus unresolved applicant-facing 2027 cycle",
    tuitionSummary: "official 2026 fee table",
    applicationFee: "official 2026 fee table",
    websiteUrl: "official university domain",
    admissionsUrl: "official 2026 international guide",
    subjectTags: "official named program list",
    languageTags: "official English Teaching Program section",
    tuitionBandLabel: "official 2026 fee table",
    campusHighlights: "official institutional profile, program list and 2027 planning notice",
  },
};

const bachelorSpecs: ProgramSpec[] = [
  { name: "Petroleum Engineering", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Engineering", cscaSubjects: ["Mathematics", "Physics"] },
  { name: "Mechanical Engineering", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Engineering", cscaSubjects: ["Mathematics", "Physics"] },
  { name: "Chemical Engineering and Technics", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Engineering", cscaSubjects: ["Mathematics", "Chemistry"] },
  { name: "Computer Science and Technology", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Computer Science", cscaSubjects: ["Mathematics", "Physics"] },
  { name: "Electrical Engineering and Automation", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Engineering", cscaSubjects: ["Mathematics", "Physics"] },
  { name: "Civil Engineering", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Engineering", cscaSubjects: ["Mathematics", "Physics"] },
  { name: "International Economy and Trade", degree: "Bachelor", durationYears: 4, tuition: 16000, field: "Economics", cscaSubjects: ["Mathematics", "Chemistry"] },
];
const masterNames = ["Petroleum and Natural Gas Engineering", "Geology", "Geological Resources and Geological Engineering", "Mechanical Engineering", "Chemical Engineering and Technology", "Environmental Science and Engineering", "Materials Science and Engineering", "Computer Science and Technology", "Control Science and Engineering", "Civil Engineering", "Master of Business Administration (MBA)"];
const doctoralNames = ["Petroleum and Natural Gas Engineering", "Geology", "Geological Resources and Geological Engineering", "Mechanical Engineering", "Chemical Engineering and Technology", "Materials Science and Engineering"];
const category = (name: string) => name.includes("Business") ? "Business" : name.includes("Computer") ? "Computer Science" : name === "Geology" ? "Science" : "Engineering";
const specs: ProgramSpec[] = [
  ...bachelorSpecs,
  ...masterNames.map((name) => ({ name, degree: "Master" as const, durationYears: 3, tuition: 20000, field: category(name) })),
  ...doctoralNames.map((name) => ({ name, degree: "Doctoral" as const, durationYears: 3, tuition: 25000, field: category(name) })),
];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = specs.map((spec) => ({
  slug: `southwest-petroleum-university-${slugify(spec.name)}-${spec.degree.toLowerCase()}-english-2026`,
  schoolSlug: school.slug,
  citySlug: "chengdu",
  nameEn: spec.name,
  degreeLevel: spec.degree,
  durationYears: spec.durationYears,
  fieldCategory: spec.field,
  subjectArea: spec.name,
  teachingLanguage: "English",
  englishRequirement: "TOEFL, IELTS or previous-degree English proficiency evidence; no numeric threshold is published in the 2026 guide.",
  ...(spec.cscaSubjects ? { cscaSubjects: spec.cscaSubjects, cscaRequirement: `Closed 2026 cycle: submit CSCA results for ${spec.cscaSubjects.join(" and ")} by May 30, 2026.` } : {}),
  tuitionAmount: spec.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${spec.tuition.toLocaleString("en-US")}/year in the closed 2026 cycle; insurance CNY 1,000/year and registration fee CNY 600.`,
  applicationUrl: guide.finalUrl ?? guide.url,
  applicationNote: "Named in the official 2026 English Teaching Program table. This application cycle is closed and is not represented as a 2027 route.",
  hasScholarship: true,
  scholarshipText: "The 2026 guide names Chinese Government, Sichuan Provincial, Chengdu Belt and Road and Chengdu Sister City scholarships; current policy terms are structured separately.",
  badgeText: "Closed 2026 official route",
  displayTuition: `CNY ${spec.tuition.toLocaleString("en-US")}/year (2026)`,
  displaySubjects: [spec.name],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guide.fetchedAt,
  ...sourceFields(guide),
  sourceFieldLineage: {
    nameEn: "official 2026 English Teaching Program table",
    degreeLevel: "official program category",
    durationYears: "official program-category heading",
    fieldCategory: "CUAC taxonomy of official program name",
    subjectArea: "official program name",
    teachingLanguage: "official English Teaching Program section",
    englishRequirement: "official 2026 requirements table",
    ...(spec.cscaSubjects ? { cscaSubjects: "official bachelor CSCA table", cscaRequirement: "official bachelor CSCA table and deadline" } : {}),
    tuitionAmount: "official 2026 degree-level fee table",
    tuitionText: "official 2026 fee table",
    applicationUrl: "official 2026 guide",
    applicationNote: "official named route and closed-cycle limitation",
    hasScholarship: "official 2026 scholarship section",
    scholarshipText: "official 2026 scholarship section and current policy",
    badgeText: "official cycle and closed-state label",
  },
}));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "2026 Admission",
  intakeYear: 2026,
  deadlineDate: "2026-05-30T15:59:59.000Z",
  deadlineLabel: "Applications closed May 30, 2026 Beijing time.",
  applicationRound: "2026 international degree admission",
  status: "closed" as const,
  ...sourceFields(guide),
  sourceFieldLineage: { intakeTerm: "official guide cycle without an inferred semester", intakeYear: "official guide title", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official deadline", applicationRound: "official guide cycle" },
}));

const policyLink = [{ label: "Official SWPU scholarship policy", url: scholarshipPolicy.finalUrl ?? scholarshipPolicy.url, kind: "official-source" }];
const governmentAmount = "Doctoral CNY 30,000/year for up to 3 years; master CNY 25,000/year for up to 3 years; bachelor CNY 20,000/year for up to 4 years; short-term study CNY 10,000/year or, for the Chengdu awards, CNY 1,000/month up to CNY 10,000.";
const makeScholarship = (slug: string, title: string, nameZh: string, typeLabel: string, amountText: string, coverage: string) => ({
  slug,
  title,
  nameZh,
  schoolSlug: school.slug,
  type: typeLabel.includes("SWPU") ? "university" : "government",
  typeLabel,
  providerName: typeLabel.includes("SWPU") ? "西南石油大学" : typeLabel.includes("Sichuan") ? "四川省政府" : "成都市政府",
  providerNameEn: typeLabel.includes("SWPU") ? "Southwest Petroleum University" : typeLabel.includes("Sichuan") ? "Sichuan Provincial Government" : "Chengdu Municipal Government",
  providerLocation: "Chengdu, Sichuan, China",
  fundingLevel: "Current policy award",
  coverage,
  applicableDegree: "Bachelor, Master and Doctoral; government policies also include short-term study",
  amountText,
  requirementText: "Applicants must meet the university's admission conditions, have good academic performance and conduct, and may not concurrently hold another government scholarship. The current policy does not publish a 2027 application window.",
  benefitItems: [{ label: "Funding", included: true, note: amountText }],
  eligibilityItems: [{ label: "Academic standing", value: "Good academic performance and meets SWPU admission conditions" }, { label: "Conduct", value: "Complies with Chinese law and university rules" }],
  applicationMaterials: [],
  applicationSteps: [],
  actionLinks: policyLink,
  applicationRound: "Current scholarship policy; no 2027 application dates published",
  summary: `${title} under the current official policy; no open 2027 application round is inferred.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipPolicy.fetchedAt,
  ...sourceFields(scholarshipPolicy),
  sourceFieldLineage: { title: "official scholarship-category policy", coverage: "official award standard", applicableDegree: "official award categories", amountText: "official award standard", requirementText: "official policy eligibility and exclusivity rules", benefitItems: "official award standard", eligibilityItems: "official policy eligibility", applicationMaterials: "intentionally omitted", applicationSteps: "intentionally omitted", applicationRound: "official current policy with unresolved 2027 dates", summary: "official current policy and explicit cycle limitation" },
});
const scholarships = [
  makeScholarship("southwest-petroleum-university-sichuan-provincial-government-scholarship-current", "Sichuan Provincial Government Scholarship for International Students at SWPU", "西南石油大学四川省外国留学生政府奖学金", "Sichuan Provincial Government Scholarship", governmentAmount, "Fixed annual award by study level under the current policy."),
  makeScholarship("southwest-petroleum-university-chengdu-belt-and-road-scholarship-current", "Chengdu Belt and Road Government Scholarship at SWPU", "西南石油大学成都市“一带一路”留学生政府奖学金", "Chengdu Belt and Road Government Scholarship", governmentAmount, "Fixed annual or monthly award by study level under the current policy."),
  makeScholarship("southwest-petroleum-university-chengdu-sister-city-scholarship-current", "Chengdu Sister City Government Scholarship at SWPU", "西南石油大学成都市国际友好城市留学生政府奖学金", "Chengdu Sister City Government Scholarship", governmentAmount, "Fixed annual or monthly award by study level under the current policy."),
  makeScholarship("southwest-petroleum-university-study-in-swpu-scholarship-current", "Study in SWPU International Student Scholarship", "“留学SWPU”国际学生奖学金", "Study in SWPU Scholarship", "Doctoral: tuition waiver plus CNY 3,000/year for 3 years; master: tuition waiver plus CNY 2,000/year for 3 years; bachelor: tuition waiver for 4 years.", "Tuition waiver for degree study, plus the published doctoral or master annual award."),
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: planning2027.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...locks.keys()].map((id) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: planning2027.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 119, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  unresolved: [
    "The official September 2026 notice starts internal compilation of the 2027 international enrollment plan, but it is not an applicant-facing guide and does not publish approved routes, tuition, language rules or deadlines. No 2026 field is relabeled as 2027.",
    "All 24 route and intake rows are explicitly tied to the closed 2026 guide. The guide does not state an intake semester, so the intake label is '2026 Admission' rather than an inferred Fall term.",
    "The current scholarship policy publishes award categories and standards but no open 2027 application dates; no 2027 scholarship window is inferred.",
    "Accommodation breakdowns, applicant documents, personal contacts and financial-guarantee contents are excluded from the candidate.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant documents, personal contacts, payment details and financial-guarantee contents are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-164");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 164, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
