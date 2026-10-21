import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const outputPath = resolve(root, process.argv[2] || "work/city-data/all-city-baseline.draft.json");
type InventoryCity = { slug: string; nameEn: string; nameZh: string; schoolCount: number; programCount: number; englishProgramCount: number; openIntakeCount: number; scholarshipCount: number; dataPriority: string };
type Inventory = { generatedAt: string; cities: InventoryCity[] };
type IdentityCity = { slug: string; candidateProvince: string; candidateRegion: string; reviewState: string };
type IdentityDraft = { cities: IdentityCity[] };
type CoverageCity = { slug: string; dataStage: string; acquiredRoles: string[]; acquiredDirectSourceCount: number; acquiredSchoolSourceCount: number; schoolCountWithRegistryEvidence: number; directSourceIds: string[] };
type CoverageDraft = { cities: CoverageCity[] };
const [inventory, identity, coverage] = await Promise.all([
  readFile(resolve(root, "work/city-data/city-inventory.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "work/city-data/city-identity-normalization.draft.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "work/city-data/city-source-coverage.json"), "utf8").then(JSON.parse),
] as const) as [Inventory, IdentityDraft, CoverageDraft];

const identities = new Map(identity.cities.map((city) => [city.slug, city]));
const sourceCoverage = new Map(coverage.cities.map((city) => [city.slug, city]));
const expectedRoles = [
  "city-statistics",
  "city-public-transport",
  "city-international-services",
  "city-health-services",
  "city-student-guide",
  "city-student-cost",
  "city-climate",
];

const cities = inventory.cities.map((city) => {
  const identityDraft = identities.get(city.slug);
  const sources = sourceCoverage.get(city.slug);
  if (!identityDraft || !sources) throw new Error(`Missing city baseline dependency: ${city.slug}`);
  const acquiredRoles = new Set(sources.acquiredRoles);
  const missingDataAreas = expectedRoles.filter(role => !acquiredRoles.has(role));
  return {
    slug: city.slug,
    identity: {
      nameEn: city.nameEn,
      nameZh: city.nameZh,
      province: identityDraft.candidateProvince,
      region: identityDraft.candidateRegion,
      reviewState: identityDraft.reviewState,
    },
    liveCatalogSnapshot: {
      schoolCount: city.schoolCount,
      programCount: city.programCount,
      englishProgramCount: city.englishProgramCount,
      openIntakeCount: city.openIntakeCount,
      verifiedScholarshipCount: city.scholarshipCount,
      computedAt: inventory.generatedAt,
      source: "local catalog relations",
    },
    evidenceCoverage: {
      dataStage: sources.dataStage,
      acquiredCityRoles: sources.acquiredRoles,
      acquiredDirectSourceCount: sources.acquiredDirectSourceCount,
      acquiredSchoolSourceCount: sources.acquiredSchoolSourceCount,
      schoolCountWithRegistryEvidence: sources.schoolCountWithRegistryEvidence,
      directSourceIds: sources.directSourceIds,
    },
    missingDataAreas,
    dataPriority: city.dataPriority,
    reviewState: "pending",
    publicationAuthorized: false,
  };
});

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_draft",
  publicationAuthorized: false,
  scope: "All non-fixture cities currently present in the local CUAC catalog",
  cityCount: cities.length,
  summary: {
    identityDraftComplete: cities.filter((city) => city.identity.province && city.identity.region).length,
    richDraftAvailable: cities.filter((city) => city.evidenceCoverage.dataStage === "rich_draft_available").length,
    withAnyAcquiredOfficialEvidence: cities.filter((city) => city.evidenceCoverage.acquiredDirectSourceCount + city.evidenceCoverage.acquiredSchoolSourceCount > 0).length,
    withoutAcquiredOfficialEvidence: cities.filter((city) => city.evidenceCoverage.acquiredDirectSourceCount + city.evidenceCoverage.acquiredSchoolSourceCount === 0).length,
    publicationReady: 0,
  },
  cities,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, cityCount: output.cityCount, summary: output.summary }, null, 2));
