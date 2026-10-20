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

type Major = {
  degreeLevel: "Master" | "Doctoral";
  school: string;
  nameEn: string;
  nameZh?: string;
  language: "Chinese" | "English";
  special?: string;
  cscSupported: boolean;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-07.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-07.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-07.review.json");
const schoolSlug = "northwestern-polytechnical-university";
const applicationUrl = "https://admission.nwpu.edu.cn/en/index";

const expected: Record<string, string> = {
  "nwpu-master-admissions-2027": "c1054e95a287494e7886f0b27c9c84e5b93e6bf8c378fbf1097a474f0185b946",
  "nwpu-master-program-catalog-2027": "34b2e729ac6c50e720c31ea9b76efc8d5d252a3211e81d1a43839e8c028392ef",
  "nwpu-doctoral-admissions-2027": "6f067453a7c0ac05368fbc0a89ec58495205a1632e62066f6da3bec6fb583e6d",
  "nwpu-doctoral-program-catalog-2027": "f651d90a412d954568c6b1c0be09c342bb4f9840f640aefb10fdd1557127c654",
  "nwpu-foundation-program-2027": "b5022ad585d9a1c6e4ace9c86b5b50ae4f458ca8c8925e69e90e44f35a4447c9",
  "nwpu-youth-of-excellence-scholarship-2027": "23221b5abb986d1ceedeb7723b771c8c776bef74a214607f842c16d2c8b9f199",
};

const evidence = new Map<string, ManifestSource>();
const rawHtml = new Map<string, string>();
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
      rawHtml.set(source.id, bytes.toString("utf8"));
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 07 evidence: ${missing.join(", ")}`);

const decode = (value: string) => value
  .replace(/<br\s*\/?\s*>/gi, " / ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, "&")
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();
const tableRows = (html: string) => [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].flatMap((table) =>
  [...table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi)].map((cell) => decode(cell[0])),
  ),
);
const bilingual = (value: string) => {
  const clean = value.replace(/[✭★]/g, "").replace(/\s+/g, " ").trim();
  const firstLatin = clean.search(/[A-Za-z]/);
  const nameZh = firstLatin > 0 ? clean.slice(0, firstLatin).replace(/[\s/]+$/g, "").trim() : undefined;
  const nameEn = (firstLatin >= 0 ? clean.slice(firstLatin) : clean).replace(/^[/\s]+|[/\s]+$/g, "").trim();
  return { nameEn, ...(nameZh ? { nameZh } : {}) };
};
const languages = (value: string): Array<Major["language"]> => {
  const hasEnglish = /English|英文/i.test(value);
  const hasChinese = /Chinese|中文/i.test(value);
  return [...(hasEnglish ? ["English" as const] : []), ...(hasChinese ? ["Chinese" as const] : [])];
};
const parseMajors = (sourceId: string, degreeLevel: Major["degreeLevel"]) => {
  const rows = tableRows(rawHtml.get(sourceId)!);
  const output: Major[] = [];
  let currentSchool = "";
  let currentSpecial: string | undefined;
  for (const cells of rows.slice(6)) {
    if (cells.length < 2) continue;
    let majorText: string;
    let mediumText: string;
    if (/School|Institute/.test(cells[0]) && cells.length >= 3) {
      currentSchool = bilingual(cells[0]).nameEn;
      majorText = cells[1];
      mediumText = cells[2];
      currentSpecial = cells[3] && cells[3] !== "/" ? bilingual(cells[3]).nameEn : undefined;
    } else {
      majorText = cells[0];
      mediumText = cells[1];
    }
    const name = bilingual(majorText);
    for (const language of languages(mediumText)) {
      output.push({
        degreeLevel,
        school: currentSchool,
        ...name,
        language,
        ...(currentSpecial ? { special: currentSpecial } : {}),
        cscSupported: /[✭★]/.test(majorText),
      });
    }
  }
  return output;
};

const masterMajors = parseMajors("nwpu-master-program-catalog-2027", "Master");
const doctoralMajors = parseMajors("nwpu-doctoral-program-catalog-2027", "Doctoral");
if (masterMajors.length !== 50 || doctoralMajors.length !== 39) {
  throw new Error(`Unexpected NPU 2027 graduate route counts: ${masterMajors.length} master, ${doctoralMajors.length} doctoral.`);
}

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === schoolSlug);
const baseCity = (base.cities ?? []).find((row) => row.slug === "xian");
if (!baseSchool || !baseCity) throw new Error("NWPU or Xi'an dependency is missing from the reviewed 100-school release.");
const basePrograms = (base.programs ?? []).filter((row) => row.schoolSlug === schoolSlug);
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});
const guideFor = (degreeLevel: Major["degreeLevel"]) => evidence.get(degreeLevel === "Master" ? "nwpu-master-admissions-2027" : "nwpu-doctoral-admissions-2027")!;
const catalogFor = (degreeLevel: Major["degreeLevel"]) => evidence.get(degreeLevel === "Master" ? "nwpu-master-program-catalog-2027" : "nwpu-doctoral-program-catalog-2027")!;
const matchedBaseSlugs = new Set<string>();
const usedSlugs = new Set<string>();

const degreePrograms: CatalogSeedProgram[] = [...masterMajors, ...doctoralMajors].map((major) => {
  const existing = basePrograms.find((row) => row.degreeLevel === major.degreeLevel
    && normalize(row.nameEn) === normalize(major.nameEn)
    && row.teachingLanguage?.includes(major.language)
    && normalize(row.fieldCategory ?? "") === normalize(major.school));
  if (existing) matchedBaseSlugs.add(existing.slug);
  let slug = existing?.slug ?? `${schoolSlug}-${major.degreeLevel.toLowerCase()}-${slugify(major.nameEn)}-${slugify(major.school.replace(/^(School|Institute) of\s+/i, ""))}-${major.language.toLowerCase()}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${usedSlugs.size + 1}`;
  usedSlugs.add(slug);
  const guide = guideFor(major.degreeLevel);
  const catalog = catalogFor(major.degreeLevel);
  const tuitionAmount = major.degreeLevel === "Master"
    ? (major.language === "Chinese" ? 30000 : 33000)
    : (major.language === "Chinese" ? 38000 : 42000);
  return {
    ...(existing ?? {}),
    slug,
    schoolSlug,
    citySlug: "xian",
    nameEn: major.nameEn,
    ...(major.nameZh ? { nameZh: major.nameZh } : {}),
    degreeLevel: major.degreeLevel,
    ...(major.degreeLevel === "Master" ? { durationMonths: 30, durationYears: undefined } : { durationYears: 4, durationMonths: undefined }),
    fieldCategory: major.school,
    subjectArea: major.nameEn,
    teachingLanguage: major.language,
    ...(major.language === "Chinese"
      ? { hskRequirement: "HSK Level 5 score 200 or above", englishRequirement: undefined }
      : { englishRequirement: "IELTS 6.5 overall with no element below 5.5, TOEFL 85, Duolingo 120, or PTE Academic 58", hskRequirement: undefined }),
    tuitionAmount,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${tuitionAmount.toLocaleString("en-US")}/year; application fee CNY 600 and health insurance CNY 800-1,800/year are published separately.`,
    applicationUrl,
    applicationNote: [
      major.degreeLevel === "Master" ? "Applicants must be under 30 by September 1, 2027, hold a bachelor's degree by that date, and normally have an average score of at least 75% (80% for CSC applicants)." : "Applicants must be under 35 by September 1, 2027, hold a master's degree by that date, and normally have an average score of at least 75% (80% for CSC applicants). A supervisor acceptance letter is mandatory.",
      major.special,
    ].filter(Boolean).join(" "),
    scholarshipText: major.cscSupported ? "The official 2027 catalog marks this major as supported by the CSC Chinese University Program." : undefined,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: guide.fetchedAt,
    ...sourceFields(catalog),
    sourceFieldLineage: {
      nameEn: "2027 official major table, Major column",
      ...(major.nameZh ? { nameZh: "2027 official bilingual major table" } : {}),
      degreeLevel: "official 2027 program catalog title",
      fieldCategory: "2027 official major table, School column",
      subjectArea: "2027 official major table, Major column",
      teachingLanguage: "2027 official major table, Medium column",
      ...(major.degreeLevel === "Master" ? { durationMonths: `${guide.id}, Duration of Offered Program` } : { durationYears: `${guide.id}, Duration of Offered Program` }),
      ...(major.language === "Chinese" ? { hskRequirement: `${guide.id}, Language Requirement` } : { englishRequirement: `${guide.id}, Language Requirement` }),
      tuitionAmount: `${guide.id}, Fees table`,
      tuitionCurrency: `${guide.id}, Fees table`,
      tuitionPeriod: `${guide.id}, Fees table`,
      tuitionText: `${guide.id}, Fees table`,
      applicationUrl: `${guide.id}, Application Procedure`,
      applicationNote: `${guide.id}, Admission Requirements; major table Special requirement column`,
      ...(major.cscSupported ? { scholarshipText: "2027 official major table star marker" } : {}),
    },
  };
});

const foundationSource = evidence.get("nwpu-foundation-program-2027")!;
const foundationPrograms: CatalogSeedProgram[] = [
  {
    slug: `${schoolSlug}-english-foundation-one-semester-spring-2027`,
    schoolSlug,
    citySlug: "xian",
    nameEn: "English Foundation Program (One Semester)",
    degreeLevel: "Non-degree",
    durationMonths: 4,
    fieldCategory: "Foundation and university preparation",
    subjectArea: "Mathematics, Physics, Practical English, Chinese language and Chinese culture",
    teachingLanguage: "English",
    englishRequirement: "IELTS 5.5 overall with no element below 5.5, TOEFL 66, or Duolingo 105",
    tuitionAmount: 15000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "semester",
    tuitionText: "CNY 15,000/semester; application CNY 600, insurance CNY 800/year and dormitory CNY 600/month are published separately.",
    applicationUrl,
    applicationNote: "Applicants must be non-Chinese citizens, aged 16-22 by March 1, 2027, hold a high-school diploma and normally have an average score of at least 70%. Completion may support a later NPU undergraduate application but does not guarantee admission or scholarship.",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: foundationSource.fetchedAt,
    ...sourceFields(foundationSource),
    sourceFieldLineage: {
      nameEn: "English Foundation Program (One Semester)", durationMonths: "Study Duration", subjectArea: "Curriculum", teachingLanguage: "official guide title and language requirement", englishRequirement: "Language Requirements", tuitionAmount: "Fees", tuitionCurrency: "Fees", tuitionPeriod: "Fees", tuitionText: "Fees", applicationUrl: "Application Procedures", applicationNote: "Admission Requirements and progression note",
    },
  },
  {
    slug: `${schoolSlug}-english-foundation-one-year-fall-2027`,
    schoolSlug,
    citySlug: "xian",
    nameEn: "English Foundation Program (One Year)",
    degreeLevel: "Non-degree",
    durationYears: 1,
    fieldCategory: "Foundation and university preparation",
    subjectArea: "Mathematics, Physics, English reading, English writing, basic Chinese and Chinese culture",
    teachingLanguage: "English",
    englishRequirement: "IELTS 5.5 overall with no element below 5.5, TOEFL 66, or Duolingo 105",
    tuitionAmount: 25000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 25,000/year; application CNY 600, insurance CNY 800/year and dormitory CNY 600/month are published separately.",
    applicationUrl,
    applicationNote: "Applicants must be non-Chinese citizens, aged 16-22, hold a high-school diploma and normally have an average score of at least 70%. Completion may support a later NPU undergraduate application but does not guarantee admission or scholarship.",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: foundationSource.fetchedAt,
    ...sourceFields(foundationSource),
    sourceFieldLineage: {
      nameEn: "English Foundation Program (One Year)", durationYears: "Study Duration", subjectArea: "Curriculum", teachingLanguage: "official guide title and language requirement", englishRequirement: "Language Requirements", tuitionAmount: "Fees", tuitionCurrency: "Fees", tuitionPeriod: "Fees", tuitionText: "Fees", applicationUrl: "Application Procedures", applicationNote: "Admission Requirements and progression note",
    },
  },
];

const programs = [...degreePrograms, ...foundationPrograms];
if (new Set(programs.map((row) => row.slug)).size !== programs.length) throw new Error("NPU wave 07 program slugs are not unique.");
const graduateDeadlineLabel = "Four batches: Nov 1-Dec 31, 2026; Jan 1-Feb 28, Mar 1-Mar 31 and Apr 1-Apr 30, 2027. Each batch closes at 17:00 GMT+8; CSC Type B closes February 28, 2027 at 17:00 GMT+8.";
const programIntakes: CatalogSeedProgramIntake[] = degreePrograms.map((program) => {
  const guide = guideFor(program.degreeLevel as Major["degreeLevel"]);
  return {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineDate: "2027-04-30T09:00:00.000Z",
    deadlineLabel: graduateDeadlineLabel,
    applicationRound: `NPU 2027 ${program.degreeLevel} admission`,
    status: "open",
    ...sourceFields(guide),
    sourceFieldLineage: { intakeTerm: "Fall Semester Intake Only", intakeYear: "official guide title", deadlineDate: "Application Period, fourth-batch close", deadlineLabel: "Application Period", applicationRound: "official guide title", status: "application period compared with capturedAt" },
  };
});
programIntakes.push(
  {
    programSlug: foundationPrograms[0].slug,
    intakeTerm: "Spring",
    intakeYear: 2027,
    openDate: "2026-09-30T16:00:00.000Z",
    deadlineDate: "2026-12-15T15:59:59.000Z",
    deadlineLabel: "Application October 1-December 15, 2026; study March-June 2027.",
    applicationRound: "NPU 2027 one-semester English Foundation Program",
    status: "open",
    ...sourceFields(foundationSource),
    sourceFieldLineage: { intakeTerm: "Study Duration", intakeYear: "Study Duration", openDate: "Deadline of Application", deadlineDate: "Deadline of Application", deadlineLabel: "Study Duration and Deadline of Application", applicationRound: "official guide title", status: "application period compared with capturedAt" },
  },
  {
    programSlug: foundationPrograms[1].slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineDate: "2027-06-15T15:59:59.000Z",
    deadlineLabel: "Final application deadline June 15, 2027; study early September 2027 to mid-July 2028. The official page does not publish an opening date for this route.",
    applicationRound: "NPU 2027 one-year English Foundation Program",
    status: "open",
    ...sourceFields(foundationSource),
    sourceFieldLineage: { intakeTerm: "Study Duration", intakeYear: "Study Duration", deadlineDate: "Deadline of Application", deadlineLabel: "Study Duration and Deadline of Application", applicationRound: "official guide title", status: "application period compared with capturedAt" },
  },
);

const youthSource = evidence.get("nwpu-youth-of-excellence-scholarship-2027")!;
const scholarship: CatalogSeedScholarship = {
  slug: "official-2027-nwpu-csc-youth-of-excellence-scheme",
  title: "NPU 2027 CSC Youth of Excellence Scheme of China Program",
  schoolSlug,
  providerName: "China Scholarship Council / Northwestern Polytechnical University",
  applicableDegree: "Master",
  applicableProgram: "Business Administration; International Public Administration and Management; Software Engineering",
  fundingLevel: "Full",
  coverage: "Full scholarship; the reviewed official page does not itemize monetary coverage.",
  deadlineDate: "2027-03-25",
  deadlineLabel: "Request NPU pre-admission before March 15, 2027; submit the CSC Type A application before March 25, 2027.",
  requirementText: "Applicants must be non-Chinese citizens under 40 by September 1, 2027, hold a bachelor's degree, have at least three years of work experience, meet the English requirement, belong to one of the four published professional categories, and obtain an NPU pre-admission notice.",
  applicationRound: "CSC Type A, agency code 1563, Youth of Excellence Scheme of China",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: youthSource.fetchedAt,
  ...sourceFields(youthSource),
  sourceFieldLineage: { title: "page title", schoolSlug: "official NPU page authority", providerName: "Program Introduction and Application Procedure", applicableDegree: "Form of the Program", applicableProgram: "Program Introduction", fundingLevel: "Scholarship coverage", coverage: "Scholarship coverage", deadlineDate: "Application Timetable", deadlineLabel: "Application Procedure and Application Timetable", requirementText: "Admission Requirements", applicationRound: "Application Procedure", status: "application period compared with capturedAt" },
};

const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [baseCity],
  schools: [{
    ...baseSchool,
    applicationLevel: "Undergraduate, Master, Doctoral and Foundation",
    languageRequirement: "Program-level Chinese or English requirements are recorded on each route.",
    hskRequirement: "2027 graduate Chinese-medium routes require HSK Level 5 score 200 or above.",
    englishRequirement: "2027 graduate English-medium routes require IELTS 6.5 (no element below 5.5), TOEFL 85, Duolingo 120, or PTE 58.",
    deadlineSummary: "2027 Master/Doctoral final deadline April 30, 2027 at 17:00 GMT+8; CSC Type B February 28; foundation deadlines December 15, 2026 and June 15, 2027.",
    tuitionSummary: "2027 Master CNY 30,000-33,000/year; Doctoral CNY 38,000-42,000/year; English Foundation CNY 15,000/semester or CNY 25,000/year.",
    applicationFee: "CNY 600 / about USD 90",
    admissionsUrl: guideFor("Master").finalUrl ?? guideFor("Master").url,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: generatedAt,
    ...sourceFields(guideFor("Master")),
    sourceFieldLineage: { applicationLevel: "2027 Master, Doctoral and Foundation guides", languageRequirement: "2027 Master and Doctoral guides", hskRequirement: "2027 Master and Doctoral guides", englishRequirement: "2027 Master and Doctoral guides", deadlineSummary: "2027 Master, Doctoral and Foundation guides", tuitionSummary: "2027 Master, Doctoral and Foundation fee tables", applicationFee: "2027 fee tables", admissionsUrl: "official 2027 Master guide URL" },
  }],
  programs,
  programIntakes,
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 07 validation failed:\n${validation.errors.join("\n")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug, refreshedPrograms: programs.length, masterRoutes: masterMajors.length, doctoralRoutes: doctoralMajors.length, foundationRoutes: foundationPrograms.length, new2027Intakes: programIntakes.length, refreshedScholarships: 1, sourceSnapshots: evidence.size, matchedExistingProgramSlugs: matchedBaseSlugs.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "This wave refreshes all published NPU 2027 Master and Doctoral rows, splitting bilingual-medium rows into separate Chinese and English application routes.",
    "The 2027 undergraduate guide has not been published in the registered official sources, so existing undergraduate routes are not relabeled or changed.",
    "The foundation guide creates separate one-semester and one-year routes because their dates, duration and tuition differ.",
    "The Youth of Excellence page says full scholarship but does not itemize monetary coverage, so no unsupported amount is added.",
    "No old route is archived automatically; unmatched 2026 routes remain for a separate reconciliation decision.",
    "No applicant, account, passport, payment, or other personal data is included.",
  ],
};

await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { programs: programs.length, masterRoutes: masterMajors.length, doctoralRoutes: doctoralMajors.length, foundationRoutes: foundationPrograms.length, programIntakes: programIntakes.length, scholarships: 1, sourceSnapshots: evidence.size, matchedExistingProgramSlugs: matchedBaseSlugs.size }, publicationAuthorized: false }, null, 2));
