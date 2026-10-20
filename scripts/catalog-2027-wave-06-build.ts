import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

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
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-06.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-06.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-06.review.json");
const schoolSlug = "huazhong-university-of-science-and-technology";

const expected: Record<string, string> = {
  "hust-scholarship-information-2027": "f34319ae377af3c884abb1aa21c16d7b1d4b842fd0039e263342d11e452a559e",
  "hust-chinese-government-scholarship-review-regulations-current": "dd676769a92c2a123d721235647c89915660c2b9c1f81c6a5890dba65e0e79c1",
  "hust-foundation-program-2027": "57069f1e27857b50d4567a37a65882cc02682396414b04899e57f321d15d98df",
  "hust-chinese-language-programs-2027": "e0dbbd10e0d5e5c0e618788f6b67e93963146d36303a1f0fbc9890f33316629c",
};

const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 06 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((school) => school.slug === schoolSlug);
const baseCity = (base.cities ?? []).find((city) => city.slug === "wuhan");
if (!baseSchool || !baseCity) throw new Error("HUST or Wuhan dependency is missing from the reviewed 100-school release.");

const scholarshipSource = evidence.get("hust-scholarship-information-2027")!;
const scholarshipFundingSource = evidence.get("hust-chinese-government-scholarship-review-regulations-current")!;
const foundationSource = evidence.get("hust-foundation-program-2027")!;
const languageSource = evidence.get("hust-chinese-language-programs-2027")!;
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const programBase = {
  schoolSlug,
  citySlug: "wuhan",
  degreeLevel: "Non-degree",
  status: "active" as const,
  verificationStatus: "verified" as const,
};
const foundationSlug = `${schoolSlug}-foundation-program-spring-2027`;
const languageSlug = `${schoolSlug}-long-term-chinese-language-program-2027`;
const internshipSlug = `${schoolSlug}-chinese-language-internship-3-plus-3-2027`;
const sportsSlug = `${schoolSlug}-short-term-chinese-language-traditional-sports-2027`;
const urbanizationSlug = `${schoolSlug}-short-term-chinese-language-urbanization-2027`;

const programs: CatalogSeedProgram[] = [
  {
    ...programBase,
    slug: foundationSlug,
    nameEn: "Foundation Program",
    englishRequirement: "No fixed English-test score is published; the program itself is designed to enhance applicants' English proficiency.",
    fieldCategory: "Foundation and university preparation",
    subjectArea: "English, Mathematics, Physics, Chemistry and Biology",
    tuitionAmount: 18000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "program",
    tuitionText: "CNY 18,000 for the 17-week program; application fee CNY 800, insurance CNY 500 and accommodation CNY 700-1,200/month are published separately.",
    applicationUrl: foundationSource.finalUrl ?? foundationSource.url,
    applicationNote: "Applicants must have graduated or be about to graduate from high school. The program prepares students for the entrance examination and possible progression to HUST English-medium undergraduate programs; progression is not guaranteed.",
    ...sourceFields(foundationSource),
    sourceFieldLineage: {
      nameEn: "page title and Program Introduction",
      englishRequirement: "Program Introduction and published eligibility/application-material sections",
      subjectArea: "Main subjects",
      tuitionAmount: "Fees section",
      tuitionCurrency: "Fees section",
      tuitionPeriod: "Duration and Fees sections",
      tuitionText: "Fees section",
      applicationUrl: "official page URL",
      applicationNote: "Program Introduction and Eligibility sections",
    },
    lastVerifiedAt: foundationSource.fetchedAt,
  },
  {
    ...programBase,
    slug: `${languageSlug}-one-semester`,
    nameEn: "Long-term Chinese Language Program (One Semester)",
    durationMonths: 5,
    fieldCategory: "Chinese language",
    subjectArea: "Chinese language and culture",
    teachingLanguage: "Chinese",
    hskRequirement: "No fixed HSK score is published; the program offers instruction from elementary through advanced levels.",
    tuitionAmount: 8000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "semester",
    tuitionText: "CNY 8,000/semester or CNY 16,000/year; application fee CNY 800, insurance CNY 500/semester or CNY 1,000/year, and accommodation CNY 700-1,400/month.",
    applicationUrl: languageSource.finalUrl ?? languageSource.url,
    applicationNote: "Six proficiency levels are offered from elementary to advanced. Applicants must be non-Chinese citizens aged 16-35 by September 1, 2027 and hold or expect a high-school qualification.",
    ...sourceFields(languageSource),
    sourceFieldLineage: {
      nameEn: "Program Introduction",
      durationMonths: "official one-semester option represented by the published semester dates",
      fieldCategory: "Program Introduction",
      subjectArea: "Core Curriculum",
      teachingLanguage: "program title and curriculum",
      hskRequirement: "six published proficiency levels from elementary through advanced and no fixed HSK threshold in eligibility/materials",
      tuitionAmount: "Fees table",
      tuitionCurrency: "Fees table",
      tuitionPeriod: "Fees table",
      tuitionText: "Fees section",
      applicationUrl: "official page URL",
      applicationNote: "Eligibility and Requirements section",
    },
    lastVerifiedAt: languageSource.fetchedAt,
  },
  {
    ...programBase,
    slug: `${languageSlug}-one-academic-year`,
    nameEn: "Long-term Chinese Language Program (One Academic Year)",
    durationYears: 1,
    fieldCategory: "Chinese language",
    subjectArea: "Chinese language and culture",
    teachingLanguage: "Chinese",
    hskRequirement: "No fixed HSK score is published; the program offers instruction from elementary through advanced levels.",
    tuitionAmount: 16000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 16,000/year; application fee CNY 800, insurance CNY 1,000/year, and accommodation CNY 700-1,400/month.",
    applicationUrl: languageSource.finalUrl ?? languageSource.url,
    applicationNote: "Six proficiency levels are offered from elementary to advanced. Applicants must be non-Chinese citizens aged 16-35 by September 1, 2027 and hold or expect a high-school qualification.",
    ...sourceFields(languageSource),
    sourceFieldLineage: {
      nameEn: "Program Introduction",
      durationYears: "official one-academic-year option",
      fieldCategory: "Program Introduction",
      subjectArea: "Core Curriculum",
      teachingLanguage: "program title and curriculum",
      hskRequirement: "six published proficiency levels from elementary through advanced and no fixed HSK threshold in eligibility/materials",
      tuitionAmount: "Fees table",
      tuitionCurrency: "Fees table",
      tuitionPeriod: "Fees table",
      tuitionText: "Fees section",
      applicationUrl: "official page URL",
      applicationNote: "Eligibility and Requirements section",
    },
    lastVerifiedAt: languageSource.fetchedAt,
  },
  {
    ...programBase,
    slug: internshipSlug,
    nameEn: "3+3 Program (Chinese Language + Internship)",
    durationMonths: 6,
    fieldCategory: "Chinese language and internship",
    subjectArea: "Chinese language, business Chinese and company internship",
    teachingLanguage: "Chinese",
    hskRequirement: "No fixed HSK score is published for this route.",
    tuitionAmount: 5500,
    tuitionCurrency: "CNY",
    tuitionPeriod: "semester",
    tuitionText: "CNY 5,500/semester; application fee CNY 800, insurance and accommodation are published separately.",
    applicationUrl: languageSource.finalUrl ?? languageSource.url,
    applicationNote: "Three months of Chinese-language study followed by a three-month company internship. A CV or work/internship certificate is required.",
    ...sourceFields(languageSource),
    sourceFieldLineage: {
      nameEn: "Program Introduction",
      durationMonths: "3+3 program description",
      fieldCategory: "Program Introduction",
      subjectArea: "Core Curriculum and program description",
      teachingLanguage: "program title and curriculum",
      hskRequirement: "published eligibility/application-material sections contain no fixed HSK threshold",
      tuitionAmount: "Fees table",
      tuitionCurrency: "Fees table",
      tuitionPeriod: "Fees table",
      tuitionText: "Fees section",
      applicationUrl: "official page URL",
      applicationNote: "Program Introduction and Documents for Application sections",
    },
    lastVerifiedAt: languageSource.fetchedAt,
  },
  {
    ...programBase,
    slug: sportsSlug,
    nameEn: "Short-term Chinese Language + Chinese Traditional Sports",
    fieldCategory: "Short-term Chinese language",
    subjectArea: "Chinese language and traditional sports",
    teachingLanguage: "Chinese",
    hskRequirement: "No fixed HSK score is published for this short-term route.",
    tuitionAmount: 3000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "program",
    tuitionText: "CNY 3,000 for about two weeks.",
    applicationUrl: languageSource.finalUrl ?? languageSource.url,
    applicationNote: "The official guide asks short-term applicants to contact the program coordinator directly; no fixed intake date is published.",
    ...sourceFields(languageSource),
    sourceFieldLineage: {
      nameEn: "Fees table",
      fieldCategory: "Program Introduction",
      subjectArea: "Fees table",
      teachingLanguage: "program title",
      hskRequirement: "published eligibility/application-material sections contain no fixed HSK threshold",
      tuitionAmount: "Fees table",
      tuitionCurrency: "Fees table",
      tuitionPeriod: "Fees table",
      tuitionText: "Fees table",
      applicationUrl: "official page URL",
      applicationNote: "Documents for Application section item 9",
    },
    lastVerifiedAt: languageSource.fetchedAt,
  },
  {
    ...programBase,
    slug: urbanizationSlug,
    nameEn: "Short-term Chinese Language + Chinese Urbanization",
    fieldCategory: "Short-term Chinese language",
    subjectArea: "Chinese language and Chinese urbanization",
    teachingLanguage: "Chinese",
    hskRequirement: "No fixed HSK score is published for this short-term route.",
    tuitionAmount: 3000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "program",
    tuitionText: "CNY 3,000 for about two weeks.",
    applicationUrl: languageSource.finalUrl ?? languageSource.url,
    applicationNote: "The official guide asks short-term applicants to contact the program coordinator directly; no fixed intake date is published.",
    ...sourceFields(languageSource),
    sourceFieldLineage: {
      nameEn: "Fees table",
      fieldCategory: "Program Introduction",
      subjectArea: "Fees table",
      teachingLanguage: "program title",
      hskRequirement: "published eligibility/application-material sections contain no fixed HSK threshold",
      tuitionAmount: "Fees table",
      tuitionCurrency: "Fees table",
      tuitionPeriod: "Fees table",
      tuitionText: "Fees table",
      applicationUrl: "official page URL",
      applicationNote: "Documents for Application section item 9",
    },
    lastVerifiedAt: languageSource.fetchedAt,
  },
];

const languageIntake = (programSlug: string, intakeTerm: "Spring" | "Fall", openDate: string, deadlineDate: string, deadlineLabel: string): CatalogSeedProgramIntake => ({
  programSlug,
  intakeTerm,
  intakeYear: 2027,
  openDate,
  deadlineDate,
  deadlineLabel,
  applicationRound: "HUST 2027 Chinese language programs",
  status: "open",
  ...sourceFields(languageSource),
  sourceFieldLineage: {
    intakeTerm: "Application and Admission Procedures",
    intakeYear: "Application and Admission Procedures",
    openDate: "Application and Admission Procedures",
    deadlineDate: "Application and Admission Procedures",
    deadlineLabel: "Application and Admission Procedures",
    applicationRound: "official guide title",
    status: "application period compared with capturedAt",
  },
});
const programIntakes: CatalogSeedProgramIntake[] = [
  {
    programSlug: foundationSlug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    openDate: "2026-10-14T16:00:00.000Z",
    deadlineDate: "2027-01-10T15:59:59.000Z",
    deadlineLabel: "October 15, 2026-January 10, 2027; program runs March 1-June 25, 2027.",
    applicationRound: "HUST 2027 Foundation Program",
    status: "open",
    ...sourceFields(foundationSource),
    sourceFieldLineage: {
      intakeTerm: "Duration and Location",
      intakeYear: "official guide title and intake dates",
      openDate: "Application Period",
      deadlineDate: "Application Period",
      deadlineLabel: "Application Period and Duration and Location",
      applicationRound: "official guide title",
      status: "application period compared with capturedAt",
    },
  },
  languageIntake(`${languageSlug}-one-semester`, "Spring", "2026-10-14T16:00:00.000Z", "2026-12-31T15:59:59.000Z", "Spring 2027 application: October 15-December 31, 2026; study March 1-July 15, 2027."),
  languageIntake(`${languageSlug}-one-semester`, "Fall", "2026-10-14T16:00:00.000Z", "2027-06-30T15:59:59.000Z", "Fall 2027 application: October 15, 2026-June 30, 2027; study September 1, 2027-January 15, 2028."),
  languageIntake(`${languageSlug}-one-academic-year`, "Spring", "2026-10-14T16:00:00.000Z", "2026-12-31T15:59:59.000Z", "Spring 2027 application: October 15-December 31, 2026; one-academic-year option begins March 1, 2027."),
  languageIntake(`${languageSlug}-one-academic-year`, "Fall", "2026-10-14T16:00:00.000Z", "2027-06-30T15:59:59.000Z", "Fall 2027 application: October 15, 2026-June 30, 2027; one-academic-year option begins September 1, 2027."),
  languageIntake(internshipSlug, "Spring", "2026-10-14T16:00:00.000Z", "2026-12-31T15:59:59.000Z", "Spring 2027 application: October 15-December 31, 2026."),
  languageIntake(internshipSlug, "Fall", "2026-10-14T16:00:00.000Z", "2027-06-30T15:59:59.000Z", "Fall 2027 application: October 15, 2026-June 30, 2027."),
];

const scholarship = (slug: string, title: string, applicableDegree: string, deadlineLabel: string, requirementText: string, applicationRound: string, amountText: string): CatalogSeedScholarship => ({
  slug,
  title,
  schoolSlug,
  providerName: "Chinese Government Scholarship",
  fundingLevel: "Full",
  coverage: "Registration fee, tuition, experiment and internship expenses, basic textbooks, on-campus accommodation, medical coverage and living allowance under the current HUST Chinese Government Scholarship regulations.",
  amountText,
  applicableDegree,
  deadlineLabel,
  requirementText,
  applicationRound,
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: [scholarshipSource.fetchedAt, scholarshipFundingSource.fetchedAt].sort().at(-1)!,
  ...sourceFields(scholarshipSource),
  sourceFieldLineage: {
    title: "Scholarship Information and Tips heading/table",
    schoolSlug: "official HUST page authority",
    providerName: "page heading and program names",
    fundingLevel: "current official HUST Chinese Government Scholarship review regulations, Clause I",
    coverage: "current official HUST Chinese Government Scholarship review regulations, Clause I",
    amountText: "current official HUST Chinese Government Scholarship review regulations, Clause II",
    applicableDegree: "WHO row and detailed program section",
    deadlineLabel: "WHEN row",
    requirementText: "WHO row, Tips and detailed program section",
    applicationRound: "program type headings",
    status: "application period compared with capturedAt",
  },
});
const scholarships: CatalogSeedScholarship[] = [
  scholarship(
    "official-2027-hust-csc-bilateral-program",
    "HUST 2027 Chinese Government Scholarship - Bilateral Program",
    "Bachelor, Master, Doctoral, General Scholar, Senior Scholar and Chinese Language Student",
    "Late November to early April; the exact deadline is set by each dispatching authority.",
    "Apply through the dispatching authority in the applicant's home country. HUST does not charge an application fee for this route and advises applicants to obtain pre-admission evidence where possible.",
    "Chinese Government Scholarship Type A Bilateral Program",
    "Bachelor: CNY 2,500/month; General Scholar and Master: CNY 3,000/month; Senior Scholar and Doctoral: CNY 3,500/month.",
  ),
  scholarship(
    "official-2027-hust-csc-chinese-university-program",
    "HUST 2027 Chinese Government Scholarship - Chinese University Program",
    "Master and Doctoral",
    "October 15, 2026-February 25, 2027.",
    "Applicants must have an excellent academic record and strong academic potential. Apply through the HUST online application system under agency number 10487.",
    "Chinese Government Scholarship Type B Chinese University Program",
    "Master: CNY 3,000/month; Doctoral: CNY 3,500/month.",
  ),
  scholarship(
    "official-2027-hust-csc-silk-road-program",
    "HUST 2027 Chinese Government Scholarship - Silk Road Program",
    "Bachelor, Master and Doctoral",
    "Master/Doctoral: October 15, 2026-February 25, 2027; Bachelor: October 15, 2026-April 30, 2027.",
    "Limited to applicants from the 10 countries listed by HUST. Published specialties are Chinese-taught Architecture and Software Engineering for bachelor's study, plus English-taught Computer Science and Technology, Civil Engineering and Chemistry for master's/doctoral study. HSK 4 score 180 or above is required for the bachelor routes.",
    "Chinese Government Scholarship Type B Silk Road Program",
    "Bachelor: CNY 2,500/month; Master: CNY 3,000/month; Doctoral: CNY 3,500/month.",
  ),
];

const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [baseCity],
  schools: [baseSchool],
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 06 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    schoolSlug,
    refreshedPrograms: programs.length,
    new2027Intakes: programIntakes.length,
    refreshedScholarships: scholarships.length,
    sourceSnapshots: evidence.size,
  },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "This wave covers HUST 2027 foundation, Chinese-language and Chinese Government Scholarship information that is explicitly published on official pages.",
    "The reviewed 100-school HUST and Wuhan rows are included unchanged as dependencies and retain their original evidence.",
    "No 2026 degree-admission route is relabeled as a 2027 intake; the 2027 degree guides remain unresolved.",
    "Short-term programs have no fixed published intake dates, so no intake rows are invented for them.",
    "The 2027 scholarship summary establishes route scope and deadlines; the separately captured current HUST scholarship regulations establish the full-scholarship coverage and degree-level living allowances.",
    "No applicant, account, passport, payment, or other personal data is included.",
  ],
};

await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  reviewPath,
  candidateSha256,
  counts: {
    programs: programs.length,
    programIntakes: programIntakes.length,
    scholarships: scholarships.length,
    sourceSnapshots: evidence.size,
  },
  publicationAuthorized: false,
}, null, 2));
