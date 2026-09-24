import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const outputPath = resolve(root, process.argv[2] || "work/city-data/all-city-baseline.draft.json");
const [inventory, identity, coverage] = await Promise.all([
  readFile(resolve(root, "work/city-data/city-inventory.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "work/city-data/city-identity-normalization.draft.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "work/city-data/city-source-coverage.json"), "utf8").then(JSON.parse),
]);

const identities = new Map(identity.cities.map((city: any) => [city.slug, city]));
const sourceCoverage = new Map(coverage.cities.map((city: any) => [city.slug, city]));
const expectedRoles = [
  "city-statistics",
  "city-public-transport",
  "city-international-services",
  "city-health-services",
  "city-student-guide",
  "city-student-cost",
  "city-climate",
];

const cities = inventory.cities.map((city: any) => {
  const identityDraft: any = identities.get(city.slug);
  const sources: any = sourceCoverage.get(city.slug);
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
    identityDraftComplete: cities.filter((city: any) => city.identity.province && city.identity.region).length,
    richDraftAvailable: cities.filter((city: any) => city.evidenceCoverage.dataStage === "rich_draft_available").length,
    withAnyAcquiredOfficialEvidence: cities.filter((city: any) => city.evidenceCoverage.acquiredDirectSourceCount + city.evidenceCoverage.acquiredSchoolSourceCount > 0).length,
    withoutAcquiredOfficialEvidence: cities.filter((city: any) => city.evidenceCoverage.acquiredDirectSourceCount + city.evidenceCoverage.acquiredSchoolSourceCount === 0).length,
    publicationReady: 0,
  },
  cities,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, cityCount: output.cityCount, summary: output.summary }, null, 2));
