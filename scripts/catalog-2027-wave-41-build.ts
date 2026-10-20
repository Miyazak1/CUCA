import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
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
const sourceId = "xjtu-chinese-language-program-xian-2027";
const expectedSha256 = "7f34c442794f0c2bf9fd3b9a14648fadecd917343c8501160458934532d0ae93";
const runRoot = resolve(root, "work/catalog-official/xjtu-chinese-language-2027-2026-10-20");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked XJTU 2027 Chinese-language evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("XJTU Wave 41 evidence hash mismatch.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-08.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "xi-an-jiaotong-university");
const city = dependency.cities?.find((row) => row.slug === "xian");
if (!school || !city) throw new Error("Wave 41 XJTU or Xi'an dependency is missing.");

const sourceFields = {
  sourceUrl: evidence.finalUrl ?? evidence.url,
  sourceLabel: evidence.label,
  sourceSha256: evidence.sha256,
  capturedAt: evidence.fetchedAt,
};
const commonProgram = {
  schoolSlug: school.slug,
  citySlug: city.slug,
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: "Comprehensive Chinese, listening and speaking, reading and writing, HSK preparation, electives and cultural immersion",
  teachingLanguage: "Chinese",
  hskRequirement: "No admission HSK threshold is published. Placement covers complete beginners through HSK Level 5+ and assigns elementary, intermediate or advanced classes; a Chinese or English language certificate is submitted only if available.",
  applicationUrl: "https://isso.xjtu.edu.cn/recruit/login",
  applicationNote: "Applicants must be over 18 and under 45, be in good health and hold a valid foreign ordinary passport. Submit a passport valid for at least six months beyond enrolment, a valid original non-criminal-record certificate, highest diploma in Chinese or English, the completed Foreigner Physical Examination Record and blood-test report, and any available language certificate. On-campus accommodation is required in principle and university insurance is mandatory.",
  scholarshipText: "Applicants may apply separately for the International Chinese Language Teachers Scholarship; this program page does not publish the award terms or scholarship deadline.",
  hasScholarship: true,
  badgeText: "Spring and Fall 2027",
  displayGroup: "Non-degree",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
};
const semesterSlug = "xi-an-jiaotong-university-chinese-language-program-xian-2027-one-semester";
const academicYearSlug = "xi-an-jiaotong-university-chinese-language-program-xian-2027-one-academic-year";
const programs: CatalogSeedProgram[] = [
  {
    slug: semesterSlug,
    nameEn: "Chinese Language Program in Xi'an (One Semester)",
    nameZh: "西安交通大学2027年汉语进修项目（西安校区，一学期）",
    tuitionAmount: 8000,
    tuitionCurrency: "RMB",
    tuitionPeriod: "semester",
    tuitionText: "RMB 8,000 per semester; self-funded application fee RMB 500, scholarship application fee RMB 800, and registration fee RMB 400.",
    displayGroupLabel: "One-semester Chinese language",
    ...commonProgram,
    sourceFieldLineage: {
      nameEn: "Program Types and page title",
      nameZh: "official institution, year and Program Types",
      degreeLevel: "Program Completion and Chinese Language Program context",
      fieldCategory: "page title and Program Introduction",
      subjectArea: "Curriculum",
      teachingLanguage: "Chinese-language curriculum and placement levels",
      hskRequirement: "Program Level and Application Documents",
      tuitionAmount: "Fees",
      tuitionCurrency: "Fees",
      tuitionPeriod: "Program Types and Fees",
      tuitionText: "Fees",
      applicationUrl: "Application Procedure",
      applicationNote: "Eligibility, Application Documents and Other Information",
      scholarshipText: "Scholarships Policy",
      hasScholarship: "Scholarships Policy",
      badgeText: "Program Types",
      displayGroup: "Chinese Language Program context",
      displayGroupLabel: "Program Types",
    },
  },
  {
    slug: academicYearSlug,
    nameEn: "Chinese Language Program in Xi'an (One Academic Year)",
    nameZh: "西安交通大学2027年汉语进修项目（西安校区，一学年）",
    durationYears: 1,
    tuitionAmount: 15000,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: "RMB 15,000 per academic year; self-funded application fee RMB 500, scholarship application fee RMB 800, and registration fee RMB 400.",
    displayGroupLabel: "One-academic-year Chinese language",
    ...commonProgram,
    sourceFieldLineage: {
      nameEn: "Program Types and page title",
      nameZh: "official institution, year and Program Types",
      degreeLevel: "Program Completion and Chinese Language Program context",
      durationYears: "Program Types explicitly publishes February-to-February and September-to-July academic-year options",
      fieldCategory: "page title and Program Introduction",
      subjectArea: "Curriculum",
      teachingLanguage: "Chinese-language curriculum and placement levels",
      hskRequirement: "Program Level and Application Documents",
      tuitionAmount: "Fees",
      tuitionCurrency: "Fees",
      tuitionPeriod: "Program Types and Fees",
      tuitionText: "Fees",
      applicationUrl: "Application Procedure",
      applicationNote: "Eligibility, Application Documents and Other Information",
      scholarshipText: "Scholarships Policy",
      hasScholarship: "Scholarships Policy",
      badgeText: "Program Types",
      displayGroup: "Chinese Language Program context",
      displayGroupLabel: "Program Types",
    },
  },
];

const intake = (programSlug: string, term: "Spring" | "Fall", deadlineDate: string, deadlineLabel: string, applicationRound: string): CatalogSeedProgramIntake => ({
  programSlug,
  intakeTerm: term,
  intakeYear: 2027,
  deadlineDate,
  deadlineLabel,
  applicationRound,
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "Program Types",
    intakeYear: "Program Types",
    deadlineDate: "Application Deadlines; Beijing end-of-day normalized to UTC",
    deadlineLabel: "Program Types, Application Deadlines and early-close warning",
    applicationRound: "page title and Program Types",
    status: "published application route compared with capturedAt and deadline",
  },
});
const programIntakes: CatalogSeedProgramIntake[] = [
  intake(semesterSlug, "Spring", "2027-01-15T15:59:59.000Z", "Apply by January 15, 2027; study February-July 2027. The exact start date is stated in the admission letter and the class may close early when full.", "XJTU Spring 2027 Chinese Language Program in Xi'an - One Semester"),
  intake(academicYearSlug, "Spring", "2027-01-15T15:59:59.000Z", "Apply by January 15, 2027; study February 2027-February 2028. The exact start date is stated in the admission letter and the class may close early when full.", "XJTU Spring 2027 Chinese Language Program in Xi'an - One Academic Year"),
  intake(semesterSlug, "Fall", "2027-08-15T15:59:59.000Z", "Apply by August 15, 2027; study September 2027-February 2028. The exact start date is stated in the admission letter and the class may close early when full.", "XJTU Fall 2027 Chinese Language Program in Xi'an - One Semester"),
  intake(academicYearSlug, "Fall", "2027-08-15T15:59:59.000Z", "Apply by August 15, 2027; study September 2027-July 2028. The exact start date is stated in the admission letter and the class may close early when full.", "XJTU Fall 2027 Chinese Language Program in Xi'an - One Academic Year"),
];

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: evidence.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 41 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The official guide states only the months for each study period and defers exact start dates to the admission letter; no exact start or end date is invented.",
    "The scholarship is referenced as a separate application route, but coverage and deadline are not published on this page, so no scholarship entity is emitted.",
    "This source establishes Chinese-language non-degree routes, not XJTU's general 2027 undergraduate or graduate admission cycle.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-41");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 41, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
