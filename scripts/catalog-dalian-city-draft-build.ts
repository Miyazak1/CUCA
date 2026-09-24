import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/dut-complete-batch-01/manifest.json");
const manifestText = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(manifestText) as {
  generatedAt: string;
  sources: Array<{ id: string; status: number; url: string; finalUrl?: string; label: string; sha256: string; fetchedAt: string }>;
};
const source = manifest.sources.find((row) => row.id === "dut-undergraduate-english-admissions-2026");
const expectedSha256 = "5a4b504bf036a111c7df49228b0da3e30d18e824f080620f424542146924dab8";
if (!source || source.status !== 200 || source.sha256 !== expectedSha256) throw new Error("Dalian city evidence mismatch");

const bundle: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [{
    slug: "dalian",
    nameEn: "Dalian",
    nameZh: "大连",
    province: "Liaoning",
    region: "Northeast China",
    tags: ["coastal-city", "higher-education-centre"],
    status: "draft",
    verificationStatus: "unverified",
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      nameEn: "official DUT contact address: Ganjingzi District, Dalian",
      nameZh: "official university page title identifies Dalian University of Technology; editorial city rendering requires review",
      province: "official institution location; CUAC geographic normalization requires review",
      region: "CUAC geographic taxonomy derived from the official city; requires review",
      tags: "CUAC editorial classification; requires review",
    },
  }],
  schools: [],
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const body = `${JSON.stringify(bundle, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(body));
if (!validation.ok || validation.summary.cities !== 1) throw new Error(`Dalian city draft invalid:\n${validation.errors.join("\n")}`);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(body),
  sourceManifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "This city dependency is limited to identity and geographic relation supported by the official DUT page.",
      "Population, climate, transport and cost fields remain unresolved; none are inferred from the school page.",
      "The record exists to repair the deterministic Dalian University of Technology city relationship and remains unreviewed.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.dalian-city-rich-batch-01.draft.json"), body, "utf8"),
  writeFile(resolve(root, "seeds/catalog.dalian-city-rich-batch-01.validation.json"), `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, summary: validation.summary, candidateSha256: validationArtifact.candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
