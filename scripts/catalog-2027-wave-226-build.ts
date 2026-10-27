import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type DegreeLevel = "Bachelor" | "Master" | "Doctoral";
type ProgramRow = { degreeLevel: DegreeLevel; teachingLanguage: "Chinese"; schoolEn: string; nameEn: string; durationYears: number; sourceId: string; sourcePublishedAt: "2019-03-26" };
type Extraction = { version: number; schoolSlug: string; counts: { total: number; bachelor: number; master: number; doctoral: number }; sources: Array<{ id: string; sha256: string }>; programs: ProgramRow[]; sourceRun: string };
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const extractionPath = resolve(root, "catalog-sources/henu-current-degree-programs.extracted.json");
const extractionText = await readFile(extractionPath, "utf8");
const extraction = JSON.parse(extractionText) as Extraction;
if (extraction.version !== 1 || extraction.schoolSlug !== "henan-university" || extraction.counts.total !== 339 || extraction.programs.length !== 339) throw new Error("Unexpected HENU extraction shape.");

const sources = new Map<string, Source>();
const programRun = resolve(root, "work/catalog-official", extraction.sourceRun);
const programManifest = JSON.parse(await readFile(resolve(programRun, "manifest.json"), "utf8")) as { sources: Source[] };
for (const lock of extraction.sources) {
  const source = programManifest.sources.find((item) => item.id === lock.id && item.status === 200 && item.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked HENU source ${lock.id}.`);
  if (createHash("sha256").update(await readFile(resolve(programRun, source.artifactPath))).digest("hex") !== lock.sha256) throw new Error(`Hash mismatch ${lock.id}.`);
  sources.set(lock.id, source);
}

const currentRun = resolve(root, "work/catalog-official/2026-10-27T07-03-15-560Z");
const currentManifest = JSON.parse(await readFile(resolve(currentRun, "manifest.json"), "utf8")) as { sources: Source[] };
for (const [id, sha256] of [
  ["henu-international-admission-index-current", "ca94034d8eeee424a494e28f532843a4f1330f49c7c4e63f81d3f6c1d8dadd87"],
  ["henu-cgs-high-level-graduate-2027-2028", "7b767700f8e54a9bc943e65362bbd1c835ce8ba27d10f4c3e62c9d5130c206ca"],
] as const) {
  const source = currentManifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha256);
  if (!source) throw new Error(`Missing locked HENU source ${id}.`);
  if (createHash("sha256").update(await readFile(resolve(currentRun, source.artifactPath))).digest("hex") !== sha256) throw new Error(`Hash mismatch ${id}.`);
  sources.set(id, source);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-148.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "kaifeng");
const priorSchool = prior.schools?.find((row) => row.slug === extraction.schoolSlug);
const priorScholarship = prior.scholarships?.find((row) => row.schoolSlug === extraction.schoolSlug);
if (!city || !priorSchool || !priorScholarship) throw new Error("Wave 226 requires Wave 148 HENU dependencies.");
const scholarshipSource = sources.get("henu-cgs-high-level-graduate-2027-2028")!;
const admissionIndex = sources.get("henu-international-admission-index-current")!;

const school = {
  ...priorSchool,
  applicationLevel: "Current official Chinese-medium Bachelor, Master and Doctoral reference lists, plus an explicit 2027/2028 Chinese Government Scholarship graduate route",
  tuitionSummary: "The 2027/2028 scholarship covers tuition and free on-campus accommodation. Current self-funded route tuition is not published in the captured sources.",
  subjectTags: [...new Set(extraction.programs.map((row) => row.schoolEn))],
  campusHighlights: ["339 official Chinese-medium reference rows", "Explicit 2027/2028 graduate scholarship route", "Kaifeng, Henan"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: scholarshipSource.fetchedAt,
  sourceUrl: scholarshipSource.finalUrl ?? scholarshipSource.url,
  sourceLabel: scholarshipSource.label,
  sourceSha256: scholarshipSource.sha256,
  capturedAt: scholarshipSource.fetchedAt,
  admissionsUrl: admissionIndex.finalUrl ?? admissionIndex.url,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "official current degree-program index and three linked program tables; explicit 2027/2028 scholarship guide",
    tuitionSummary: "explicit 2027/2028 scholarship coverage; self-funded tuition limitation",
    subjectTags: "official linked program tables",
    campusHighlights: "official linked program tables, scholarship guide and address",
  },
};

const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 72);
const programs: CatalogSeedProgram[] = extraction.programs.map((row, index) => {
  const source = sources.get(row.sourceId)!;
  return {
    slug: `henan-university-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-current-ref-${index + 1}`,
    schoolSlug: extraction.schoolSlug,
    citySlug: "kaifeng",
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    durationYears: row.durationYears,
    fieldCategory: "Official current Chinese-medium reference catalog",
    subjectArea: row.nameEn,
    teachingLanguage: "Chinese",
    applicationUrl: source.finalUrl ?? source.url,
    applicationNote: `The current official degree-program index still links this table, originally published March 26, 2019. It is retained as a current-reference row and is not represented as a 2027 self-funded intake. College: ${row.schoolEn}.`,
    badgeText: "Current official reference",
    displaySubjects: [row.nameEn, row.schoolEn],
    status: "draft",
    verificationStatus: "unverified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official linked program table",
      degreeLevel: "official table title and degree column",
      durationYears: "official linked program table",
      fieldCategory: "evidence-scope label",
      subjectArea: "official linked program table",
      teachingLanguage: "official Chinese-medium page title",
      applicationUrl: "official linked program page",
      applicationNote: "official index linkage, publication date and explicit scope limitation",
      badgeText: "evidence-scope label",
    },
  };
});

const scholarship = { ...priorScholarship, status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: scholarshipSource.fetchedAt, sourceUrl: scholarshipSource.finalUrl ?? scholarshipSource.url, sourceLabel: scholarshipSource.label, sourceSha256: scholarshipSource.sha256, capturedAt: scholarshipSource.fetchedAt };
const candidate: CatalogSeedBundle = { version: 1, generatedAt: scholarshipSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: scholarshipSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 95, schoolSlugs: [extraction.schoolSlug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: 1 },
  evidence,
  extraction: { path: "catalog-sources/henu-current-degree-programs.extracted.json", sha256: createHash("sha256").update(extractionText).digest("hex"), extractor: "scripts/catalog-henu-current-degree-programs-extract.ts", expectedPrograms: 339 },
  unresolved: [
    "The three accessible program tables were published March 26, 2019. They remain linked from the current official degree-program index but are not relabeled as 2027.",
    "The protected 2027/2028 scholarship program annex could not be inspected, so the 339 current-reference rows are not automatically marked scholarship-eligible.",
    "No explicit 2027 self-funded program list, tuition schedule, application deadline or intake calendar is accessible; those fields remain empty.",
    "The official 2027/2028 scholarship materials archive resolves to an access-control page; no protected attachment content is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant or personal staff data is included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-226");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 226, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
