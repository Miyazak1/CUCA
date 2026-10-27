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
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-26T15-14-53-579Z";
const sourceId = "usst-sbc-application-documents-2027-intake";
const expectedSha256 = "6623db378c423f2c229ffaabfcdaeea0d487e07860deb6895d6dc8b61a5b080d";
const runRoot = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error(`Missing locked official evidence ${sourceId} at ${expectedSha256}.`);
const artifact = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== expectedSha256) throw new Error(`Evidence hash mismatch: ${sourceId}.`);
const html = artifact.toString("utf8");
for (const marker of [
  "Applications for the 2027 intake will open in November",
  "Major: Business Management",
  "Major: Mechanical Engineering",
  "Major: Electrical &amp; Electronic Engineering",
]) {
  if (!html.includes(marker)) throw new Error(`Expected official-page marker missing: ${marker}.`);
}

const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-156.draft.json"), "utf8")) as CatalogSeedBundle;
const city = baseline.cities?.find((row) => row.slug === "shanghai");
const baselineSchool = baseline.schools?.find((row) => row.slug === "university-of-shanghai-for-science-and-technology");
if (!city || !baselineSchool) throw new Error("USST wave 156 dependencies are missing.");

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const school = {
  ...baselineSchool,
  admissionsUrl: sourceFields.sourceUrl,
  deadlineSummary: "Sino-British College states that its 2027 intake applications will open in November; an exact opening day and deadline are not yet published.",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baselineSchool.sourceFieldLineage ?? {}),
    admissionsUrl: "official Sino-British College application-documents page",
    deadlineSummary: "official page statement for the 2027 intake; unresolved exact dates are explicitly retained",
  },
};

const rows = [
  { slug: "business-management", nameEn: "Business Management", fieldCategory: "Business, Economics and Management", cscaSubjects: ["Mathematics"] },
  { slug: "mechanical-engineering", nameEn: "Mechanical Engineering", fieldCategory: "Engineering and Technology", cscaSubjects: ["Mathematics", "Physics"] },
  { slug: "electrical-and-electronic-engineering", nameEn: "Electrical & Electronic Engineering", fieldCategory: "Engineering and Technology", cscaSubjects: ["Mathematics", "Physics", "Chemistry"] },
] as const;
const programs = rows.map((row) => ({
  slug: `university-of-shanghai-for-science-and-technology-bachelor-sbc-${row.slug}`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: row.nameEn,
  degreeLevel: "Bachelor",
  fieldCategory: row.fieldCategory,
  subjectArea: row.nameEn,
  cscaSubjects: [...row.cscaSubjects],
  cscaRequirement: `The official 2027-intake application page lists ${row.cscaSubjects.join(", ")} as the CSCA test subject${row.cscaSubjects.length === 1 ? "" : "s"} for this major.`,
  applicationUrl: sourceFields.sourceUrl,
  applicationNote: "The official page announces that 2027 intake applications will open in November and lists this major under the Dual Degree Programme. Exact opening day, deadline, duration, teaching language and tuition for 2027 remain unpublished.",
  badgeText: "2027 intake announced",
  status: "draft" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official 2027-intake page, Dual Degree Programme CSCA major list",
    degreeLevel: "derived from official page requirement for a high-school diploma and the linked SBC bachelor-program context",
    fieldCategory: "derived CUAC display category from the explicit official major name",
    subjectArea: "official 2027-intake page major name",
    cscaSubjects: "official 2027-intake page, CSCA Test section",
    cscaRequirement: "official 2027-intake page, CSCA Test section",
    applicationUrl: "official 2027-intake application-documents page",
    applicationNote: "official opening-month statement plus explicit unresolved-field note",
    badgeText: "official statement that applications for the 2027 intake will open in November",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 198 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 106, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: sourceFields.sourceUrl, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The page publishes only the opening month, not an exact 2027 opening day or application deadline; no programIntake row is created.",
    "The linked application form is still labeled 2026 and is not treated as a 2027 form.",
    "Duration, teaching language, tuition and route-specific language thresholds are not explicit on the captured 2027-intake page and remain absent.",
    "The page describes Single Degree Programme application documents but does not enumerate its majors; no single-degree route is inferred.",
  ],
  sensitiveDataCheck: { result: "review_required", note: "The public source page contains an institutional staff contact block. No name, phone number or email is copied into the candidate; editorial review must confirm exclusion before publication." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-198");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 198, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
