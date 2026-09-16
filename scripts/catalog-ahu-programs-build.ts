import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = { parsed: resolve(root, "work/catalog-official/ahu-programs-batch-01/parsed-programs.json"), manifest: resolve(root, "work/catalog-official/ahu-programs-batch-01/manifest.json"), sourceBundle: resolve(root, "seeds/catalog.cscalite-online-20260910.published.json"), output: resolve(root, "seeds/catalog.ahu-programs-safe-new-batch-01.draft.json"), validation: resolve(root, "seeds/catalog.ahu-programs-safe-new-batch-01.validation.json") };
const [parsed, manifest, sourceBundle] = await Promise.all([readFile(paths.parsed, "utf8").then(JSON.parse), readFile(paths.manifest, "utf8").then(JSON.parse), readFile(paths.sourceBundle, "utf8").then(JSON.parse)]) as [any, any, CatalogSeedBundle];
const city = sourceBundle.cities?.find((row) => row.slug === "hefei"), school = sourceBundle.schools?.find((row) => row.slug === "anhui-university");
if (!city || !school || parsed.programCount !== 169 || parsed.degreeCounts.Undergraduate !== 80 || parsed.degreeCounts.Master !== 89 || manifest.sources.length !== 2) throw new Error("AHU parsed program evidence is incomplete.");
const slugify = (value: string) => value.normalize("NFKD").replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const safeRows = parsed.programs.filter((row: any) => !(row.degreeLevel === "Undergraduate" && row.major === "Economics"));
const programs = safeRows.map((row: any) => ({
  slug: `anhui-university-${row.degreeLevel.toLowerCase()}-${slugify(row.major)}-${slugify(row.school)}`,
  schoolSlug: "anhui-university",
  citySlug: "hefei",
  nameEn: row.major,
  degreeLevel: row.degreeLevel,
  fieldCategory: row.school,
  subjectArea: row.major,
  badgeText: "Official international program",
  displaySubjects: [row.major],
  displayGroup: row.degreeLevel === "Undergraduate" ? "ahu-undergraduate" : "ahu-master",
  displayGroupLabel: row.degreeLevel === "Undergraduate" ? "AHU international undergraduate programs" : "AHU international master programs",
  status: "draft" as const,
  sourceUrl: row.sourceUrl,
  sourceLabel: row.sourceLabel,
  sourceSha256: row.sourceSha256,
  capturedAt: row.capturedAt,
  sourceFieldLineage: {
    nameEn: `PDF page ${row.sourcePage}, table row ${row.sourceTableRow}, English Major column`,
    degreeLevel: `explicit document title: ${row.degreeLevel} Programs for International Students`,
    fieldCategory: `PDF page ${row.sourcePage}, table row ${row.sourceTableRow}, English Schools column`,
    subjectArea: `derived from the explicit English Major value on PDF page ${row.sourcePage}`,
  },
}));
if (programs.length !== 168 || new Set(programs.map((row) => row.slug)).size !== 168) throw new Error("AHU safe-new program identity mismatch.");
const candidate: CatalogSeedBundle = { version: 1, generatedAt: manifest.generatedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok || validation.summary.programs !== 168 || validation.summary.programIntakes !== 0) throw new Error(`Invalid AHU program candidate: ${validation.errors.join(" ")}`);
await writeFile(paths.output, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
await writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath: paths.output, validationPath: paths.validation, programCount: programs.length, bundleSha256: validation.bundleSha256, parsedSha256: createHash("sha256").update(await readFile(paths.parsed)).digest("hex") }, null, 2));
