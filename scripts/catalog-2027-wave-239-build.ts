import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const freshRuns = [
  "2026-10-27T09-04-46-080Z",
  "2026-10-27T09-04-54-914Z",
  "2026-10-27T09-04-57-991Z",
  "2026-10-27T09-05-04-018Z",
];
const sourceLocations = new Map<string, { source: Source; runRoot: string }>();
for (const run of freshRuns) {
  const runRoot = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const source of manifest.sources) sourceLocations.set(source.id, { source, runRoot });
}

const freshLocks = new Map<string, string>([
  ["ouc-international-admission-brochures-index-current", "8e0bdf4a47402b336e85dea67946e32c71995896fb9b7df35761ae278037d901"],
  ["ouc-international-admission-guide-page-2026", "a8ca0e325bfac1744eaad41ef477490bd4e082d50c386bf18e047f7bba8ed96e"],
  ["ouc-international-programs-pdf-2026", "48adb9bb99468bbd88092ba5cb39c9ec83d33b90f7beb23af6fd456b79b85589"],
  ["ouc-english-undergraduate-program-pdf-2026", "cc575ac8fc50cbf8ff99153ff74eea4b07044a70dd9c5aa79bd46b06a7788248"],
]);
for (const [id, expectedSha256] of freshLocks) {
  const located = sourceLocations.get(id);
  if (!located || located.source.status !== 200 || located.source.sha256 !== expectedSha256) throw new Error(`Missing locked fresh OUC source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(located.runRoot, located.source.artifactPath))).digest("hex");
  if (actual !== expectedSha256) throw new Error(`Fresh OUC evidence hash mismatch: ${id}`);
}

const oldRunRoot = resolve(root, "work/catalog-official/ouc-complete-batch-01");
const oldManifest = JSON.parse(await readFile(resolve(oldRunRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const scholarshipLocks = new Map<string, string>([
  ["ouc-high-level-graduate-scholarship-pdf-2026", "76d08f4d9f1782ad141dcf8fe7caf572e0c44e569f57468a261b3b5b36fc4da8"],
  ["ouc-silk-road-scholarship-pdf-2026", "36a853c763e86c944d458ec1ae9971a00258a89e6b64b98b06c22135d9f39db1"],
  ["ouc-youth-excellence-scholarship-pdf-2026", "ffb7a83c1dc074f7aa68933396d02bc46bcda782fbdaf5672108d76a0207e362"],
]);
for (const [id, expectedSha256] of scholarshipLocks) {
  const source = oldManifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked OUC scholarship source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(oldRunRoot, source.artifactPath))).digest("hex") !== expectedSha256) throw new Error(`OUC scholarship evidence hash mismatch: ${id}`);
  sourceLocations.set(id, { source, runRoot: oldRunRoot });
}

const marineRunRoot = resolve(root, "work/catalog-official/2026-10-20-ouc-marine-scholarship-page-2026");
const marineManifest = JSON.parse(await readFile(resolve(marineRunRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const marineSource = marineManifest.sources.find((row) => row.id === "ouc-marine-scholarship-page-2026" && row.status === 200 && row.sha256 === "83f841975978107863a6bc23cd0e049103eb9bb70b4966dc6aba6e95b446edfb");
if (!marineSource || createHash("sha256").update(await readFile(resolve(marineRunRoot, marineSource.artifactPath))).digest("hex") !== marineSource.sha256) throw new Error("Missing locked OUC marine scholarship source.");
sourceLocations.set(marineSource.id, { source: marineSource, runRoot: marineRunRoot });

const basePath = resolve(root, "seeds/catalog.ouc-international-batch-01.draft.json");
const baseText = await readFile(basePath, "utf8");
const base = JSON.parse(baseText) as CatalogSeedBundle;
const marinePath = resolve(root, "seeds/catalog.2027-wave-84.draft.json");
const marineText = await readFile(marinePath, "utf8");
const marine = JSON.parse(marineText) as CatalogSeedBundle;
if (base.schools?.length !== 1 || base.schools[0].slug !== "ocean-university-of-china" || base.programs?.length !== 10 || base.programIntakes?.length !== 10 || base.scholarships?.length !== 3) throw new Error("Unexpected OUC base candidate shape.");
if (marine.scholarships?.length !== 1 || marine.scholarships[0].slug !== "official-2026-ouc-cgs-marine-scholarship") throw new Error("Unexpected OUC marine scholarship dependency.");

const indexSource = sourceLocations.get("ouc-international-admission-brochures-index-current")!.source;
const programSource = sourceLocations.get("ouc-international-programs-pdf-2026")!.source;
const sourceMeta = { sourceUrl: programSource.finalUrl ?? programSource.url, sourceLabel: programSource.label, sourceSha256: programSource.sha256, capturedAt: programSource.fetchedAt };
const city = { ...base.cities![0], status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: indexSource.fetchedAt };
const school = {
  ...base.schools[0],
  deadlineSummary: "The latest public international degree guide remains the closed Fall 2026 cycle with a June 10, 2026 deadline. The current official brochure index still does not publish a general 2027 international degree guide.",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: indexSource.fetchedAt,
  ...sourceMeta,
  sourceFieldLineage: {
    ...(base.schools[0].sourceFieldLineage ?? {}),
    deadlineSummary: "fresh current official brochure index plus locked 2026 application guide",
  },
};
const programs = base.programs.map((row) => ({ ...row, status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: programSource.fetchedAt, ...sourceMeta }));
const programIntakes = base.programIntakes.map((row) => ({ ...row, status: "closed" as const, ...sourceMeta }));
const scholarships = [...base.scholarships, marine.scholarships[0]].map((row) => ({ ...row, status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: row.capturedAt ?? indexSource.fetchedAt }));
if (new Set(scholarships.map((row) => row.slug)).size !== 4) throw new Error("Duplicate OUC scholarship slug.");

const candidate: CatalogSeedBundle = { version: 1, generatedAt: indexSource.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sourceLocations.values()].map(({ source }) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: indexSource.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 51, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence,
  dependencies: [
    { path: "seeds/catalog.ouc-international-batch-01.draft.json", sha256: createHash("sha256").update(baseText).digest("hex") },
    { path: "seeds/catalog.2027-wave-84.draft.json", sha256: createHash("sha256").update(marineText).digest("hex") },
  ],
  freshness: {
    result: "unchanged_core_2026_sources",
    note: "The October 27, 2026 refetch matched the September hashes for the application guide, international-program PDF and English-undergraduate PDF. The current brochure index also matched the October 20 hash. The large general program-list PDF remains above the collector's 15 MiB safety limit and was not bypassed.",
  },
  unresolved: [
    "The current official brochure index still exposes 2026 as the latest general international degree cycle; no 2026 route is relabeled as a 2027 intake.",
    "All ten Fall 2026 intake records remain closed historical references.",
    "The four 2026/2027 scholarship routes are closed historical rounds and are not represented as Fall 2027 awards.",
    "The official general program-list PDF exceeds the repository's 15 MiB acquisition limit. The limit was not bypassed, and no claim depends on a fresh copy of that file.",
    "No current official source in this batch establishes a complete Chinese-taught bachelor, master and doctoral route inventory for 2027.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant records, personal documents or published staff contact details are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-239");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 239, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
