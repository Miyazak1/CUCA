import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const locks = [
  ["2026-10-26T08-41-06-326Z", "nuist-international-admissions-index-current", "6453cafbca840c4039c21800850bfe9333e4e0cdc92235889b4f2f78d602b228"],
  ["2026-10-26T08-41-06-326Z", "nuist-international-undergraduate-programs-current", "1bd2844eacfec52c3906dbd22c5a9362f3a7fb31b8f3642eb38e25694ec185b7"],
  ["2026-10-26T08-41-06-326Z", "nuist-international-application-procedures-current", "9c1b5d8c5ef287677c4ef2d63eb91f4ce549c4b9edcf168f810c476d8c1c6e6b"],
  ["2026-10-26T08-41-43-127Z", "nuist-international-undergraduate-program-list-pdf-2027", "6c3c93d2dc3df1b56278cca57af32412afdf2c52bb4128288704dc70ad284fae"],
] as const;
const sources = new Map<string, Source>();
for (const [run, id, sha] of locks) {
  const dir = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(dir, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === sha);
  if (!source) throw new Error(`Missing ${id}`);
  if (createHash("sha256").update(await readFile(resolve(dir, source.artifactPath))).digest("hex") !== sha) throw new Error(`Hash mismatch ${id}`);
  sources.set(id, source);
}

const programSource = sources.get("nuist-international-undergraduate-program-list-pdf-2027")!;
const applicationSource = sources.get("nuist-international-application-procedures-current")!;
const sf = { sourceUrl: programSource.finalUrl ?? programSource.url, sourceLabel: programSource.label, sourceSha256: programSource.sha256, capturedAt: programSource.fetchedAt };
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "nanjing");
if (!city) throw new Error("Nanjing dependency missing");

const school = {
  slug: "nanjing-university-of-information-science-and-technology",
  nameEn: "Nanjing University of Information Science & Technology",
  nameZh: "南京信息工程大学",
  citySlug: "nanjing",
  schoolType: "Public comprehensive university with atmospheric science and information technology strengths",
  region: "Nanjing, Jiangsu, East China",
  applicationLevel: "The captured 2027 international undergraduate catalog publishes 61 four-year September-entry routes. Graduate and non-degree routes are not structured in this wave.",
  languageOfInstruction: "Chinese, with five undergraduate programs also available in English.",
  languageRequirement: "The captured 2027 page publishes CSCA subject combinations by teaching language and field. Separate HSK and English-score thresholds were not stated in the captured 2027 sources.",
  deadlineSummary: "University scholarship and self-sponsored applications close April 30, 2027, or earlier if capacity is reached. Other scholarship deadlines are separate.",
  tuitionSummary: "CNY 15,000/year for each undergraduate route in the official 2027 program list.",
  applicationFee: "CNY 500, non-refundable",
  websiteUrl: "https://www.nuist.edu.cn/",
  admissionsUrl: sources.get("nuist-international-admissions-index-current")!.finalUrl ?? sources.get("nuist-international-admissions-index-current")!.url,
  subjectTags: ["Atmospheric Science", "Meteorology", "Computer Science", "Artificial Intelligence", "Environmental Science", "Engineering", "Business"],
  languageTags: ["Chinese", "English"],
  tuitionBandLabel: "CNY 15,000/year for 2027 undergraduate routes",
  campusHighlights: ["Atmospheric science specialization", "61 official 2027 undergraduate routes", "Chinese and selected English-medium study"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: programSource.fetchedAt,
  ...sf,
  sourceFieldLineage: {
    nameEn: "official English international admissions pages",
    nameZh: "official university and international admissions pages",
    citySlug: "official admissions address",
    schoolType: "official institutional identity plus CUAC taxonomy",
    region: "official admissions address plus CUAC taxonomy",
    applicationLevel: "official 2027 undergraduate program-list PDF",
    languageOfInstruction: "official 2027 undergraduate program-list PDF",
    languageRequirement: "official current CSCA requirements page; unsupported language-score fields intentionally omitted",
    deadlineSummary: "official current application procedures",
    tuitionSummary: "official 2027 undergraduate program-list PDF",
    applicationFee: "official current application procedures",
    websiteUrl: "official university domain",
    admissionsUrl: "official current international admissions index",
    subjectTags: "official 2027 undergraduate program list",
    languageTags: "official 2027 undergraduate program list",
    tuitionBandLabel: "official 2027 undergraduate program list",
    campusHighlights: "official 2027 undergraduate program list and institutional scope",
  },
};

const groupedPrograms = [
  ["Science", ["Atmospheric Science", "Applied Meteorology", "Smart Agriculture", "Ecology", "Geographical Information Science", "Geographical Science", "Marine Science", "Marine Technology", "Marine Resources and Environment", "Applied Physics"]],
  ["Engineering", ["Meteorological Technology and Engineering", "Disaster Prevention and Mitigation Engineering", "Geomatics Engineering", "Remote Sensing Science and Technology", "Geographic Space Information Engineering", "Hydrology and Water Resources Engineering", "Intelligent Hydraulic Engineering", "Environmental Science and Engineering", "Water Supply and Drainage", "Measurement Technology and Instrument", "Electrical Engineering and Automation", "Automation", "Robotics Engineering", "Low-Altitude Technology and Engineering", "Information Engineering", "Medical Information Engineering", "Electronic Information Engineering", "Electronic Science and Technology", "Communication Engineering", "Microelectronics Science and Engineering", "Integrated Circuit Design and Integrated Systems", "Opto-Electronics Information Science and Engineering", "Material Physics", "New Energy Materials and Devices"]],
  ["Computer Science", ["Artificial Intelligence", "Virtual Reality Technology", "Data Science and Big Data Technology", "Computer Science and Technology", "Internet of Things", "Software Engineering", "Cyberspace Security"]],
  ["Chemistry", ["Applied Chemistry"]],
  ["Law and Public Administration", ["Law", "Administration", "Medical Insurance", "Emergency Management"]],
  ["Business", ["Financial Engineering", "Information Management and Information System", "Economic Statistics", "Actuarial Science", "Big Data Management and Application", "Digital Economy", "International Economy and Trade", "Accounting", "Financial Management", "Supply Chain Management"]],
  ["Humanities", ["Chinese Language and Literature"]],
  ["Arts", ["Animation", "Digital Media Arts", "Art and Technology", "Environmental Design"]],
] as const;
const bilingual = new Set(["Atmospheric Science", "Artificial Intelligence", "Electronic Information Engineering", "Computer Science and Technology", "International Economy and Trade"]);
const slugify = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = groupedPrograms.flatMap(([fieldCategory, names]) => names.map((name) => ({
  slug: `nanjing-university-of-information-science-and-technology-${slugify(name)}-bachelor-fall-2027`,
  schoolSlug: school.slug,
  citySlug: "nanjing",
  nameEn: name,
  degreeLevel: "Bachelor",
  durationYears: 4,
  fieldCategory,
  subjectArea: name,
  teachingLanguage: bilingual.has(name) ? "Chinese/English" : "Chinese",
  tuitionAmount: 15000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 15,000/year",
  applicationUrl: applicationSource.finalUrl ?? applicationSource.url,
  applicationNote: "September 2027 intake. University scholarship and self-sponsored applications close April 30, 2027 or earlier if capacity is reached.",
  badgeText: "Official 2027 undergraduate route",
  displayTuition: "CNY 15,000/year",
  displaySubjects: [name],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: programSource.fetchedAt,
  ...sf,
  sourceFieldLineage: {
    nameEn: "official 2027 undergraduate program-list PDF",
    degreeLevel: "official 2027 undergraduate program-list PDF",
    durationYears: "official 2027 undergraduate program-list PDF",
    fieldCategory: "official school grouping normalized to CUAC taxonomy",
    subjectArea: "official 2027 program name",
    teachingLanguage: "official 2027 undergraduate program-list PDF",
    tuitionAmount: "official 2027 undergraduate program-list PDF",
    tuitionText: "official 2027 undergraduate program-list PDF",
    applicationUrl: "official current application procedures",
    applicationNote: "official 2027 deadline and capacity note",
    badgeText: "official cycle label",
  },
})));
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall 2027",
  intakeYear: 2027,
  deadlineDate: "2027-04-30T15:59:59.000Z",
  deadlineLabel: "April 30, 2027; the application system may close earlier when capacity is reached.",
  applicationRound: "2027 university scholarship and self-sponsored international undergraduate admission",
  status: "open" as const,
  sourceUrl: applicationSource.finalUrl ?? applicationSource.url,
  sourceLabel: applicationSource.label,
  sourceSha256: applicationSource.sha256,
  capturedAt: applicationSource.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "official 2027 program-list PDF (September intake)",
    intakeYear: "official 2027 program-list title and application deadline",
    deadlineDate: "official current application procedures converted from Beijing end-of-day",
    deadlineLabel: "official current application procedures",
    applicationRound: "official current application procedures",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: programSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([, id]) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: programSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 98, schoolSlugs: [school.slug], newSchools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence,
  unresolved: [
    "The captured official 2027 evidence is undergraduate-only; graduate, non-degree and award-specific scholarship records remain absent.",
    "The official 2027 pages define CSCA subject combinations but do not state separate HSK or English-test thresholds, so those fields remain empty.",
    "No scholarship row is created because the captured application page points to separate scholarship deadlines without publishing award-specific coverage and rules.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Applicant data, bank/payment instructions and personal contacts are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-151");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 151, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
