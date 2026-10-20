import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const expected = new Map([
  ["tsinghua-industrial-engineering-apply-2027", "99fe6a13fbc3dc9a2415189bd73f0243a5a43d509bceb4da87610ae4b09ad368"],
  ["tsinghua-industrial-engineering-qualifications-2027", "fc3e71326dcc1809fa4b0a3b36564e7e493cae4006517724f6cef24d5769ecce"],
  ["tsinghua-industrial-engineering-costs-current", "f3da8ad8ed1c5654d500b92bccfcc8359c9a775403a89927ef9b4a9573299fd4"],
  ["tsinghua-gma-overview-current", "33a7aa6241cfdcf1ac05d0adb4ca7f3a2f5ccad5622aa85498fdfc5cfe0e489b"],
  ["tsinghua-industrial-engineering-programs-2027", "5c403cacc8edc3288ea409c489ebb8c6932694e92840e04cfaa3460ed200903a"],
]);
const evidence = new Map<string, ManifestSource>();

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const row of manifest.sources ?? []) {
      if (row.status !== 200 || expected.get(row.id) !== row.sha256) continue;
      const bytes = await readFile(resolve(runRoot, row.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`Tsinghua Industrial Engineering evidence hash mismatch: ${row.id}`);
      evidence.set(row.id, row);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
for (const id of expected.keys()) if (!evidence.has(id)) throw new Error(`Missing locked Tsinghua Industrial Engineering evidence: ${id}`);

const application = evidence.get("tsinghua-industrial-engineering-apply-2027")!;
const qualifications = evidence.get("tsinghua-industrial-engineering-qualifications-2027")!;
const costs = evidence.get("tsinghua-industrial-engineering-costs-current")!;
const gmaOverview = evidence.get("tsinghua-gma-overview-current")!;
const programs2027 = evidence.get("tsinghua-industrial-engineering-programs-2027")!;
const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const gmaSlug = "tsinghua-university-master-department-of-industrial-engineering-master-s-program-in-global-manufacturing-and-analytics-english";
const imemSlug = "tsinghua-university-master-department-of-industrial-engineering-mem-education-center-international-master-of-engineering-management-imem-program-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorGma = prior.programs?.find((row) => row.slug === gmaSlug);
const priorImem = prior.programs?.find((row) => row.slug === imemSlug);
if (!city || !school || !priorGma || !priorImem) throw new Error("Missing Tsinghua Industrial Engineering dependency or prior program row.");

const applicationFields = { sourceUrl: application.finalUrl ?? application.url, sourceLabel: application.label, sourceSha256: application.sha256, capturedAt: generatedAt };
const englishRequirement = "Both programs are taught in English. Non-native English speakers must provide IELTS 6.5, TOEFL iBT 85 for tests taken before January 21, 2026, TOEFL iBT 4.5 for tests taken on or after January 21, 2026, or proof that a prior degree was taught in English.";
const materials = "Required materials include a personal statement, authenticated bachelor's degree evidence, undergraduate transcript and GPA evidence where needed, English proof, two academic or professional recommendations, passport and nationality-status documentation.";
const commonLineage = {
  teachingLanguage: `official 2027 application guide (${application.id}; ${application.sha256})`,
  englishRequirement: `official 2027 application and qualifications pages (${application.id}; ${application.sha256}; ${qualifications.id}; ${qualifications.sha256})`,
  tuitionAmount: `current official costs page paired with 2027 program application (${costs.id}; ${costs.sha256})`,
  tuitionCurrency: `current official costs page (${costs.id}; ${costs.sha256})`,
  tuitionPeriod: `current official costs page (${costs.id}; ${costs.sha256})`,
  tuitionText: `current official costs page (${costs.id}; ${costs.sha256})`,
  applicationUrl: `registered official Industrial Engineering 2027 application guide (${application.id})`,
};

const gma = {
  ...priorGma,
  durationYears: 2,
  fieldCategory: "Industrial engineering and management science",
  subjectArea: "Global manufacturing and analytics",
  teachingLanguage: "English",
  englishRequirement,
  tuitionAmount: 78000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "program",
  tuitionText: "RMB 78,000 for the full program: RMB 39,000 in each of the first and second years.",
  applicationUrl: application.finalUrl ?? application.url,
  applicationNote: `The official study-period range is two to three years. Applicants need a bachelor's degree or equivalent in engineering, science, mathematics, statistics, business or a related discipline. ${materials} Admission proceeds through document review and an interview for shortlisted applicants.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: generatedAt,
  ...applicationFields,
  sourceFieldLineage: {
    ...(priorGma.sourceFieldLineage ?? {}),
    durationYears: `official GMA overview; lower bound of published two-to-three-year range (${gmaOverview.id}; ${gmaOverview.sha256})`,
    fieldCategory: `official program identity (${gmaOverview.id})`,
    subjectArea: `official program identity (${gmaOverview.id})`,
    ...commonLineage,
    applicationNote: `official GMA overview, 2027 qualifications and application pages (${gmaOverview.id}; ${qualifications.id}; ${application.id})`,
  },
};

const imem = {
  ...priorImem,
  durationYears: 2,
  fieldCategory: "Engineering management",
  subjectArea: "International engineering management",
  teachingLanguage: "English",
  englishRequirement,
  tuitionAmount: 78000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "program",
  tuitionText: "RMB 78,000 for the full program: RMB 39,000 in each of the first and second years.",
  applicationUrl: application.finalUrl ?? application.url,
  applicationNote: `Two-year professional master's program. Applicants need a bachelor's degree or equivalent in engineering, science, management or a related discipline and at least three years of work experience after a bachelor's degree, or two years after a master's or doctoral degree. ${materials} Admission proceeds through document review and an interview for shortlisted applicants.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: generatedAt,
  ...applicationFields,
  sourceFieldLineage: {
    ...(priorImem.sourceFieldLineage ?? {}),
    durationYears: `official 2027 Industrial Engineering program page (${programs2027.id}; ${programs2027.sha256})`,
    fieldCategory: `official program identity (${programs2027.id})`,
    subjectArea: `official program identity (${programs2027.id})`,
    ...commonLineage,
    applicationNote: `official 2027 programs, qualifications and application pages (${programs2027.id}; ${qualifications.id}; ${application.id})`,
  },
};

const intakes = [gmaSlug, imemSlug].map((programSlug) => ({
  programSlug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-03-31T09:00:00.000Z",
  deadlineLabel: "Round 1: through December 11, 2026 at 17:00 Beijing time. Round 2: December 12, 2026 at 08:00 through February 26, 2027 at 17:00. Round 3: February 27, 2027 at 08:00 through March 31, 2027 at 17:00.",
  applicationRound: "Tsinghua Industrial Engineering 2027 - three application rounds",
  status: "open" as const,
  ...applicationFields,
  sourceFieldLineage: {
    intakeTerm: "2027 admission cycle and normal late-August or early-September registration",
    intakeYear: "official 2027 application and qualifications pages",
    deadlineDate: "official third-round closing time converted from Beijing time to UTC",
    deadlineLabel: "official 2027 Application Schedule",
    applicationRound: "official 2027 Application Schedule",
    status: "official first-round availability compared with capturedAt",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs: [gma, imem], programIntakes: intakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 69 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 2, refreshed2027Intakes: 2, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The GMA study period is published as two to three years; the structured duration stores the lower bound and the complete range remains in applicationNote.",
    "The department costs page is current and was last modified during the 2027 application cycle; it agrees with Tsinghua's separate official 2027 tuition schedule already in the candidate.",
    "No program-specific scholarship award or entitlement is inferred from these pages.",
  ],
  notes: ["The exact three-round department calendar replaces the prior university-level generic deadline for both routes.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-69.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-69.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-69.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 69, candidateSha256, counts: { cities: 1, schools: 1, programs: 2, programIntakes: 2, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
