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
const expected = { "tjfsu-chinese-language-spring-2027": "1f588efbc5cd429464158974db293de1cdc88ba50943962f04278a24395d6118" } as const;
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.id !== "tjfsu-chinese-language-spring-2027" || item.status !== 200 || item.sha256 !== expected[item.id]) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error("TFSU evidence hash mismatch.");
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const item = evidence.get("tjfsu-chinese-language-spring-2027");
if (!item) throw new Error("Missing locked TFSU Spring 2027 evidence.");
const fields = { sourceUrl: item.finalUrl ?? item.url, sourceLabel: item.label, sourceSha256: item.sha256, capturedAt: item.fetchedAt };
const verified = { status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: item.fetchedAt, ...fields };

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-release-candidate.draft.json"), "utf8")) as CatalogSeedBundle;
const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "tianjin") ?? baseline.cities?.find((row) => row.slug === "tianjin");
const baselineSchool = baseline.schools?.find((row) => row.slug === "tianjin-foreign-studies-university");
if (!city || !baselineSchool) throw new Error("Missing TFSU dependency rows.");
const school = {
  ...baselineSchool,
  deadlineSummary: "Spring 2027 Chinese-language applications close December 31, 2026; registration is February 24-25, 2027. Other degree-cycle deadlines remain unchanged until separately refreshed.",
  tuitionSummary: "Spring 2027 Chinese language: CNY 6,700/semester or CNY 13,400/year; application fee CNY 500, insurance CNY 400/semester or CNY 800/year, double-room accommodation CNY 50/day.",
  admissionsUrl: item.url,
  campusHighlights: [...(baselineSchool.campusHighlights ?? []), "Spring 2027 Chinese-language study from elementary through advanced levels"],
  ...verified,
  sourceFieldLineage: {
    ...(baselineSchool.sourceFieldLineage ?? {}),
    deadlineSummary: "official Spring 2027 Chinese-language brochure",
    tuitionSummary: "official Spring 2027 Chinese-language brochure fee section",
    admissionsUrl: "registered official Spring 2027 brochure URL",
    campusHighlights: "official Spring 2027 course description",
  },
};

const commonNote = "Applicants must be non-Chinese citizens aged 18-60, in good physical and mental health, with a valid passport, physical-examination form, no-criminal-record certificate and a bank deposit certificate above CNY 20,000. Non-Chinese/English documents require notarized translations. New students take written and oral placement tests.";
const routes = [
  {
    slug: "tianjin-foreign-studies-university-chinese-language-one-semester-spring-2027",
    nameEn: "Chinese Language Program - One Semester (Spring 2027)",
    nameZh: "天津外国语大学2027年春季汉语言项目（一学期）",
    durationMonths: 4,
    tuitionAmount: 6700,
    tuitionPeriod: "semester",
    tuitionText: "CNY 6,700 per semester; each semester is 16-18 weeks. Application fee CNY 500, insurance CNY 400/semester and double-room accommodation CNY 50/day are separate.",
    displayTuition: "CNY 6,700/semester",
  },
  {
    slug: "tianjin-foreign-studies-university-chinese-language-one-year-spring-2027",
    nameEn: "Chinese Language Program - One Academic Year (Spring 2027)",
    nameZh: "天津外国语大学2027年春季汉语言项目（一学年）",
    durationYears: 1,
    tuitionAmount: 13400,
    tuitionPeriod: "year",
    tuitionText: "CNY 13,400 per academic year. Application fee CNY 500, insurance CNY 800/year and double-room accommodation CNY 50/day are separate.",
    displayTuition: "CNY 13,400/year",
  },
] as const;

const programs: CatalogSeedProgram[] = routes.map((route) => {
  const program: CatalogSeedProgram = {
    ...route,
    schoolSlug: school.slug,
    citySlug: city.slug,
    degreeLevel: "Non-degree",
    fieldCategory: "Chinese language",
    subjectArea: "Chinese language and culture",
    teachingLanguage: "Chinese",
    hskRequirement: "No fixed HSK score is published for admission; new students take written and oral placement tests after arrival.",
    tuitionCurrency: "CNY",
    scholarshipText: "The captured self-funded brochure does not publish a scholarship for this route.",
    applicationUrl: item.url,
    applicationNote: commonNote,
    hasScholarship: false,
    badgeText: "Spring 2027",
    displayGroup: "Non-degree",
    displayGroupLabel: "Chinese language programs",
    ...verified,
    sourceFieldLineage: { nameEn: "official brochure title and duration options", nameZh: "official brochure title and duration options", ...("durationMonths" in route ? { durationMonths: "official 16-18-week semester duration" } : {}), ...("durationYears" in route ? { durationYears: "official one-academic-year option" } : {}), subjectArea: "official course description", teachingLanguage: "official Chinese-language curriculum", hskRequirement: "official eligibility section publishes no HSK threshold and placement-test section assigns new students by written and oral testing", tuitionAmount: "official fee section", tuitionText: "official fee section", applicationNote: "official eligibility, materials and placement-test sections" },
  };
  return program;
});

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  deadlineDate: "2026-12-31T15:59:59Z",
  deadlineLabel: "Applications close December 31, 2026; registration is February 24-25, 2027.",
  applicationRound: "Spring 2027 Chinese-language entry",
  status: "open",
  ...fields,
  sourceFieldLineage: { intakeTerm: "official Spring 2027 brochure title", intakeYear: "official brochure title", deadlineDate: "official application deadline", deadlineLabel: "official deadline and registration section", status: "deadline compared with capturedAt" },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: item.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 26 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: item.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: item.id, label: item.label, url: item.url, fetchedAt: item.fetchedAt, sha256: item.sha256 }],
  unresolved: ["The page publishes self-funded language routes only; no scholarship is inferred.", "The brochure gives registration dates rather than a separate class start date, so no openDate is emitted.", "Degree-program information remains at its previously reviewed cycle until separate 2027 official sources are published."],
  notes: ["The semester and academic-year tuition options are represented as separate applicant-facing routes.", "No applicant, account, passport, payment or other personal data is included."],
};
await Promise.all([
  writeFile(resolve(root, "seeds/catalog.2027-wave-26.draft.json"), candidateText, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-26.validation.json"), `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(resolve(root, "seeds/catalog.2027-wave-26.review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidateSha256, counts: { cities: 1, schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
