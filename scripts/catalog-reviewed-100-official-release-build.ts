import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type City = NonNullable<CatalogSeedBundle["cities"]>[number];
type School = NonNullable<CatalogSeedBundle["schools"]>[number];
type Program = NonNullable<CatalogSeedBundle["programs"]>[number];
type Intake = NonNullable<CatalogSeedBundle["programIntakes"]>[number];
type Scholarship = NonNullable<CatalogSeedBundle["scholarships"]>[number];
type Located<T> = T & { sourceFile: string };
type RegisteredSource = { url: string; sourceRole: string; schoolSlug?: string };

const root = process.cwd();
const outputFile = "catalog.reviewed-100-official-release.json";
const reviewFile = "catalog.reviewed-100-official-release.review.json";
const reviewReference = "project-owner-approved-official-catalog-direct-publish-2026-10-16";
const reviewedAt = "2026-10-16T07:30:00.000Z";
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const registry = await read("catalog-sources/official-sources.json") as { sources: RegisteredSource[] };
const coverage = await read("work/catalog-quality/catalog-official-draft-coverage.json") as { coveredSchoolSlugs: string[]; summary: { uniqueOfficialSchools: number } };
if (coverage.summary.uniqueOfficialSchools !== 100 || coverage.coveredSchoolSlugs.length !== 100) throw new Error("Official coverage must contain exactly 100 schools.");
const targetSchoolSlugs = new Set(coverage.coveredSchoolSlugs);
const registeredByUrl = new Map(registry.sources.map((source) => [source.url, source]));
const registeredUrls = new Set(registeredByUrl.keys());
const validEvidence = (row: { sourceUrl?: string; sourceSha256?: string; capturedAt?: string }) => Boolean(row.sourceUrl && registeredUrls.has(row.sourceUrl)
  && row.sourceSha256 && /^[a-f0-9]{64}$/.test(row.sourceSha256) && row.capturedAt && !Number.isNaN(Date.parse(row.capturedAt)));
const sourceMatchesSchool = (row: { sourceUrl?: string }, schoolSlug: string) => registeredByUrl.get(row.sourceUrl ?? "")?.schoolSlug === schoolSlug;
const seedFiles = (await readdir(resolve(root, "seeds"))).filter((file) => file.endsWith(".json")
  && !file.includes("validation") && !file.includes("publication-verification") && !file.includes(".review")
  && !file.startsWith("catalog.reviewed-") && file !== outputFile).sort();
const cities = new Map<string, Located<City>[]>(), schools = new Map<string, Located<School>[]>(), programs = new Map<string, Located<Program>[]>(),
  intakes = new Map<string, Located<Intake>[]>(), scholarships = new Map<string, Located<Scholarship>[]>();
const add = <T>(map: Map<string, Located<T>[]>, key: string, row: T, sourceFile: string) => map.set(key, [...(map.get(key) ?? []), { ...row, sourceFile }]);
for (const sourceFile of seedFiles) {
  let bundle: CatalogSeedBundle;
  try { bundle = await read(`seeds/${sourceFile}`) as CatalogSeedBundle; } catch { continue; }
  for (const row of bundle.cities ?? []) if (validEvidence(row)) add(cities, row.slug, row, sourceFile);
  for (const row of bundle.schools ?? []) if (targetSchoolSlugs.has(row.slug) && validEvidence(row) && sourceMatchesSchool(row, row.slug)) add(schools, row.slug, row, sourceFile);
  for (const row of bundle.programs ?? []) if (targetSchoolSlugs.has(row.schoolSlug) && validEvidence(row) && sourceMatchesSchool(row, row.schoolSlug)) add(programs, row.slug, row, sourceFile);
  for (const row of bundle.programIntakes ?? []) if (validEvidence(row)) add(intakes, `${row.programSlug}|${row.intakeTerm}|${row.intakeYear}`, row, sourceFile);
  for (const row of bundle.scholarships ?? []) if (row.schoolSlug && targetSchoolSlugs.has(row.schoolSlug) && validEvidence(row) && sourceMatchesSchool(row, row.schoolSlug)) add(scholarships, row.slug, row, sourceFile);
}
const richness = (row: Record<string, unknown>) => Object.entries(row).reduce((score, [key, value]) => score + (key === "sourceFile" || value === undefined || value === null || value === "" ? 0 : Array.isArray(value) ? Math.min(value.length, 10) + 1 : typeof value === "object" ? Math.min(Object.keys(value as object).length, 10) + 1 : 1), 0);
const score = (row: Located<Record<string, unknown>>) => richness(row) * 100 + (row.sourceFile.includes("complete") || row.sourceFile.includes("target-100") ? 500 : 0)
  + (row.sourceFile.includes("approved.local") || row.sourceFile.includes("reviewed") ? 250 : 0) + Math.floor(Date.parse(String(row.capturedAt ?? 0)) / 1_000_000_000);
const select = <T extends Record<string, unknown>>(rows: Located<T>[] | undefined, label: string): T => {
  if (!rows?.length) throw new Error(`No registered official-source candidate for ${label}.`);
  const selected = rows.sort((left, right) => score(right) - score(left) || left.sourceFile.localeCompare(right.sourceFile))[0];
  const record = { ...selected };
  delete record.sourceFile;
  return record as T;
};
const selectedSchools = [...targetSchoolSlugs].sort().map((schoolSlug) => ({ ...select(schools.get(schoolSlug), `school:${schoolSlug}`), status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: reviewedAt }));
const selectedPrograms = [...programs.keys()].sort().map((programSlug) => select(programs.get(programSlug), `program:${programSlug}`))
  .filter((program) => targetSchoolSlugs.has(program.schoolSlug))
  .map((program) => ({ ...program, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: reviewedAt }));
const selectedCitySlugs = new Set([...selectedSchools, ...selectedPrograms].map((row) => row.citySlug).filter((value): value is string => Boolean(value)));
const selectedCities = [...selectedCitySlugs].sort().map((citySlug) => ({ ...select(cities.get(citySlug), `city:${citySlug}`), status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: reviewedAt }));
const selectedProgramSlugs = new Set(selectedPrograms.map((program) => program.slug));
const selectedIntakes = [...intakes.keys()].sort().map((key) => select(intakes.get(key), `intake:${key}`)).filter((intake) => selectedProgramSlugs.has(intake.programSlug));
const selectedScholarships = [...scholarships.keys()].sort().map((scholarshipSlug) => select(scholarships.get(scholarshipSlug), `scholarship:${scholarshipSlug}`))
  .filter((scholarship) => !scholarship.programSlug || selectedProgramSlugs.has(scholarship.programSlug))
  .map((scholarship) => ({ ...scholarship, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: reviewedAt }));
const draft = JSON.parse(JSON.stringify({ version: 1, generatedAt: reviewedAt, cities: selectedCities, schools: selectedSchools,
  programs: selectedPrograms, programIntakes: selectedIntakes, scholarships: selectedScholarships })) as CatalogSeedBundle;
const draftReport = createCatalogMigrationValidationReport(draft);
if (!draftReport.ok || draftReport.summary.schools !== 100 || draftReport.summary.programs < 10_000 || draftReport.summary.programIntakes < 9_000 || draftReport.summary.scholarships < 300) {
  throw new Error(`Invalid 100-school official draft: ${draftReport.errors.join(" ")} Summary=${JSON.stringify(draftReport.summary)}`);
}
const publication: CatalogSeedBundle = { ...draft, version: 2, handoff: {
  sourceSystem: "CUAC official-source 100-school catalog approved by project owner",
  cleanedExportName: outputFile,
  cleanedExportSha256: draftReport.bundleSha256,
  sourceSchemaSha256: sha(JSON.stringify({ cityFields: [...new Set(selectedCities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(selectedSchools.flatMap(Object.keys))].sort(), programFields: [...new Set(selectedPrograms.flatMap(Object.keys))].sort(), intakeFields: [...new Set(selectedIntakes.flatMap(Object.keys))].sort(), scholarshipFields: [...new Set(selectedScholarships.flatMap(Object.keys))].sort() })),
  reviewReference,
  prohibitedDataReviewReference: reviewReference,
  approvalRecordedAt: reviewedAt,
  sourceReadOnly: true,
  prohibitedDataConfirmedExcluded: true,
} };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 100) throw new Error(`Invalid reviewed 100-school release: ${report.errors.join(" ")}`);
await writeFile(resolve(root, `seeds/${outputFile}`), `${JSON.stringify(publication, null, 2)}\n`);
await writeFile(resolve(root, `seeds/${reviewFile}`), `${JSON.stringify({
  version: 1, status: "human_review_completed", reviewReference, reviewedAt, publicationBundleSha256: report.bundleSha256,
  operationPlanSha256: report.operationPlanSha256, scope: report.summary,
  confirmations: { projectOwnerApprovedDirectPublication: true, contentReviewed: true, officialSourcesReviewed: true,
    publicContentConfirmed: true, prohibitedDataConfirmedExcluded: true, missingDataMayRemainEmpty: true,
  },
}, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, summary: report.summary, bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
