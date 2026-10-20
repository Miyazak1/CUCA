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
  "gdufs-chinese-language-spring-2027": "f6b458f127af56b4b2a0b090879dd93e9c3781d6eb534f613275427be694a822",
  "gdufs-winter-chinese-program-2027": "375ab8cb2b393ccd5e3c8a923d62a27396e6767b0e9f6d5ceb4b5aa4e229a846",
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
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`GDUFS Wave 47 evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked GDUFS Wave 47 evidence: ${missing.join(", ")}`);
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const row = source(id);
  return { sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sourceSha256: row.sha256, capturedAt: row.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-44.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "guangdong-university-of-foreign-studies");
const city = dependency.cities?.find((row) => row.slug === "guangzhou");
if (!school || !city) throw new Error("Wave 47 GDUFS dependency rows are incomplete.");

const routeDefinitions = [
  {
    sourceId: "gdufs-chinese-language-spring-2027",
    slug: "guangdong-university-of-foreign-studies-chinese-language-program-spring-2027",
    nameEn: "Chinese Language Program - Spring 2027",
    nameZh: "广东外语外贸大学2027年春季汉语研修班",
    durationMonths: 4,
    subjectArea: "Introductory, intermediate and advanced Chinese comprehensive, listening and speaking courses, with optional cultural activities such as calligraphy and martial arts.",
    hskRequirement: "No fixed HSK score is published. The program offers introductory, intermediate and advanced levels.",
    tuitionAmount: 8600,
    tuitionPeriod: "semester",
    tuitionText: "CNY 8,600 per semester or CNY 17,200 per academic year. First-time application fee CNY 500, insurance CNY 400 per semester or CNY 800 per year, double-room accommodation CNY 4,800 per semester and four-bed-room accommodation CNY 2,400 per semester are separate.",
    applicationNote: "Applicants must be eligible for a student visa, aged 18-35, law-abiding and in good physical and mental health. Submit Chinese and English versions of a no-criminal-record certificate; applicants who previously studied Chinese in China must also provide official attendance and academic transcripts. The class requires at least ten participants and on-campus accommodation is limited.",
    intakeTerm: "Spring",
    openDate: "2026-09-30T00:00:00.000Z",
    deadlineDate: "2026-12-10T15:59:59.000Z",
    deadlineLabel: "Apply September 30-December 10, 2026; register February 25-26, 2027; classes run February 25-June 25, 2027. The deadline is normalized to end of day in Guangzhou because no time is published.",
    applicationRound: "GDUFS Spring 2027 Chinese Language Program",
  },
  {
    sourceId: "gdufs-winter-chinese-program-2027",
    slug: "guangdong-university-of-foreign-studies-winter-chinese-language-program-2027",
    nameEn: "Winter Chinese Language Program 2027",
    nameZh: "广东外语外贸大学2027年汉语寒假班",
    durationMonths: 1,
    subjectArea: "Introductory Chinese comprehensive, listening and speaking courses for short-term communication development.",
    hskRequirement: "Designed for applicants with no Chinese proficiency or HSK Level 1.",
    tuitionAmount: 2600,
    tuitionPeriod: "program",
    tuitionText: "CNY 2,600 for the one-month program. First-time application fee CNY 500 and compulsory insurance CNY 100 are separate. No on-campus accommodation is available during the winter holidays.",
    applicationNote: "Applicants in Chinese mainland must be eligible for a student visa, be under age 35, obey Chinese law and university regulations, and be in good physical and mental health. The class requires at least ten participants.",
    intakeTerm: "Winter",
    openDate: undefined,
    deadlineDate: "2026-10-31T15:59:59.000Z",
    deadlineLabel: "Applications are accepted from the notice date through October 31, 2026; the program runs December 28, 2026-January 22, 2027. The deadline is normalized to end of day in Guangzhou because no time is published.",
    applicationRound: "GDUFS 2027 Winter Chinese Language Program",
  },
] as const;

const programs: CatalogSeedProgram[] = routeDefinitions.map((route) => ({
  slug: route.slug,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: route.nameEn,
  nameZh: route.nameZh,
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese language",
  subjectArea: route.subjectArea,
  teachingLanguage: "Chinese",
  durationMonths: route.durationMonths,
  hskRequirement: route.hskRequirement,
  tuitionAmount: route.tuitionAmount,
  tuitionCurrency: "CNY",
  tuitionPeriod: route.tuitionPeriod,
  tuitionText: route.tuitionText,
  scholarshipText: "The captured self-funded program notice does not publish a route-specific scholarship.",
  applicationUrl: source(route.sourceId).finalUrl ?? source(route.sourceId).url,
  applicationNote: route.applicationNote,
  hasScholarship: false,
  badgeText: route.intakeTerm === "Spring" ? "Spring 2027" : "Winter 2027",
  displayGroup: "Non-degree",
  displayGroupLabel: "Chinese language programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields(route.sourceId),
  sourceFieldLineage: {
    nameEn: "official program title",
    nameZh: "official program title (translated)",
    degreeLevel: "official non-degree Chinese training description",
    fieldCategory: "official program description",
    subjectArea: "official Program Highlight section",
    teachingLanguage: "official Chinese-language curriculum",
    durationMonths: "official program calendar, represented at published month granularity",
    hskRequirement: "official Program Highlight section",
    tuitionAmount: "official Fees section",
    tuitionCurrency: "official Fees section",
    tuitionPeriod: "official Fees section and program calendar",
    tuitionText: "official Fees section",
    applicationUrl: "registered HTTPS official program notice; its How to apply section links the external application platform over HTTP",
    applicationNote: "official Requirements and Program Highlight sections",
  },
}));

const programIntakes: CatalogSeedProgramIntake[] = routeDefinitions.map((route) => ({
  programSlug: route.slug,
  intakeTerm: route.intakeTerm,
  intakeYear: 2027,
  ...(route.openDate ? { openDate: route.openDate } : {}),
  deadlineDate: route.deadlineDate,
  deadlineLabel: route.deadlineLabel,
  applicationRound: route.applicationRound,
  status: "open",
  ...fields(route.sourceId),
  sourceFieldLineage: {
    intakeTerm: "official program title and calendar",
    intakeYear: "official program title and calendar",
    ...(route.openDate ? { openDate: "official Applicant Period" } : {}),
    deadlineDate: "official application deadline; Guangzhou end-of-day normalization",
    deadlineLabel: "official application and program calendar",
    applicationRound: "official program title",
    status: "deadline compared with capturedAt",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 47 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
  unresolved: [
    "Both pages are self-funded non-degree notices and publish no route-specific scholarship, so no scholarship entity is emitted.",
    "The winter notice gives no application opening date beyond 'from issuance date'; openDate remains absent.",
    "The spring notice advertises both semester and academic-year prices but publishes only the Spring 2027 semester calendar; this wave creates the evidenced Spring semester route and preserves the annual price in tuition text without inventing a separate year-long intake.",
    "Both classes require at least ten participants; the routes remain active while their published application windows are open, without asserting that a class has formed.",
  ],
  notes: [
    "Wave 47 adds two non-degree routes that are distinct from GDUFS's Spring 2027 degree routes refreshed in Wave 44.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-47");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 47, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
