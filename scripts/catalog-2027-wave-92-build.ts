import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceSpecs = [
  { run: "work/catalog-official/2026-10-20T11-52-40-474Z", id: "guiyang-gmcu-undergraduate-admission-2026", schoolSlug: "guizhou-medical-university", sha256: "6d11acc0cf35e4afb7f2132d0d694b0b5ef95b3a404c1baee2f00c713b5401bb" },
  { run: "work/catalog-official/2026-10-20T11-52-44-961Z", id: "hitsz-international-undergraduate-prospectus-page-2026", schoolSlug: "harbin-institute-of-technology-shenzhen", sha256: "a46dd3133d5742e97017dff4794c950c317e07cd6ebab751ea8e037bea6b620c" },
  { run: "work/catalog-official/2026-10-20T11-52-48-128Z", id: "sjtu-medicine-chinese-undergraduate-2026", schoolSlug: "shanghai-jiao-tong-university-school-of-medicine", sha256: "932f864a5d911ef46cc81bd07f670211db6f4b8c602e06019746b4ea3d9a1640" },
  { run: "work/catalog-official/2026-10-20T11-52-51-612Z", id: "shupl-international-admissions-2026", schoolSlug: "shanghai-university-of-political-science-and-law", sha256: "c369cca864ccdda2b6d061ff6af5aaee360496aecf54bc9bf69604bd4d14eb0c" },
  { run: "work/catalog-official/2026-10-20T11-52-54-921Z", id: "scnu-international-undergraduate-admissions-2026", schoolSlug: "south-china-normal-university", sha256: "ca1bd48ae1423d04753e3502a3df54e94997a18d86e5f3e0e0c93086c43e9fa0" },
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
  ["harbin-institute-of-technology-shenzhen", "CNY 30,000/year undergraduate tuition"],
  ["shanghai-jiao-tong-university-school-of-medicine", "RMB 29,000-75,000/year undergraduate tuition"],
  ["shanghai-university-of-political-science-and-law", "CNY 21,500-50,000/year by degree and program"],
  ["south-china-normal-university", "CNY 21,000/year reviewed undergraduate tuition"],
]);
const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug);
  const currentCycleNote = "Official-source freshness recheck completed October 20, 2026. The latest public campus-specific international admissions guide remains the 2026 cycle; domestic or outbound 2027 notices are not substituted for an inbound international 2027 intake.";
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
      ...(tuitionBandLabel ? { tuitionBandLabel: `Latest registered official 2026 international admissions source (${sourceUrl}; snapshot ${source.sha256})` } : {}),
      contactNotes: `Official-source freshness recheck (${sourceUrl}; snapshot ${source.sha256})`,
    },
  };
});
const citySlugs = new Set(schools.map((row) => row.citySlug));
const cities = (dependency.cities ?? []).filter((row) => citySlugs.has(row.slug));
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 92 city dependencies are missing.");
const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 92 validation failed: ${validation.errors.join(" ")}`);
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
  unresolved: ["No source in this wave establishes a cycle-specific 2027 international degree intake.", "Guizhou Medical University retains no school-level tuition band because the refreshed page does not support a complete range."],
  notes: ["No domestic or outbound notice is substituted for international admissions evidence.", "No applicant or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-92");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 92, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
