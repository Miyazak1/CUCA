import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type DegreeLevel = "Bachelor" | "Master" | "Doctoral";
type ProgramRow = { sourceRow: number; degreeLevel: DegreeLevel; nameEn: string; nameZh: string; durationYears: number; teachingLanguage: string; catalogYear: number };
type Extraction = { version: number; run: string; source: { id: string; sha256: string }; counts: { Doctoral: number; Master: number; Bachelor: number; total: number }; programs: ProgramRow[] };
type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const extractionPath = resolve(root, "catalog-sources/tyut-2025-programs.extracted.json");
const extractionText = await readFile(extractionPath, "utf8");
const extraction = JSON.parse(extractionText) as Extraction;
if (extraction.version !== 1 || extraction.counts.total !== 67 || extraction.programs.length !== 67) throw new Error("Unexpected TYUT extraction shape.");

const runRoot = resolve(root, "work/catalog-official", extraction.run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === extraction.source.id && row.status === 200 && row.sha256 === extraction.source.sha256);
if (!source) throw new Error("Missing locked TYUT catalog source.");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== extraction.source.sha256) throw new Error("TYUT catalog evidence hash mismatch.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-150.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "taiyuan");
const priorSchool = prior.schools?.find((row) => row.slug === "taiyuan-university-of-technology");
if (!city || !priorSchool) throw new Error("Wave 235 requires Wave 150 TYUT dependencies.");

const school = {
  ...priorSchool,
  applicationLevel: "The current official international admissions index links a 2025 catalog containing 19 bachelor, 31 master and 17 doctoral programs. The newest cycle-specific guide remains 2026; no 2027 degree intake is inferred.",
  languageOfInstruction: "The 2025 catalog identifies three English-taught and sixteen Chinese-taught bachelor routes. Graduate teaching language is not stated in the catalog.",
  subjectTags: [...new Set(extraction.programs.map((row) => row.nameEn))],
  campusHighlights: ["67 official international program reference rows", "Bachelor, master and doctoral coverage", "Taiyuan, Shanxi"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    ...(priorSchool.sourceFieldLineage ?? {}),
    applicationLevel: "current official admissions index and linked 2025 program catalog",
    languageOfInstruction: "official 2025 bachelor program language column; graduate language absent",
    subjectTags: "official 2025 program catalog",
    campusHighlights: "official catalog counts and institutional location",
  },
};

const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 72);
const programs: CatalogSeedProgram[] = extraction.programs.map((row, index) => ({
  slug: `taiyuan-university-of-technology-${row.degreeLevel.toLowerCase()}-${slugify(row.nameEn)}-2025-ref-${index + 1}`,
  schoolSlug: school.slug,
  citySlug: "taiyuan",
  nameEn: row.nameEn,
  nameZh: row.nameZh,
  degreeLevel: row.degreeLevel,
  durationYears: row.durationYears,
  fieldCategory: "Official international program reference catalog",
  subjectArea: row.nameEn,
  teachingLanguage: row.teachingLanguage,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Official 2025 reference catalog currently linked from the university's international admissions index. This row is not represented as an open 2027 intake; unpublished requirements, fees and deadlines remain empty.",
  badgeText: "Official 2025 reference",
  displaySubjects: [row.nameEn, row.degreeLevel],
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "official 2025 program table",
    nameZh: "official 2025 program table",
    degreeLevel: "official table section",
    durationYears: "official table section duration",
    fieldCategory: "evidence-scope label",
    subjectArea: "official 2025 program table",
    teachingLanguage: row.degreeLevel === "Bachelor" ? "official bachelor language column" : "not stated in official graduate tables",
    applicationUrl: "official catalog page",
    applicationNote: "catalog year and current-index linkage with explicit 2027 limitation",
    badgeText: "evidence-scope label",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 97, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  extraction: { path: "catalog-sources/tyut-2025-programs.extracted.json", sha256: createHash("sha256").update(extractionText).digest("hex"), extractor: "scripts/catalog-tyut-2025-programs-extract.py", expectedPrograms: 67 },
  unresolved: [
    "The program catalog is explicitly labeled 2025. It remains linked from the current official index but is not relabeled as 2027.",
    "The newest cycle-specific international recruitment guide is 2026 and its alternate host presents a TLS certificate for another domain; certificate validation was not bypassed.",
    "Graduate teaching language, route-specific tuition, application requirements, deadlines and a 2027 intake calendar are not published in the accessible catalog and remain empty.",
    "No program intake rows are created because the catalog does not establish a currently open application cycle.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published office contact details and all applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-235");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 235, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
