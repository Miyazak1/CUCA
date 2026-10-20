import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string; schoolSlug?: string };
type Route = { level: "Basic" | "Advanced" | "Intensive"; track: "IFP" | "1+4"; weeks: 36 | 18 | 11; intakeTerm: "Fall" | "Spring"; start: string; application: string; tuition: number; chinese: string };

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-08.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-08.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-08.review.json");
const schoolSlug = "xi-an-jiaotong-university";
const expectedSha256 = "61924d9ec9d56bb485c58845c515ad72bd710972475c489e58c26750bc424970";

let source: ManifestSource | undefined;
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const row of manifest.sources ?? []) {
      if (row.id !== "xjtu-foundation-programs-2027" || row.sha256 !== expectedSha256 || row.status !== 200 || row.schoolSlug !== schoolSlug) continue;
      const bytes = await readFile(resolve(runRoot, row.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error("XJTU 2027 foundation evidence hash mismatch.");
      source = row;
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (!source) throw new Error("Missing locked XJTU 2027 foundation evidence with the normalized school slug.");

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === schoolSlug);
const baseCity = (base.cities ?? []).find((row) => row.slug === "xian");
if (!baseSchool || !baseCity) throw new Error("XJTU or Xi'an dependency is missing from the reviewed 100-school release.");
const sourceFields = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const currentSchool = {
  ...baseSchool,
  applicationLevel: "Non-degree foundation study, with a conditional 1+4 foundation-to-bachelor progression track",
  languageOfInstruction: "Chinese",
  languageRequirement: "Basic routes require no prior Chinese proficiency; Advanced routes require HSK 2-3 or equivalent; Intensive routes require HSK 4 or above or equivalent.",
  hskRequirement: "No prior Chinese for Basic; HSK 2-3 or equivalent for Advanced; HSK 4 or above or equivalent for Intensive.",
  deadlineSummary: "Spring 2027 Advanced applications close January 15, 2027; Spring 2027 Intensive applications close March 12, 2027; Fall 2027 Basic applications close July 15, 2027.",
  tuitionSummary: "CNY 8,800 for 11 weeks; CNY 13,800 for 18 weeks; CNY 25,800 for 36 weeks.",
  applicationFee: "CNY 500",
  admissionsUrl: source.finalUrl ?? source.url,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    applicationLevel: "Program Introduction and 1+4 progression section",
    languageOfInstruction: "official guide title and Program Features",
    languageRequirement: "Chinese language proficiency table",
    hskRequirement: "Chinese language proficiency table",
    deadlineSummary: "Start Time & Application Deadline table",
    tuitionSummary: "Tuition Fee table",
    applicationFee: "Application Procedure",
    admissionsUrl: "registered official 2027 foundation-program source",
  },
};
const routes: Route[] = [
  { level: "Basic", track: "IFP", weeks: 36, intakeTerm: "Fall", start: "September 2027", application: "November 1, 2026-July 15, 2027", tuition: 25800, chinese: "No prior Chinese proficiency required" },
  { level: "Basic", track: "1+4", weeks: 36, intakeTerm: "Fall", start: "September 2027", application: "November 1, 2026-July 15, 2027", tuition: 25800, chinese: "No prior Chinese proficiency required" },
  { level: "Advanced", track: "IFP", weeks: 18, intakeTerm: "Spring", start: "February 2027", application: "October 1, 2026-January 15, 2027", tuition: 13800, chinese: "HSK 2-3 or equivalent" },
  { level: "Advanced", track: "1+4", weeks: 18, intakeTerm: "Spring", start: "February 2027", application: "October 1, 2026-January 15, 2027", tuition: 13800, chinese: "HSK 2-3 or equivalent" },
  { level: "Intensive", track: "IFP", weeks: 11, intakeTerm: "Spring", start: "April 2027", application: "October 1, 2026-March 12, 2027", tuition: 8800, chinese: "HSK 4 or above or equivalent" },
  { level: "Intensive", track: "1+4", weeks: 11, intakeTerm: "Spring", start: "April 2027", application: "October 1, 2026-March 12, 2027", tuition: 8800, chinese: "HSK 4 or above or equivalent" },
];
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = routes.map((route) => ({
  slug: `${schoolSlug}-2027-${slugify(route.level)}-${route.track === "IFP" ? "ifp" : "one-plus-four"}-foundation`,
  schoolSlug,
  citySlug: "xian",
  nameEn: `${route.level} ${route.track === "IFP" ? "International Foundation Program" : "1+4 Foundation-Bachelor Program"} (${route.weeks} weeks)`,
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese-taught foundation and university preparation",
  subjectArea: "Humanities (Business and Social Science) or Science and Engineering; foundational Chinese, academic Chinese, core subjects and cross-cultural communication",
  teachingLanguage: "Chinese",
  hskRequirement: route.chinese,
  tuitionAmount: route.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: "program",
  tuitionText: `CNY ${route.tuition.toLocaleString("en-US")} for the ${route.weeks}-week program; the standard application fee is CNY 500.`,
  applicationUrl: "https://isso.xjtu.edu.cn/recruit/login",
  applicationNote: route.track === "1+4"
    ? "Applicants must be under 24, hold or expect a high-school qualification and normally average at least 70%. Direct undergraduate admission after the foundation stage additionally requires successful completion, Chinese proficiency equivalent to HSK 4 and a qualifying CSCA report."
    : "Applicants must be under 24, hold or expect a high-school qualification and normally average at least 60%. This IFP route prepares students for later university applications and does not itself guarantee degree admission.",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: { nameEn: "Program Introduction and Length of Program table", degreeLevel: "International Foundation Program section", fieldCategory: "Program Features", subjectArea: "Program Features", teachingLanguage: "official guide title and Program Features", hskRequirement: "Chinese language proficiency table", tuitionAmount: "Tuition Fee table", tuitionCurrency: "Tuition Fee table", tuitionPeriod: "Length of Program and Tuition Fee tables", tuitionText: "Tuition Fee and Application Procedure", applicationUrl: "Application Procedure", applicationNote: "Eligibility, Grades table and 1+4 progression note" },
}));
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program, index) => ({
  programSlug: program.slug,
  intakeTerm: routes[index].intakeTerm,
  intakeYear: 2027,
  deadlineLabel: `${routes[index].application}; program starts ${routes[index].start}. The official page publishes dates without times.`,
  applicationRound: `XJTU 2027 ${routes[index].level} ${routes[index].track} foundation route`,
  status: "open",
  ...sourceFields,
  sourceFieldLineage: { intakeTerm: "Start Time table", intakeYear: "official guide title and Start Time table", deadlineLabel: "Start Time & Application Deadline table", applicationRound: "Program Introduction and Start Time table", status: "application period compared with capturedAt" },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [baseCity],
  schools: [currentSchool],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 08 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug, refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  notes: [
    "The official table presents IFP and 1+4 as two eligibility tracks across the same three durations, so six independently selectable catalog routes are retained.",
    "The official source publishes day-level application windows without times; the draft preserves them in deadline labels and does not invent timestamps.",
    "The 1+4 progression condition is recorded as conditional eligibility, not a guaranteed admission claim.",
    "No 2026 XJTU degree route is relabeled as 2027; current degree admissions remain unresolved.",
    "No applicant, account, passport, payment, or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { programs: programs.length, programIntakes: programIntakes.length, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
