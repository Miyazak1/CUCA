import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
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

type UndergraduateRoute = {
  slug: string;
  school: string;
  name: string;
  medium: "Chinese" | "English";
  cscaSubjects: string[];
  cscTypeA: boolean;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const sourceId = "nwpu-undergraduate-admissions-2027";
const expectedSha256 = "7a4b1331a42a5683f5e65c847089f7b628190fb2a313ad155a0a795bb0b16222";
const schoolSlug = "northwestern-polytechnical-university";
const applicationUrl = "https://admission.nwpu.edu.cn/en/index";

let source: ManifestSource | undefined;
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    const candidate = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
    if (!candidate) continue;
    const artifact = await readFile(resolve(runRoot, candidate.artifactPath));
    if (createHash("sha256").update(artifact).digest("hex") !== candidate.sha256) throw new Error(`Evidence hash mismatch: ${sourceId}`);
    source = candidate;
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error(`Missing locked official evidence ${sourceId} at ${expectedSha256}.`);

const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const baseSchool = base.schools?.find((row) => row.slug === schoolSlug);
const baseCity = base.cities?.find((row) => row.slug === "xian");
if (!baseSchool || !baseCity) throw new Error("NWPU or Xi'an dependency is missing from the reviewed release.");
const basePrograms = new Map((base.programs ?? []).filter((row) => row.schoolSlug === schoolSlug).map((row) => [row.slug, row]));

const scienceEnglish = ["Mathematics", "Physics"];
const materialsEnglish = ["Mathematics", "Chemistry"];
const businessEnglish = ["Mathematics"];
const scienceChinese = ["Science Chinese", "Mathematics", "Physics"];
const businessChinese = ["Liberal Arts Chinese", "Mathematics"];
const routes: UndergraduateRoute[] = [
  { slug: `${schoolSlug}-aerospace-engineering-english`, school: "School of Aeronautics", name: "Aerospace Engineering", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-undergraduate-aerospace-engineering-astronautics-english`, school: "School of Astronautics", name: "Aerospace Engineering", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-materials-science-and-engineering-english`, school: "School of Materials Science and Engineering", name: "Materials Science and Engineering", medium: "English", cscaSubjects: materialsEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-mechanical-engineering-english`, school: "School of Mechanical Engineering", name: "Mechanical Design & Manufacturing and its Automation", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: true },
  { slug: `${schoolSlug}-undergraduate-engineering-mechanics-mechanics-and-transportation-engineering-english`, school: "School of Mechanics and Transportation Engineering", name: "Engineering Mechanics", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-undergraduate-electronics-and-information-engineering-school-of-electronics-and-information-english`, school: "School of Electronics and Information", name: "Electronics and Information Engineering", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: true },
  { slug: `${schoolSlug}-undergraduate-electrical-engineering-and-automation-automation-english`, school: "School of Automation", name: "Electrical Engineering and Automation", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-computer-science-and-technology-english`, school: "School of Computer Science", name: "Computer Science and Technology", medium: "English", cscaSubjects: scienceEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-business-administration-english`, school: "School of Management", name: "Business Administration", medium: "English", cscaSubjects: businessEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-undergraduate-international-economics-and-trade-public-policy-and-administration-chinese`, school: "School of Public Policy and Administration", name: "International Economics and Trade", medium: "Chinese", cscaSubjects: businessChinese, cscTypeA: true },
  { slug: `${schoolSlug}-software-engineering`, school: "School of Software", name: "Software Engineering", medium: "Chinese", cscaSubjects: scienceChinese, cscTypeA: true },
  { slug: `${schoolSlug}-undergraduate-biotechnology-life-sciences-english`, school: "School of Life Sciences", name: "Biotechnology", medium: "English", cscaSubjects: materialsEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-undergraduate-english-foreign-studies-english`, school: "School of Foreign Studies", name: "English", medium: "English", cscaSubjects: businessEnglish, cscTypeA: false },
  { slug: `${schoolSlug}-undergraduate-g-erman-foreign-studies-chinese`, school: "School of Foreign Studies", name: "German", medium: "Chinese", cscaSubjects: businessChinese, cscTypeA: true },
];

const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};
const programs: CatalogSeedProgram[] = routes.map((route) => {
  const existing = basePrograms.get(route.slug);
  if (!existing) throw new Error(`Missing reviewed NWPU dependency program ${route.slug}.`);
  const tuitionAmount = route.medium === "English" ? 25000 : 22000;
  const languageRequirement = route.medium === "Chinese"
    ? { hskRequirement: "HSK Level 5 score 180 or above", englishRequirement: undefined }
    : { hskRequirement: undefined, englishRequirement: "IELTS Academic 6.0 overall with no component below 5.5; TOEFL iBT 80; Duolingo 115; Cambridge A-Level English grade A; or FCE 169 / CAE 180 / CPE" };
  return {
    ...existing,
    nameEn: route.name,
    degreeLevel: "Undergraduate",
    durationYears: 4,
    durationMonths: undefined,
    fieldCategory: route.school,
    subjectArea: route.name,
    teachingLanguage: route.medium,
    cscaSubjects: route.cscaSubjects,
    cscaRequirement: `A valid 2027 CSCA score is required: ${route.cscaSubjects.join(", ")}.`,
    ...languageRequirement,
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year; application fee CNY 600, insurance CNY 800-1,800/year and triple-room accommodation CNY 5,400/year are published separately.`,
    scholarshipText: route.cscTypeA ? "The official 2027 appendix marks this major as accepting CSC Type A applications." : undefined,
    applicationUrl,
    applicationNote: "Applicants must be non-Chinese citizens, be under 23 on September 1, 2027, obtain a high-school diploma by that date, normally hold an academic average of at least 75%, submit a valid CSCA result, and meet the route language requirement. The official nationality, document, health, non-criminal-record and financial-proof rules also apply.",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      nameEn: "2027 official undergraduate appendix, Major column",
      degreeLevel: "official guide title and Duration and Degree",
      durationYears: "Duration and Degree",
      fieldCategory: "2027 official undergraduate appendix, School column",
      subjectArea: "2027 official undergraduate appendix, Major column",
      teachingLanguage: "2027 official undergraduate appendix, Medium column",
      cscaSubjects: "Eligibility Criteria, CSCA subject table",
      cscaRequirement: "Eligibility Criteria, CSCA requirement and subject table",
      ...(route.medium === "Chinese" ? { hskRequirement: "Eligibility Criteria, Language proficiency" } : { englishRequirement: "Eligibility Criteria, Language proficiency" }),
      tuitionAmount: "Expense table",
      tuitionCurrency: "Expense table",
      tuitionPeriod: "Expense table",
      tuitionText: "Expense table",
      ...(route.cscTypeA ? { scholarshipText: "2027 official undergraduate appendix star marker" } : {}),
      applicationUrl: "Application Procedures",
      applicationNote: "Eligibility Criteria and Application Materials",
    },
  };
});

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-10-31T16:00:00.000Z",
  deadlineDate: "2027-05-20T15:59:59.000Z",
  deadlineLabel: "Four application batches: Nov 1-Dec 31, 2026; Jan 1-Feb 28, Mar 1-Apr 15 and Apr 16-May 20, 2027. September 2027 intake only; a major may close early when its quota is filled.",
  applicationRound: "NPU 2027 international undergraduate admission",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "Application Timeline: September autumn intake only",
    intakeYear: "official guide title and registration section",
    openDate: "Application Timeline, first-batch opening",
    deadlineDate: "Application Timeline, fourth-batch close",
    deadlineLabel: "Application Timeline",
    applicationRound: "official guide title",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [baseCity],
  schools: [{
    ...baseSchool,
    applicationLevel: "Undergraduate, Master, Doctoral and Foundation",
    languageRequirement: "2027 undergraduate Chinese-medium routes require HSK 5 score 180; English-medium routes require one of the published English thresholds.",
    hskRequirement: "2027 undergraduate Chinese-medium routes require HSK Level 5 score 180 or above.",
    englishRequirement: "2027 undergraduate English-medium routes require IELTS 6.0 (no component below 5.5), TOEFL 80, Duolingo 115, Cambridge A-Level English A, FCE 169, CAE 180 or CPE.",
    deadlineSummary: "2027 undergraduate applications run in four batches from November 1, 2026 through May 20, 2027; quotas may close early.",
    tuitionSummary: "2027 undergraduate tuition is CNY 25,000/year for English-medium routes and CNY 22,000/year for Chinese-medium routes.",
    applicationFee: "CNY 600 / about USD 90",
    cscaRequired: true,
    cscaRequirement: "A valid CSCA score is mandatory; exact subjects depend on medium and subject group and are recorded per program.",
    admissionsUrl: sourceFields.sourceUrl,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      applicationLevel: "official 2027 undergraduate, graduate and foundation guides",
      languageRequirement: "Eligibility Criteria, Language proficiency",
      hskRequirement: "Eligibility Criteria, Language proficiency",
      englishRequirement: "Eligibility Criteria, Language proficiency",
      deadlineSummary: "Application Timeline",
      tuitionSummary: "Expense table",
      applicationFee: "Expense table",
      cscaRequired: "Eligibility Criteria",
      cscaRequirement: "Eligibility Criteria, CSCA subject table",
      admissionsUrl: "official 2027 undergraduate guide URL",
    },
  }],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 98 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug, refreshedUndergraduatePrograms: programs.length, new2027Intakes: programIntakes.length, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: sourceFields.sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  notes: [
    "This wave adds the newly published NPU 2027 international undergraduate guide to the existing 2027 graduate and foundation evidence set.",
    "The official 2027 appendix lists 14 undergraduate routes. Three older 2026 routes not present in the 2027 appendix are not archived automatically and require a separate reconciliation decision.",
    "Application status is intentionally omitted because the official first batch opens on November 1, 2026, after the evidence capture time.",
    "No unsupported undergraduate scholarship amount is added; only the appendix's CSC Type A eligibility marker is recorded on the five marked majors.",
  ],
  unresolved: [
    "The guide does not publish a single exact registration date beyond late August to early September 2027.",
    "The guide does not publish scholarship coverage for CSC Type A in this source.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-98");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 98, candidateSha256, counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 }, publicationAuthorized: false }, null, 2));
