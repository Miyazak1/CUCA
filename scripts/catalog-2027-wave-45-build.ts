import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/tsinghua-visiting-spring-2027-2026-10-20");
const sourceId = "tsinghua-visiting-student-program-spring-2027";
const expectedSha256 = "698034977aa11f4960abda730fe6079e9cb32283c41b45a0d999a3476ea7d211";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked Tsinghua Spring 2027 visiting-student evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("Tsinghua Wave 45 evidence hash mismatch.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "tsinghua-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 45 Tsinghua or Beijing dependency is missing.");
const sourceFields = { sourceUrl: evidence.finalUrl ?? evidence.url, sourceLabel: evidence.label, sourceSha256: evidence.sha256, capturedAt: evidence.fetchedAt };
const programSlug = "tsinghua-university-visiting-student-program-spring-2027";
const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Visiting Student Program - Spring 2027",
  nameZh: "清华大学非学位进修生项目（2027年春季）",
  degreeLevel: "Non-degree",
  fieldCategory: "Visiting study and research",
  subjectArea: "Short-term coursework or visiting research across participating Tsinghua departments; the official page states that more than 200 English-medium courses are available.",
  teachingLanguage: "Chinese or English, depending on the selected department and course",
  hskRequirement: "Humanities and social-science disciplines require HSK 5 with 210 or above; Modern Chinese requires HSK 5 with 180 or above. Applicants must confirm the teaching language with the relevant department.",
  englishRequirement: "For English-taught courses, applicants from non-native English-speaking countries need TOEFL 90, IELTS 6.5, or an English-proficiency certificate from their current university.",
  tuitionText: "Tuition is department- and subject-specific in the linked Spring 2027 fee schedule; the main official page publishes a CNY 400 non-refundable application fee, CNY 800/year insurance, and accommodation reference prices of CNY 40/bed/day for double rooms or CNY 30/bed/day for triple rooms.",
  scholarshipText: "The program accepts Chinese Government Scholarship Type A and Type B (China Link) routes and the China Studies Program joint-research PhD fellowship. The main page does not publish route-specific 2027 deadlines or award amounts.",
  applicationUrl: "https://intl-nondegree.tsinghua.edu.cn",
  applicationNote: "Study length ranges from one semester to two years. General visiting students must be aged 18-45 and have completed at least the equivalent of university year two. Senior visiting students must be current PhD students, PhD candidates or PhD holders and are normally no older than 50. Required documents include a study plan, enrollment or prior-degree certificate, latest transcript with 4.0-scale GPA, language proof and passport; senior visitors additionally submit an acceptance letter and two academic references, while arts-and-design applicants submit six photographic design works.",
  hasScholarship: true,
  badgeText: "Spring 2027 non-degree",
  displayGroup: "Non-degree",
  displayGroupLabel: "Visiting Student Program",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official 2026/2027 program title and Spring 2027 application schedule",
    nameZh: "official Chinese portal context and English program title",
    degreeLevel: "official Application for Non-degree International Students portal",
    fieldCategory: "official program introduction",
    subjectArea: "official program introduction",
    teachingLanguage: "official Language Competence Requirements",
    hskRequirement: "official Language Competence Requirements",
    englishRequirement: "official Language Competence Requirements",
    tuitionText: "official Costs section; detailed tuition remains attachment-specific",
    scholarshipText: "official Scholarship section",
    applicationUrl: "official Application Procedure",
    applicationNote: "official schooling system, qualifications and application documents",
  },
};
const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-15T00:00:00.000Z",
  deadlineDate: "2026-11-30T15:59:59.000Z",
  deadlineLabel: "Apply October 15-November 30, 2026 for Spring 2027 enrollment. The deadline is normalized to end of day in Beijing because the official page publishes no time.",
  applicationRound: "Tsinghua Spring 2027 Visiting Student Program",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official Spring Semester Enrollment label",
    intakeYear: "official Spring 2027 schedule",
    openDate: "official Application Schedule",
    deadlineDate: "official Application Schedule; Beijing end-of-day normalization",
    deadlineLabel: "official Application Schedule",
    applicationRound: "official program title and Spring 2027 schedule",
    status: "deadline compared with capturedAt",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: evidence.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 45 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: 1, new2027Intakes: 1, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The linked Spring 2027 program handbook, major list, fee schedule and scholarship overview download endpoints return an unsupported response without a declared content type to the controlled collector. The collector failed closed; exact majors, department tuition and scholarship details are not inferred from those attachments.",
    "The official page publishes a study-length range of one semester to two years rather than a single route duration, so no numeric duration field is asserted.",
    "The page lists accepted scholarship families but not route-specific 2027 deadlines or exact award amounts, so no scholarship entity is emitted.",
  ],
  notes: [
    "The candidate models the general visiting-student route once; General and Senior Visiting Student are eligibility classifications rather than separate program offerings according to the official page.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-45");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 45, candidateSha256, counts: { schools: 1, programs: 1, programIntakes: 1, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
