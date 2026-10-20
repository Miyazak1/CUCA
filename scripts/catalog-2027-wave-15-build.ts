import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-15.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-15.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-15.review.json");
const expected: Record<string, string> = {
  "ecnu-current-undergraduate-language-requirements": "b9a073a39f62937a823737e489036dbadc28717280d74ed81d3ffa5b1fedd04d",
  "ecnu-current-graduate-language-requirements": "2406673ce8cd567443778717128c53dacbe1d024855ccb625915971754e57acf",
  "ecnu-current-international-student-fee-list": "51654adde30ed310b57430143c671cd6de4c4bad583b754ef17abec08b5a4955",
  "ecnu-standard-chinese-language-spring-2027": "7240d619ab1fae13c2d80625a112a051e8bc2159b079678b250c7f437cf55f38",
  "ecnu-business-chinese-language-spring-2027": "1ef20bd71fb40eeb84244838ae1dae17bcbddd9058231c0177ef89fb1a46243a",
  "ecnu-global-china-program-spring-2027": "5aa5392cc221790673daf92171a2ce8d001a4a36f7c2e574f8b9ff8fb69b91cc",
  "ecnu-love-ai-shanghai-winter-study-program-2027": "7a547f36725cdb094d1ebb6a7cf9f46c506e08edc28c0919fae30f233d686429",
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
if (missing.length) throw new Error(`Missing locked 2027 wave 15 evidence: ${missing.join(", ")}`);

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const baseSchool = (base.schools ?? []).find((row) => row.slug === "east-china-normal-university");
const city = (base.cities ?? []).find((row) => row.slug === "shanghai");
if (!baseSchool || !city) throw new Error("Wave 15 ECNU dependencies are missing from the reviewed 100-school release.");
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const item = source(id);
  return { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const school = {
  ...baseSchool,
  deadlineSummary: "ECNU's published 2027 non-degree deadlines include December 6, 2026 for the winter study program and December 25, 2026 for the Standard Chinese, Business Chinese and Global China spring programs. General Fall 2027 degree deadlines are not yet established by these sources.",
  tuitionSummary: "Current official fees: Chinese-language and China-study programs CNY 9,800-18,000/semester; short-term Chinese CNY 500-1,500/week; undergraduate/visiting categories generally CNY 22,000-50,000/year, with AEBS routes published separately; master's categories generally CNY 25,000-35,000/year with higher MBA/AEBS rates; doctoral categories CNY 30,000-45,000/year.",
  applicationFee: "CNY 800 for the listed semester and degree programs; CNY 400 for short-term Chinese programs.",
  languageRequirement: "Current degree-program policy: undergraduate Chinese-taught routes generally require HSK 5 score 180, while English for overseas students, School of International Chinese Studies routes and Chinese-taught Design routes require HSK 4 score 180; School of Communication routes require HSK 6 score 180. English-taught undergraduate routes require IELTS 6.0, TOEFL 85 or Cambridge English B2 for non-native speakers. Graduate Chinese-taught liberal arts/economics routes require HSK 5 score 210 or HSK 6 score 180; art, physical education and science routes require HSK 5 score 180. English-taught graduate routes require IELTS 6.0, TOEFL 80 or Cambridge English C1 Advanced score 169, or another ECNU-approved equivalent.",
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields("ecnu-standard-chinese-language-spring-2027"),
  sourceFieldLineage: {
    ...(baseSchool.sourceFieldLineage ?? {}),
    deadlineSummary: "four official ECNU Spring/Winter 2027 non-degree program pages",
    tuitionSummary: "current official international-student fee list",
    applicationFee: "current official international-student fee list",
    languageRequirement: "current official undergraduate and graduate degree-program language requirement pages",
  },
};

type ProgramSpec = {
  id: string;
  slug: string;
  nameEn: string;
  nameZh: string;
  fieldCategory: string;
  subjectArea: string;
  teachingLanguage: string;
  durationMonths?: number;
  hskRequirement?: string;
  englishRequirement?: string;
  tuitionText: string;
  requirementText: string;
  scheduleText: string;
  deadlineDate: string;
  deadlineLabel: string;
  intakeTerm: "Winter" | "Spring";
};
const specs: ProgramSpec[] = [
  {
    id: "ecnu-standard-chinese-language-spring-2027",
    slug: "east-china-normal-university-standard-chinese-language-spring-2027",
    nameEn: "Standard Chinese Language Program - Spring 2027",
    nameZh: "2027年春季标准中文项目",
    fieldCategory: "Chinese language",
    subjectArea: "General Chinese language from beginner through advanced levels",
    teachingLanguage: "Chinese",
    durationMonths: 4,
    hskRequirement: "No prior Chinese proficiency threshold is published; classes cover beginner through advanced levels.",
    tuitionText: "CNY 12,000/semester; application fee CNY 800; textbooks are self-funded",
    requirementText: "Applicants should have completed high school or an equivalent or higher qualification. The standard age range is 18-55; applicants aged 16-17 receive additional university review. No prior Chinese proficiency threshold is published.",
    scheduleText: "Putuo Campus; March 1-June 18, 2027; orientation week begins March 1 and classes begin March 8; 20 class hours per week.",
    deadlineDate: "2026-12-25T12:00:00Z",
    deadlineLabel: "Complete materials due December 25, 2026 at 20:00 Beijing time; tuition payment due January 14, 2027 at 20:00 Beijing time.",
    intakeTerm: "Spring",
  },
  {
    id: "ecnu-business-chinese-language-spring-2027",
    slug: "east-china-normal-university-business-chinese-language-spring-2027",
    nameEn: "Business Chinese Language Program - Spring 2027",
    nameZh: "2027年春季商务汉语项目",
    fieldCategory: "Business Chinese language",
    subjectArea: "Business Chinese, contemporary Chinese economy and finance, and workplace communication",
    teachingLanguage: "Chinese",
    durationMonths: 4,
    hskRequirement: "HSK Level 3 or above is required.",
    tuitionText: "CNY 18,000/semester; application fee CNY 800; textbooks are self-funded",
    requirementText: "HSK Level 3 or above is required. Applicants should have completed high school or an equivalent or higher qualification. The standard age range is 18-55; applicants aged 16-17 receive additional university review. Each level needs at least eight students to open.",
    scheduleText: "Putuo Campus; March 1-June 18, 2027; orientation week begins March 1 and classes begin March 8; 29 class hours per week.",
    deadlineDate: "2026-12-25T12:00:00Z",
    deadlineLabel: "Complete materials due December 25, 2026 at 20:00 Beijing time; tuition payment due January 14, 2027 at 20:00 Beijing time.",
    intakeTerm: "Spring",
  },
  {
    id: "ecnu-global-china-program-spring-2027",
    slug: "east-china-normal-university-global-china-program-spring-2027",
    nameEn: "Global China Program - Spring 2027",
    nameZh: "2027年春季全球中国项目",
    fieldCategory: "Visiting and study abroad",
    subjectArea: "Chinese language plus English-taught China Studies content courses",
    teachingLanguage: "English and Chinese",
    durationMonths: 4,
    englishRequirement: "Non-native English speakers must provide IELTS 6.0+, TOEFL 85+ or Cambridge English B2+.",
    tuitionText: "CNY 20,000/semester; application fee CNY 800; insurance CNY 800/year",
    requirementText: "Open to current college students. Required documents include a high-school or college graduation certificate and college transcript, passport and photo. Non-native English speakers must provide IELTS 6.0+, TOEFL 85+ or Cambridge English B2+.",
    scheduleText: "Putuo Campus; March 1-June 11, 2027; orientation week begins March 1 and classes begin March 8; students may take up to four courses and course opening depends on enrollment.",
    deadlineDate: "2026-12-25T00:00:00Z",
    deadlineLabel: "Application deadline: December 25, 2026. The official page does not state a deadline time.",
    intakeTerm: "Spring",
  },
  {
    id: "ecnu-love-ai-shanghai-winter-study-program-2027",
    slug: "east-china-normal-university-love-ai-shanghai-winter-study-program-2027",
    nameEn: "Love (AI) Shanghai Winter Study Program - 2027",
    nameZh: "2027年“爱（AI）上海”寒假研学项目",
    fieldCategory: "Short-term Chinese and cultural study",
    subjectArea: "Chinese language, Chinese AI applications, city exploration and cultural study",
    teachingLanguage: "Chinese immersion; classes are arranged by Chinese proficiency",
    hskRequirement: "No fixed HSK threshold is published; classes are arranged by Chinese proficiency.",
    tuitionText: "CNY 9,800 program fee including tuition, materials, standard twin-room accommodation, listed activities, meals and campus card; application fee CNY 800; optional Suzhou trip approximately CNY 500",
    requirementText: "Applicants must be aged 18-55, in good health and hold a valid foreign passport. Required materials are passport copy, digital photo and enrollment certificate or highest qualification in Chinese or English.",
    scheduleText: "January 4-22, 2027; three weeks of Chinese workshops, AI practice, Shanghai exploration and cultural activities.",
    deadlineDate: "2026-12-06T00:00:00Z",
    deadlineLabel: "Application deadline: December 6, 2026. The official page does not state a deadline time; payment is due before December 10, 2026.",
    intakeTerm: "Winter",
  },
];

const programs: CatalogSeedProgram[] = specs.map((spec) => ({
  slug: spec.slug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: spec.nameEn,
  nameZh: spec.nameZh,
  degreeLevel: "Non-degree",
  ...(spec.durationMonths ? { durationMonths: spec.durationMonths } : {}),
  fieldCategory: spec.fieldCategory,
  subjectArea: spec.subjectArea,
  teachingLanguage: spec.teachingLanguage,
  ...(spec.hskRequirement ? { hskRequirement: spec.hskRequirement } : {}),
  ...(spec.englishRequirement ? { englishRequirement: spec.englishRequirement } : {}),
  tuitionText: spec.tuitionText,
  displayTuition: spec.tuitionText,
  applicationUrl: source(spec.id).finalUrl ?? source(spec.id).url,
  applicationNote: `${spec.scheduleText} ${spec.requirementText}`,
  badgeText: "Official 2027 program",
  displayGroup: "Non-degree",
  displayGroupLabel: "2027 non-degree programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: source(spec.id).fetchedAt,
  ...fields(spec.id),
  sourceFieldLineage: {
    nameEn: "official program title and 2027 schedule",
    nameZh: "official program title translated or copied from the bilingual official page",
    degreeLevel: "official non-degree/visiting/short-term program category",
    ...(spec.durationMonths ? { durationMonths: "official semester label and published March-to-June 2027 schedule" } : {}),
    fieldCategory: "official program category and course description",
    subjectArea: "official curriculum description",
    teachingLanguage: "official course-language description",
    ...(spec.hskRequirement ? { hskRequirement: "official eligibility or placement policy" } : {}),
    ...(spec.englishRequirement ? { englishRequirement: "official eligibility section" } : {}),
    tuitionText: "official program fee section",
    applicationUrl: "official ECNU program page",
    applicationNote: "official schedule, eligibility and application-material sections",
  },
}));
const intakes: CatalogSeedProgramIntake[] = specs.map((spec) => ({
  programSlug: spec.slug,
  intakeTerm: spec.intakeTerm,
  intakeYear: 2027,
  deadlineDate: spec.deadlineDate,
  deadlineLabel: spec.deadlineLabel,
  applicationRound: `${spec.nameEn} official application round`,
  status: "open",
  ...fields(spec.id),
  sourceFieldLineage: {
    intakeTerm: "official 2027 program dates",
    intakeYear: "official 2027 program dates",
    deadlineDate: "official application deadline; date-only deadlines normalized to ISO UTC midnight unless an explicit Beijing time is published",
    deadlineLabel: "official application and payment deadline text",
    applicationRound: "official program title",
    status: "deadline compared with capturedAt",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs, programIntakes: intakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 15 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: intakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "These sources establish four Winter/Spring 2027 non-degree routes only; Fall 2027 bachelor, master and doctoral admission rounds remain unpublished and existing 2026 degree routes are not relabeled.",
    "No 2027 scholarship eligibility is stated on these four program pages, so no scholarship row is created.",
    "Date-only deadlines for Global China and the winter study program have no published deadline time; the display labels preserve that limitation.",
    "The winter study program is explicitly three weeks long. It remains without a numeric duration because the current seed contract cannot represent weeks without approximation.",
  ],
  notes: [
    "Fees, dates, eligibility, language thresholds and application materials are kept at route level and are not generalized to other ECNU programs.",
    "The three March-to-June semester routes are represented as four months from their published 2027 schedules; published HSK, English and placement policies are stored in structured route fields.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: intakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
