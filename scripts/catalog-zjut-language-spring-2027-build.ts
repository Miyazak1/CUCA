import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const languageRun = "work/catalog-official/refresh-20261014-zjut-language-programs";
const scholarshipRun = "work/catalog-official/2026-10-15T07-11-22-013Z";
const candidatePath = resolve(root, "seeds/catalog.zjut-language-spring-2027.draft.json");
const validationPath = resolve(root, "seeds/catalog.zjut-language-spring-2027.validation.json");
const programSlug = "zhejiang-university-of-technology-iclts-one-semester-chinese-language-spring-2027";

type Source = {
  id: string;
  label: string;
  url: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};
type Manifest = { generatedAt: string; sources: Source[] };
type Dependency = CatalogSeedBundle & { cities: NonNullable<CatalogSeedBundle["cities"]>; schools: NonNullable<CatalogSeedBundle["schools"]> };

const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
const languageManifest = await json<Manifest>(`${languageRun}/manifest.json`);
const scholarshipManifest = await json<Manifest>(`${scholarshipRun}/manifest.json`);
const cityDependency = await json<Dependency>("seeds/catalog.hangzhou-city-rich-batch-01.draft.json");
const schoolDependency = await json<Dependency>("seeds/catalog.zjut-school-program-cleanup-batch-01.draft.json");

function lockedSource(manifest: Manifest, id: string, expectedSha256: string): Source {
  const source = manifest.sources.find((row) => row.id === id);
  if (!source || source.status !== 200 || source.contentType !== "text/html" || source.sha256 !== expectedSha256) {
    throw new Error(`ZJUT evidence mismatch: ${id}`);
  }
  return source;
}

const languageSource = lockedSource(
  languageManifest,
  "zjut-language-programs-current",
  "3d1f04efd111f90cfb311a5231f1c858c4146c3fd04aa397ca2f382006419008",
);
const scholarshipSource = lockedSource(
  scholarshipManifest,
  "zjut-international-chinese-language-teachers-scholarship-2027-spring",
  "f791ea59d259c7b31634789605755e24dcbd94b87a426c5f2f23dd1e60bdd454",
);

function visibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function assertEvidence(run: string, source: Source, fragments: string[]): Promise<void> {
  const artifactPath = resolve(root, run, source.artifactPath);
  const bytes = await readFile(artifactPath);
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Artifact hash mismatch: ${source.id}`);
  const text = visibleText(bytes.toString("utf8"));
  for (const fragment of fragments) {
    if (!text.includes(fragment)) throw new Error(`Expected evidence fragment missing from ${source.id}: ${fragment}`);
  }
}

await assertEvidence(languageRun, languageSource, [
  "Chinese Language Program",
  "One semester duration (16 weeks).",
  "Tuition: CNY9000/semester, Registration fee: CNY400.",
  "Insurance: CNY500/semester.",
  "Copy of Passport Photo Page",
  "No Criminal-Record Certificate",
]);
await assertEvidence(scholarshipRun, scholarshipSource, [
  "2027 March Intake",
  "One-Semester Study Program",
  "Commence in March 2027. Scholarship is subsidized for maximum 5 months.",
  "Applicants must complete their applications on ZJUT application system by October 20,2026",
]);

const city = cityDependency.cities.find((row) => row.slug === "hangzhou");
const schoolBase = schoolDependency.schools.find((row) => row.slug === "zhejiang-university-of-technology");
if (!city || !schoolBase) throw new Error("ZJUT city or school dependency missing.");
const school = {
  ...schoolBase,
  applicationLevel: "Bachelor, Master, Doctoral and Non-degree",
  deadlineSummary: "The reviewed one-semester Spring 2027 scholarship route closes October 20, 2026; degree-route deadlines are separate.",
  tuitionSummary: `${schoolBase.tuitionSummary} The self-funded Chinese Language Program page lists CNY 9,000/semester, plus registration and insurance fees; the Spring 2027 scholarship route publishes separate coverage.`,
  sourceFieldLineage: {
    ...schoolBase.sourceFieldLineage,
    applicationLevel: `${scholarshipSource.id}: Scholarship Category, One-Semester Study Program`,
    deadlineSummary: `${scholarshipSource.id}: Application Deadline`,
    tuitionSummary: `${languageSource.id} (${languageSource.sha256}): Fees`,
  },
};

const program: CatalogSeedProgram = {
  slug: programSlug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "International Chinese Language Teachers Scholarship — One-Semester Study Program (Spring 2027)",
  nameZh: "国际中文教师奖学金一学期研修生项目（2027年春季）",
  degreeLevel: "Non-degree",
  durationMonths: 5,
  fieldCategory: "Chinese Language",
  subjectArea: "International Chinese Education, Chinese Language and Literature, or Taiji Culture",
  teachingLanguage: "Chinese",
  hskRequirement: "International Chinese Education or Chinese Language and Literature: HSK Level 3 score 180 plus HSKK. Taiji Culture: HSK score required; HSKK is preferred.",
  tuitionText: "Scholarship route: tuition covered. The separate self-funded Chinese Language Program page lists CNY 9,000/semester.",
  scholarshipText: "Covers tuition, accommodation, living allowance and comprehensive medical insurance under the official Spring 2027 scholarship notice.",
  applicationUrl: "https://zjut.at0086.cn/StuApplication/Login.aspx",
  applicationNote: "Apply first in the ZJUT system, then use the ZJUT recommendation letter to complete the CIS scholarship application.",
  hasScholarship: true,
  badgeText: "Spring 2027 scholarship route",
  displaySubjects: ["Chinese Language", "International Chinese Education", "Taiji Culture"],
  displayGroup: "zjut-non-degree-chinese-language",
  displayGroupLabel: "ZJUT Non-degree Chinese-language routes",
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: scholarshipSource.url,
  sourceLabel: scholarshipSource.label,
  sourceSha256: scholarshipSource.sha256,
  capturedAt: scholarshipSource.fetchedAt,
  sourceFieldLineage: {
    nameEn: `${scholarshipSource.id}: 2027 March Intake; Scholarship Category; One-Semester Study Program`,
    nameZh: "derived Chinese rendering of the official English route title; pending editorial review",
    degreeLevel: `${scholarshipSource.id}: One-Semester Study Program; maximum 5 months`,
    durationMonths: `${scholarshipSource.id}: Commence in March 2027; maximum 5 months`,
    subjectArea: `${scholarshipSource.id}: Scholarship Category, two One-Semester Study Program bullets`,
    teachingLanguage: `${languageSource.id} (${languageSource.sha256}): Chinese Language Program; Daily Course`,
    hskRequirement: `${scholarshipSource.id}: Scholarship Category, One-Semester Study Program`,
    tuitionText: `${scholarshipSource.id}: Coverage and Standard; ${languageSource.id} (${languageSource.sha256}): Fees`,
    applicationUrl: `${scholarshipSource.id}: Application Procedure, step 1`,
  },
};

const intake: CatalogSeedProgramIntake = {
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-08-31T16:00:00.000Z",
  deadlineDate: "2026-10-20T15:59:59.000Z",
  deadlineLabel: "October 20, 2026",
  applicationRound: "March 2027 International Chinese Language Teachers Scholarship — one-semester study",
  status: "open",
  sourceUrl: scholarshipSource.url,
  sourceLabel: scholarshipSource.label,
  sourceSha256: scholarshipSource.sha256,
  capturedAt: scholarshipSource.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "2027 March Intake; commencement in March 2027",
    intakeYear: "2027 March Intake",
    openDate: "Application Procedure, step 1",
    deadlineDate: "Application Deadline",
    status: "derived: deadline is after the 2026-10-14 capture date",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: scholarshipManifest.generatedAt,
  cities: [city],
  schools: [school],
  programs: [program],
  programIntakes: [intake],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 1 || validation.summary.programIntakes !== 1) {
  throw new Error(`Invalid ZJUT Spring 2027 language candidate: ${validation.errors.join(" ")}`);
}
const validationArtifact = {
  ...validation,
  candidateSha256: createHash("sha256").update(candidateText).digest("hex"),
  sourceReview: {
    status: "unreviewed_draft",
    evidenceModel: "program identity and self-funded reference from the official program page; Spring 2027 availability, scholarship scope and deadline from the official scholarship notice",
    changeReview: {
      priorSha256: "cf418ebc0919a72dc86285ecfc6098d6b3b970d0ec2957cd71a51b5c2eeaa1a1",
      currentSha256: scholarshipSource.sha256,
      visibleAdmissionsTextChanged: false,
      disposition: "The official page HTML changed, but normalized visible admissions text is unchanged from the prior snapshot.",
    },
    unresolved: ["The Chinese route title is an editorial translation and must be reviewed before publication."],
  },
  databaseWriteAuthorized: false,
  publicationAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256, databaseWriteAuthorized: false, publicationAuthorized: false }, null, 2));
