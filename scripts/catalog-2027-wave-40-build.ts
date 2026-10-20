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
const runRoot = resolve(root, "work/catalog-official/sjtu-chinese-language-spring-2027-2026-10-20");
const expectedHashes: Record<string, string> = {
  "sjtu-chinese-language-admission-guideline-current": "188a9ede81fa572c744b031e689a44517a067cc1b819f6bc51d09c2aef503b52",
  "sjtu-spring-chinese-language-full-time-2027-docx": "8c23224dd8f53e74675874d060b4f081e7caf22e3ca457b1802112fe890a39ba",
};
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = new Map<string, ManifestSource>();
for (const [id, expectedSha256] of Object.entries(expectedHashes)) {
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked SJTU Wave 40 evidence for ${id}.`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== expectedSha256) throw new Error(`SJTU Wave 40 evidence hash mismatch for ${id}.`);
  evidence.set(id, source);
}

const pageSource = evidence.get("sjtu-chinese-language-admission-guideline-current")!;
const guideSource = evidence.get("sjtu-spring-chinese-language-full-time-2027-docx")!;
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-03.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "shanghai-jiao-tong-university");
const city = dependency.cities?.find((row) => row.slug === "shanghai");
if (!school || !city) throw new Error("Wave 40 SJTU or Shanghai dependency is missing.");

const sourceFields = {
  sourceUrl: guideSource.finalUrl ?? guideSource.url,
  sourceLabel: guideSource.label,
  sourceSha256: guideSource.sha256,
  capturedAt: guideSource.fetchedAt,
};
const programSlug = "shanghai-jiao-tong-university-long-term-chinese-language-2027";
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Long-term Chinese Language Course (Full time)",
  nameZh: "上海交通大学长期汉语进修项目（全日制）",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: "General Chinese, Chinese for heritage learners, and advanced culture and business Chinese",
  teachingLanguage: "Chinese",
  tuitionAmount: 10500,
  tuitionCurrency: "RMB",
  tuitionPeriod: "semester",
  tuitionText: "RMB 10,500 per semester or RMB 21,000 per academic year; textbooks cost about RMB 300 and the non-refundable application fee is RMB 450.",
  applicationUrl: "https://applychinese.sjtu.edu.cn",
  applicationNote: "Applicants must hold a passport valid for at least one year, be aged 18-60, be in good health, obey Chinese law and university rules, and submit the passport page, a recent passport-style photo and the Supplementary Information Form. Current students in China also submit a transcript and attendance letter. Students take a placement test and must purchase required insurance. No on-campus accommodation is offered to non-degree Chinese-language students.",
  badgeText: "Spring and Fall 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Long-term Chinese language",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: guideSource.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "DOCX title",
    nameZh: "official institution and course title",
    degreeLevel: "completion-certificate and international Chinese education context",
    fieldCategory: "course title and class tracks",
    subjectArea: "Type of long-term Chinese language classes",
    teachingLanguage: "course and placement descriptions",
    tuitionAmount: "Fees",
    tuitionCurrency: "Fees",
    tuitionPeriod: "Period of Schooling and Fees",
    tuitionText: "Fees",
    applicationUrl: "Application Procedure",
    applicationNote: "Application Requirements, Upload Documents, Insurance and Accommodation Registration",
    badgeText: "2027 study periods",
    displayGroup: "completion-certificate and course context",
    displayGroupLabel: "DOCX title",
  },
};

const intakeSourceFields = {
  sourceUrl: guideSource.finalUrl ?? guideSource.url,
  sourceLabel: guideSource.label,
  sourceSha256: guideSource.sha256,
  capturedAt: guideSource.fetchedAt,
};
const programIntakes: CatalogSeedProgramIntake[] = [
  {
    programSlug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    openDate: "2026-09-14T16:00:00.000Z",
    deadlineDate: "2026-12-15T15:59:59.000Z",
    deadlineLabel: "Apply September 15-December 15, 2026; study February 22-June 25, 2027.",
    applicationRound: "SJTU Spring 2027 Long-term Chinese Language Course",
    status: "open",
    ...intakeSourceFields,
    sourceFieldLineage: {
      intakeTerm: "Semesters & Registration periods",
      intakeYear: "2027 Spring study period",
      openDate: "Application Period; Beijing start-of-day normalized to UTC",
      deadlineDate: "Application Period; Beijing end-of-day normalized to UTC",
      deadlineLabel: "Application Period and Study period",
      applicationRound: "DOCX title and 2027 Spring study period",
      status: "application period compared with capturedAt",
    },
  },
  {
    programSlug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2027-03-14T16:00:00.000Z",
    deadlineLabel: "Applications open March 15, 2027; the official DOCX says June 15 while the official webpage says June 30, so no deadlineDate is emitted. Study runs September 13, 2027-January 14, 2028.",
    applicationRound: "SJTU Fall 2027 Long-term Chinese Language Course",
    ...intakeSourceFields,
    sourceFieldLineage: {
      intakeTerm: "Semesters & Registration periods",
      intakeYear: "2027 Fall study period",
      openDate: "Application Period; Beijing start-of-day normalized to UTC",
      deadlineLabel: "DOCX and registered official webpage; conflict preserved",
      applicationRound: "DOCX title and 2027 Fall study period",
    },
  },
];

const generatedAt = [pageSource.fetchedAt, guideSource.fetchedAt].sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 40 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 2, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map((row) => ({ id: row.id, label: row.label, url: row.url, fetchedAt: row.fetchedAt, sha256: row.sha256 })),
  unresolved: [
    "The official DOCX states a June 15 Fall application deadline while the official webpage states June 30. The conflict is preserved in deadlineLabel and no deadlineDate is emitted.",
    "The source permits one-semester or one-academic-year study but does not publish a complete date range for every academic-year combination, so no durationYears value or invented end date is emitted.",
    "This source establishes a non-degree Chinese-language route, not SJTU's general 2027 undergraduate or graduate admission cycle.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-40");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 40, candidateSha256, counts: { schools: 1, programs: 1, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
