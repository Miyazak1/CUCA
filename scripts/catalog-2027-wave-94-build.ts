import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceSpecs = [
  { run: "work/catalog-official/full-refresh-2026-10-20", id: "btbu-international-undergraduate-admissions-pdf-2026", schoolSlug: "beijing-technology-and-business-university", sha256: "fc0ade25dd70cbf7394f4e5c87d87dc21aa6fca0b2ab0d808b3483a82e13b044" },
  { run: "work/catalog-official/2026-10-20T12-00-21-789Z", id: "cust-international-student-admission-guide-pdf-2026-spring", schoolSlug: "changchun-university-of-science-and-technology", sha256: "3398ecc29d314597588dee448f197ba9701e1aa2bbe194ea3fe139a2e42b9864" },
  { run: "work/catalog-official/2026-10-20T12-00-27-709Z", id: "hfnu-international-student-admissions-pdf-2026", schoolSlug: "hefei-normal-university", sha256: "84fac21acdad4ab6c7027c3f78ce5ebf2ab9fe2b3b10e5dc7ceb5a3d83af0b8c" },
  { run: "work/catalog-official/2026-10-20T12-00-31-018Z", id: "kmmu-international-student-admission-brochure-pdf-2026", schoolSlug: "kunming-medical-university", sha256: "a8f1c9a87f710305c4ed05f66023efed7cd436ce5cfe958d2717210fab81f99e" },
  { run: "work/catalog-official/2026-10-20T12-00-35-328Z", id: "kunming-university-international-student-admissions-pdf-2026", schoolSlug: "kunming-university", sha256: "740bb23b2054f9f28363ad9be0f2ba27437f5f4a045ce9f5ccb81d2f0058889e" },
  { run: "work/catalog-official/2026-10-20T12-00-40-779Z", id: "suep-english-undergraduate-admission-brochure-pdf-2026", schoolSlug: "shanghai-university-of-electric-power", sha256: "e2690915d6f03412ad83f4beee286c4b5d43401bf96383db323852f6406a0c84" },
  { run: "work/catalog-official/full-refresh-large-files-2026-10-20", id: "uestc-admission-brochure-en-2026", schoolSlug: "university-of-electronic-science-and-technology-of-china", sha256: "cd4ea8f64f11474c569dcd6dd9a38960ccbc8fe9ae4a606ec59d066396418d70" },
  { run: "work/catalog-official/2026-10-20T12-00-49-259Z", id: "xzmu-international-bachelor-admission-brochure-pdf-2026", schoolSlug: "xuzhou-medical-university", sha256: "b9e6f1ba0c0d6940f121d30f52731831cbf548fa48a5f9e87e9104474d507fff" },
  { run: "work/catalog-official/2026-10-20T12-00-53-357Z", id: "kunming-ynufe-study-guide-current", schoolSlug: "yunnan-university-of-finance-and-economics", sha256: "74ae89ffd4ed185ac23256acfd86f377417911bf513bacd030a8583509ad304b" },
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
  ["changchun-university-of-science-and-technology", "CNY 6,000-22,000/year"],
  ["hefei-normal-university", "CNY 4,500-20,000/year"],
  ["kunming-medical-university", "CNY 12,000-45,000/year"],
  ["kunming-university", "CNY 8,000-16,000/year"],
  ["shanghai-university-of-electric-power", "CNY 20,000/year"],
  ["xuzhou-medical-university", "CNY 33,000/year"],
]);

const schools = sources.map((source) => {
  const baseSchool = dependency.schools?.find((row) => row.slug === source.schoolSlug);
  if (!baseSchool) throw new Error(`Missing baseline school ${source.schoolSlug}.`);
  const sourceUrl = source.finalUrl ?? source.url;
  const tuitionBandLabel = tuitionBandLabels.get(source.schoolSlug);
  const currentCycleNote = "Official-source freshness recheck completed October 20, 2026. The latest registered public international admissions material remains 2026 or current-cycle information; no unannounced 2027 dates or requirements are inferred, and unresolved fields remain absent.";
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
if (cities.length !== citySlugs.size) throw new Error("One or more Wave 94 city dependencies are missing.");
const generatedAt = sources.map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 94 validation failed: ${validation.errors.join(" ")}`);
const evidence = sources.map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { schoolSlugs: schools.map((row) => row.slug), refreshedSchoolFields: ["tuitionBandLabel", "contactNotes", "sourceSha256", "lastVerifiedAt"], sourceSnapshots: evidence.length },
  evidence,
  unresolved: ["No source in this wave establishes a new institution-wide 2027 international degree intake.", "Beijing Technology and Business University and Yunnan University of Finance and Economics retain no school-level tuition band because the refreshed sources do not support a complete range."],
  notes: ["The BTBU and UESTC records reuse hash-locked official snapshots captured earlier on October 20 after later retry failures; no TLS validation or access control was bypassed.", "No applicant or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-94");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 94, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: 0, programIntakes: 0, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
