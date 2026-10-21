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
const expected: Record<string, string> = {
  "fudan-chinese-language-spring-2027": "945f80fb7b291ebae07b30a4b02838d9ba538d236e4db36988b67a94b0d1d249",
  "fudan-chinese-language-guide-pdf-spring-2027": "2f5b09cc02fed3753bf0b662f60242cfcd56f21eeb8f7904b5bc48464d30bef2",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Fudan Wave 48 evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked Fudan Wave 48 evidence: ${missing.join(", ")}`);
const pageSource = evidence.get("fudan-chinese-language-spring-2027")!;
const guideSource = evidence.get("fudan-chinese-language-guide-pdf-spring-2027")!;
const fields = { sourceUrl: guideSource.finalUrl ?? guideSource.url, sourceLabel: guideSource.label, sourceSha256: guideSource.sha256, capturedAt: guideSource.fetchedAt };

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-04.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "fudan-university");
const city = dependency.cities?.find((row) => row.slug === "shanghai");
if (!school || !city) throw new Error("Wave 48 Fudan dependency rows are incomplete.");

const common = {
  schoolSlug: school.slug,
  citySlug: city.slug,
  degreeLevel: "Non-degree" as const,
  fieldCategory: "Chinese language",
  subjectArea: "Chinese intensive reading, extensive reading, listening and speaking, writing, and level-specific electives in Chinese language and culture; approximately 18 class hours per week.",
  teachingLanguage: "Chinese",
  hskRequirement: "No fixed HSK score is published. Students take an online Chinese placement test after arrival and are assigned among ten levels from beginner to advanced.",
  tuitionCurrency: "CNY",
  scholarshipText: "The captured self-funded program guide does not publish a route-specific scholarship.",
  applicationUrl: pageSource.finalUrl ?? pageSource.url,
  applicationNote: "Applicants must be foreign citizens aged 17-60 and in good physical and mental health. Required materials are the completed online application and a passport personal-information-page copy valid throughout the study period. Applicants aged 17 but under 18 must provide a guardian guarantee and related materials; the university may request supplements.",
  hasScholarship: false,
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guideSource.fetchedAt,
  ...fields,
};
const routes = [
  {
    slug: "fudan-university-chinese-language-one-semester-spring-2027",
    nameEn: "Chinese Language Program - One Semester (Spring 2027)",
    nameZh: "复旦大学2027年春季外国留学生汉语进修项目（一学期）",
    durationMonths: 4,
    tuitionAmount: 10500,
    tuitionPeriod: "semester",
    tuitionText: "Reference tuition CNY 10,500 per semester; application fee CNY 400 is non-refundable. Final tuition is subject to the university finance price in effect at enrollment.",
    endDate: "2027-06-25",
  },
  {
    slug: "fudan-university-chinese-language-one-academic-year-spring-2027",
    nameEn: "Chinese Language Program - One Academic Year (Spring 2027)",
    nameZh: "复旦大学2027年春季外国留学生汉语进修项目（一学年）",
    durationYears: 1,
    tuitionAmount: 21000,
    tuitionPeriod: "year",
    tuitionText: "Reference tuition CNY 21,000 per academic year; application fee CNY 400 is non-refundable. Final tuition is subject to the university finance price in effect at enrollment.",
    endDate: "2028-01-07",
  },
] as const;

const programs: CatalogSeedProgram[] = routes.map((route) => ({
  ...common,
  slug: route.slug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  ...("durationMonths" in route ? { durationMonths: route.durationMonths } : {}),
  ...("durationYears" in route ? { durationYears: route.durationYears } : {}),
  tuitionAmount: route.tuitionAmount,
  tuitionPeriod: route.tuitionPeriod,
  tuitionText: route.tuitionText,
  badgeText: "Spring 2027",
  sourceFieldLineage: {
    nameEn: "official Spring 2027 guide title and study-duration section (translated)",
    nameZh: "official Spring 2027 guide title and study-duration section",
    degreeLevel: "official Chinese language non-degree program context",
    ...("durationMonths" in route ? { durationMonths: "official February 15-June 25 semester schedule, represented at month granularity" } : {}),
    ...("durationYears" in route ? { durationYears: "official academic-year route and February 15, 2027-January 7, 2028 schedule" } : {}),
    fieldCategory: "official program introduction",
    subjectArea: "official curriculum and level table",
    teachingLanguage: "official Chinese language program description",
    hskRequirement: "official placement-test and ten-level description",
    tuitionAmount: "official tuition reference",
    tuitionCurrency: "official tuition reference",
    tuitionPeriod: "official study-duration and tuition references",
    tuitionText: "official tuition and final-pricing disclaimer",
    applicationUrl: "registered HTTPS official program notice",
    applicationNote: "official eligibility and application-material sections",
  },
}));

const programIntakes: CatalogSeedProgramIntake[] = routes.map((route) => ({
  programSlug: route.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-15T16:00:00.000Z",
  deadlineDate: "2026-12-13T15:59:59.000Z",
  deadlineLabel: `Apply October 16-December 13, 2026. Study begins February 15, 2027 and is expected to end ${route.endDate}. The deadline is normalized to end of day in Shanghai because no time is published.`,
  applicationRound: "Fudan ICES Spring 2027 Chinese Language Program",
  status: "open",
  ...fields,
  sourceFieldLineage: {
    intakeTerm: "official Spring 2027 guide title",
    intakeYear: "official Spring 2027 guide title",
    openDate: "official application period; normalized to start of day in Shanghai",
    deadlineDate: "official application period; normalized to end of day in Shanghai",
    deadlineLabel: "official application period and program schedule",
    applicationRound: "official program title",
    status: "deadline compared with capturedAt",
  },
}));

const generatedAt = [pageSource.fetchedAt, guideSource.fetchedAt].sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 48 validation failed:\n${validation.errors.join("\n")}`);
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
    "The guide labels tuition as a reference and says the final amount follows the university finance price at enrollment; the structured amount therefore retains that qualification in tuitionText.",
    "The guide publishes no route-specific scholarship, fixed HSK threshold, accommodation price or exact registration date, so those values are not inferred.",
    "The semester duration is stored as four months from the exact February 15-June 25 schedule because the seed contract has no date-range duration field.",
  ],
  notes: [
    "The locked 13-page PDF was text-extracted and visually reviewed at the cover, curriculum, study-duration/fee/deadline and application-procedure pages before transcription.",
    "The semester and academic-year options are represented as separate applicant-facing routes sharing the published Spring 2027 application window.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-48");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 48, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
