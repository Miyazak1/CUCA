import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceSpecs = [
  { run: "work/catalog-official/2026-10-20T11-57-50-153Z", id: "nanning-gxmu-undergraduate-admission-2026", schoolSlug: "guangxi-medical-university", sha256: "8fe09f32b70210fee64ab4f0c9bc982803914adcbd00a31a42ed4136e3b9c138" },
  { run: "work/catalog-official/2026-10-20T11-57-53-655Z", id: "luzhou-vocational-chinese-language-admissions-2026", schoolSlug: "luzhou-vocational-and-technical-college", sha256: "00a6f2551a50a01500c1c2ff00f51cf37ebbbeff6cf5aa0cb7241d27ee21fd8b" },
  { run: "work/catalog-official/2026-10-20T11-57-57-063Z", id: "tianfu-college-international-student-admissions-2026", schoolSlug: "southwestern-university-of-finance-and-economics-tianfu-college", sha256: "f2cb2b71d707dd4ebc92476f931df1b2adc8f235cd0340c3d4976f15b7609af0" },
  { run: "work/catalog-official/2026-10-20T11-58-00-262Z", id: "ucas-international-admission-overview-current", schoolSlug: "university-of-chinese-academy-of-sciences", sha256: "787b4e9165398d714aecf058591a49e278f2591f17bdc8895d4caf48a66b3fe5" },
  { run: "work/catalog-official/2026-10-20T11-58-03-781Z", id: "wut-international-undergraduate-admissions-2026", schoolSlug: "wuchang-university-of-technology", sha256: "d1b74100cd3a0231d5c50353c4e2208dbf90bde4216276fae9e9e759df338f47" },
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
  ["luzhou-vocational-and-technical-college", "CNY 5,280/year Chinese-language tuition"],
  ["southwestern-university-of-finance-and-economics-tianfu-college", "CNY 29,500/year standard; CNY 13,000/year displayed after scholarship"],
  ["university-of-chinese-academy-of-sciences", "RMB 30,000-40,000/year graduate tuition"],
  ["wuchang-university-of-technology", "CNY 15,000/year undergraduate tuition"],
]);
const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug);
  const currentCycleNote = "Official-source freshness recheck completed October 20, 2026. Current published information is retained, but the source does not establish a new institution-wide Spring or Fall 2027 international intake; domestic, outbound or individual-supervisor notices are not substituted.";
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
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 93 city dependencies are missing.");
const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 93 validation failed: ${validation.errors.join(" ")}`);
const evidence = sources.map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlugs: schools.map((row) => row.slug), refreshedSchoolFields: ["tuitionBandLabel", "contactNotes", "sourceSha256", "lastVerifiedAt"], sourceSnapshots: evidence.length },
  evidence,
  unresolved: ["No source in this wave establishes a cycle-specific 2027 international degree intake.", "Guangxi Medical University retains no school-level tuition band because the refreshed page does not support a complete range."],
  notes: ["No domestic, outbound or individual-supervisor notice is substituted for institution-wide international admissions evidence.", "No applicant or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-93");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 93, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
