import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };
const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-40-21-545Z", id: "bjtu-international-admissions-disclosure-index-current", sha256: "74d8c49621b4a3cf8f428177ab364cb8d6a42855ed910ab48b5fea97319a452e" },
  { run: "2026-10-26T05-41-46-034Z", id: "bjtu-english-admission-brochure-event-2025", sha256: "527e6c02ab629bc85398802df8b3f80a9455944c91f307633d7c36571aec0761" },
];
const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}
const eventSource = sources.get("bjtu-english-admission-brochure-event-2025")!;
const sourceFields = { sourceUrl: eventSource.finalUrl ?? eventSource.url, sourceLabel: eventSource.label, sourceSha256: eventSource.sha256, capturedAt: eventSource.fetchedAt };
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!city) throw new Error("Beijing city dependency is missing.");
const schoolSlug = "beijing-jiaotong-university";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Beijing Jiaotong University already exists in the reviewed base.");

const school = {
  slug: schoolSlug,
  nameEn: "Beijing Jiaotong University",
  nameZh: "北京交通大学",
  citySlug: "beijing",
  schoolType: "Public research university",
  region: "Beijing, North China",
  applicationLevel: "International degree and non-degree admissions are referenced by the official admissions entry; current 2027 levels are unresolved",
  deadlineSummary: "The official disclosure index currently exposes a 2024 handbook, while the official English university page points to a 2025 admission brochure. No retrievable 2026 or 2027 inbound guide was found as of October 26, 2026.",
  websiteUrl: "https://www.bjtu.edu.cn/",
  admissionsUrl: "https://cie.bjtu.edu.cn/en/admission/",
  subjectTags: ["Transportation", "Engineering", "Information Technology", "Economics and Management"],
  campusHighlights: ["Official 2025 admission-brochure announcement", "Current international admissions endpoint registered for retry", "No stale program facts promoted to 2027"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: eventSource.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official English university page identity", nameZh: "official disclosure index identity", citySlug: "official university identity and reviewed Beijing dependency", schoolType: "broad CUAC classification; no admissions claim", region: "official university address plus CUAC geographic taxonomy", applicationLevel: "official admissions entry existence with explicit unresolved-current-cycle limitation", deadlineSummary: "official disclosure index and English admission announcement freshness state", websiteUrl: "official university domain", admissionsUrl: "exact target linked by the official 2025 admission announcement", subjectTags: "institution-level subject profile only; no program-availability claim", campusHighlights: "captured official freshness evidence and retry state",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: eventSource.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 115 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => { const source = sources.get(locked.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: eventSource.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 41, schoolSlugs: [schoolSlug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "No official 2026 or 2027 inbound international-student guide was found. The information-disclosure index still lists a 2024 handbook and the official English university page still links a 2025 brochure.",
    "The current international admissions endpoint timed out during registered collection. The 2023 official PDF exceeds the collector's strict 15 MiB source limit and therefore was not captured or used for imported fields.",
    "Programs, degree levels, language requirements, tuition, deadlines, scholarships and current application materials remain absent. No historic value is relabeled as 2027.",
    "This school-only candidate closes the directory-identity gap but does not establish application-ready status. The international admissions endpoint remains queued for a later registered retry.",
  ],
  sensitiveDataCheck: { result: "pass", note: "The captured sources contain no applicant records. Institutional footer contacts were not imported." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-115");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 115, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
