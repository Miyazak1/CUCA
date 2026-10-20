import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "work/catalog-official/2026-10-20-sustech-undergraduate-cost-current";
const sourceId = "sustech-undergraduate-cost-api";
const expectedSha256 = "df75126b8a7c3abf148556b4fc20732cdda891948bb3966a73f250fb7101b057";
const manifest = JSON.parse(await readFile(resolve(root, run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked SUSTech undergraduate cost evidence.");
const artifact = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error("SUSTech cost artifact hash mismatch.");
const payload = JSON.parse(artifact.toString("utf8")) as { module?: Array<{ ywxxnr?: string }> };
const costText = payload.module?.[0]?.ywxxnr ?? "";
const normalizedCostText = costText.replaceAll("&nbsp;", " ").replace(/\s+/g, " ");
for (const required of ["RMB 30000/Y", "RMB 7200/Y", "RMB 800/Y", "RMB 2500 /M", "RMB 68000/Y"]) {
  if (!normalizedCostText.includes(required)) throw new Error(`SUSTech cost evidence is missing ${required}.`);
}
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const baseSchool = dependency.schools?.find((row) => row.slug === "southern-university-of-science-and-technology");
const city = dependency.cities?.find((row) => row.slug === "shenzhen");
if (!baseSchool || !city) throw new Error("SUSTech dependency rows are missing.");
const sourceUrl = source.finalUrl ?? source.url;
const school = {
  ...baseSchool,
  tuitionSummary: "International undergraduate tuition CNY 30,000/year. The current official cost table estimates total annual cost at about CNY 68,000, including CNY 7,200/year dormitory, CNY 800/year insurance, CNY 600 residence permit, CNY 600 health check, and approximately CNY 2,500/month for food, books and miscellaneous expenses.",
  tuitionBandLabel: "CNY 30,000/year undergraduate tuition; about CNY 68,000/year total",
  contactNotes: "Current undergraduate cost reference: dormitory CNY 7,200/year, insurance CNY 800/year, residence permit CNY 600, health check CNY 600, and food/books/miscellaneous about CNY 2,500/month.",
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  lastVerifiedAt: source.fetchedAt,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    tuitionSummary: `Official undergraduate cost API, ywxxnr (${sourceUrl}; snapshot ${source.sha256})`,
    tuitionBandLabel: `Official undergraduate cost API, ywxxnr (${sourceUrl}; snapshot ${source.sha256})`,
    contactNotes: `Official undergraduate cost API, ywxxnr (${sourceUrl}; snapshot ${source.sha256})`,
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 87 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256,
  publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlug: school.slug, refreshedSchoolFields: ["tuitionSummary", "tuitionBandLabel", "contactNotes"], sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The current undergraduate requirements page loads its substantive fields through POST endpoints, which were not submitted or bypassed by the collector.",
    "The cost API is current but does not establish a cycle-specific Fall 2027 intake or postgraduate fee schedule.",
  ],
  notes: [
    "Only explicit undergraduate cost values are refreshed; existing separately verified degree, language and 2026 postgraduate fields remain unchanged.",
    "No applicant or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-87");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 87, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
