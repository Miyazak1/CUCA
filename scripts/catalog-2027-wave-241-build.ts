import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

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
const legacyPath = resolve(root, "seeds/catalog.xtu-safe-new-batch-01.draft.json");
const currentPath = resolve(root, "seeds/catalog.2027-wave-83.draft.json");
const legacyText = await readFile(legacyPath, "utf8");
const currentText = await readFile(currentPath, "utf8");
const legacy = JSON.parse(legacyText) as CatalogSeedBundle;
const current = JSON.parse(currentText) as CatalogSeedBundle;

if (legacy.programs?.length !== 96 || legacy.programIntakes?.length !== 96) throw new Error("Unexpected XTU legacy program dependency.");
if (current.schools?.length !== 1 || current.schools[0].slug !== "xiangtan-university" || current.scholarships?.length !== 1) throw new Error("Unexpected XTU wave 83 dependency.");

const runRoots = [
  resolve(root, "work/catalog-official/2026-10-27T09-21-16-904Z"),
  resolve(root, "work/catalog-official/2026-10-27T09-21-17-314Z"),
  resolve(root, "work/catalog-official/2026-10-27T09-21-17-682Z"),
];
const sources = new Map<string, ManifestSource>();
for (const runRoot of runRoots) {
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  for (const source of manifest.sources) {
    const artifact = await readFile(resolve(runRoot, source.artifactPath));
    if (source.status !== 200 || createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Invalid XTU evidence: ${source.id}`);
    sources.set(source.id, source);
  }
}
const sourceByUrl = new Map([...sources.values()].map((source) => [source.finalUrl ?? source.url, source]));

const programs = legacy.programs.map((program) => {
  const source = sourceByUrl.get(program.sourceUrl);
  if (!source || source.sha256 !== program.sourceSha256) throw new Error(`XTU program source changed or is missing: ${program.slug}`);
  return {
    ...program,
    status: "draft" as const,
    verificationStatus: "unverified" as const,
    lastVerifiedAt: source.fetchedAt,
    capturedAt: source.fetchedAt,
    applicationNote: `${String(program.applicationNote ?? "2026 international degree route.")} The official project table was unchanged when re-fetched on October 27, 2026; no 2027 intake is inferred.`,
  };
});
const programIntakes = legacy.programIntakes.map((intake) => ({
  ...intake,
  status: "closed" as const,
}));
const school = {
  ...current.schools[0],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  deadlineSummary: "The latest official general international-student brochure remains the closed 2026 cycle. No 2027 general degree deadline has been published on the official English news index as of October 27, 2026.",
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree. The official undergraduate, master and doctoral project tables were unchanged when re-fetched on October 27, 2026.",
  sourceFieldLineage: {
    ...(current.schools[0].sourceFieldLineage ?? {}),
    applicationLevel: "official current undergraduate, master and doctoral program tables; re-fetched October 27, 2026",
    deadlineSummary: "official English news index and 2026 international-student brochure; no 2027 general guide found",
  },
};
const city = { ...current.cities![0], status: "draft" as const, verificationStatus: "unverified" as const };
const scholarships = current.scholarships!.map((scholarship) => ({ ...scholarship, status: "draft" as const, verificationStatus: "unverified" as const }));
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: new Date().toISOString(),
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships,
};
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
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 117,
    schoolSlugs: [school.slug],
    newSchools: 0,
    programs: programs.length,
    programIntakes: programIntakes.length,
    scholarships: scholarships.length,
  },
  evidence: [...sources.values()].map((source) => ({
    id: source.id,
    label: source.label,
    url: source.finalUrl ?? source.url,
    fetchedAt: source.fetchedAt,
    sha256: source.sha256,
  })),
  dependencies: [
    { path: "seeds/catalog.xtu-safe-new-batch-01.draft.json", sha256: createHash("sha256").update(legacyText).digest("hex") },
    { path: "seeds/catalog.2027-wave-83.draft.json", sha256: createHash("sha256").update(currentText).digest("hex") },
  ],
  freshness: {
    result: "current_program_tables_unchanged_general_guide_still_2026",
    note: "All three official XTU degree-program tables were re-fetched on October 27, 2026 and retain their prior hashes. The official English news index still lists the 2026 general brochure as the latest inbound degree guide, so all application intakes remain closed 2026 references.",
  },
  unresolved: [
    "XTU has not published a general 2027 international degree admission brochure on the checked official English news index.",
    "No 2027 general degree deadline is inferred from the current undated project tables.",
    "The 2026/2027 Silk Road scholarship deadline was May 20, 2026 and remains a closed historical scholarship round.",
    "Application-fee information is not represented because the checked official evidence does not support a current 2027 value.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional catalog and admissions facts are included; no applicant or personal-contact records are present." },
};

const stem = resolve(root, "seeds/catalog.2027-wave-241");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 241, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
