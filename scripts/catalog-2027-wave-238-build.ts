import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type ExtractedProgram = {
  sourceOrdinal: number;
  sourcePage: number;
  degreeLevel: "Undergraduate" | "Master" | "Doctoral";
  nameEn: string;
  durationYears?: number;
  programType?: "Academic" | "Professional";
  catalogYear: 2026;
  sourceId: string;
  sourceSha256: string;
};
type Extraction = {
  version: number;
  run: string;
  counts: { Undergraduate: number; Master: number; Doctoral: number; total: number };
  programs: ExtractedProgram[];
};
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const extractionPath = resolve(root, "catalog-sources/scau-2026-programs.extracted.json");
const extractionText = await readFile(extractionPath, "utf8");
const extraction = JSON.parse(extractionText) as Extraction;
if (extraction.version !== 1 || extraction.run !== "2026-10-27T08-46-18-229Z" || extraction.counts.total !== 209 || extraction.programs.length !== 209) {
  throw new Error("Unexpected SCAU extraction shape.");
}

const pdfRunRoot = resolve(root, "work/catalog-official", extraction.run);
const pdfManifest = JSON.parse(await readFile(resolve(pdfRunRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const feeRunRoot = resolve(root, "work/catalog-official/2026-10-27T08-44-51-555Z");
const feeManifest = JSON.parse(await readFile(resolve(feeRunRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const expected = new Map<string, { sha256: string; runRoot: string }>([
  ["scau-international-undergraduate-program-catalog-pdf-2026", { sha256: "57a59f23f64d546980fee8c1cefd03639ef39044393a0da19a855e3995827b58", runRoot: pdfRunRoot }],
  ["scau-international-master-program-catalog-pdf-2026", { sha256: "480452f16b878f8d4cb1f8a1a8fb977862d90cbe5e803011b2c73dac5b1c766c", runRoot: pdfRunRoot }],
  ["scau-international-doctoral-program-catalog-pdf-2026", { sha256: "3a2a636d303fad84e6b8a41e7a48252b1f5df98a4c0e3a5fbe85471af7a52f08", runRoot: pdfRunRoot }],
  ["scau-international-courses-entry-requirements-current", { sha256: "c0927ecd14ed71129080f32002ac20b571ad7907143d5cba6818c6d113de0b40", runRoot: feeRunRoot }],
  ["scau-international-study-fees-current", { sha256: "48b91c9f7190758b54bdf25e0f5100e79fe083dcca68ae2608d42a8c4bbbc599", runRoot: feeRunRoot }],
]);
const allManifestSources = [...pdfManifest.sources, ...feeManifest.sources];
const sources = new Map<string, Source>();
for (const [id, lock] of expected) {
  const source = allManifestSources.find((row) => row.id === id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked SCAU source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(lock.runRoot, source.artifactPath))).digest("hex");
  if (actual !== lock.sha256) throw new Error(`SCAU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

for (const row of extraction.programs) {
  if (sources.get(row.sourceId)?.sha256 !== row.sourceSha256) throw new Error(`Extraction source mismatch for ${row.degreeLevel} #${row.sourceOrdinal}`);
}

const priorText = await readFile(resolve(root, "seeds/catalog.2027-wave-154.draft.json"), "utf8");
const prior = JSON.parse(priorText) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "guangzhou");
const priorSchool = prior.schools?.find((row) => row.slug === "south-china-agricultural-university");
if (!city || !priorSchool) throw new Error("Wave 238 requires Wave 154 SCAU dependencies.");

const feeSource = sources.get("scau-international-study-fees-current")!;
const school = {
  ...priorSchool,
  applicationLevel: "The current official 2026 international catalogs contain 95 undergraduate, 80 master and 34 doctoral program rows. No 2027 intake is inferred from these reference catalogs.",
  languageOfInstruction: "Teaching language is not stated per program in the captured catalogs. The current fee page separately identifies an English-taught Plant Protection master tuition category, but it does not uniquely map that category to one of the two same-named catalog rows.",
  tuitionSummary: "Current official annual tuition bands are CNY 15,000 for undergraduate humanities/social sciences and science/engineering, CNY 22,500 for undergraduate art, CNY 20,000 for master humanities/social sciences and science/engineering, CNY 30,000 for master art, and CNY 28,000 for doctoral humanities/social sciences and science/engineering. The English-taught Plant Protection master category is CNY 26,000/year. Application fee is CNY 500.",
  deadlineSummary: "The maintained application procedure gives March 1-June 30 for self-funded applications, but the captured current sources do not label that recurring window as a 2027 intake.",
  campusHighlights: ["209 official 2026 international program reference rows", "95 undergraduate, 80 master and 34 doctoral routes", "Guangzhou, Guangdong"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: feeSource.fetchedAt,
  sourceUrl: feeSource.finalUrl ?? feeSource.url,
  sourceLabel: feeSource.label,
  sourceSha256: feeSource.sha256,
  capturedAt: feeSource.fetchedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official 2026 undergraduate, master and doctoral catalog PDFs",
    languageOfInstruction: "official current fee page plus explicit catalog limitation",
    tuitionSummary: "official current international study-fee page",
    deadlineSummary: "maintained application procedure retained with explicit missing-cycle limitation",
    campusHighlights: "official 2026 catalog row counts and institutional location",
  },
};

const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 72);
const programs: CatalogSeedProgram[] = extraction.programs.map((row) => {
  const source = sources.get(row.sourceId)!;
  const degreeKey = row.degreeLevel.toLowerCase();
  return {
    slug: `south-china-agricultural-university-${degreeKey}-${slugify(row.nameEn)}-2026-ref-${row.sourceOrdinal}`,
    schoolSlug: school.slug,
    citySlug: "guangzhou",
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    ...(row.durationYears ? { durationYears: row.durationYears } : {}),
    fieldCategory: row.programType ? `Official 2026 ${row.programType.toLowerCase()} program reference` : "Official 2026 international program reference",
    subjectArea: row.nameEn,
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: "Official 2026 reference catalog row. This record is not represented as an open 2027 intake; unpublished language, requirements, fees and deadlines remain empty.",
    badgeText: "Official 2026 reference",
    displaySubjects: [row.nameEn, row.degreeLevel, ...(row.programType ? [row.programType] : [])],
    displayGroup: `scau-2026-${degreeKey}`,
    displayGroupLabel: `SCAU 2026 ${row.degreeLevel.toLowerCase()} reference catalog`,
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: `official 2026 PDF page ${row.sourcePage}, program ordinal ${row.sourceOrdinal}`,
      degreeLevel: "official PDF catalog title",
      ...(row.durationYears ? { durationYears: `official 2026 PDF page ${row.sourcePage}, study-length column` } : {}),
      ...(row.programType ? { fieldCategory: `official 2026 PDF page ${row.sourcePage}, program-type column` } : { fieldCategory: "evidence-scope label" }),
      subjectArea: "official English program name",
      applicationUrl: "exact official 2026 catalog PDF",
      applicationNote: "catalog year and explicit 2027 limitation",
      badgeText: "evidence-scope label",
    },
  };
});

const candidate: CatalogSeedBundle = { version: 1, generatedAt: feeSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, contentType: row.contentType, fetchedAt: row.fetchedAt, sha256: row.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: feeSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 103, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence,
  extraction: { path: "catalog-sources/scau-2026-programs.extracted.json", sha256: createHash("sha256").update(extractionText).digest("hex"), extractor: "scripts/catalog-scau-2026-programs-extract.py", expectedPrograms: 209, baseCandidatePath: "seeds/catalog.2027-wave-154.draft.json", baseCandidateSha256: createHash("sha256").update(priorText).digest("hex") },
  unresolved: [
    "The program PDFs are explicitly 2026 reference catalogs and are not relabeled as a 2027 intake.",
    "No route-specific 2027 application deadline, intake status or application calendar is published in the captured sources; no intake rows are created.",
    "Teaching language and admissions requirements are not stated per program in the catalogs and remain empty.",
    "The fee page publishes degree/discipline bands rather than a complete per-program mapping, so tuition is retained at school-summary level. The Plant Protection English-master band cannot be uniquely assigned to either same-named catalog row.",
    "The PDFs' embedded Chinese font maps do not decode reliably. Chinese program labels are omitted instead of storing mojibake.",
    "No cycle-specific 2027 scholarship notice is represented as a current award record.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant records, personal documents or published staff contact details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-238");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 238, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
