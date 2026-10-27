import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};
type ExtractedProgram = {
  degreeLevel: "Bachelor" | "Master" | "Doctoral";
  schoolName: string;
  nameEn: string;
  sourceId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256: string;
  capturedAt: string;
};

const root = process.cwd();
const extractionPath = resolve(root, "catalog-sources/ncu-current-programs.extracted.json");
const extractionBytes = await readFile(extractionPath);
const extractionSha256 = createHash("sha256").update(extractionBytes).digest("hex");
if (extractionSha256 !== "0ae388253f6474d0cf98340a7212cd681acb344e7826cd9259567a2514957f37") {
  throw new Error("Nanchang current-program extraction hash mismatch; rerun and review the extractor before building.");
}
const extraction = JSON.parse(extractionBytes.toString("utf8")) as {
  generatedAt: string;
  counts: { Bachelor: number; Master: number; Doctoral: number; total: number };
  programs: ExtractedProgram[];
  evidence: Array<{ id: string; label: string; url: string; sha256: string; fetchedAt: string }>;
};
if (extraction.counts.total !== 309 || extraction.programs.length !== 309) throw new Error("Unexpected Nanchang extraction count.");

const locks = [
  ["2026-10-27T08-01-26-551Z", "ncu-international-admissions-current", "3971610bbc5fa24864cab18fbd912347693ad2e40636526caf4ad4c785314245"],
  ["2026-10-27T08-01-26-551Z", "ncu-international-application-procedure-current", "b36a8a1ea83002bed467e903fb207f793f8b2a1498277542b15b935868b985d1"],
  ["2026-10-27T08-01-26-551Z", "ncu-international-application-method-current", "805fe986bf04d941d48cfecf6f4bcf96128ac60555a80c7542f9c49d96575028"],
  ["2026-10-27T08-01-26-551Z", "ncu-international-application-period-current", "c449c54f51ea01a79eb1806f4f2b6245eb1d66cb2ab9ac48072abbd4a48c1fc0"],
  ["2026-10-27T08-01-26-551Z", "ncu-international-degree-tuition-current", "fe1904c2fe3176e2f0a2a2c3ff3b1e2fc550984d8576f61bc36960fe367d537b"],
  ["2026-10-27T08-01-26-551Z", "ncu-international-accommodation-fee-current", "b1ac2af042c6751ed69fb4acac1e85bf7d9393297ff1bb6087f1fc05ca1921ac"],
  ["2026-10-27T08-02-42-532Z", "ncu-international-nondegree-programs-current", "ae9297e9126dd1f6180350fc06bd7cc14e7fd45e7ad0a575a24088a1149bb0ea"],
] as const;
const supportingSources = new Map<string, Source>();
for (const [run, id, sha256] of locks) {
  const directory = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked Nanchang supporting source ${id}.`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  supportingSources.set(id, source);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-133.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanchang");
const base = prior.schools?.find((row) => row.slug === "nanchang-university");
if (!city || !base) throw new Error("Wave 133 Nanchang University dependencies are missing.");
const procedure = supportingSources.get("ncu-international-application-procedure-current")!;
const method = supportingSources.get("ncu-international-application-method-current")!;
const nondegreeSource = supportingSources.get("ncu-international-nondegree-programs-current")!;
const capturedAt = [...supportingSources.values(), ...extraction.programs.map((row) => ({ fetchedAt: row.capturedAt }))]
  .map((row) => row.fetchedAt)
  .sort()
  .at(-1)!;

const school = {
  ...base,
  applicationLevel: "86 current undergraduate references, 190 master references, 33 doctoral references and 7 non-degree or exchange references are captured from the official admissions portal. These current pages do not identify a 2027-specific cycle.",
  deadlineSummary: "The current official application-period page says 'Full Year' and is dated April 18, 2024. It does not publish a 2027-specific opening or deadline, so no 2027 intake row is created.",
  admissionsUrl: method.finalUrl ?? method.url,
  campusHighlights: [
    "Current official project tables cover 22 undergraduate schools and extensive master and doctoral catalogs",
    "Current non-degree catalog includes Chinese-language, business-Chinese, HSK and exchange routes",
    "No applicant-facing 2027-specific cycle is published on the captured pages",
  ],
  lastVerifiedAt: capturedAt,
  sourceUrl: procedure.finalUrl ?? procedure.url,
  sourceLabel: procedure.label,
  sourceSha256: procedure.sha256,
  capturedAt,
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official current undergraduate, master, doctoral and non-degree program pages",
    deadlineSummary: "official current application-period page; cycle limitation retained",
    admissionsUrl: "official current application-method page",
    campusHighlights: "official current program catalogs and cycle limitation",
  },
};

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const shortHash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 10);
const applicationNote = "The official current admissions pages publish generic requirements and a full-year application period but no 2027-specific intake. Confirm the applicable cycle in the application system before applying.";
const degreePrograms = extraction.programs.map((row) => {
  const key = `${row.degreeLevel}\u0000${row.schoolName}\u0000${row.nameEn}`;
  return {
    slug: `nanchang-university-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn).slice(0, 72)}-${shortHash(key)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    fieldCategory: row.schoolName.replace(/^School\s*of\s*/i, "") || row.schoolName,
    subjectArea: row.nameEn,
    applicationUrl: method.finalUrl ?? method.url,
    applicationNote,
    badgeText: "Current official program reference",
    displaySubjects: [row.nameEn],
    displayGroup: `nanchang-${row.degreeLevel.toLowerCase()}-current`,
    displayGroupLabel: `Nanchang University current ${row.degreeLevel.toLowerCase()} references`,
    status: "draft" as const,
    verificationStatus: "unverified" as const,
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    sourceSha256: row.sourceSha256,
    capturedAt: row.capturedAt,
    sourceFieldLineage: {
      nameEn: `official ${row.degreeLevel.toLowerCase()} table under ${row.schoolName}`,
      degreeLevel: "official catalog section",
      fieldCategory: "official school heading retained as catalog grouping",
      subjectArea: "official program label",
      applicationUrl: "official current application method",
      applicationNote: "official current requirements and application-period pages; no 2027 cycle inferred",
      badgeText: "official current program table",
    },
  };
});

const nondegreeSpecs: ReadonlyArray<{ nameEn: string; durationYears?: number; tuitionAmount?: number; tuitionText?: string; note: string }> = [
  { nameEn: "Chinese Language Training Class", durationYears: 1, tuitionAmount: 4500, tuitionText: "CNY 4,500 per period", note: "448 class hours over about 32 weeks; classes start in March or September." },
  { nameEn: "Intermediate Business Chinese Class", tuitionAmount: 3000, tuitionText: "CNY 3,000 per period", note: "90 class hours over 6 weeks; class opens with at least 8 students." },
  { nameEn: "Advanced Business Chinese Class", tuitionAmount: 3000, tuitionText: "CNY 3,000 per period", note: "75 class hours over 5 weeks; class opens with at least 8 students." },
  { nameEn: "HSK Level 3 Intensive Sprint Online Class", tuitionAmount: 1000, tuitionText: "CNY 1,000 per period", note: "30 class hours over 2 weeks; class opens with at least 8 students." },
  { nameEn: "HSK Level 4 Intensive Sprint Online Class", tuitionAmount: 1300, tuitionText: "CNY 1,300 per period", note: "45 class hours over 3 weeks; class opens with at least 8 students." },
  { nameEn: "HSK Level 5 Intensive Sprint Online Class", tuitionAmount: 1600, tuitionText: "CNY 1,600 per period", note: "60 class hours over 4 weeks; class opens with at least 8 students." },
  { nameEn: "Exchange Students Program", note: "Available to students from overseas partner universities according to the inter-university agreement." },
];
const nondegreeEvidence = {
  sourceUrl: nondegreeSource.finalUrl ?? nondegreeSource.url,
  sourceLabel: nondegreeSource.label,
  sourceSha256: nondegreeSource.sha256,
  capturedAt: nondegreeSource.fetchedAt,
};
const nondegreePrograms = nondegreeSpecs.map((spec) => ({
  slug: `nanchang-university-nondegree-${slugify(spec.nameEn)}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: spec.nameEn,
  degreeLevel: "Non-degree",
  fieldCategory: spec.nameEn === "Exchange Students Program" ? "Exchange Study" : "Chinese Language and Test Preparation",
  subjectArea: spec.nameEn,
  teachingLanguage: spec.nameEn === "Exchange Students Program" ? undefined : "Chinese",
  ...(spec.durationYears ? { durationYears: spec.durationYears } : {}),
  ...(spec.tuitionAmount ? { tuitionAmount: spec.tuitionAmount, tuitionCurrency: "CNY", tuitionPeriod: "period", tuitionText: spec.tuitionText } : {}),
  applicationUrl: method.finalUrl ?? method.url,
  applicationNote: `${spec.note} The current page does not assign a 2027-specific intake or deadline.`,
  badgeText: "Current official non-degree reference",
  displaySubjects: [spec.nameEn],
  displayGroup: "nanchang-nondegree-current",
  displayGroupLabel: "Nanchang University current non-degree references",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  ...nondegreeEvidence,
  sourceFieldLineage: {
    nameEn: "official current non-degree program heading",
    degreeLevel: "official non-degree catalog section",
    fieldCategory: "official route type plus CUAC grouping",
    subjectArea: "official route heading",
    ...(spec.nameEn === "Exchange Students Program" ? {} : { teachingLanguage: "official Chinese-language or HSK scope" }),
    ...(spec.durationYears ? { durationYears: "official one-year and class-hour statement" } : {}),
    ...(spec.tuitionAmount ? { tuitionAmount: "official fee table", tuitionCurrency: "official yuan-denominated fee", tuitionPeriod: "official per-period fee", tuitionText: "official fee table" } : {}),
    applicationUrl: "official current application method",
    applicationNote: "official duration, opening condition and cycle limitation",
    badgeText: "official current non-degree page",
  },
}));

const programs = [...degreePrograms, ...nondegreePrograms];
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: capturedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [
  ...extraction.evidence.map((source) => ({ ...source, contentType: "text/html" })),
  ...supportingSources.values(),
].filter((source, index, rows) => rows.findIndex((row) => row.id === source.id) === index)
  .map((source) => ({ id: source.id, label: source.label, url: "finalUrl" in source ? source.finalUrl ?? source.url : source.url, contentType: "contentType" in source ? source.contentType : "text/html", fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: capturedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 74, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence,
  extraction: { path: "catalog-sources/ncu-current-programs.extracted.json", sha256: extractionSha256, degreeProgramCount: degreePrograms.length, nondegreeProgramCount: nondegreePrograms.length },
  unresolved: [
    "The official pages are current but dated April 18, 2024 or carry a 2022 site footer; they do not identify a 2027-specific intake. No 2027 intake, deadline, duration or teaching language is inferred for degree routes.",
    "The official tuition page publishes degree-level arts/sciences/medicine price bands but does not map every listed program to a billing category; route-level degree tuition remains blank.",
    "Exact duplicate program labels within the same school and level are deduplicated; similarly named programs under different schools remain separate source-bounded references.",
    "The source repeats Pediatrics (Clinical) within the same medical-school master row; the duplicate is represented once.",
    "Public staff contact details and payment instructions are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional program, requirement and fee facts are included; applicant data, personal contacts and payment account details are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-230");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 230, candidateSha256, counts: validation.summary, extractedDegreePrograms: extraction.counts, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
