import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

type School = NonNullable<CatalogSeedBundle["schools"]>[number];
type City = NonNullable<CatalogSeedBundle["cities"]>[number];
type Located<T> = T & { sourceFile: string; sourcePriority: number };
type RegisteredSource = {
  url: string;
  sourceRole: string;
  schoolSlug?: string;
};
type TargetFile = {
  rankingBasis: Record<string, unknown>;
  schools: Array<{
    targetPosition: number;
    publishedRank: string;
    nameEn: string;
    catalogSchoolSlug: string | null;
  }>;
};

const root = process.cwd();
const outputFile = "catalog.top-150-school-directory.candidate.draft.json";
const validationFile = "catalog.top-150-school-directory.candidate.validation.json";
const reviewFile = "catalog.top-150-school-directory.candidate.review.json";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;

const target = await readJson<TargetFile>("catalog-sources/china-top-150-targets.2026.json");
const registry = await readJson<{ sources: RegisteredSource[] }>("catalog-sources/official-sources.json");
const targets = target.schools.map((row) => {
  if (!row.catalogSchoolSlug) throw new Error(`Top-150 target position ${row.targetPosition} has no catalog school slug.`);
  return { ...row, slug: row.catalogSchoolSlug };
});
if (targets.length !== 150 || new Set(targets.map((row) => row.slug)).size !== 150) {
  throw new Error(`Expected 150 unique target schools, found ${targets.length}.`);
}

const allowedSchoolRoles = new Set(["school-admissions", "program-catalog", "freshness-index", "scholarship"]);
const registeredSchoolUrls = new Map<string, Set<string>>();
for (const source of registry.sources) {
  if (!source.schoolSlug || !allowedSchoolRoles.has(source.sourceRole)) continue;
  const urls = registeredSchoolUrls.get(source.schoolSlug) ?? new Set<string>();
  urls.add(source.url);
  registeredSchoolUrls.set(source.schoolSlug, urls);
}
const registeredUrls = new Set(registry.sources.map((source) => source.url));

const sourcePriority = (file: string) => {
  const wave = file.match(/catalog\.2027-wave-(\d+)\.draft\.json$/i)?.[1];
  if (wave) return 10_000 + Number(wave);
  if (file === "catalog.2027-release.reviewed.json") return 9_000;
  if (file === "catalog.reviewed-100-official-release.json") return 8_000;
  if (file === "catalog.current-2027-prerequisites.reviewed.json") return 7_000;
  if (file === "catalog.reviewed-50-school-directory.json") return 6_000;
  return 0;
};
const seedFiles = (await readdir(resolve(root, "seeds")))
  .filter((file) => sourcePriority(file) > 0 && file !== outputFile)
  .sort((left, right) => sourcePriority(left) - sourcePriority(right) || left.localeCompare(right));
const schoolCandidates = new Map<string, Located<School>[]>();
const cityCandidates = new Map<string, Located<City>[]>();
for (const sourceFile of seedFiles) {
  let bundle: CatalogSeedBundle;
  try {
    bundle = await readJson<CatalogSeedBundle>(`seeds/${sourceFile}`);
  } catch {
    continue;
  }
  const priority = sourcePriority(sourceFile);
  for (const school of bundle.schools ?? []) {
    if (!registeredSchoolUrls.get(school.slug)?.has(school.sourceUrl) || !school.sourceSha256 || !school.capturedAt || !school.sourceFieldLineage) continue;
    const rows = schoolCandidates.get(school.slug) ?? [];
    rows.push({ ...school, sourceFile, sourcePriority: priority });
    schoolCandidates.set(school.slug, rows);
  }
  for (const city of bundle.cities ?? []) {
    if (!registeredUrls.has(city.sourceUrl) || !city.sourceSha256 || !city.capturedAt || !city.sourceFieldLineage) continue;
    const rows = cityCandidates.get(city.slug) ?? [];
    rows.push({ ...city, sourceFile, sourcePriority: priority });
    cityCandidates.set(city.slug, rows);
  }
}

const richness = (row: School | City) => Object.values(row).filter((value) => value !== undefined && value !== null && value !== "").length;
const normalizeName = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const namesMatch = (left: string, right: string) => left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `);
const select = <T extends School | City>(rows: Located<T>[] | undefined, label: string): Located<T> => {
  if (!rows?.length) throw new Error(`No registered official-source candidate exists for ${label}.`);
  return rows.sort((left, right) => right.sourcePriority - left.sourcePriority
    || String(right.capturedAt).localeCompare(String(left.capturedAt))
    || richness(right) - richness(left)
    || left.sourceFile.localeCompare(right.sourceFile))[0];
};

const selections: Array<{ targetPosition: number; schoolSlug: string; sourceFile: string; sourceUrl: string }> = [];
const schools = targets.map((targetSchool) => {
  const source = select(schoolCandidates.get(targetSchool.slug), `school:${targetSchool.slug}`);
  if (!namesMatch(normalizeName(source.nameEn), normalizeName(targetSchool.nameEn))) {
    throw new Error(`Target identity mismatch for ${targetSchool.slug}: ${targetSchool.nameEn} != ${source.nameEn}.`);
  }
  selections.push({
    targetPosition: targetSchool.targetPosition,
    schoolSlug: source.slug,
    sourceFile: source.sourceFile,
    sourceUrl: source.sourceUrl!,
  });
  const { sourceFile: _sourceFile, sourcePriority: _sourcePriority, contactNotes: _contactNotes, ...school } = source;
  void _sourceFile;
  void _sourcePriority;
  void _contactNotes;
  const sourceFieldLineage = { ...(school.sourceFieldLineage ?? {}) };
  delete sourceFieldLineage.contactNotes;
  return { ...school, sourceFieldLineage, status: "draft" as const, verificationStatus: "unverified" as const };
});
const citySlugs = [...new Set(schools.map((school) => school.citySlug).filter((slug): slug is string => Boolean(slug)))].sort();
const cities = citySlugs.map((slug) => {
  const source = select(cityCandidates.get(slug), `city:${slug}`);
  return {
    slug: source.slug,
    nameEn: source.nameEn,
    ...(source.nameZh ? { nameZh: source.nameZh } : {}),
    ...(source.region ? { region: source.region } : {}),
    ...(source.province ? { province: source.province } : {}),
    sourceUrl: source.sourceUrl,
    sourceLabel: source.sourceLabel,
    sourceSha256: source.sourceSha256,
    capturedAt: source.capturedAt,
    sourceFieldLineage: {
      nameEn: source.sourceFieldLineage?.nameEn ?? "registered official source location identity",
      ...(source.nameZh ? { nameZh: source.sourceFieldLineage?.nameZh ?? "reviewed canonical city identity" } : {}),
      ...(source.region ? { region: source.sourceFieldLineage?.region ?? "reviewed CUAC geographic taxonomy" } : {}),
      ...(source.province ? { province: source.sourceFieldLineage?.province ?? "registered official source location" } : {}),
    },
    status: "draft" as const,
    verificationStatus: "unverified" as const,
  };
});

const generatedAt = [...schools.map((row) => row.capturedAt), ...cities.map((row) => row.capturedAt)]
  .filter((value): value is string => Boolean(value)).sort().at(-1);
if (!generatedAt) throw new Error("Top-150 school directory has no capture timestamp.");
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities,
  schools,
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const report = createCatalogMigrationValidationReport(candidate);
if (!report.ok || report.summary.schools !== 150 || report.summary.cities !== citySlugs.length
  || report.summary.programs !== 0 || report.summary.programIntakes !== 0 || report.summary.scholarships !== 0) {
  throw new Error(`Invalid top-150 school-directory candidate: ${report.errors.join(" ")}`);
}
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateFileSha256 = hash(candidateText);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateFileSha256,
  bundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: report.summary,
  target: { rankingBasis: target.rankingBasis, targetSchoolCount: 150 },
  policy: {
    schoolsOnly: true,
    preserveExistingSchools: true,
    preserveExistingCities: true,
    programsWritten: false,
    programIntakesWritten: false,
    scholarshipsWritten: false,
    missingFieldsRemainEmpty: true,
  },
  selections,
};
await Promise.all([
  writeFile(resolve(root, `seeds/${outputFile}`), candidateText, "utf8"),
  writeFile(resolve(root, `seeds/${validationFile}`), `${JSON.stringify({ ...report, candidateFileSha256 }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, `seeds/${reviewFile}`), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidateFileSha256,
  bundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256,
  summary: report.summary,
  outputFile: `seeds/${outputFile}`,
  reviewFile: `seeds/${reviewFile}`,
}, null, 2));
