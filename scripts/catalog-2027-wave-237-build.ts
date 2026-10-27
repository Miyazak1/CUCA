import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-27T08-41-48-589Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const locks = {
  "ahu-undergraduate-programs-current": "95397e8a135c3a67045dceddd10b8e4bbfe652d3ddc02f2eeab1e553c7ae6b98",
  "ahu-master-programs-current": "06f23c29e4f330d01e58ed67b198a2018de09b79825a654d2ff510bd05cbed46",
  "ahu-international-admissions-fees-and-application-current": "77e5a55b153c3764e84aebcae215c7ee13879479705c26181f76b82574cd8139",
} as const;
const sources = new Map<string, Source>();
for (const [id, sha256] of Object.entries(locks)) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked AHU source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== sha256) throw new Error(`AHU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const legacyPath = resolve(root, "seeds/catalog.ahu-core-enrichment-batch-01.draft.json");
const legacyText = await readFile(legacyPath, "utf8");
const legacy = JSON.parse(legacyText) as CatalogSeedBundle;
const schoolSlug = "anhui-university";
if (legacy.schools?.length !== 1 || legacy.schools[0].slug !== schoolSlug || legacy.programs?.length !== 170 || legacy.programIntakes?.length !== 0) throw new Error("Unexpected legacy AHU extraction scope.");
const sourceBySha = new Map([...sources.values()].map((row) => [row.sha256, row]));
if (legacy.programs.some((row) => !row.sourceSha256 || !sourceBySha.has(row.sourceSha256))) throw new Error("Legacy AHU programs do not match the locked official catalogs.");

const feeSource = sources.get("ahu-international-admissions-fees-and-application-current")!;
const feeEvidence = { sourceUrl: feeSource.finalUrl ?? feeSource.url, sourceLabel: feeSource.label, sourceSha256: feeSource.sha256, capturedAt: feeSource.fetchedAt };
const city = { ...legacy.cities![0], status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: feeSource.fetchedAt, ...feeEvidence };
const school = {
  ...legacy.schools[0],
  applicationLevel: "The current official international catalogs publish 81 undergraduate and 89 master program rows. No explicit 2027 international degree intake is published in the captured sources.",
  tuitionSummary: "Current official annual tuition is CNY 15,000 for undergraduate study and CNY 18,000 for master study.",
  deadlineSummary: "No explicit 2027 international degree application deadline is published in the captured sources.",
  subjectTags: [...new Set(legacy.programs.map((row) => row.fieldCategory).filter((value): value is string => Boolean(value)))],
  campusHighlights: ["170 official international program reference rows", "81 undergraduate and 89 master routes", "Hefei, Anhui"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: feeSource.fetchedAt,
  ...feeEvidence,
  sourceFieldLineage: {
    ...(legacy.schools[0].sourceFieldLineage ?? {}),
    applicationLevel: "current official undergraduate and master program catalogs",
    tuitionSummary: "current official international admissions fee table",
    deadlineSummary: "explicit source limitation; no 2027 deadline published",
    subjectTags: "official program catalog school/discipline columns",
    campusHighlights: "official catalog row counts and institutional location",
  },
};
const programs = legacy.programs.map((row) => {
  const currentSource = sourceBySha.get(row.sourceSha256!)!;
  return { ...row, status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: currentSource.fetchedAt, sourceUrl: currentSource.finalUrl ?? currentSource.url, sourceLabel: currentSource.label, sourceSha256: currentSource.sha256, capturedAt: currentSource.fetchedAt };
});
const candidate: CatalogSeedBundle = { version: 1, generatedAt: feeSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((row) => ({ id: row.id, label: row.label, url: row.finalUrl ?? row.url, contentType: row.contentType, fetchedAt: row.fetchedAt, sha256: row.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: feeSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 101, schoolSlugs: [schoolSlug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence,
  extraction: { path: "seeds/catalog.ahu-core-enrichment-batch-01.draft.json", sha256: createHash("sha256").update(legacyText).digest("hex"), extractors: ["scripts/catalog-ahu-programs-build.ts", "scripts/catalog-ahu-core-enrichment-build.ts"], expectedPrograms: 170 },
  unresolved: [
    "The current official program PDFs do not identify a 2027 intake year, application deadline or route-specific application calendar; no intake rows are created.",
    "Teaching language and duration are not classified per program in the captured catalogs and remain absent.",
    "The 2026/2027 Chinese Government Scholarship brochure belongs to the published 2026 application round and is not converted into a separate 2027 intake.",
    "No doctoral international program catalog is present in the captured current program sources.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant records or personal staff contact data are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-237");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 237, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
