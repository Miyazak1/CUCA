import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const outputPath = resolve(root, process.argv[2] || "work/city-data/city-route-readiness.draft.json");
const inventory = JSON.parse(await readFile(resolve(root, "work/city-data/city-inventory.json"), "utf8"));
const coverage = JSON.parse(await readFile(resolve(root, "work/city-data/city-source-coverage.json"), "utf8"));
const identities = JSON.parse(await readFile(resolve(root, "work/city-data/city-identity-normalization.draft.json"), "utf8"));
const coverageBySlug = new Map(coverage.cities.map((row: Record<string, unknown>) => [row.slug, row]));
const identityBySlug = new Map(identities.cities.map((row: Record<string, unknown>) => [row.slug, row]));

const cities = inventory.cities.map((city: Record<string, unknown>) => {
  const schoolCount = Number(city.schoolCount || 0);
  const programCount = Number(city.programCount || 0);
  const evidence = coverageBySlug.get(city.slug) as Record<string, unknown> | undefined;
  const identity = identityBySlug.get(city.slug) as Record<string, unknown> | undefined;
  const routeState = schoolCount > 0 && programCount > 0 ? "active_catalog_route" : "no_active_catalog_route";
  const action = routeState === "active_catalog_route"
    ? evidence?.dataStage === "rich_draft_available"
      ? "continue_evidence_completion"
      : "acquire_or_unblock_official_evidence"
    : "hold_from_public_city_directory_until_route_exists";
  return {
    slug: city.slug,
    nameEn: city.nameEn,
    nameZh: city.nameZh,
    candidateProvince: identity?.candidateProvince || city.province || null,
    candidateRegion: identity?.candidateRegion || city.region || null,
    schoolCount,
    programCount,
    routeState,
    evidenceStage: evidence?.dataStage || "no_official_source",
    action,
    reviewState: "pending",
    publicationAuthorized: false,
  };
});
const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_draft",
  publicationAuthorized: false,
  policy: "A city requires at least one active school and one active program relationship before it is eligible for the public city directory. Identity-only records are retained internally and not presented as study destinations.",
  summary: {
    cityCount: cities.length,
    activeCatalogRoute: cities.filter((city: Record<string, unknown>) => city.routeState === "active_catalog_route").length,
    noActiveCatalogRoute: cities.filter((city: Record<string, unknown>) => city.routeState === "no_active_catalog_route").length,
    activeRouteWithStructuredDraft: cities.filter((city: Record<string, unknown>) => city.routeState === "active_catalog_route" && city.evidenceStage === "rich_draft_available").length,
    activeRouteAwaitingEvidence: cities.filter((city: Record<string, unknown>) => city.routeState === "active_catalog_route" && city.evidenceStage !== "rich_draft_available").length,
  },
  cities,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: result.summary, publicationAuthorized: false }, null, 2));
