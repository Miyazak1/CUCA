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
const expected: Record<string, string> = {
  "xjtu-visiting-scholar-program-2027": "5cf29a3d1da4864a4e7fde468b8374a6f206c331bfefd3d375efb909feb000a5",
  "xjtu-student-exchange-program-2027-pdf": "0e11211b2085159331331592280d2a8ea83c7f06397ded83cb473f5b07370d04",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) {
      if (source.status !== 200 || expected[source.id] !== source.sha256) continue;
      const bytes = await readFile(resolve(runRoot, source.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`XJTU Wave 59 evidence hash mismatch: ${source.id}`);
      evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked XJTU Wave 59 evidence: ${missing.join(", ")}`);

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-55.draft.json"), "utf8")) as CatalogSeedBundle;
const release = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = prior.schools?.find((row) => row.slug === "xi-an-jiaotong-university");
const city = release.cities?.find((row) => row.slug === "xian");
if (!school || !city) throw new Error("Wave 59 XJTU dependency rows are missing.");

const visiting = evidence.get("xjtu-visiting-scholar-program-2027")!;
const exchange = evidence.get("xjtu-student-exchange-program-2027-pdf")!;
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});

const commonVisiting = {
  schoolSlug: school.slug,
  citySlug: city.slug,
  degreeLevel: "Non-degree",
  fieldCategory: "Visiting scholar",
  subjectArea: "Course study or research in a selected academic field",
  teachingLanguage: "Chinese or English",
  hskRequirement: "Chinese-taught study: HSK Level 4 score 180 or above, or another language credential accepted by XJTU.",
  englishRequirement: "English-taught study: IELTS 6.0 or TOEFL 80 or above, or another language credential accepted by XJTU.",
  applicationUrl: visiting.finalUrl ?? visiting.url,
  badgeText: "Spring / Fall 2027",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: visiting.fetchedAt,
  ...sourceFields(visiting),
};
const programs: CatalogSeedProgram[] = [
  {
    slug: "xi-an-jiaotong-university-general-visiting-scholar-2027",
    nameEn: "General Visiting Scholar Program 2027",
    nameZh: "2027年普通进修生项目",
    tuitionCurrency: "CNY",
    tuitionPeriod: "variable",
    tuitionText: "General Visiting Scholar: Business, Economics & Humanities RMB 20,000/academic year or RMB 2,000/month; Science & Engineering RMB 22,000/academic year or RMB 2,200/month; Arts & Medicine RMB 40,000/academic year or RMB 4,000/month. Application fee RMB 500 and registration fee RMB 400.",
    applicationNote: "Applicants must hold a senior high school diploma or above, be under 45, and arrange course or research duration with the supervising professor. Applications are due at least four weeks before the intended semester starts.",
    ...commonVisiting,
    sourceFieldLineage: {
      nameEn: "official 2027 visiting-scholar title and General Visiting Scholar category",
      degreeLevel: "official non-degree program description",
      fieldCategory: "official program category",
      teachingLanguage: "official Chinese- and English-taught language requirements",
      hskRequirement: "official language-proficiency section",
      englishRequirement: "official language-proficiency section",
      tuitionText: "official 2027 visiting-scholar fee table",
      applicationUrl: "official 2027 visiting-scholar page",
      applicationNote: "official eligibility, duration and deadline sections",
    },
  },
  {
    slug: "xi-an-jiaotong-university-senior-visiting-scholar-2027",
    nameEn: "Senior Visiting Scholar Program 2027",
    nameZh: "2027年高级进修生项目",
    tuitionCurrency: "CNY",
    tuitionPeriod: "variable",
    tuitionText: "Senior Visiting Scholar: Business, Economics & Humanities RMB 30,000/academic year or RMB 3,000/month; Science & Engineering RMB 34,000/academic year or RMB 3,400/month; Arts & Medicine RMB 50,000/academic year or RMB 5,000/month. Application fee RMB 500 and registration fee RMB 400.",
    applicationNote: "Applicants must hold a master's degree or above or an associate-professor/professor title, be under 50, and arrange course or research duration with the supervising professor. Applications are due at least four weeks before the intended semester starts.",
    ...commonVisiting,
    sourceFieldLineage: {
      nameEn: "official 2027 visiting-scholar title and Senior Visiting Scholar category",
      degreeLevel: "official non-degree program description",
      fieldCategory: "official program category",
      teachingLanguage: "official Chinese- and English-taught language requirements",
      hskRequirement: "official language-proficiency section",
      englishRequirement: "official language-proficiency section",
      tuitionText: "official 2027 visiting-scholar fee table",
      applicationUrl: "official 2027 visiting-scholar page",
      applicationNote: "official eligibility, duration and deadline sections",
    },
  },
  {
    slug: "xi-an-jiaotong-university-student-exchange-program-2027",
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: "Student Exchange Program 2027",
    nameZh: "2027年校际交流项目",
    degreeLevel: "Non-degree",
    fieldCategory: "Inter-university exchange",
    subjectArea: "Courses or study covered by the active exchange agreement",
    teachingLanguage: "Chinese or English",
    hskRequirement: "Chinese-taught study: HSK Level 4 score 180 or above; some projects require HSK Level 5 score 180 or above. The exchange agreement controls if it sets a different rule.",
    englishRequirement: "English-taught study: IELTS 6.0 or TOEFL 80 or above, or another credential accepted by XJTU. The exchange agreement controls if it sets a different rule.",
    tuitionText: "Fees and payment arrangements are governed by the exchange agreement; matters not specified there follow the relevant university rules.",
    applicationUrl: exchange.finalUrl ?? exchange.url,
    applicationNote: "Applicants must be full-time degree students at an overseas university with an active XJTU exchange agreement and must be nominated by the home university. Program duration and quota follow the agreement.",
    badgeText: "Spring / Fall 2027",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: exchange.fetchedAt,
    ...sourceFields(exchange),
    sourceFieldLineage: {
      nameEn: "official 2027 exchange brochure title",
      degreeLevel: "official exchange-program description",
      fieldCategory: "official program category",
      teachingLanguage: "official Chinese- and English-taught language requirements",
      hskRequirement: "official language-proficiency section",
      englishRequirement: "official language-proficiency section",
      tuitionText: "official fees section",
      applicationUrl: "official 2027 exchange brochure",
      applicationNote: "official eligibility, nomination and duration sections",
    },
  },
];

const visitingIntakes = programs.slice(0, 2).flatMap<CatalogSeedProgramIntake>((program) => ([
  {
    programSlug: program.slug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    deadlineLabel: "Submit at least four weeks before the intended Spring 2027 semester start; XJTU states that spring semester typically begins in March.",
    applicationRound: "XJTU 2027 Visiting Scholar - Spring",
    status: "open",
    ...sourceFields(visiting),
    sourceFieldLineage: { intakeTerm: "official typical semester timing", intakeYear: "official 2027 guide title", deadlineLabel: "official relative deadline", applicationRound: "official guide title and semester", status: "deadline compared with capturedAt" },
  },
  {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineLabel: "Submit at least four weeks before the intended Fall 2027 semester start; XJTU states that autumn semester typically begins in September.",
    applicationRound: "XJTU 2027 Visiting Scholar - Fall",
    status: "open",
    ...sourceFields(visiting),
    sourceFieldLineage: { intakeTerm: "official typical semester timing", intakeYear: "official 2027 guide title", deadlineLabel: "official relative deadline", applicationRound: "official guide title and semester", status: "deadline compared with capturedAt" },
  },
]));
const exchangeProgram = programs[2];
const exchangeIntakes: CatalogSeedProgramIntake[] = [
  {
    programSlug: exchangeProgram.slug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    openDate: "2026-09-01T00:00:00.000Z",
    deadlineDate: "2026-12-31T00:00:00.000Z",
    deadlineLabel: "Spring 2027 application period: September 1-December 31, 2026; home-university nomination deadline: November 30, 2026. The brochure gives no time of day, and an exchange agreement may specify a different timeline.",
    applicationRound: "XJTU 2027 Student Exchange - Spring",
    status: "open",
    ...sourceFields(exchange),
    sourceFieldLineage: { intakeTerm: "official March semester timing", intakeYear: "official 2027 brochure title", openDate: "official Spring application period", deadlineDate: "official Spring application period", deadlineLabel: "official application and nomination deadlines", applicationRound: "official brochure title and semester", status: "deadline compared with capturedAt" },
  },
  {
    programSlug: exchangeProgram.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2026-09-01T00:00:00.000Z",
    deadlineDate: "2027-06-30T00:00:00.000Z",
    deadlineLabel: "Fall 2027 application period: September 1, 2026-June 30, 2027; home-university nomination deadline: May 31, 2027. The brochure gives no time of day, and an exchange agreement may specify a different timeline.",
    applicationRound: "XJTU 2027 Student Exchange - Fall",
    status: "open",
    ...sourceFields(exchange),
    sourceFieldLineage: { intakeTerm: "official September semester timing", intakeYear: "official 2027 brochure title", openDate: "official Fall application period", deadlineDate: "official Fall application period", deadlineLabel: "official application and nomination deadlines", applicationRound: "official brochure title and semester", status: "deadline compared with capturedAt" },
  },
];
const programIntakes = [...visitingIntakes, ...exchangeIntakes];

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 59 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
  unresolved: [
    "Visiting-scholar duration is agreed between the applicant and supervising professor; no numeric duration is inferred.",
    "Visiting-scholar deadlines are relative to the intended semester start, so no calendar deadlineDate is emitted.",
    "Exchange duration, quota and fees depend on the active inter-university agreement and remain agreement-specific.",
    "The official 2027 admissions catalogue workbook is not required to establish these three umbrella non-degree routes and is not interpreted in this wave.",
  ],
  notes: [
    "Wave 59 adds the newly published XJTU 2027 General Visiting Scholar, Senior Visiting Scholar and Student Exchange routes with six Spring/Fall intake rows.",
    "The full field-specific visiting-scholar fee matrix is preserved without turning fee categories into unsupported academic programs.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-59");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 59, candidateSha256, counts: { programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
