import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ExtractedRoute = {
  degreeLevel: "Master" | "Doctoral";
  page: number;
  nameZh: string;
  nameEn: string;
  facultyZh: string;
  facultyEn: string;
  teachingLanguage: "Chinese" | "English" | "Chinese and English";
};

type Extraction = {
  version: number;
  schoolSlug: string;
  sourceCatalogYear: number;
  currentGuideAcademicYear: string;
  sources: Array<{ id: string; url: string; sha256: string; fetchedAt: string; pages: number; routes: number }>;
  counts: { total: number; master: number; doctoral: number };
  routes: ExtractedRoute[];
};

type ManifestSource = {
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

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-27T06-19-53-740Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const sources = new Map(manifest.sources.map((source) => [source.id, source]));
const requiredIds = [
  "swjtu-degree-program-index-2026-2027",
  "swjtu-self-supported-guide-2026-2027",
  "swjtu-presidential-scholarship-guide-2026-2027",
  "swjtu-csc-high-level-postgraduate-guide-2026-2027",
  "swjtu-master-program-catalog-current",
  "swjtu-doctoral-program-catalog-current",
];
for (const id of requiredIds) {
  const source = sources.get(id);
  if (!source || source.status !== 200) throw new Error(`Missing locked SWJTU source: ${id}`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`SWJTU source hash mismatch: ${id}`);
}

const extraction = JSON.parse(await readFile(resolve(root, "catalog-sources/swjtu-current-graduate-programs.extracted.json"), "utf8")) as Extraction;
if (extraction.version !== 1 || extraction.schoolSlug !== "southwest-jiaotong-university" || extraction.counts.total !== 89 || extraction.routes.length !== 89) {
  throw new Error("Unexpected SWJTU graduate extraction shape.");
}
for (const locked of extraction.sources) {
  const source = sources.get(locked.id);
  if (!source || source.sha256 !== locked.sha256 || source.fetchedAt !== locked.fetchedAt) throw new Error(`SWJTU extraction provenance mismatch: ${locked.id}`);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-120.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "chengdu");
const school = prior.schools?.find((row) => row.slug === "southwest-jiaotong-university");
if (!city || !school || prior.programs?.length !== 2 || prior.programIntakes?.length !== 4) throw new Error("Wave 220 requires the complete Wave 120 SWJTU language candidate.");

const selfSupported = sources.get("swjtu-self-supported-guide-2026-2027")!;
const presidential = sources.get("swjtu-presidential-scholarship-guide-2026-2027")!;
const csc = sources.get("swjtu-csc-high-level-postgraduate-guide-2026-2027")!;
const programSources = new Map(extraction.sources.map((source) => [source.id, sources.get(source.id)!]));
const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

const graduatePrograms: CatalogSeedProgram[] = extraction.routes.map((entry, index) => {
  const sourceId = entry.degreeLevel === "Master" ? "swjtu-master-program-catalog-current" : "swjtu-doctoral-program-catalog-current";
  const source = programSources.get(sourceId)!;
  const englishAvailable = entry.teachingLanguage.includes("English");
  return {
    slug: `southwest-jiaotong-university-${entry.degreeLevel.toLowerCase()}-${String(index + 1).padStart(3, "0")}-${slugify(entry.nameEn)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: entry.nameEn,
    nameZh: entry.nameZh,
    degreeLevel: entry.degreeLevel,
    fieldCategory: entry.facultyEn || entry.facultyZh,
    subjectArea: entry.nameEn,
    teachingLanguage: entry.teachingLanguage,
    durationMonths: entry.degreeLevel === "Master" ? 36 : 48,
    hskRequirement: "For Chinese-taught self-supported study, the current guide requires HSK 5 score 180 for science/engineering or HSK 4 score 180 for liberal arts/management, subject to the selected major.",
    ...(englishAvailable ? { englishRequirement: "For non-native English speakers, IELTS 6.0, TOEFL iBT 80, equivalent results, proof of prior English-medium study, or other valid English-proficiency evidence is required." } : {}),
    scholarshipText: "The current 2026/2027 guide links this catalog to self-supported study, the SWJTU Presidential Scholarship and, for graduate routes, the Chinese Government Scholarship High-level Postgraduate Program.",
    applicationUrl: selfSupported.finalUrl ?? selfSupported.url,
    applicationNote: "The official PDF labels its major list as 2025, while the current 2026/2027 admission guide continues to link it as the available program catalog. The self-supported application deadline was June 30, 2026; no 2027 degree deadline is published.",
    hasScholarship: true,
    badgeText: "Current official catalog; 2027 degree cycle pending",
    displaySubjects: [entry.nameEn],
    displayGroup: entry.degreeLevel,
    displayGroupLabel: `${entry.degreeLevel} programs`,
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `official ${entry.degreeLevel.toLowerCase()} program PDF English-major column`,
      nameZh: `official ${entry.degreeLevel.toLowerCase()} program PDF Chinese-major column`,
      degreeLevel: "official PDF title",
      fieldCategory: "official program PDF school/faculty column",
      subjectArea: "official program PDF English-major column",
      teachingLanguage: "official program PDF teaching-language column",
      durationMonths: "current 2026/2027 self-supported admission guide degree-duration section",
      hskRequirement: "current 2026/2027 self-supported admission guide language section",
      ...(englishAvailable ? { englishRequirement: "current 2026/2027 self-supported admission guide language section" } : {}),
      scholarshipText: "current degree index and official scholarship guides",
      applicationNote: "current guide and source-PDF year labels; unresolved 2027 degree cycle retained explicitly",
    },
  };
});

const graduateIntakes: CatalogSeedProgramIntake[] = graduatePrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-06-30T15:59:59.000Z",
  deadlineLabel: "Closed: self-supported applications ran through June 30, 2026. No 2027 degree deadline is published.",
  applicationRound: "2026/2027 self-supported international degree cycle",
  sourceUrl: selfSupported.finalUrl ?? selfSupported.url,
  sourceLabel: selfSupported.label,
  sourceSha256: selfSupported.sha256,
  capturedAt: selfSupported.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "official degree-program index: September 2026 enrollment",
    intakeYear: "official degree-program index: September 2026 enrollment",
    deadlineDate: "official self-supported guide close date normalized from end-of-day Beijing time to UTC",
    deadlineLabel: "official deadline plus explicit unresolved 2027 degree cycle",
    applicationRound: "official current self-supported guide title",
  },
}));

const scholarshipBase = (source: ManifestSource) => ({
  schoolSlug: school.slug,
  providerNameEn: "Southwest Jiaotong University",
  providerLocation: "Chengdu, Sichuan, China",
  targetCountries: [] as string[],
  targetRegions: [] as string[],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const scholarships: CatalogSeedScholarship[] = [
  {
    slug: "southwest-jiaotong-university-presidential-scholarship-2026-2027",
    ...scholarshipBase(presidential),
    title: "SWJTU Presidential Scholarship 2026-2027",
    type: "university",
    typeLabel: "University scholarship",
    fundingLevel: "Full or partial scholarship",
    coverage: "The full award covers tuition, living expenses, comprehensive medical insurance and on-campus accommodation; partial awards cover one or more of those items.",
    applicableDegree: "Undergraduate, Master, Doctoral",
    applicableProgram: "Eligible international degree programs in the official 2026 program catalog.",
    deadlineDate: "2026-06-01",
    deadlineLabel: "Closed: June 1, 2026",
    applicationRound: "2026/2027 international degree cycle",
    benefitItems: [
      { label: "Tuition", included: true, note: "Included in the full award" },
      { label: "Living expenses", included: true, note: "Included in the full award; no public amount stated" },
      { label: "Accommodation", included: true, note: "On-campus accommodation included in the full award" },
      { label: "Medical insurance", included: true, note: "Comprehensive insurance included in the full award" },
    ],
    actionLinks: [{ label: "Official Presidential Scholarship guide", url: presidential.finalUrl ?? presidential.url, kind: "official-source" }],
    summary: "SWJTU's full-or-partial institutional award for the closed 2026/2027 international degree cycle.",
    sourceFieldLineage: {
      title: "official scholarship-guide title",
      fundingLevel: "official funding section",
      coverage: "official funding section",
      applicableDegree: "official supported-category section",
      applicableProgram: "official linked major catalog",
      deadlineDate: "official application close date",
      deadlineLabel: "official application close date",
      applicationRound: "official guide title",
      benefitItems: "official funding section; unpublished amounts remain unresolved",
      actionLinks: "registered official university source",
      summary: "official scope and funding section",
    },
  },
  {
    slug: "southwest-jiaotong-university-csc-high-level-postgraduate-2026-2027",
    ...scholarshipBase(csc),
    title: "Chinese Government Scholarship High-level Postgraduate Program at SWJTU 2026-2027",
    type: "government",
    typeLabel: "Chinese Government Scholarship Type B",
    fundingLevel: "Full scholarship",
    coverage: "Tuition, living expenses and comprehensive medical insurance are covered; on-campus accommodation is provided.",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "Eligible master's and doctoral programs in the official catalogs.",
    deadlineDate: "2026-02-22",
    deadlineLabel: "Closed: February 22, 2026",
    applicationRound: "2026/2027 High-level Postgraduate Program",
    benefitItems: [
      { label: "Tuition", included: true },
      { label: "Living expenses", included: true, note: "No public amount stated on the guide" },
      { label: "Accommodation", included: true, note: "On-campus accommodation" },
      { label: "Medical insurance", included: true, note: "Comprehensive medical insurance" },
    ],
    actionLinks: [{ label: "Official CSC Type B guide", url: csc.finalUrl ?? csc.url, kind: "official-source" }],
    summary: "The closed 2026/2027 full CSC Type B route for eligible SWJTU master's and doctoral applicants.",
    sourceFieldLineage: {
      title: "official scholarship-guide title",
      fundingLevel: "official funding section",
      coverage: "official funding section",
      applicableDegree: "official supported-category section",
      applicableProgram: "official linked master and doctoral catalogs",
      deadlineDate: "official application close date",
      deadlineLabel: "official application close date",
      applicationRound: "official guide title",
      benefitItems: "official funding section; unpublished amounts remain unresolved",
      actionLinks: "registered official university source",
      summary: "official scope and funding section",
    },
  },
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.sources.map((source) => source.fetchedAt).sort().at(-1)!,
  cities: [city],
  schools: [school],
  programs: [...prior.programs, ...graduatePrograms],
  programIntakes: [...prior.programIntakes, ...graduateIntakes],
  scholarships,
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 220 validation failed:\n${validation.errors.join("\n")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 49, schoolSlugs: [school.slug], programs: candidate.programs?.length ?? 0, programIntakes: candidate.programIntakes?.length ?? 0, scholarships: scholarships.length },
  evidence: requiredIds.map((id) => {
    const source = sources.get(id)!;
    return { id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 };
  }),
  unresolved: [
    "The official graduate PDF files label their program information as 2025, although the current 2026/2027 admission and scholarship guides continue to link them as the available catalogs. Their program names and languages are retained with the 2025 source year and are not relabeled as 2027.",
    "The current degree cycle is for September 2026 entry and is closed. No explicit 2027 undergraduate, master or doctoral international admission cycle is published; no 2027 degree intake is inferred.",
    "The current combined 2026 undergraduate/master/doctoral major attachment is protected by an interactive CAPTCHA. The collector does not bypass it. Accessible official master and doctoral PDFs were extracted; the undergraduate program-level list remains unresolved.",
    "Neither scholarship guide publishes a numeric living allowance. Coverage is retained without inventing amounts.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only institutional program, admissions and scholarship data is retained; personal contacts are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-220");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 220, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
