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

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const releasePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-04.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-04.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-04.review.json");
const expected: Record<string, string> = {
  "fudan-management-international-masters-2027": "3849133acc04eaa54dbfd8121ab6f104137a38e9fb0d021b759c351080891baf",
  "pku-phbs-master-economics-2027": "074091bb412ed14a914ddabe32bdeb58d37914801c89418de3cd9460679fc8a4",
  "westlake-international-phd-admissions-2027": "fe4eb97569f0cfd5ab3f8cf20c447cc492937217b5695751be0c9e5d493cfded",
};

const evidence = new Map<string, ManifestSource & { runRoot: string; body: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, { ...source, runRoot, body: bytes.toString("utf8") });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 04 evidence: ${missing.join(", ")}`);

const fudanSource = evidence.get("fudan-management-international-masters-2027")!;
const pkuSource = evidence.get("pku-phbs-master-economics-2027")!;
const westlakeSource = evidence.get("westlake-international-phd-admissions-2027")!;
for (const required of ["Master of Finance - lnternational Finance", "Master of AI for Business"]) {
  if (!fudanSource.body.includes(required)) throw new Error(`Fudan source no longer contains ${required}.`);
}
for (const required of ["Application for 2027 intake", "March 31, 2027", "64,000 RMB per year", "TOEFL (90 and above)"]) {
  if (!pkuSource.body.includes(required)) throw new Error(`PKU PHBS source no longer contains ${required}.`);
}
for (const required of ["Fall 2027 intake", "There are currently eleven Ph.D. programs", "Biomedical Sciences", "40,000 CNY/year"]) {
  if (!westlakeSource.body.includes(required)) throw new Error(`Westlake source no longer contains ${required}.`);
}

const release = JSON.parse(await readFile(releasePath, "utf8")) as CatalogSeedBundle;
const allPrograms = release.programs ?? [];
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const fudanProgramRows = [
  {
    slug: "fudan-university-master-finance-international-finance",
    nameEn: "Master of Finance - International Finance (MIF)",
    teachingLanguage: "English",
    subjectArea: "International Finance",
  },
  {
    slug: "fudan-university-master-ai-for-business",
    nameEn: "Master of AI for Business (AIB)",
    teachingLanguage: "Chinese",
    subjectArea: "Artificial Intelligence for Business",
  },
] as const;
const fudanPrograms: CatalogSeedProgram[] = fudanProgramRows.map((row) => ({
  slug: row.slug,
  schoolSlug: "fudan-university",
  citySlug: "shanghai",
  nameEn: row.nameEn,
  degreeLevel: "Master",
  fieldCategory: "Management",
  subjectArea: row.subjectArea,
  teachingLanguage: row.teachingLanguage,
  applicationNote: "The official 2027 Fudan School of Management notice lists this route as open to international applicants. Detailed procedures are published in an image and are not transcribed into structured fields in this draft.",
  status: "active",
  ...sourceFields(fudanSource),
  sourceFieldLineage: {
    nameEn: "official 2027 notice, numbered program list",
    degreeLevel: "official notice title: Master Program",
    teachingLanguage: "official 2027 notice, numbered program list",
    applicationNote: "official 2027 notice and procedure-image disclosure",
  },
  verificationStatus: "verified",
  lastVerifiedAt: fudanSource.fetchedAt,
}));
const fudanIntakes: CatalogSeedProgramIntake[] = fudanPrograms.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineLabel: "Application activity runs from September 2026 to April 2027; exact round dates are shown in the official procedure image.",
  applicationRound: "Fudan School of Management 2027 international master's intake",
  status: "open",
  ...sourceFields(fudanSource),
  sourceFieldLineage: {
    intakeYear: "official notice title and opening paragraph",
    deadlineLabel: "official notice opening paragraph; no exact deadline inferred from the linked image",
    status: "official notice states the 2027 intake is open to international applicants",
  },
}));

const pkuSlug = "peking-university-graduate-en-master-graduate-school-of-shenzhen-020104";
const pkuExisting = allPrograms.find((program) => program.slug === pkuSlug);
if (!pkuExisting) throw new Error(`Missing existing PKU PHBS Economics program: ${pkuSlug}`);
const pkuProgram: CatalogSeedProgram = {
  ...pkuExisting,
  citySlug: "shenzhen",
  nameEn: "Master's in Economics",
  englishRequirement: "TOEFL 90 or above, IELTS 6.5 or above, or native English speaker exemption.",
  tuitionAmount: 64000,
  tuitionCurrency: "RMB",
  tuitionPeriod: "year",
  tuitionText: "RMB 64,000 per year for the 2027 intake",
  applicationNote: "The curriculum is quantitatively focused; the official program page recommends prior Economics and Mathematics coursework.",
  ...sourceFields(pkuSource),
  sourceFieldLineage: {
    nameEn: "official PHBS program page title",
    citySlug: "official PHBS contact address, Shenzhen",
    teachingLanguage: "English-language program page and English proficiency requirement",
    englishRequirement: "Admissions section",
    tuitionAmount: "Fee & Finances section, 2027 intake",
    applicationNote: "Program Curriculum section",
  },
  verificationStatus: "verified",
  lastVerifiedAt: pkuSource.fetchedAt,
};
const pkuIntake: CatalogSeedProgramIntake = {
  programSlug: pkuProgram.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  deadlineDate: "2027-03-31T15:59:59.000Z",
  deadlineLabel: "Opens mid-October 2026; application deadline March 31, 2027",
  applicationRound: "Peking University HSBC Business School 2027 Master's in Economics",
  status: "open",
  ...sourceFields(pkuSource),
  sourceFieldLineage: {
    intakeYear: "Admissions section",
    deadlineDate: "Admissions section; end-of-day Beijing time normalized to UTC",
    status: "officially published 2027 application route",
  },
};

const westlakeRows = [
  { slug: "westlake-university-doctorate-mathematics", nameEn: "Mathematics", category: "Science", deadline: undefined, joint: true },
  { slug: "westlake-university-doctorate-physics", nameEn: "Physics", category: "Science", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-chemistry", nameEn: "Chemistry", category: "Science", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-quantitative-biology-and-complex-systems", nameEn: "Quantitative Biology and Complex Systems", category: "Science", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-multiscale-astrophysics", nameEn: "Multiscale Astrophysics", category: "Science", deadline: undefined },
  { slug: "westlake-university-doctorate-electronic-and-information-engineering", nameEn: "Electronic Science and Technology", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-materials-science-and-engineering", nameEn: "Materials Science and Engineering", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-information-technology-in-artificial-intelligence", nameEn: "Information Technology in Artificial Intelligence", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-sustainability-science-and-technology", nameEn: "Sustainability Science and Technology", category: "Engineering", deadline: "2026-11-09T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-biology", nameEn: "Biology", category: "Life Sciences", deadline: "2026-10-31T02:00:00.000Z" },
  { slug: "westlake-university-doctorate-biomedical-sciences", nameEn: "Biomedical Sciences", category: "Medicine", deadline: "2026-10-31T02:00:00.000Z" },
] as const;
const westlakePrograms: CatalogSeedProgram[] = westlakeRows.map((row) => {
  const existing = allPrograms.find((program) => program.slug === row.slug);
  return {
    ...(existing ?? {}),
    slug: row.slug,
    schoolSlug: "westlake-university",
    citySlug: "hangzhou",
    nameEn: row.nameEn,
    degreeLevel: "Doctorate",
    fieldCategory: row.category,
    subjectArea: row.nameEn,
    teachingLanguage: "English",
    englishRequirement: "Evidence of English proficiency through English as a first language, official TOEFL/IELTS scores, or an English-medium prior-degree letter.",
    tuitionAmount: row.joint ? 37000 : 40000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: row.joint ? "CNY 37,000/year for the joint university program" : "CNY 40,000/year for Westlake University programs",
    scholarshipText: "The official page states full or partial tuition waivers and fellowships/scholarships exceeding RMB 85,000 per year before tax.",
    hasScholarship: true,
    applicationNote: "Fall 2027 international PhD route. Application requirements include a personal statement of more than 1,500 words and the listed academic documents.",
    status: "active",
    ...sourceFields(westlakeSource),
    sourceFieldLineage: {
      nameEn: "current international-applicant overview and Fall 2027 application table",
      degreeLevel: "current international-applicant overview",
      teachingLanguage: "application documents require an English personal statement and English proficiency evidence",
      englishRequirement: "Application Documents section",
      tuitionAmount: "Tuition & Financial Aid table",
      scholarshipText: "Tuition & Financial Aid table",
      applicationNote: "Application Timeline and Application Documents sections",
    },
    verificationStatus: "verified",
    lastVerifiedAt: westlakeSource.fetchedAt,
  };
});
if (westlakePrograms.length !== 11 || new Set(westlakePrograms.map((program) => program.slug)).size !== 11) {
  throw new Error(`Expected 11 unique Westlake Fall 2027 doctoral routes, found ${westlakePrograms.length}.`);
}
const westlakeIntakes: CatalogSeedProgramIntake[] = westlakeRows.map((row) => ({
  programSlug: row.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: row.deadline ? "2026-10-10T02:00:00.000Z" : undefined,
  deadlineDate: row.deadline,
  deadlineLabel: row.deadline
    ? `First-round application closes ${row.deadline.includes("10-31") ? "October 31" : "November 9"}, 2026 at 10:00 Beijing time; second round to be announced.`
    : "Not open in the first round; second-round dates to be announced.",
  applicationRound: "Westlake University Fall 2027 international PhD admission",
  status: row.deadline ? "open" : "closed",
  ...sourceFields(westlakeSource),
  sourceFieldLineage: {
    intakeYear: "Application Timeline heading",
    ...(row.deadline ? { openDate: "Fall 2027 first-round application table; Beijing time normalized to UTC" } : {}),
    ...(row.deadline ? { deadlineDate: "Fall 2027 first-round application table; Beijing time normalized to UTC" } : {}),
    status: row.deadline ? "first round is published and open" : "first round not open; second round to be announced",
  },
}));

const programs = [...fudanPrograms, pkuProgram, ...westlakePrograms].sort((left, right) => left.slug.localeCompare(right.slug));
const programIntakes = [...fudanIntakes, pkuIntake, ...westlakeIntakes].sort((left, right) => left.programSlug.localeCompare(right.programSlug));
const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const schoolSlugs = new Set(programs.map((program) => program.schoolSlug));
const selectedSchools = (release.schools ?? []).filter((row) => schoolSlugs.has(row.slug));
const citySlugs = new Set([
  ...programs.map((program) => program.citySlug).filter((slug): slug is string => Boolean(slug)),
  ...selectedSchools.map((school) => school.citySlug),
]);
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (release.cities ?? []).filter((row) => citySlugs.has(row.slug)),
  schools: selectedSchools,
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 04 validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: { schools: 10, completedThroughWave: 10 },
  scope: {
    schoolSlugs: [...schoolSlugs].sort(),
    refreshedPrograms: programs.length,
    new2027Intakes: programIntakes.length,
    fudanManagementPrograms: fudanPrograms.length,
    pkuPhbsPrograms: 1,
    westlakeDoctoralPrograms: westlakePrograms.length,
  },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "Fudan is limited to the two management master's routes explicitly named for international applicants; image-only procedure details are not converted into exact structured deadlines.",
    "PKU is limited to the PHBS Master's in Economics page; no other PKU route is rolled forward from the 2026 catalog.",
    "Westlake includes the eleven doctoral routes in the current Fall 2027 international applicant table. Mathematics and Multiscale Astrophysics remain draft because their second-round dates are still to be announced.",
    "No applicant or account data is present.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  schools: [...schoolSlugs].sort(),
  refreshedPrograms: programs.length,
  new2027Intakes: programIntakes.length,
  candidatePath,
  validationPath,
  reviewPath,
  candidateSha256,
}, null, 2));
