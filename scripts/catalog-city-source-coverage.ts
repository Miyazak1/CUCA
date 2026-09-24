import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type RegistrySource = { id: string; sourceRole: string; citySlug?: string; schoolSlug?: string };
type InventoryCity = { slug: string; nameEn: string; nameZh: string; dataPriority: string; richDataState: string; schoolSlugs?: string[] };

const root = process.cwd();
const inventoryPath = resolve(root, "work/city-data/city-inventory.json");
const registryPath = resolve(root, "catalog-sources/official-sources.json");
const acquisitionRoot = resolve(root, "work/catalog-official");
const outputPath = resolve(root, process.argv[2] || "work/city-data/city-source-coverage.json");

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const sources = registry.sources as RegistrySource[];
const acquired = new Set<string>();
for (const entry of await readdir(acquisitionRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(acquisitionRoot, entry.name, "manifest.json"), "utf8"));
    for (const source of manifest.sources || []) acquired.add(source.id);
  } catch { /* ignore incomplete acquisition directories */ }
}

const cities = (inventory.cities as InventoryCity[]).map(city => {
  const schoolSlugs = new Set(city.schoolSlugs || []);
  const directSources = sources.filter(source => source.citySlug === city.slug);
  const schoolSources = sources.filter(source => source.schoolSlug && schoolSlugs.has(source.schoolSlug));
  const acquiredDirectSources = directSources.filter(source => acquired.has(source.id));
  const acquiredSchoolSources = schoolSources.filter(source => acquired.has(source.id));
  const registeredRoles = [...new Set(directSources.map(source => source.sourceRole))].sort();
  const acquiredRoles = [...new Set(acquiredDirectSources.map(source => source.sourceRole))].sort();
  const dataStage = city.richDataState === "draft_available"
    ? "rich_draft_available"
    : acquiredDirectSources.length
      ? "city_evidence_acquired"
      : directSources.length
        ? "city_sources_registered"
        : acquiredSchoolSources.length
          ? "school_evidence_only"
          : "no_official_source";
  return {
    slug: city.slug,
    nameEn: city.nameEn,
    nameZh: city.nameZh,
    dataPriority: city.dataPriority,
    dataStage,
    directSourceCount: directSources.length,
    acquiredDirectSourceCount: acquiredDirectSources.length,
    registeredRoles,
    acquiredRoles,
    schoolCountWithRegistryEvidence: new Set(schoolSources.map(source => source.schoolSlug)).size,
    schoolSourceCount: schoolSources.length,
    acquiredSchoolSourceCount: acquiredSchoolSources.length,
    directSourceIds: directSources.map(source => source.id).sort(),
  };
});

const stageCounts = Object.fromEntries([...new Set(cities.map(city => city.dataStage))].sort()
  .map(stage => [stage, cities.filter(city => city.dataStage === stage).length]));
const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  publicationAuthorized: false,
  cityCount: cities.length,
  stageCounts,
  priorityCities: cities.filter(city => city.dataPriority === "priority"),
  cities,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, cityCount: result.cityCount, stageCounts }, null, 2));
