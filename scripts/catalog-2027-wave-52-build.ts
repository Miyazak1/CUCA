import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const sourceId = "pku-shenzhen-environment-energy-international-programs-current";
const expectedSha256 = "c9e314a044883c832caaabbd3fb1f0196c5013fea51b9a109c309ed4b6505be8";
let evidence: ManifestSource | undefined;
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const item = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!item) continue;
    const bytes = await readFile(resolve(runRoot, item.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error("PKU Shenzhen SEE evidence hash mismatch.");
    evidence = item;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!evidence) throw new Error("Missing locked PKU Shenzhen SEE program evidence.");

const wave38 = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-38.draft.json"), "utf8")) as CatalogSeedBundle;
const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = wave38.schools?.find((row) => row.slug === "peking-university");
const city = baseline.cities?.find((row) => row.slug === "shenzhen");
const schoolCity = baseline.cities?.find((row) => row.slug === school?.citySlug);
if (!school || !city || !schoolCity) throw new Error("PKU, Beijing or Shenzhen dependency row is missing.");
const sourceFields = { sourceUrl: evidence.finalUrl ?? evidence.url, sourceLabel: evidence.label, sourceSha256: evidence.sha256, capturedAt: evidence.fetchedAt };
const common = {
  schoolSlug: school.slug,
  citySlug: city.slug,
  fieldCategory: "Environmental science and engineering",
  hasScholarship: true,
  scholarshipText: "New international students may apply for the Chinese Government Scholarship High-Level Graduate Program, which the source describes as covering tuition, on-campus accommodation, medical insurance and a nationally standardized monthly living allowance.",
  applicationUrl: evidence.url,
  applicationNote: "This current program overview was published on September 21, 2026. It does not publish an application window or confirm a Fall 2027 intake date; applicants must follow a later school or university admission notice. Tuition is intentionally absent because the page says it is pending approval and gives 2026 figures only as references.",
  badgeText: "Current international program overview",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
};
type Spec = { slug: string; nameEn: string; nameZh: string; degreeLevel: "Master" | "Doctoral"; durationYears: number; teachingLanguage: "Chinese" | "English"; subjectArea: string };
const specs: Spec[] = [
  { slug: "peking-university-shenzhen-see-environmental-science-doctoral-chinese-current", nameEn: "Environmental Science", nameZh: "环境科学", degreeLevel: "Doctoral", durationYears: 4, teachingLanguage: "Chinese", subjectArea: "School of Environment and Energy, Shenzhen; Environmental Science" },
  { slug: "peking-university-shenzhen-see-environmental-engineering-doctoral-chinese-current", nameEn: "Environmental Engineering", nameZh: "环境工程", degreeLevel: "Doctoral", durationYears: 4, teachingLanguage: "Chinese", subjectArea: "School of Environment and Energy, Shenzhen; Environmental Engineering" },
  { slug: "peking-university-shenzhen-see-environmental-science-master-chinese-current", nameEn: "Environmental Science", nameZh: "环境科学", degreeLevel: "Master", durationYears: 3, teachingLanguage: "Chinese", subjectArea: "School of Environment and Energy, Shenzhen; Environmental Science" },
  { slug: "peking-university-shenzhen-see-environmental-engineering-master-chinese-current", nameEn: "Environmental Engineering", nameZh: "环境工程", degreeLevel: "Master", durationYears: 3, teachingLanguage: "Chinese", subjectArea: "School of Environment and Energy, Shenzhen; Environmental Engineering" },
  { slug: "peking-university-shenzhen-see-sustainable-environment-energy-master-english-current", nameEn: "Sustainable Environment and Energy", nameZh: "可持续环境与能源", degreeLevel: "Master", durationYears: 2, teachingLanguage: "English", subjectArea: "School of Environment and Energy, Shenzhen; Sustainable Environment and Energy" },
];
const programs: CatalogSeedProgram[] = specs.map((spec) => ({
  ...spec,
  ...common,
  displayGroup: spec.degreeLevel,
  displayGroupLabel: `PKU Shenzhen SEE ${spec.degreeLevel.toLowerCase()} programs`,
  sourceFieldLineage: {
    nameEn: "official bilingual current program overview",
    nameZh: "official bilingual current program overview",
    degreeLevel: "official program heading",
    durationYears: "official program heading",
    teachingLanguage: "official program heading",
    subjectArea: "official school and program sections",
    scholarshipText: "official scholarship section",
    applicationNote: "official publication date, pending-fee statement and reminder to follow later admission notices",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: evidence.fetchedAt, cities: [schoolCity, city], schools: [school], programs, programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 52 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: 0, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The source is a current international program overview, not a cycle-specific admission guide. No intake, opening date or deadline is emitted.",
    "The page states that tuition is pending approval and prints 2026 amounts only as references. No tuition fields are emitted.",
    "The source names the Chinese Government Scholarship High-Level Graduate Program but does not publish a cycle-specific deadline or stipend amount. No separate scholarship row is created.",
    "Program-specific language-score thresholds and application materials are not published on this page and remain absent.",
  ],
  notes: ["Five explicit international program-and-medium combinations are retained exactly; no 2027 intake is inferred from the publication date.", "No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-52.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-52.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-52.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: 2, schools: 1, programs: programs.length, programIntakes: 0, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
