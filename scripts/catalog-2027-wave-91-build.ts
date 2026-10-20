import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceSpecs = [
  { run: "work/catalog-official/2026-10-20T11-50-10-803Z", id: "bpu-international-student-admissions-2026", schoolSlug: "beijing-polytechnic-university", sha256: "9940bed025c79611aad19eec3bbcf3b6fd7ce5fb102ad8c710f61626152e4947" },
  { run: "work/catalog-official/2026-10-20T11-50-14-176Z", id: "ecjtu-international-english-program-admissions-2026", schoolSlug: "east-china-jiaotong-university", sha256: "49c8d0b3b44971931760a4a84140e49aa3363e3824c5a163355fbd930cf21cd1" },
  { run: "work/catalog-official/2026-10-20T11-50-19-953Z", id: "hdu-international-student-admissions-2026", schoolSlug: "hangzhou-dianzi-university", sha256: "5ba8c1a1c20be6d7597256a0e14eebca6b0cf557b02fa7f411db77f09e9f048f" },
  { run: "work/catalog-official/2026-10-20T11-50-23-052Z", id: "hutb-international-student-enrollment-guide-2026", schoolSlug: "hunan-university-of-technology-and-business", sha256: "d4321d95b87b1cd3c4f6bc0dd2de3faf02502b27fa82bcce028d3138582013d5" },
  { run: "work/catalog-official/2026-10-20T11-50-25-961Z", id: "just-international-student-enrollment-guideline-2026", schoolSlug: "jiangsu-university-of-science-and-technology", sha256: "44eec966f49695c778106d317315e371265d8c78833a9d29d5ce5e9ac02288ec" },
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
  ["beijing-polytechnic-university", "CNY 18,000-26,000/year by program type"],
  ["east-china-jiaotong-university", "Up to CNY 16,000/year; reviewed doctoral routes have a full tuition waiver"],
  ["hangzhou-dianzi-university", "CNY 18,000-30,000/year by degree"],
  ["hunan-university-of-technology-and-business", "CNY 11,000-24,000/year by program"],
  ["jiangsu-university-of-science-and-technology", "CNY 11,250-25,000/year by degree"],
]);
const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug)!;
  const currentCycleNote = "Official-source freshness recheck completed October 20, 2026. The latest public international admissions guide remains the 2026 cycle; no domestic 2027 route or recurring deadline is substituted for a cycle-specific international 2027 intake.";
  return {
    ...baseSchool,
    tuitionBandLabel,
    contactNotes: [baseSchool.contactNotes, currentCycleNote].filter(Boolean).join(" "),
    sourceUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    lastVerifiedAt: source.fetchedAt,
    sourceFieldLineage: {
      ...(baseSchool.sourceFieldLineage ?? {}),
      tuitionBandLabel: `Latest registered official 2026 international admissions source (${sourceUrl}; snapshot ${source.sha256})`,
      contactNotes: `Official-source freshness recheck (${sourceUrl}; snapshot ${source.sha256})`,
    },
  };
});
const citySlugs = new Set(schools.map((row) => row.citySlug));
const cities = (dependency.cities ?? []).filter((row) => citySlugs.has(row.slug));
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 91 city dependencies are missing.");
const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 91 validation failed: ${validation.errors.join(" ")}`);
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
  unresolved: ["No source in this wave establishes a cycle-specific 2027 international degree intake.", "Program-level 2027 deadlines, language/CSCA mappings and scholarship terms remain absent unless already supported by separate reviewed evidence."],
  notes: ["No 2026 deadline is rolled forward by assumption.", "No applicant or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-91");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 91, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
