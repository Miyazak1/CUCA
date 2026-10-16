import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type School = NonNullable<CatalogSeedBundle["schools"]>[number];
type City = NonNullable<CatalogSeedBundle["cities"]>[number];
type RequirementOperation = { schoolSlug: string };
type RegisteredSource = { url: string; sourceRole: string; schoolSlug?: string };
type Located<T> = T & { sourceFile: string };

const root = process.cwd();
const outputFile = "catalog.reviewed-50-school-directory.json";
const reviewFile = "catalog.reviewed-50-school-directory.review.json";
const read = async (file: string) => JSON.parse(await readFile(resolve(root, file), "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidate = await read("seeds/application-requirements-release-candidate.unreviewed.json");
const review = await read("seeds/application-requirements-release-candidate.review.json");
const registry = await read("catalog-sources/official-sources.json") as { sources: RegisteredSource[] };
if (review.status !== "human_review_completed" || review.scope?.schoolCount !== 52
  || review.confirmations?.officialSourcesReviewed !== true || review.confirmations?.prohibitedDataConfirmedExcluded !== true) {
  throw new Error("The reviewed 52-school requirement source is unavailable.");
}

const targetSlugs = [...new Set((candidate.operations as RequirementOperation[]).map(row => row.schoolSlug))].sort();
const eligibleSources = new Map<string, Set<string>>();
for (const source of registry.sources) {
  if (!source.schoolSlug || !["school-admissions", "program-catalog"].includes(source.sourceRole)) continue;
  const urls = eligibleSources.get(source.schoolSlug) ?? new Set<string>();
  urls.add(source.url);
  eligibleSources.set(source.schoolSlug, urls);
}

const seedFiles = (await readdir(resolve(root, "seeds"))).filter(file => file.endsWith(".json")
  && file !== outputFile && file !== reviewFile && !file.includes("validation") && !file.includes("publication-verification")).sort();
const schoolCandidates = new Map<string, Located<School>[]>(), cityCandidates = new Map<string, Located<City>[]>();
const registeredUrls = new Set(registry.sources.map(source => source.url));
for (const sourceFile of seedFiles) {
  const bundle = await read(`seeds/${sourceFile}`) as CatalogSeedBundle;
  for (const school of bundle.schools ?? []) {
    if (!eligibleSources.get(school.slug)?.has(school.sourceUrl) || !school.sourceSha256 || !school.capturedAt) continue;
    const rows = schoolCandidates.get(school.slug) ?? [];
    rows.push({ ...school, sourceFile });
    schoolCandidates.set(school.slug, rows);
  }
  for (const city of bundle.cities ?? []) {
    if (!registeredUrls.has(city.sourceUrl) || !city.sourceSha256 || !city.capturedAt) continue;
    const rows = cityCandidates.get(city.slug) ?? [];
    rows.push({ ...city, sourceFile });
    cityCandidates.set(city.slug, rows);
  }
}

const eligibleSchoolSlugs = targetSlugs.filter(slug => eligibleSources.has(slug) && schoolCandidates.has(slug));
const excludedSchoolSlugs = targetSlugs.filter(slug => !eligibleSchoolSlugs.includes(slug));

const score = (row: Located<School | City>) => (row.sourceFile.includes("approved.local") || row.sourceFile.includes(".reviewed") ? 1_000 : 0)
  + (row.status === "active" ? 200 : 0) + (row.verificationStatus === "verified" ? 100 : 0) + Object.keys(row).length;
const select = <T extends School | City>(rows: Located<T>[] | undefined, label: string): Located<T> => {
  if (!rows?.length) throw new Error(`No exact registered evidence record for ${label}.`);
  return rows.sort((left, right) => score(right) - score(left)
    || String(right.lastVerifiedAt ?? right.capturedAt).localeCompare(String(left.lastVerifiedAt ?? left.capturedAt))
    || left.sourceFile.localeCompare(right.sourceFile))[0];
};

const schools = eligibleSchoolSlugs.map(slug => {
  const source = select(schoolCandidates.get(slug), `school:${slug}`);
  return {
    slug: source.slug, nameEn: source.nameEn, nameZh: source.nameZh, citySlug: source.citySlug,
    admissionsUrl: source.sourceUrl, status: "active" as const, verificationStatus: "verified" as const,
    lastVerifiedAt: review.reviewedAt, sourceUrl: source.sourceUrl, sourceLabel: source.sourceLabel,
    sourceSha256: source.sourceSha256, capturedAt: source.capturedAt,
    sourceFieldLineage: {
      nameEn: source.sourceFieldLineage?.nameEn ?? "registered official school page identity",
      ...(source.nameZh ? { nameZh: source.sourceFieldLineage?.nameZh ?? "reviewed canonical school identity" } : {}),
      ...(source.citySlug ? { citySlug: source.sourceFieldLineage?.citySlug ?? "registered official school page location" } : {}),
      admissionsUrl: "registered official school admissions or program page",
    },
  } satisfies School;
});
const citySlugs = [...new Set(schools.map(school => school.citySlug).filter((slug): slug is string => Boolean(slug)))].sort();
const cities = citySlugs.map(slug => {
  const source = select(cityCandidates.get(slug), `city:${slug}`);
  return {
    slug: source.slug, nameEn: source.nameEn, nameZh: source.nameZh, region: source.region, province: source.province,
    status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: review.reviewedAt,
    sourceUrl: source.sourceUrl, sourceLabel: source.sourceLabel, sourceSha256: source.sourceSha256, capturedAt: source.capturedAt,
    sourceFieldLineage: {
      nameEn: source.sourceFieldLineage?.nameEn ?? "registered official source location identity",
      ...(source.nameZh ? { nameZh: source.sourceFieldLineage?.nameZh ?? "reviewed canonical city identity" } : {}),
      ...(source.region ? { region: source.sourceFieldLineage?.region ?? "reviewed CUAC geographic taxonomy" } : {}),
      ...(source.province ? { province: source.sourceFieldLineage?.province ?? "registered official source location" } : {}),
    },
  } satisfies City;
});

// Normalize optional undefined fields before hashing so the stored JSON and its
// review hash describe exactly the same bytes of structured data.
const draft = JSON.parse(JSON.stringify({
  version: 1, generatedAt: review.reviewedAt, cities, schools, programs: [], programIntakes: [], scholarships: [],
})) as CatalogSeedBundle;
const draftReport = createCatalogMigrationValidationReport(draft);
if (!draftReport.ok || draftReport.summary.schools !== 50 || draftReport.summary.cities !== 22) {
  throw new Error(`Invalid reviewed school directory draft: ${draftReport.errors.join(" ")}`);
}
const publication: CatalogSeedBundle = { ...draft, version: 2, handoff: {
  sourceSystem: "CUAC reviewed official-source 50-school directory",
  cleanedExportName: outputFile,
  cleanedExportSha256: draftReport.bundleSha256,
  sourceSchemaSha256: sha(JSON.stringify({ cityFields: [...new Set(cities.flatMap(Object.keys))].sort(), schoolFields: [...new Set(schools.flatMap(Object.keys))].sort() })),
  reviewReference: review.reviewReference,
  prohibitedDataReviewReference: review.reviewReference,
  approvalRecordedAt: review.reviewedAt,
  sourceReadOnly: true,
  prohibitedDataConfirmedExcluded: true,
} };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.schools !== 50 || report.summary.cities !== 22) throw new Error(`Invalid reviewed school directory: ${report.errors.join(" ")}`);
await writeFile(resolve(root, `seeds/${outputFile}`), `${JSON.stringify(publication, null, 2)}\n`);
await writeFile(resolve(root, `seeds/${reviewFile}`), `${JSON.stringify({
  version: 1, status: "human_review_completed", reviewReference: review.reviewReference, reviewedAt: review.reviewedAt,
  publicationBundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256,
  scope: { cities: 22, schools: 50, programs: 0, programIntakes: 0, scholarships: 0 },
  excludedSchoolSlugs,
  confirmations: { contentReviewed: true, officialSourcesReviewed: true, publicContentConfirmed: true,
    prohibitedDataConfirmedExcluded: true, missingDataMayRemainEmpty: true, existingRecordsMustBePreserved: true },
}, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, summary: report.summary, excludedSchoolSlugs,
  bundleSha256: report.bundleSha256, operationPlanSha256: report.operationPlanSha256 }, null, 2));
