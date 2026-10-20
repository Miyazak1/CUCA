import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "tsinghua-cpfp-admissions-2027";
const expectedSha256 = "ca2515798ce48faa04fec87323d0fac2f75289ac3a2dfbc8fcf1449b3320a414";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua CPFP evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua CPFP 2027 evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const programSlug = "tsinghua-university-master-sch-ool-of-social-sciences-master-s-program-in-chinese-politics-foreign-policy-and-international-relations-cpfp-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorProgram = prior.programs?.find((row) => row.slug === programSlug);
if (!city || !school || !priorProgram) throw new Error("Missing Tsinghua CPFP dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const program = {
  ...priorProgram,
  durationYears: 2,
  fieldCategory: "International affairs",
  subjectArea: "Chinese politics, foreign policy and international relations",
  teachingLanguage: "English",
  englishRequirement: "Non-native English speakers must provide IELTS 7.0, TOEFL iBT 100 for tests taken before January 21, 2026, or TOEFL iBT 5.0 for tests taken on or after January 21, 2026. Native English speakers and applicants who completed a degree in an English-speaking country are exempt.",
  tuitionAmount: 120000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "program",
  tuitionText: "RMB 120,000 for the full two-year program.",
  scholarshipText: "The Chinese Government Scholarship full award usually covers tuition, university dormitory or accommodation subsidy, stipend and medical insurance. The Beijing Government Scholarship usually covers tuition and medical insurance for one academic year.",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "Two-year full-time English program leading to the Master of International Affairs degree. Applicants need a bachelor's degree or equivalent. Required materials include a personal statement, authenticated degree evidence, undergraduate transcript and GPA evidence where needed, English proof, two academic or professional recommendations, passport and nationality-status documentation. Admission uses document review and a comprehensive assessment, generally an interview.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorProgram.sourceFieldLineage ?? {}),
    durationYears: "official CPFP 2027 guide, Introduction",
    fieldCategory: "official 2025 conversion to Master of International Affairs degree",
    subjectArea: "official program identity",
    teachingLanguage: "official CPFP 2027 guide, Course Credit Requirements",
    englishRequirement: "official CPFP 2027 guide, Language competence requirements",
    tuitionAmount: "official CPFP 2027 guide, Costs",
    tuitionCurrency: "official CPFP 2027 guide, Costs",
    tuitionPeriod: "official CPFP 2027 guide, Costs",
    tuitionText: "official CPFP 2027 guide, Costs",
    scholarshipText: "official CPFP 2027 guide, Scholarships",
    applicationUrl: "registered official CPFP 2027 guide",
    applicationNote: "official CPFP 2027 guide, Introduction, qualifications, materials and evaluation",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 68 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, refreshed2027Intakes: 0, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The CPFP guide states only the university-level general September-to-February application period and directs applicants to the catalog for the department deadline, so the existing general 2027 intake is retained without inventing an exact date.",
    "Scholarship coverage is general guidance for prospective full-time international graduate students; no applicant entitlement or award-specific deadline is inferred.",
  ],
  notes: ["The official program title remains on the existing stable slug while its malformed imported fieldCategory is corrected.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-68.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-68.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-68.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 68, candidateSha256, counts: { cities: 1, schools: 1, programs: 1, programIntakes: 0, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
