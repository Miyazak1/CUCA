import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

type WaveReview = {
  status?: string;
  candidateSha256?: string;
  publicationAuthorized?: boolean;
  databaseWriteAuthorized?: boolean;
  evidence?: Array<{ id: string; label: string; url: string; fetchedAt: string; sha256: string }>;
};

const root = process.cwd();
const waveNumbers = [1, 2, 3, 4] as const;
const outputPath = resolve(root, "seeds/catalog.2027-release-candidate.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-release-candidate.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-release-candidate.review.json");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const waves: Array<{ number: number; bundle: CatalogSeedBundle; review: WaveReview; candidateSha256: string }> = [];
for (const number of waveNumbers) {
  const stem = `seeds/catalog.2027-wave-0${number}`;
  const candidateText = await readFile(resolve(root, `${stem}.draft.json`), "utf8");
  const bundle = JSON.parse(candidateText) as CatalogSeedBundle;
  const review = JSON.parse(await readFile(resolve(root, `${stem}.review.json`), "utf8")) as WaveReview;
  const candidateSha256 = sha256(candidateText);
  if (review.candidateSha256 !== candidateSha256) throw new Error(`Wave ${number} candidate hash does not match its review artifact.`);
  if (review.status !== "unreviewed_draft" || review.publicationAuthorized !== false || review.databaseWriteAuthorized !== false) {
    throw new Error(`Wave ${number} is not an isolated unreviewed draft.`);
  }
  waves.push({ number, bundle, review, candidateSha256 });
}

const mergeByKey = <T>(rows: T[], keyOf: (row: T) => string, label: string) => {
  const merged = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    const prior = merged.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error(`Conflicting ${label} rows for ${key}.`);
    merged.set(key, row);
  }
  return [...merged.values()];
};

const cities = mergeByKey(waves.flatMap(({ bundle }) => bundle.cities ?? []), (row) => row.slug, "city").sort((a, b) => a.slug.localeCompare(b.slug));
const schools = mergeByKey(waves.flatMap(({ bundle }) => bundle.schools ?? []), (row) => row.slug, "school").sort((a, b) => a.slug.localeCompare(b.slug));
const programs = mergeByKey(waves.flatMap(({ bundle }) => bundle.programs ?? []), (row) => row.slug, "program").sort((a, b) => a.slug.localeCompare(b.slug));
const programIntakes = mergeByKey(
  waves.flatMap(({ bundle }) => bundle.programIntakes ?? []),
  (row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`,
  "program intake",
).sort((a, b) => `${a.programSlug}\u0000${a.intakeTerm}\u0000${a.intakeYear}`.localeCompare(`${b.programSlug}\u0000${b.intakeTerm}\u0000${b.intakeYear}`));
const scholarships = mergeByKey(waves.flatMap(({ bundle }) => bundle.scholarships ?? []), (row) => row.slug, "scholarship").sort((a, b) => a.slug.localeCompare(b.slug));

if (schools.length !== 9) throw new Error(`Expected 9 updated schools plus Tianjin already current, found ${schools.length} updated schools.`);
if (programs.length !== 769) throw new Error(`Expected 769 refreshed program rows, found ${programs.length}.`);
if (programIntakes.length !== 761) throw new Error(`Expected 761 2027 intake rows, found ${programIntakes.length}.`);
if (programIntakes.some((row) => row.intakeYear !== 2027)) throw new Error("Release candidate contains a non-2027 intake.");
if (scholarships.length !== 1) throw new Error(`Expected one current 2027 scholarship, found ${scholarships.length}.`);

const programSlugs = new Set(programs.map((row) => row.slug));
const intakeProgramSlugs = new Set(programIntakes.map((row) => row.programSlug));
const refreshedWithoutNewIntake = [...programSlugs].filter((slug) => !intakeProgramSlugs.has(slug)).sort();
if (refreshedWithoutNewIntake.length !== 8 || refreshedWithoutNewIntake.some((slug) => !slug.startsWith("tsinghua-university-"))) {
  throw new Error(`Expected exactly eight Tsinghua routes whose existing 2027 intakes are preserved, found ${refreshedWithoutNewIntake.length}.`);
}

const generatedAt = waves.map(({ bundle }) => bundle.generatedAt).filter((value): value is string => Boolean(value)).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities,
  schools,
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = sha256(candidateText);
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Unified 2027 candidate validation failed:\n${validation.errors.join("\n")}`);

const evidenceById = new Map<string, NonNullable<WaveReview["evidence"]>[number]>();
for (const { number, review } of waves) {
  for (const row of review.evidence ?? []) {
    const prior = evidenceById.get(row.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error(`Wave ${number} has conflicting evidence metadata for ${row.id}.`);
    evidenceById.set(row.id, row);
  }
}
const evidence = [...evidenceById.values()].sort((a, b) => a.id.localeCompare(b.id));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: {
    requestedSchoolCoverage: 10,
    updatedSchoolCount: schools.length,
    alreadyCurrentSchoolSlugs: ["tianjin-university"],
    completedSchoolCoverage: 10,
  },
  scope: {
    updatedSchoolSlugs: schools.map((row) => row.slug),
    cityDependencies: cities.length,
    refreshedPrograms: programs.length,
    newOrReplacement2027Intakes: programIntakes.length,
    preservedExisting2027IntakeProgramSlugs: refreshedWithoutNewIntake,
    scholarships: scholarships.length,
    sourceSnapshots: evidence.length,
  },
  componentWaves: waves.map(({ number, candidateSha256: waveCandidateSha256 }) => ({ number, candidateSha256: waveCandidateSha256 })),
  evidence,
  notes: [
    "This is a targeted 2027 delta bundle. It does not replay the other 90 schools or replace the already-current Tianjin University 2027 routes.",
    "Eight Tsinghua program records are refreshed while their existing 2027 intake rows are deliberately preserved rather than duplicated.",
    "Fields not explicitly published by the registered official sources remain absent; no 2026 date is rolled forward by assumption.",
    "No applicant, account, passport, payment, or other personal data is present.",
    "Publication remains disabled until a separate completed human review and publication authorization are supplied.",
  ],
};

await Promise.all([
  writeFile(outputPath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  validationPath,
  reviewPath,
  candidateSha256,
  counts: {
    cities: cities.length,
    schools: schools.length,
    programs: programs.length,
    programIntakes: programIntakes.length,
    scholarships: scholarships.length,
    sourceSnapshots: evidence.length,
  },
  targetSchoolCoverage: 10,
  publicationAuthorized: false,
}, null, 2));
