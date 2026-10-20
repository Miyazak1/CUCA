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
const sourceSpecs = [
  {
    run: "work/catalog-official/2026-10-20T11-45-16-485Z",
    id: "scut-fees-current",
    schoolSlug: "south-china-university-of-technology",
    sha256: "08595aaaa61327fef05b31b6ac63d50e42f74d9fa8834b3a6c6e93c9727a11bd",
  },
  {
    run: "work/catalog-official/2026-10-20T11-45-19-625Z",
    id: "cufe-international-undergraduate-admissions-en-2026",
    schoolSlug: "central-university-of-finance-and-economics",
    sha256: "1c1c5daa32e2fda7b4abdda0e83a0f56de2893a6e68f703936b89ae104a6d54c",
  },
  {
    run: "work/catalog-official/2026-10-20T11-45-22-993Z",
    id: "ecust-international-undergraduate-admissions-en-2026",
    schoolSlug: "east-china-university-of-science-and-technology",
    sha256: "3257d2cc6575acfa62ef1c7d5839e32c715ab345376c07a7af84b15dde61bf87",
  },
  {
    run: "work/catalog-official/2026-10-20T11-45-26-475Z",
    id: "ahu-international-admissions-fees-and-application-current",
    schoolSlug: "anhui-university",
    sha256: "77e5a55b153c3764e84aebcae215c7ee13879479705c26181f76b82574cd8139",
  },
  {
    run: "work/catalog-official/2026-10-20T11-45-33-336Z",
    id: "tjufe-international-undergraduate-admissions-en-2026",
    schoolSlug: "tianjin-university-of-finance-and-economics",
    sha256: "c652d92a92bf162353cf9198a175484db6a0494d4ae6b0c6f9a9f98322ccba0c",
  },
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
  ["central-university-of-finance-and-economics", "CNY 25,000-40,000/year undergraduate tuition"],
  ["east-china-university-of-science-and-technology", "CNY 22,000-120,000/year by degree and route"],
  ["tianjin-university-of-finance-and-economics", "CNY 16,600-20,000/year undergraduate tuition including insurance"],
]);

const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug);
  const currentCycleNote = "Official-source freshness recheck completed October 20, 2026. No cycle-specific 2027 international applicant guide is published at the registered source, so 2026 dates are not carried forward and unresolved 2027 fields remain absent.";
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
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 89 city dependencies are missing.");

const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 89 validation failed: ${validation.errors.join(" ")}`);

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
    "No registered source in this wave establishes a cycle-specific 2027 international degree intake.",
    "SCUT's current fees index and Anhui University's current brochure are retained as current general evidence; neither is relabeled as a Fall 2027 guide.",
    "Missing program-level 2027 deadlines, CSCA mappings, tuition and scholarship fields remain absent.",
  ],
  notes: [
    "Tuition display bands are added only where the locked source already supports the baseline tuition summary.",
    "No applicant or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-89");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 89, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
