import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/full-refresh-2026-10-20");
const sourceIds = [
  "zjut-university-scholarship-current",
  "zjut-international-chinese-language-teachers-scholarship-2027-spring",
] as const;
const expectedHashes = new Map([
  ["zjut-university-scholarship-current", "8ce1bc1951431915008a3f98e31c8e5db5f4220f91ab8509c4f043d55a310be7"],
  ["zjut-international-chinese-language-teachers-scholarship-2027-spring", "4b0323dcd6ff0bf3aaf563ad3db912dbd5d6c4d0047a181b6504c29139bc6757"],
]);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const sources = new Map<string, ManifestSource>();
for (const id of sourceIds) {
  const expectedSha256 = expectedHashes.get(id)!;
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked ZJUT scholarship evidence: ${id}.`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`ZJUT scholarship evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.zjut-scholarships-safe-new-batch-01.draft.json"), "utf8")) as CatalogSeedBundle;
const cityDependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-23.draft.json"), "utf8")) as CatalogSeedBundle;
const school = prior.schools?.find((row) => row.slug === "zhejiang-university-of-technology");
const city = cityDependency.cities?.find((row) => row.slug === "hangzhou");
if (!school || !city) throw new Error("Wave 77 ZJUT school or authoritative Hangzhou dependency row is missing.");

const currentUniversitySlugs = new Set([
  "official-zjut-excellence-scholarship",
  "official-zjut-merit-scholarship",
  "official-zjut-friendly-scholarship",
  "official-zjut-encouragement-scholarship",
]);
const springSlug = "official-2027-spring-zjut-international-chinese-language-teachers-one-semester";
const selected = (prior.scholarships ?? []).filter((row) => currentUniversitySlugs.has(row.slug) || row.slug === springSlug);
if (selected.length !== 5) throw new Error(`Expected five selected ZJUT scholarship rows, found ${selected.length}.`);

const scholarships: CatalogSeedScholarship[] = selected.map((row) => {
  const sourceId = row.slug === springSlug
    ? "zjut-international-chinese-language-teachers-scholarship-2027-spring"
    : "zjut-university-scholarship-current";
  const source = sources.get(sourceId)!;
  const officialUrl = source.finalUrl ?? source.url;
  return {
    ...row,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    sourceUrl: officialUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    actionLinks: [{ label: "Official ZJUT scholarship page", url: officialUrl, kind: "official-source" }],
    sourceFieldLineage: {
      ...(row.sourceFieldLineage ?? {}),
      status: "official page available at capturedAt",
      sourceUrl: "exact registered official source",
      sourceSha256: "locked acquisition artifact",
      capturedAt: "official acquisition manifest",
    },
  };
});

const capturedAt = [...sources.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: capturedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 77 validation failed:\n${validation.errors.join("\n")}`);

const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: capturedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 0, new2027Intakes: 0, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.length },
  evidence,
  unresolved: [
    "The four annual ZJUT university scholarships publish recurring March-to-end-of-May timing without a calendar year. No deadlineDate is created for those awards.",
    "The annual university scholarships do not cover accommodation, living expenses or insurance.",
    "The March 2027 language scholarship has a fixed October 20, 2026 deadline and is retained exactly as published.",
    "The doctoral scholarship page is excluded from this wave pending a separate current-content review.",
  ],
  notes: [
    "The four annual university award values and the March 2027 language award terms were re-confirmed against the October 20 official snapshots.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-77");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 77,
  candidateSha256,
  counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length, sourceSnapshots: evidence.length },
  publicationAuthorized: false,
}, null, 2));
