import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const undergraduatePath = resolve(root, "seeds/catalog.scut-undergraduate-batch-01.draft.json");
const scholarshipPath = resolve(root, "seeds/catalog.scut-school-scholarships-batch-01.draft.json");
const undergraduateText = await readFile(undergraduatePath, "utf8");
const scholarshipText = await readFile(scholarshipPath, "utf8");
const undergraduate = JSON.parse(undergraduateText) as CatalogSeedBundle;
const scholarshipBundle = JSON.parse(scholarshipText) as CatalogSeedBundle;
if (undergraduate.programs?.length !== 99 || undergraduate.programIntakes?.length !== 99) throw new Error("Unexpected SCUT undergraduate dependency.");
if (scholarshipBundle.scholarships?.length !== 8) throw new Error("Unexpected SCUT scholarship dependency.");

const runRoots = [
  "2026-10-27T09-24-25-699Z",
  "2026-10-27T09-24-26-283Z",
  "2026-10-27T09-24-26-829Z",
  "2026-10-27T09-24-27-372Z",
  "2026-10-27T09-24-27-889Z",
].map((name) => resolve(root, "work/catalog-official", name));
const sources = new Map<string, Source>();
for (const runRoot of runRoots) {
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const source of manifest.sources) {
    const artifact = await readFile(resolve(runRoot, source.artifactPath));
    if (source.status !== 200 || createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Invalid SCUT evidence: ${source.id}`);
    sources.set(source.id, source);
  }
}
const programSource = sources.get("scut-full-time-undergraduate-program-catalog-current");
const undergraduateGuide = sources.get("scut-undergraduate-programs-2026");
if (!programSource || !undergraduateGuide || undergraduate.programs[0].sourceSha256 !== programSource.sha256) throw new Error("SCUT undergraduate catalog changed.");

const programs = undergraduate.programs.map((program) => ({
  ...program,
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  capturedAt: programSource.fetchedAt,
  lastVerifiedAt: programSource.fetchedAt,
  applicationNote: `${String(program.applicationNote ?? "2026 international undergraduate route.")} The official project catalog was unchanged when re-fetched on October 27, 2026; no 2027 intake is inferred.`,
}));
const programIntakes = undergraduate.programIntakes.map((intake) => ({ ...intake, status: "closed" as const }));
const school = {
  ...undergraduate.schools![0],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  capturedAt: undergraduateGuide.fetchedAt,
  lastVerifiedAt: undergraduateGuide.fetchedAt,
  deadlineSummary: "The current official pages state recurring annual deadlines of June 30 for undergraduate routes and June 15 for master and doctoral routes. They do not label a 2027 cycle, so no 2027 intake deadline is created.",
  sourceFieldLineage: {
    ...(undergraduate.schools![0].sourceFieldLineage ?? {}),
    deadlineSummary: "current official undergraduate, master and doctoral pages; recurring dates not assigned to a 2027 intake",
    applicationLevel: "current official undergraduate, master and doctoral pages re-fetched October 27, 2026",
  },
};
const city = { ...undergraduate.cities![0], status: "draft" as const, verificationStatus: "unverified" as const };
const scholarships = scholarshipBundle.scholarships.map((row) => ({ ...row, status: "draft" as const, verificationStatus: "unverified" as const }));
const candidate: CatalogSeedBundle = { version: 1, generatedAt: undergraduateGuide.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 32, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence: [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  dependencies: [
    { path: "seeds/catalog.scut-undergraduate-batch-01.draft.json", sha256: createHash("sha256").update(undergraduateText).digest("hex") },
    { path: "seeds/catalog.scut-school-scholarships-batch-01.draft.json", sha256: createHash("sha256").update(scholarshipText).digest("hex") },
  ],
  freshness: {
    result: "current_undergraduate_catalog_unchanged_general_cycle_still_2026",
    note: "The official 99-route undergraduate catalog is byte-for-byte unchanged. Current degree pages publish recurring requirements and deadlines but do not identify a 2027 general degree cycle.",
  },
  unresolved: [
    "No official general 2027 international degree brochure was found; all included application intakes remain closed 2026 references.",
    "The master and doctoral landing pages publish aggregate scope and requirements but not individual major tables, so no route inventory is inferred from them.",
    "The registered 2026 prospectus PDF exceeds the collector's 15 MiB safety cap and the alternate accessible URL now returns 404; route-level graduate extraction remains unresolved.",
    "The current fee page returned HTTP 502; the candidate retains only fee values already supported by previously captured official evidence.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional catalog and scholarship information is included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-242");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 242, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
