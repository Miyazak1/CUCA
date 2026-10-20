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
  schoolSlug?: string;
};

const root = process.cwd();
const sourceSpecs = [
  {
    run: "work/catalog-official/2026-10-20T11-41-23-278Z",
    id: "ahau-international-student-application-guide-pdf-2026",
    schoolSlug: "anhui-agricultural-university",
    sha256: "c7c2f85aa122504b1cddca2532be2a90e80fba27cd8ff05edd9618a13575372d",
  },
  {
    run: "work/catalog-official/2026-10-20T11-41-35-195Z",
    id: "fuzhou-university-international-graduate-admissions-2026",
    schoolSlug: "fuzhou-university",
    sha256: "8aa5817b831daf05ab5cf815ff3d1358604a3a21a63189886da50fafccf4bd53",
  },
  {
    run: "work/catalog-official/2026-10-20T11-41-38-249Z",
    id: "qinhuangdao-ysu-international-admission-guide-2026",
    schoolSlug: "yanshan-university",
    sha256: "a1aabae8b46f50201c6cef33ed0113fed84ff7e911cc256ed226be551b28d377",
  },
  {
    run: "work/catalog-official/2026-10-20T11-41-41-128Z",
    id: "bsu-international-admission-2026",
    schoolSlug: "beijing-sport-university",
    sha256: "205f0d5e7615133fa201d100f81539d64ce24056f4c116fdf82e9a281fc02056",
  },
  {
    run: "work/catalog-official/2026-10-20T11-41-44-594Z",
    id: "bupt-international-admission-brochure-2026",
    schoolSlug: "beijing-university-of-posts-and-telecommunications",
    sha256: "60c223830d1e46ab8625daa3060584544ad699bf3c7925a33ce59cc0d32d56a8",
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
  ["anhui-agricultural-university", "CNY 16,000-29,000/year"],
  ["fuzhou-university", "CNY 20,000-30,000/year master's; CNY 25,000/year doctoral"],
  ["beijing-sport-university", "CNY 25,000-45,000/year"],
  ["beijing-university-of-posts-and-telecommunications", "CNY 20,000-41,000/year"],
]);

const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug);
  const currentCycleNote = "Freshness recheck completed October 20, 2026: the latest public international admissions guide at this registered official source remains the 2026 cycle. No cycle-specific 2027 intake, deadline or fee is inferred or carried forward.";
  return {
    ...baseSchool,
    ...(tuitionBandLabel ? { tuitionBandLabel } : {}),
    contactNotes: currentCycleNote,
    sourceUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    lastVerifiedAt: source.fetchedAt,
    sourceFieldLineage: {
      ...(baseSchool.sourceFieldLineage ?? {}),
      ...(tuitionBandLabel ? { tuitionBandLabel: `Latest public 2026 international admissions guide (${sourceUrl}; snapshot ${source.sha256})` } : {}),
      contactNotes: `Official-source freshness recheck (${sourceUrl}; snapshot ${source.sha256})`,
    },
  };
});

const citySlugs = new Set(schools.map((row) => row.citySlug));
const cities = (dependency.cities ?? []).filter((row) => citySlugs.has(row.slug));
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 88 city dependencies are missing.");

const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 88 validation failed: ${validation.errors.join(" ")}`);

const evidence = sources.map((source) => ({
  id: source.id,
  label: source.label,
  url: source.finalUrl ?? source.url,
  fetchedAt: source.fetchedAt,
  sha256: source.sha256,
}));
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
    "The registered official sources still publish the 2026 international admissions cycle rather than a cycle-specific 2027 guide.",
    "No 2026 application date, deadline or intake is relabeled as 2027.",
    "Yanshan University retains no school-level tuition summary because the refreshed landing page does not itself publish one.",
  ],
  notes: [
    "This wave records a same-day official-source freshness recheck and adds display-ready tuition bands only where the locked guide already supports the existing tuition summary.",
    "No applicant or other personal data is included.",
  ],
};

const stem = resolve(root, "seeds/catalog.2027-wave-88");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  wave: 88,
  candidateSha256,
  counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length },
  publicationAuthorized: false,
}, null, 2));
