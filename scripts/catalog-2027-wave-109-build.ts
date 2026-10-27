import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/hust-undergraduate-2027-refresh-2026-10-27");
const sourceId = "hust-undergraduate-admissions-2027";
const expectedSha256 = "a26cac08b3a98eed26185c8422003ac6cc1aaab70dc44e375654554a829074d3";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error(`Missing locked official evidence ${sourceId} at ${expectedSha256}.`);
const artifact = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== expectedSha256) throw new Error(`Evidence hash mismatch: ${sourceId}.`);
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "huazhong-university-of-science-and-technology";
const baseSchool = dependency.schools?.find((row) => row.slug === schoolSlug);
const city = dependency.cities?.find((row) => row.slug === "wuhan");
if (!baseSchool || !city) throw new Error("HUST or Wuhan dependency is missing.");

const existingProgram = (slug: string) => {
  const program = dependency.programs?.find((row) => row.slug === slug);
  if (!program) throw new Error(`Required HUST base program is missing: ${slug}.`);
  return program;
};
const newProgramSlug = (slug: string) => {
  if (dependency.programs?.some((row) => row.slug === slug)) throw new Error(`Expected new HUST program already exists: ${slug}.`);
  return slug;
};

const school = {
  ...baseSchool,
  deadlineSummary: "2027 undergraduate applications open October 26, 2026, with two published closing rounds: April 15 and June 30, 2027. Graduate and scholarship routes retain their separate official deadlines.",
  tuitionSummary: "2027 undergraduate tuition: Chinese-taught literature, education and law CNY 18,000/year; Chinese-taught engineering, science, arts, economics and management CNY 25,000/year; Chinese-taught medicine CNY 33,000/year; named English-taught routes CNY 30,000-40,000/year by program. Graduate routes retain their separate reviewed fees.",
  applicationFee: "CNY 800 for 2027 undergraduate applications, payable within 15 days after completing the online application successfully; non-refundable.",
  hskRequirement: "2027 Chinese-taught undergraduate routes: HSK 4 score 180 for science, engineering and medicine; HSK 5 score 180 for economics, management, literature, arts, law, education, and Artificial Intelligence and Automation.",
  englishRequirement: "2027 English-taught undergraduate routes: TOEFL 80, IELTS 5.5, Duolingo 110, or another recognized equivalent; applicants whose previous education was conducted in English may be exempt from a language certificate.",
  cscaRequired: true,
  cscaRequirement: "All 2027 undergraduate applicants submit CSCA results. Published subjects vary by teaching language and discipline; the six named English-taught routes require Mathematics plus Physics or Chemistry as recorded on each route.",
  admissionsUrl: sourceFields.sourceUrl,
  campusHighlights: Array.from(new Set([...(baseSchool.campusHighlights ?? []), "Six explicitly named English-taught undergraduate routes in the 2027 guide"])),
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    deadlineSummary: "official 2027 undergraduate guide application schedule",
    tuitionSummary: "official 2027 undergraduate tuition table plus existing reviewed graduate sources",
    applicationFee: "official 2027 undergraduate guide application-fee section",
    hskRequirement: "official 2027 undergraduate language requirements",
    englishRequirement: "official 2027 undergraduate language requirements",
    cscaRequirement: "official 2027 CSCA subject table",
    admissionsUrl: "captured official 2027 undergraduate guide",
    campusHighlights: "official 2027 English-taught program fee and CSCA tables",
  },
};

type ProgramSpec = {
  slug: string;
  nameEn: string;
  nameZh: string;
  durationYears: number;
  tuitionAmount: number;
  cscaSubjects: string[];
  base?: CatalogSeedProgram;
};

const specs: ProgramSpec[] = [
  {
    slug: newProgramSlug(`${schoolSlug}-intelligent-manufacturing-engineering-english`),
    nameEn: "Intelligent Manufacturing Engineering",
    nameZh: "智能制造工程",
    durationYears: 4,
    tuitionAmount: 30000,
    cscaSubjects: ["Mathematics", "Physics"],
  },
  {
    slug: `${schoolSlug}-communication-engineering-english`,
    nameEn: "Telecommunications Engineering",
    nameZh: "通信工程",
    durationYears: 4,
    tuitionAmount: 30000,
    cscaSubjects: ["Mathematics", "Physics"],
    base: existingProgram(`${schoolSlug}-communication-engineering-english`),
  },
  {
    slug: newProgramSlug(`${schoolSlug}-software-engineering-english`),
    nameEn: "Software Engineering",
    nameZh: "软件工程",
    durationYears: 4,
    tuitionAmount: 30000,
    cscaSubjects: ["Mathematics", "Physics"],
  },
  {
    slug: `${schoolSlug}-biomedical-engineering-english`,
    nameEn: "Biomedical Engineering",
    nameZh: "生物医学工程",
    durationYears: 4,
    tuitionAmount: 30000,
    cscaSubjects: ["Mathematics", "Chemistry"],
    base: existingProgram(`${schoolSlug}-biomedical-engineering-english`),
  },
  {
    slug: `${schoolSlug}-clinical-medicine-mbbs-english`,
    nameEn: "Clinical Medicine (MBBS)",
    nameZh: "临床医学（MBBS）",
    durationYears: 6,
    tuitionAmount: 40000,
    cscaSubjects: ["Mathematics", "Chemistry"],
    base: existingProgram(`${schoolSlug}-clinical-medicine-mbbs-english`),
  },
  {
    slug: `${schoolSlug}-pharmacy-english`,
    nameEn: "Pharmacy",
    nameZh: "药学",
    durationYears: 4,
    tuitionAmount: 35000,
    cscaSubjects: ["Mathematics", "Chemistry"],
    base: existingProgram(`${schoolSlug}-pharmacy-english`),
  },
];

const programs = specs.map((spec) => ({
  ...(spec.base ?? {}),
  slug: spec.slug,
  schoolSlug,
  citySlug: "wuhan",
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Undergraduate",
  durationYears: spec.durationYears,
  fieldCategory: spec.nameEn === "Clinical Medicine (MBBS)" || spec.nameEn === "Pharmacy" ? "Medicine and Health Sciences" : "Engineering and Technology",
  subjectArea: spec.nameEn,
  teachingLanguage: "English",
  cscaSubjects: spec.cscaSubjects,
  cscaRequirement: `2027 CSCA subjects: ${spec.cscaSubjects.join(" and ")}.`,
  englishRequirement: "TOEFL 80, IELTS 5.5, Duolingo 110, or another recognized equivalent; prior English-medium education may qualify for exemption.",
  tuitionAmount: spec.tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: `CNY ${spec.tuitionAmount.toLocaleString("en-US")}/year; CNY 800 application fee. Residence permit, physical examination, insurance and accommodation are charged separately as published in the guide.`,
  applicationNote: "Submit CSCA results, high-school qualification and transcripts, personal statement, a Chinese or English self-introduction video, language evidence and required non-academic documents through the university system. The final application round closes June 30, 2027.",
  badgeText: "2027 Undergraduate",
  displayTuition: `CNY ${spec.tuitionAmount.toLocaleString("en-US")}/year`,
  displaySubjects: spec.cscaSubjects,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    ...(spec.base?.sourceFieldLineage ?? {}),
    nameEn: "official 2027 English-taught program table",
    nameZh: "official 2027 Chinese program and fee tables",
    degreeLevel: "official 2027 undergraduate guide title",
    durationYears: "official 2027 tuition table",
    fieldCategory: "official program identity plus CUAC catalog taxonomy",
    subjectArea: "official program identity",
    teachingLanguage: "official 2027 English-taught program table",
    cscaSubjects: "official 2027 CSCA subject table",
    cscaRequirement: "official 2027 CSCA subject table",
    englishRequirement: "official 2027 language requirements",
    tuitionAmount: "official 2027 tuition table",
    tuitionText: "official 2027 fee and accommodation sections",
    applicationNote: "official 2027 application documents and procedure sections",
    badgeText: "official 2027 guide title",
    displayTuition: "official 2027 tuition table",
    displaySubjects: "official 2027 CSCA subject table",
  },
}));

const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2027,
  openDate: "2026-10-26T00:00:00.000Z",
  deadlineDate: "2027-06-30T15:59:59.000Z",
  deadlineLabel: "Applications open October 26, 2026. Round 1 closes April 15, 2027; Round 2 closes June 30, 2027.",
  applicationRound: "HUST 2027 International Undergraduate Application — Rounds 1 and 2",
  status: "open" as const,
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official 2027 undergraduate cycle and September-entry context",
    intakeYear: "official 2027 guide title",
    openDate: "official Applications Open date",
    deadlineDate: "official final-round June 30 deadline converted from Beijing end-of-day",
    deadlineLabel: "official opening date and two application-round deadlines",
    applicationRound: "official 2027 guide and two application rounds",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 109 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedSchools: 1, refreshedPrograms: 4, newPrograms: 2, programs: 6, programIntakes: 6, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The page explicitly names six English-taught undergraduate routes but does not expose a separate 2027 Chinese-taught major directory. Existing 2026 Chinese-taught program rows are not relabeled as 2027.",
    "The online application system URL printed by the university is HTTP-only, so it is not written into the HTTPS-only applicationUrl field.",
    "No scholarship terms are published by this guide, so no scholarship entity or scholarship claim is added.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-109");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 109, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
