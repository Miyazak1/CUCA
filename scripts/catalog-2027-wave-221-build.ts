import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type ExtractedProgram = {
  degreeLevel: "Master" | "Doctoral";
  college: string;
  disciplineCategory: string;
  programCode: string;
  nameEn: string;
  professional: boolean;
  sourceId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256: string;
  capturedAt: string;
};

type Extraction = {
  version: number;
  schoolSlug: string;
  sourceRun: string;
  sourcePagePublishedAt: string;
  sources: Array<{ id: string; url: string; sha256: string; fetchedAt: string }>;
  counts: { total: number; master: number; doctoral: number; professionalMaster: number };
  programs: ExtractedProgram[];
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
const extraction = JSON.parse(await readFile(resolve(root, "catalog-sources/njau-current-graduate-programs.extracted.json"), "utf8")) as Extraction;
if (extraction.version !== 1 || extraction.schoolSlug !== "nanjing-agricultural-university" || extraction.counts.total !== 152 || extraction.programs.length !== 152) {
  throw new Error("Unexpected NJAU graduate extraction shape.");
}
const runRoot = resolve(root, extraction.sourceRun);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const sources = new Map(manifest.sources.map((source) => [source.id, source]));
for (const locked of extraction.sources) {
  const source = sources.get(locked.id);
  if (!source || source.status !== 200 || source.sha256 !== locked.sha256 || source.fetchedAt !== locked.fetchedAt) {
    throw new Error(`Missing locked NJAU source: ${locked.id}`);
  }
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`NJAU source hash mismatch: ${source.id}`);
}
const notice = sources.get("njau-international-notice-index-en-current");
if (!notice || notice.status !== 200 || notice.sha256 !== "60d82e3988d06deca9efc622ef87fdc81cac4cd0c3419c20a7b15ad4913c5488") {
  throw new Error("Missing locked NJAU current notice index.");
}
if (createHash("sha256").update(await readFile(resolve(runRoot, notice.artifactPath))).digest("hex") !== notice.sha256) {
  throw new Error("NJAU notice-index hash mismatch.");
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-123.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanjing");
const school = prior.schools?.find((row) => row.slug === extraction.schoolSlug);
if (!city || !school || prior.programs?.length !== 72 || prior.programIntakes?.length !== 72) {
  throw new Error("Wave 221 requires the complete Wave 123 NJAU undergraduate candidate.");
}

const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
const graduatePrograms: CatalogSeedProgram[] = extraction.programs.map((entry, index) => ({
  slug: `${school.slug}-${entry.degreeLevel.toLowerCase()}-${String(index + 1).padStart(3, "0")}-${entry.programCode.toLowerCase()}-${slugify(entry.nameEn)}-${slugify(entry.college)}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: entry.nameEn,
  degreeLevel: entry.degreeLevel,
  fieldCategory: entry.college,
  subjectArea: entry.disciplineCategory,
  applicationNote: `Current official ${entry.degreeLevel.toLowerCase()} program code ${entry.programCode}${entry.professional ? "; marked by NJAU as a professional master's program" : ""}. The page was originally published March 22, 2022 and remained in the current Degree Programs section when captured in October 2026. No 2027 graduate intake or deadline is inferred.`,
  badgeText: entry.professional ? "Current professional master's program" : "Current official graduate program",
  displaySubjects: [entry.nameEn],
  displayGroup: entry.degreeLevel,
  displayGroupLabel: `${entry.degreeLevel} programs`,
  status: "draft",
  verificationStatus: "unverified",
  lastVerifiedAt: entry.capturedAt,
  sourceUrl: entry.sourceUrl,
  sourceLabel: entry.sourceLabel,
  sourceSha256: entry.sourceSha256,
  capturedAt: entry.capturedAt,
  sourceFieldLineage: {
    nameEn: `official ${entry.degreeLevel.toLowerCase()} program table`,
    degreeLevel: "official page title and program-table heading",
    fieldCategory: "official program-table college column",
    subjectArea: "official program-table discipline-category column",
    applicationNote: "official program code, professional-master marker and page publication date; unresolved 2027 cycle stated explicitly",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: [notice.fetchedAt, ...extraction.programs.map((program) => program.capturedAt)].sort().at(-1)!,
  cities: [city],
  schools: [school],
  programs: [...prior.programs, ...graduatePrograms],
  programIntakes: prior.programIntakes,
  scholarships: prior.scholarships,
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Wave 221 validation failed:\n${validation.errors.join("\n")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 55,
    schoolSlugs: [school.slug],
    programs: candidate.programs?.length ?? 0,
    programIntakes: candidate.programIntakes?.length ?? 0,
    scholarships: candidate.scholarships?.length ?? 0,
  },
  evidence: [...extraction.sources, { id: notice.id, url: notice.finalUrl ?? notice.url, sha256: notice.sha256, fetchedAt: notice.fetchedAt }],
  unresolved: [
    "The 98 master's and 54 doctoral rows come from official current Degree Programs pages originally published on March 22, 2022. They are retained as current-reference program rows and are not relabeled as 2027 admissions.",
    "The official notice index lists 2027 international admission and CSC-NAU High-level Graduate Students Program notices, but their details are hosted in external official WeChat pages that the registered collector cannot inspect. No deadline, intake, scholarship coverage or eligibility is inferred from notice titles.",
    "The graduate tables publish no teaching language, duration, tuition, language threshold or application calendar. Those fields remain absent.",
    "Identical program codes and names offered by different colleges remain distinct rows because the official table publishes separate college ownership.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only institutional college, discipline, program-code and program-name data is retained; personal contacts are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-221");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 221, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
