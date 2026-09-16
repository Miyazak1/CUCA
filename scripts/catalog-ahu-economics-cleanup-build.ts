import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const parsed = JSON.parse(await readFile("work/catalog-official/ahu-programs-batch-01/parsed-programs.json", "utf8"));
const manifest = JSON.parse(await readFile("work/catalog-official/ahu-programs-batch-01/manifest.json", "utf8"));
const sourceBundle = JSON.parse(await readFile("seeds/catalog.cscalite-online-20260910.published.json", "utf8"));
const source = parsed.programs.filter((row: any) => row.degreeLevel === "Undergraduate" && row.major === "Economics");
const city = sourceBundle.cities?.find((row: any) => row.slug === "hefei");
const school = sourceBundle.schools?.find((row: any) => row.slug === "anhui-university");
if (source.length !== 1 || source[0].school !== "Economy" || source[0].sourcePage !== 1 || source[0].sourceTableRow !== 28 || !city || !school) throw new Error("AHU Economics source identity changed.");
const row = source[0];
const candidate: CatalogSeedBundle = {
  version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school],
  programs: [{
    slug: "anhui-university-undergraduate-economics-economy", schoolSlug: "anhui-university", citySlug: "hefei",
    nameEn: "Economics", nameZh: "经济学", degreeLevel: "Undergraduate", fieldCategory: "Economy", subjectArea: "Economics",
    badgeText: "Official international program", displaySubjects: ["Economics"], displayGroup: "ahu-undergraduate", displayGroupLabel: "AHU international undergraduate programs",
    status: "draft", sourceUrl: row.sourceUrl, sourceLabel: row.sourceLabel, sourceSha256: row.sourceSha256, capturedAt: row.capturedAt,
    sourceFieldLineage: { nameEn: "PDF page 1, table row 27, English Major column", nameZh: "PDF page 1, table row 27, Chinese Major column", degreeLevel: "explicit document title: Undergraduate Programs for International Students", fieldCategory: "PDF page 1, School 9, English Schools column", subjectArea: "derived from the explicit English Major value" },
  }],
  programIntakes: [], scholarships: [],
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok || validation.summary.programs !== 1) throw new Error(`Invalid AHU Economics candidate: ${validation.errors.join(" ")}`);
await writeFile("seeds/catalog.ahu-economics-cleanup.draft.json", `${JSON.stringify(candidate, null, 2)}\n`);
await writeFile("seeds/catalog.ahu-economics-cleanup.validation.json", `${JSON.stringify(validation, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256 }, null, 2));
