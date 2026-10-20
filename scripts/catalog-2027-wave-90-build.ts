import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceSpecs = [
  { run: "work/catalog-official/2026-10-20T11-47-43-128Z", id: "sdnu-international-admission-brochure-page-2026", schoolSlug: "shandong-normal-university", sha256: "4aba68d96857b207fe3c87f8e268796c28f36c1c0d11a4c4296436ab97f2c955" },
  { run: "work/catalog-official/2026-10-20T11-47-49-428Z", id: "hrbust-international-undergraduate-admissions-2026", schoolSlug: "harbin-university-of-science-and-technology", sha256: "8e4bc248eaaeec322074a5f6240995993cd9ff1dd03edb66a9de7688fb2626d3" },
  { run: "work/catalog-official/2026-10-20T11-47-52-447Z", id: "ecupl-international-undergraduate-admissions-2026", schoolSlug: "east-china-university-of-political-science-and-law", sha256: "830ad26e35089e6adfa212e328b09726184f0554dabdb6cbc7dea0e0cdb6ec84" },
  { run: "work/catalog-official/2026-10-20T11-47-59-187Z", id: "xjau-international-student-admissions-2026", schoolSlug: "xinjiang-agricultural-university", sha256: "028ba120b652937cd4a76ea28487c9e749223d33178c95b89384351c9550ecb5" },
  { run: "work/catalog-official/2026-10-20T11-48-31-372Z", id: "sanya-university-international-admissions-2026-2027", schoolSlug: "university-of-sanya", sha256: "5d732553c974c1e8035f15fd37972fbb0cc8018d00c9de2bdd54345bb740010e" },
] as const;

const sources: Array<ManifestSource & { schoolSlug: string }> = [];
for (const spec of sourceSpecs) {
  const manifest = JSON.parse(await readFile(resolve(root, spec.run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === spec.id && row.status === 200 && row.sha256 === spec.sha256);
  if (!source) throw new Error(`Missing locked official source ${spec.id}.`);
  const artifact = await readFile(resolve(root, spec.run, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error(`Artifact hash mismatch for ${spec.id}.`);
  sources.push({ ...source, schoolSlug: spec.schoolSlug });
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const tuitionBandLabels = new Map<string, string>([
  ["shandong-normal-university", "CNY 14,000-18,000/year undergraduate tuition"],
  ["harbin-university-of-science-and-technology", "CNY 15,000/year undergraduate tuition"],
  ["east-china-university-of-political-science-and-law", "CNY 22,000-30,000/year undergraduate tuition"],
  ["university-of-sanya", "CNY 28,000-48,000/year by degree and program"],
]);

const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug);
  const currentCycleNote = "Official-source freshness recheck completed October 20, 2026. The latest public international admissions material remains tied to the 2026 or 2026-2027 cycle and does not establish a new Spring or Fall 2027 applicant intake; unresolved 2027 fields remain absent.";
  return {
    ...baseSchool,
    ...(tuitionBandLabel ? { tuitionBandLabel } : {}),
    contactNotes: [baseSchool.contactNotes, currentCycleNote].filter(Boolean).join(" "),
    sourceUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    lastVerifiedAt: source.fetchedAt,
    sourceFieldLineage: {
      ...(baseSchool.sourceFieldLineage ?? {}),
      ...(tuitionBandLabel ? { tuitionBandLabel: `Latest registered official admissions source (${sourceUrl}; snapshot ${source.sha256})` } : {}),
      contactNotes: `Official-source freshness recheck (${sourceUrl}; snapshot ${source.sha256})`,
    },
  };
});

const citySlugs = new Set(schools.map((row) => row.citySlug));
const cities = (dependency.cities ?? []).filter((row) => citySlugs.has(row.slug));
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 90 city dependencies are missing.");
const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 90 validation failed: ${validation.errors.join(" ")}`);
const evidence = sources.map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: schools.map((row) => row.slug), refreshedSchoolFields: ["tuitionBandLabel", "contactNotes", "sourceSha256", "lastVerifiedAt"], sourceSnapshots: evidence.length },
  evidence,
  unresolved: [
    "No source in this wave establishes a distinct cycle-specific Spring or Fall 2027 international degree intake.",
    "Xinjiang Agricultural University retains no tuition band because the refreshed page does not support a complete school-level range.",
    "UESTC is excluded from this wave because its brochure exceeded the collector size limit and its alternate cost page returned HTTP 202 challenge content; neither control was bypassed.",
  ],
  notes: ["No 2026 deadline is rolled forward by assumption.", "No applicant or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-90");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 90, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
