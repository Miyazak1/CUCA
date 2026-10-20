import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };

const root = process.cwd();
const sourceId = "tsinghua-advanced-computing-admissions-2027";
const expectedSha256 = "d0293a2397bfe8e38011190ff3863abb3ff9813368a41041138c7e5c7ea9604c";
let source: ManifestSource | undefined;

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const found = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!found) continue;
    const bytes = await readFile(resolve(runRoot, found.artifactPath));
    if (createHash("sha256").update(bytes).digest("hex") !== found.sha256) throw new Error("Tsinghua Advanced Computing evidence hash mismatch.");
    source = found;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked Tsinghua Advanced Computing 2027 evidence.");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const masterSlug = "tsinghua-university-master-department-of-computer-science-and-technology-master-s-program-in-advanced-computing-english";
const doctoralSlug = "tsinghua-university-doctoral-department-of-computer-science-and-technology-doctoral-program-in-computer-science-and-technology-english";
const city = prior.cities?.find((row) => row.slug === "beijing");
const school = prior.schools?.find((row) => row.slug === "tsinghua-university");
const priorMaster = prior.programs?.find((row) => row.slug === masterSlug);
const priorDoctoral = prior.programs?.find((row) => row.slug === doctoralSlug);
if (!city || !school || !priorMaster || !priorDoctoral) throw new Error("Missing Tsinghua Computer Science dependency or prior program row.");

const fields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const commonEnglishRequirement = "Non-native English speakers must provide TOEFL iBT 85 for tests taken before January 21, 2026, TOEFL iBT 4.5 for tests taken on or after January 21, 2026, or IELTS 6.5.";
const commonMaterials = "Required materials include a personal statement, authenticated degree evidence, academic transcripts and GPA evidence where needed, language proof, two academic recommendations, passport and nationality-status documents. Uploaded documents must be in Chinese or English, or accompanied by notarized Chinese or English translations.";
const commonScholarship = "The Chinese Government Scholarship full award normally covers tuition, stipend, on-campus accommodation or accommodation subsidy, and medical insurance. Tuition scholarships such as the Beijing Government Scholarship may cover full or partial tuition for one academic year and are competitive.";

const master = {
  ...priorMaster,
  durationYears: 2,
  fieldCategory: "Computer science",
  subjectArea: "Advanced computing",
  teachingLanguage: "English",
  englishRequirement: commonEnglishRequirement,
  tuitionAmount: 39000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 39,000 per year.",
  scholarshipText: commonScholarship,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `The official completion range is two to three years. Applicants need a bachelor's degree or equivalent in computer science or a related area. ${commonMaterials} Admission uses document review and a comprehensive assessment, generally an interview.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorMaster.sourceFieldLineage ?? {}),
    durationYears: "official 2027 Advanced Computing guide; lower bound of the published two-to-three-year completion range",
    fieldCategory: "official program identity",
    subjectArea: "official program identity",
    teachingLanguage: "official Advanced Computing program description",
    englishRequirement: "official 2027 guide, English Proficiency Requirements",
    tuitionAmount: "official 2027 guide, Tuition and Scholarship table",
    tuitionCurrency: "official 2027 guide, Tuition and Scholarship table",
    tuitionPeriod: "official 2027 guide, Tuition and Scholarship table",
    tuitionText: "official 2027 guide, Tuition and Scholarship table",
    scholarshipText: "official 2027 guide, Tuition and Scholarship",
    applicationUrl: "registered official Advanced Computing 2027 guide",
    applicationNote: "official 2027 guide, program introduction, qualifications, materials and evaluation",
  },
};

const doctoral = {
  ...priorDoctoral,
  durationYears: 3,
  fieldCategory: "Computer science",
  subjectArea: "Computer science and technology",
  teachingLanguage: "English",
  englishRequirement: commonEnglishRequirement,
  tuitionAmount: 40000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 40,000 per year.",
  scholarshipText: commonScholarship,
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: `The standard doctoral completion range is three to four years; the direct doctoral route for bachelor's-degree holders is normally four to five years and has additional institution and GPA eligibility rules. Standard doctoral applicants need a master's degree or equivalent in computer science or a related area. ${commonMaterials} Admission uses document review and a comprehensive assessment, generally an interview.`,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...fields,
  sourceFieldLineage: {
    ...(priorDoctoral.sourceFieldLineage ?? {}),
    durationYears: "official 2027 Advanced Computing guide; lower bound of the published three-to-four-year standard doctoral range",
    fieldCategory: "official program identity",
    subjectArea: "official program identity",
    teachingLanguage: "official Advanced Computing program description",
    englishRequirement: "official 2027 guide, English Proficiency Requirements",
    tuitionAmount: "official 2027 guide, Tuition and Scholarship table",
    tuitionCurrency: "official 2027 guide, Tuition and Scholarship table",
    tuitionPeriod: "official 2027 guide, Tuition and Scholarship table",
    tuitionText: "official 2027 guide, Tuition and Scholarship table",
    scholarshipText: "official 2027 guide, Tuition and Scholarship",
    applicationUrl: "registered official Advanced Computing 2027 guide",
    applicationNote: "official 2027 guide, program introduction, qualifications, direct-doctoral rules, materials and evaluation",
  },
};

const intakes = [masterSlug, doctoralSlug].map((programSlug) => ({
  programSlug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-02-27T09:00:00.000Z",
  deadlineLabel: "Round 1: before December 15, 2026 at 17:00 Beijing time. Round 2: January 1, 2027 at 08:00 through February 27, 2027 at 17:00 Beijing time.",
  applicationRound: "Tsinghua Computer Science 2027 - two application rounds",
  status: "open" as const,
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "2027 enrollment cycle and normal late-August registration",
    intakeYear: "official 2027 guide",
    deadlineDate: "official second-round closing time converted from Beijing time to UTC",
    deadlineLabel: "official Application Schedule",
    applicationRound: "official Application Schedule",
    status: "official first-round closing time compared with capturedAt",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [master, doctoral], programIntakes: intakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 67 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 2, refreshed2027Intakes: 2, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The data contract stores one numeric duration, so the lower bound is structured while the complete two-to-three-year master's and three-to-four-year doctoral ranges remain in applicationNote.",
    "The direct doctoral route has a separate four-to-five-year range and additional institution/GPA eligibility; these are preserved in applicationNote rather than generalized to all doctoral applicants.",
    "Scholarship coverage is program-level guidance, not an applicant entitlement; no award-specific application deadline is inferred.",
  ],
  notes: ["The exact department calendar supersedes the prior university-level generic deadline for these two routes.", "No applicant, account, passport, payment or other personal data is included."],
};

await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-67.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-67.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-67.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, wave: 67, candidateSha256, counts: { cities: 1, schools: 1, programs: 2, programIntakes: 2, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
