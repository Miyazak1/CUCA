import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  OfficialCatalogAcquisitionManifest,
  OfficialCatalogSourceRegistry,
} from "../src/server/catalog/official-source.ts";

type Failure = { id: string; url: string; error: string };

const option = (name: string) => process.argv.slice(2).find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const manifestOption = option("--manifest");
if (!manifestOption) throw new Error("--manifest=<path> is required.");

const root = process.cwd();
const manifestPath = resolve(root, manifestOption);
const current = JSON.parse(await readFile(manifestPath, "utf8")) as OfficialCatalogAcquisitionManifest;
const registry = JSON.parse(await readFile(resolve(root, "catalog-sources/official-sources.json"), "utf8")) as OfficialCatalogSourceRegistry;
const schoolBySource = new Map(registry.sources.map((source) => [source.id, source.schoolSlug ?? null]));
const currentDir = dirname(manifestPath);
const failures = await readFailures(resolve(currentDir, "failures.json"));

const priorById = new Map<string, OfficialCatalogAcquisitionManifest["sources"][number]>();
for (const path of await findManifestPaths(resolve(root, "work/catalog-official"))) {
  if (resolve(path) === manifestPath) continue;
  const manifest = JSON.parse(await readFile(path, "utf8")) as OfficialCatalogAcquisitionManifest;
  for (const source of manifest.sources) {
    const prior = priorById.get(source.id);
    if (!prior || Date.parse(source.fetchedAt) > Date.parse(prior.fetchedAt)) priorById.set(source.id, source);
  }
}

const sourceResults = current.sources.map((source) => {
  const prior = priorById.get(source.id);
  const result = !prior ? "new" : prior.sha256 === source.sha256 ? "unchanged" : "changed";
  return {
    id: source.id,
    schoolSlug: schoolBySource.get(source.id) ?? null,
    result,
    previousFetchedAt: prior?.fetchedAt ?? null,
    previousSha256: prior?.sha256 ?? null,
    fetchedAt: source.fetchedAt,
    sha256: source.sha256,
    finalUrl: source.finalUrl,
    redirectChanged: prior ? prior.finalUrl !== source.finalUrl : false,
    contentTypeChanged: prior ? prior.contentType !== source.contentType : false,
  };
});

const failedResults = failures.map((failure) => ({
  ...failure,
  schoolSlug: schoolBySource.get(failure.id) ?? null,
  result: "failed" as const,
}));
const allResults = [...sourceResults, ...failedResults];
const counts = (rows: typeof allResults) => ({
  sources: rows.length,
  changed: rows.filter((row) => row.result === "changed").length,
  new: rows.filter((row) => row.result === "new").length,
  unchanged: rows.filter((row) => row.result === "unchanged").length,
  failed: rows.filter((row) => row.result === "failed").length,
});
const schoolSlugs = [...new Set(allResults.map((row) => row.schoolSlug).filter((slug): slug is string => Boolean(slug)))].sort();
const schools = schoolSlugs.map((schoolSlug) => {
  const rows = allResults.filter((row) => row.schoolSlug === schoolSlug);
  return { schoolSlug, ...counts(rows), needsReview: rows.some((row) => row.result !== "unchanged") };
});
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  manifestPath,
  summary: {
    requestedSources: registry.sources.length,
    ...counts(allResults),
    schools: schools.length,
    schoolsNeedingReview: schools.filter((school) => school.needsReview).length,
  },
  schools,
  reviewQueue: allResults.filter((row) => row.result !== "unchanged"),
};
const outputPath = resolve(root, option("--output") || "work/catalog-quality/catalog-official-refresh-audit.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary }, null, 2));

async function readFailures(path: string): Promise<Failure[]> {
  try {
    const payload = JSON.parse(await readFile(path, "utf8")) as { failures?: Failure[] };
    return payload.failures ?? [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function findManifestPaths(directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = resolve(directory, entry.name, "manifest.json");
    try {
      await readFile(path, "utf8");
      paths.push(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return paths;
}
