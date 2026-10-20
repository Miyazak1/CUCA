import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const locks = [
  { run: "work/catalog-official/2026-10-20-bjfu-application-procedure-current", id: "bjfu-application-procedure-current", sha256: "e95bca92bceb7a985e92a7e65235cae20681fadd711c259178c7192fbf3be43c" },
  { run: "work/catalog-official/2026-10-20-bjfu-tuition-accommodation-current", id: "bjfu-international-tuition-accommodation-current", sha256: "bb1d3885ebadd2c7fee35056d88c534459caf99dea4f31796bfda75d6e520338" },
];
const sources: ManifestSource[] = [];
for (const lock of locks) {
  const manifest = JSON.parse(await readFile(resolve(root, lock.run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === lock.id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked BJFU evidence ${lock.id}.`);
  const artifact = await readFile(resolve(root, lock.run, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`BJFU artifact hash mismatch for ${lock.id}.`);
  sources.push(source);
}
const applicationSource = sources.find((row) => row.id === "bjfu-application-procedure-current")!;
const tuitionSource = sources.find((row) => row.id === "bjfu-international-tuition-accommodation-current")!;
const applicationUrl = applicationSource.finalUrl ?? applicationSource.url;
const tuitionUrl = tuitionSource.finalUrl ?? tuitionSource.url;
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const baseSchool = dependency.schools?.find((row) => row.slug === "beijing-forestry-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!baseSchool || !city) throw new Error("BJFU dependency rows are missing.");
const school = {
  ...baseSchool,
  tuitionSummary: "Undergraduate CNY 24,800/year; master's CNY 29,800/year Chinese or CNY 33,000/year English; doctoral CNY 33,000/year Chinese or CNY 39,000/year English. Visiting students: CNY 9,900/semester at undergraduate/master level or CNY 12,400/semester at doctoral/art doctoral level. Chinese language: CNY 8,200/semester or CNY 16,400/year.",
  tuitionBandLabel: "CNY 24,800-39,000/year for degree programs",
  contactNotes: "Current application sequence: online submission, supporting-document review, first-round International College review, application-fee payment, then second-round school/college review. On-campus accommodation is CNY 50-60/day/bed for a double room and CNY 100-120/day/bed for a single room; Chinese-language accommodation is CNY 50/day/bed double or CNY 100/day/bed single. Water and electricity are excluded.",
  sourceUrl: tuitionUrl,
  sourceLabel: tuitionSource.label,
  sourceSha256: tuitionSource.sha256,
  capturedAt: tuitionSource.fetchedAt,
  lastVerifiedAt: tuitionSource.fetchedAt,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    tuitionSummary: `Tuition table at ${tuitionUrl} (snapshot ${tuitionSource.sha256})`,
    tuitionBandLabel: `Degree rows in the Tuition table at ${tuitionUrl} (snapshot ${tuitionSource.sha256})`,
    contactNotes: `Application Procedure steps 01-05 at ${applicationUrl} (snapshot ${applicationSource.sha256}); Accommodation table at ${tuitionUrl} (snapshot ${tuitionSource.sha256})`,
  },
};
const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 86 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1, status: "unreviewed_draft", generatedAt, candidateSha256,
  publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlug: school.slug, refreshedSchoolFields: ["tuitionSummary", "tuitionBandLabel", "contactNotes"], sourceSnapshots: 2 },
  evidence: sources.map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: [
    "The current generic pages do not publish a cycle-specific 2027 deadline, application fee amount, language threshold or CSCA subject mapping.",
    "The page timestamps indicate maintained current information but do not establish a Fall 2027 intake.",
  ],
  notes: [
    "Only current tuition, accommodation and application-workflow fields are refreshed; the verified 2026 undergraduate cycle fields are preserved without relabeling.",
    "No applicant or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-86");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 86, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: 2 }, publicationAuthorized: false }, null, 2));
