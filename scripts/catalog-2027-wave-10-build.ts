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

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-10.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-10.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-10.review.json");
const expected: Record<string, string> = {
  "dut-undergraduate-admissions-chinese-2027": "29bcc75688fc6d1c7ffe9bc12c1e00e25918de74b9ad1d1234bcf53c32f78295",
  "dut-undergraduate-admissions-english-2027": "a9e950a16847148bbf76c8e80d1a596c709ac4ebc0f1889a58d1a7f6bbaed53a",
  "dut-master-admissions-chinese-2027": "1e6f12d0e712d3be4ba100ad5365c10fffe425d12082a3155397bc5de5b867e4",
  "dut-master-admissions-english-2027": "63d46ce646d1ed89f978182688d1a0fbad059f552c63dd2b60455756d6ece7b0",
  "dut-doctoral-admissions-chinese-2027": "5aafa4944e56d9440dc6e5115e708f31b14e5cee733fc47b524787191e331279",
  "dut-doctoral-admissions-english-2027": "1d8d5c965ae8c0fff7f1b01c79e3a22355166211c649788794a657c4da938ad0",
  "dut-chinese-government-scholarship-type-a-2027": "58222c6400009a10999ac561f419fb67924382f150d236b7deb9774a96f3a83e",
  "dut-chinese-government-scholarship-type-b-2027": "c8df01bdddebda6223270e040fc17085562b41d7ca556f9a8ffde201ca195557",
};
const evidence = new Map<string, ManifestSource>();
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
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 10 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const school = (base.schools ?? []).find((row) => row.slug === "dalian-university-of-technology");
const city = (base.cities ?? []).find((row) => row.slug === "dalian");
if (!school || !city) throw new Error("Wave 10 DUT dependencies are missing from the reviewed 100-school release.");
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Route = {
  level: "Undergraduate" | "Master" | "Doctoral";
  language: "Chinese" | "English";
  category: string;
  tuition: number;
  duration: string;
  requirement: string;
  sourceId: keyof typeof expected;
};
const routes: Route[] = [
  { level: "Undergraduate", language: "Chinese", category: "Humanities and foreign languages", tuition: 19500, duration: "4 years", requirement: "HSK 5 with a score of 180 or above for humanities, social sciences and philosophy fields", sourceId: "dut-undergraduate-admissions-chinese-2027" },
  { level: "Undergraduate", language: "Chinese", category: "Science, engineering, economics and management", tuition: 20500, duration: "4 years", requirement: "HSK 4 with a score of 180 or above", sourceId: "dut-undergraduate-admissions-chinese-2027" },
  { level: "Undergraduate", language: "Chinese", category: "Architecture", tuition: 22500, duration: "4 years", requirement: "The official page requires the applicable Chinese-language threshold; the exact major catalog remains in a CAPTCHA-protected attachment", sourceId: "dut-undergraduate-admissions-chinese-2027" },
  { level: "Undergraduate", language: "Chinese", category: "Art and design", tuition: 25000, duration: "4 years", requirement: "The official page requires the applicable Chinese-language threshold and two artworks; the exact major catalog remains in a CAPTCHA-protected attachment", sourceId: "dut-undergraduate-admissions-chinese-2027" },
  { level: "Undergraduate", language: "English", category: "English-taught programs", tuition: 25500, duration: "4 years", requirement: "TOEFL 80, IELTS 5.5, Duolingo 100, an English-medium high-school certificate, or an applicable official-language exemption", sourceId: "dut-undergraduate-admissions-english-2027" },
  { level: "Master", language: "Chinese", category: "Humanities", tuition: 23000, duration: "3 years", requirement: "HSK 5 with a score of 180 or above", sourceId: "dut-master-admissions-chinese-2027" },
  { level: "Master", language: "Chinese", category: "Science, engineering, economics and management", tuition: 24500, duration: "3 years", requirement: "HSK 4 with a score of 180 or above", sourceId: "dut-master-admissions-chinese-2027" },
  { level: "Master", language: "Chinese", category: "Architecture", tuition: 26500, duration: "3 years", requirement: "The official page requires the applicable Chinese-language threshold; the exact major catalog remains in a CAPTCHA-protected attachment", sourceId: "dut-master-admissions-chinese-2027" },
  { level: "Master", language: "Chinese", category: "Art and design", tuition: 28500, duration: "3 years", requirement: "The official page requires the applicable Chinese-language threshold; the exact major catalog remains in a CAPTCHA-protected attachment", sourceId: "dut-master-admissions-chinese-2027" },
  { level: "Master", language: "English", category: "Humanities", tuition: 28000, duration: "3 years", requirement: "TOEFL 80, IELTS 5.5, Duolingo 100, prior English-medium study, or an applicable official-language exemption", sourceId: "dut-master-admissions-english-2027" },
  { level: "Master", language: "English", category: "Science, engineering, economics and management", tuition: 29500, duration: "3 years", requirement: "TOEFL 80, IELTS 5.5, Duolingo 100, prior English-medium study, or an applicable official-language exemption", sourceId: "dut-master-admissions-english-2027" },
  { level: "Doctoral", language: "Chinese", category: "Humanities", tuition: 31000, duration: "4 years", requirement: "HSK 5 with a score of 180 or above", sourceId: "dut-doctoral-admissions-chinese-2027" },
  { level: "Doctoral", language: "Chinese", category: "Science, engineering, economics and management", tuition: 33000, duration: "4 years", requirement: "HSK 4 with a score of 180 or above", sourceId: "dut-doctoral-admissions-chinese-2027" },
  { level: "Doctoral", language: "English", category: "English-taught programs", tuition: 40000, duration: "4 years", requirement: "TOEFL 80, IELTS 5.5, Duolingo 100, prior English-medium study, or an applicable official-language exemption", sourceId: "dut-doctoral-admissions-english-2027" },
];

const programs: CatalogSeedProgram[] = routes.map((route) => {
  const source = evidence.get(route.sourceId)!;
  const graduate = route.level !== "Undergraduate";
  const applicationNote = route.level === "Undergraduate"
    ? `Applicants must be non-Chinese citizens, normally aged 18-25, hold or expect a high-school diploma before enrollment, submit the published documents, and provide a valid CSCA transcript. The exact 2027 major and CSCA-subject attachments require a university download CAPTCHA and are therefore not inferred.`
    : `Applicants must be non-Chinese citizens, be under ${route.level === "Master" ? "35" : "40"}, hold the prior degree, submit transcripts, a research plan of at least 1,000 words signed by a supervisor, two academic recommendations, medical and blood-test records, passport materials, language evidence and a no-criminal-record certificate. Exact 2027 majors remain in a university CAPTCHA-protected attachment and are not inferred.`;
  return {
    slug: `dalian-university-of-technology-2027-${slugify(route.level)}-${slugify(route.language)}-${slugify(route.category)}`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: `2027 ${route.language}-taught ${route.level} programs - ${route.category}`,
    degreeLevel: route.level,
    durationYears: Number.parseInt(route.duration, 10),
    fieldCategory: route.category,
    subjectArea: route.category,
    teachingLanguage: route.language,
    ...(route.language === "Chinese" ? { hskRequirement: route.requirement } : { englishRequirement: route.requirement }),
    tuitionAmount: route.tuition,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: `CNY ${route.tuition.toLocaleString("en-US")}/year; published duration ${route.duration}; application fee CNY 800${graduate ? " for self-funded and DUT Presidential Scholarship applications, or CNY 400 for Chinese Government Scholarship applications" : route.language === "Chinese" ? " for self-funded and DUT Presidential Scholarship applications, or CNY 400 for International Chinese Language Teachers Scholarship applications" : ""}. Accommodation is charged separately.`,
    applicationNote,
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields(source),
    sourceFieldLineage: {
      nameEn: "degree level, teaching language and published tuition category",
      degreeLevel: "admission page heading and qualification section",
      durationYears: "Fees table, published duration",
      fieldCategory: "Fees table; exact majors are not inferred from the protected attachment",
      subjectArea: "Fees table; exact majors are not inferred from the protected attachment",
      teachingLanguage: "admission page heading",
      ...(route.language === "Chinese" ? { hskRequirement: "Language ability requirements" } : { englishRequirement: "Language ability requirements" }),
      tuitionAmount: "Fees table",
      tuitionCurrency: "Fees table",
      tuitionPeriod: "Fees table",
      tuitionText: "Fees table",
      applicationNote: "Qualifications and required documents",
    },
  };
});

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => {
  const route = routes.find((row) => program.slug === `dalian-university-of-technology-2027-${slugify(row.level)}-${slugify(row.language)}-${slugify(row.category)}`)!;
  const source = evidence.get(route.sourceId)!;
  const exactGraduateDeadline = route.level !== "Undergraduate";
  return {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2026-11-01T00:00:00.000Z",
    ...(exactGraduateDeadline ? { deadlineDate: "2027-06-30T12:00:00.000Z" } : {}),
    deadlineLabel: exactGraduateDeadline
      ? "Self-funded application: November 1, 2026-June 30, 2027, 20:00 Beijing time; scholarship application closes February 15, 2027, 20:00 Beijing time."
      : "Application opens November 1, 2026; the official page advises completion by the end of June 2027 but does not publish an exact deadline time.",
    applicationRound: `DUT Fall 2027 ${route.level.toLowerCase()} admission`,
    status: "open",
    ...sourceFields(source),
    sourceFieldLineage: { intakeTerm: "2027 registration in early September", intakeYear: "2027 registration notice", openDate: "Application time", ...(exactGraduateDeadline ? { deadlineDate: "Application time" } : {}), deadlineLabel: "Application time", applicationRound: "official 2027 admission page", status: "application window compared with capturedAt" },
  };
});

const typeBScholarshipSource = evidence.get("dut-chinese-government-scholarship-type-b-2027")!;
const typeBScholarship: CatalogSeedScholarship = {
  slug: "official-2027-dut-chinese-government-scholarship-high-level-graduate-silk-road-type-b",
  title: "DUT 2027 Chinese Government Scholarship - High-Level Graduate and Silk Road Programs (Type B)",
  schoolSlug: school.slug,
  providerName: "China Scholarship Council / Dalian University of Technology",
  applicableDegree: "Master and Doctoral",
  applicableProgram: "Eligible DUT 2027 master's and doctoral programs",
  fundingLevel: "Full",
  coverage: "Tuition waiver, on-campus accommodation, comprehensive medical insurance, and monthly stipend of CNY 3,000 for master's students or CNY 3,500 for doctoral students; international travel is not covered.",
  deadlineDate: "2027-02-15",
  deadlineLabel: "Application period: November 1, 2026-February 15, 2027. The official scholarship page publishes dates without an exact deadline time.",
  requirementText: "Applicants must be non-Chinese citizens in good health; master's applicants must hold a bachelor's degree and be no older than 35, and doctoral applicants must hold a master's degree and be no older than 40. Applicants must complete both the CSC and DUT systems and submit the published academic, language, recommendation, research-plan, medical, passport and criminal-record materials.",
  applicationRound: "DUT 2027 Chinese Government Scholarship Type B",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: typeBScholarshipSource.fetchedAt,
  ...sourceFields(typeBScholarshipSource),
  sourceFieldLineage: { title: "official page heading", schoolSlug: "official DUT domain", providerName: "scholarship introduction", applicableDegree: "quota, category and duration", applicableProgram: "application guide", fundingLevel: "scholarship content", coverage: "scholarship content", deadlineDate: "application time", deadlineLabel: "application time", requirementText: "applicant eligibility and required documents", applicationRound: "official page heading", status: "application period compared with capturedAt" },
};

const typeAScholarshipSource = evidence.get("dut-chinese-government-scholarship-type-a-2027")!;
const typeAScholarship: CatalogSeedScholarship = {
  slug: "official-2027-dut-chinese-government-scholarship-bilateral-type-a",
  title: "DUT 2027 Chinese Government Scholarship - Bilateral Program (Type A)",
  schoolSlug: school.slug,
  providerName: "China Scholarship Council / national dispatching authorities / Dalian University of Technology",
  applicableDegree: "Undergraduate, Master, Doctoral and Non-degree",
  applicableProgram: "Eligible DUT programs and scholar categories available under the applicant's bilateral agreement",
  fundingLevel: "Full or partial",
  coverage: "The official DUT page states that bilateral awards may be full or partial scholarships and refers applicants to the Chinese Government Scholarship introduction; it does not itemize a monetary benefit schedule on this page.",
  deadlineLabel: "Applications are accepted by the relevant national dispatching authority from early November 2026 to early April 2027; the exact deadline varies by authority and is not converted into a fixed date.",
  requirementText: "Applicants must obtain nomination eligibility from the dispatching authority. Bachelor applicants must hold a high-school qualification and be no older than 25; master's applicants a bachelor's degree and no older than 35; doctoral applicants a master's degree and no older than 40. The published Chinese thresholds are HSK 4 (180) for science, engineering, economics and management or HSK 5 (180) for humanities, social sciences and philosophy. English routes normally require TOEFL 80, IELTS 5.5 or Duolingo 100, with the stated prior-English-medium and official-language exemptions.",
  applicationRound: "DUT 2027 Chinese Government Scholarship Type A bilateral program",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: typeAScholarshipSource.fetchedAt,
  ...sourceFields(typeAScholarshipSource),
  sourceFieldLineage: { title: "official page heading", schoolSlug: "official DUT domain", providerName: "program introduction and application process", applicableDegree: "funded categories and duration table", applicableProgram: "bilateral-agreement scope", fundingLevel: "scholarship content", coverage: "scholarship content", deadlineLabel: "application authority and application time", requirementText: "eligibility and language ability sections", applicationRound: "official page heading", status: "published 2027 scholarship route" },
};

const scholarships = [typeAScholarship, typeBScholarship];

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 10 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: scholarships.length, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "DUT's 2027 admission pages explicitly publish degree level, duration, teaching language, tuition category, application window and shared requirements, so this wave represents those verified program groups rather than inventing individual majors.",
    "The linked exact-major and CSCA-subject attachments are protected by a university download CAPTCHA. This workflow does not bypass that protection, so exact major names and subject mappings remain unresolved.",
    "Existing 2026 DUT program names are not relabeled as 2027.",
    "The official undergraduate and doctoral pages advise applying by the end of June but do not publish an exact deadline time; no exact deadlineDate is stored for those routes.",
    "The 2027 Type A bilateral page publishes a dispatching-authority window from early November to early April rather than a universal calendar deadline, so deadlineDate remains absent.",
    "No applicant, account, passport, payment, or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
