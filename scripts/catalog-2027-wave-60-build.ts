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
const expected = new Map<string, string>([
  ["bnu-undergraduate-credit-program-chinese-spring-2027", "306e935bedf7b53ba3ee86825ccac63f7a1675747607f80dce56b494168bbef7"],
  ["bnu-graduate-credit-program-english-spring-2027", "a78bd192be62da432fcca31de6fa7f96b95119361db58d1265edc22a57fec6e2"],
]);
const evidence = new Map<string, ManifestSource>();

for (const entry of await readdir(resolve(root, "work/catalog-official"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(root, "work/catalog-official", entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const row of manifest.sources ?? []) {
      if (row.status !== 200 || expected.get(row.id) !== row.sha256) continue;
      const bytes = await readFile(resolve(runRoot, row.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw new Error(`BNU Wave 60 evidence hash mismatch for ${row.id}.`);
      evidence.set(row.id, row);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) throw new Error(`Missing locked BNU Wave 60 evidence: found ${evidence.size}/${expected.size}.`);

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-09.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "beijing-normal-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 60 BNU dependencies are incomplete.");

const undergraduate = evidence.get("bnu-undergraduate-credit-program-chinese-spring-2027")!;
const graduate = evidence.get("bnu-graduate-credit-program-english-spring-2027")!;
const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});
const deadlineFields = (source: ManifestSource) => ({
  intakeTerm: "Spring" as const,
  intakeYear: 2027,
  openDate: "2026-10-10T00:00:00.000Z",
  deadlineDate: "2026-12-15T15:59:59.000Z",
  deadlineLabel: "Apply October 10-December 15, 2026 for study starting in March 2027. If supplementary materials are requested, re-submit them by December 20, 2026. No deadline time is published; the structured deadline is normalized to end of day in Beijing.",
  status: "open" as const,
  ...sourceFields(source),
});

type UndergraduateRoute = { key: string; category: string; duration: "One Semester" | "One Academic Year"; tuition: number; durationYears?: number };
const undergraduateRoutes: UndergraduateRoute[] = [
  { key: "liberal-arts-one-semester", category: "Liberal Arts", duration: "One Semester", tuition: 11600 },
  { key: "liberal-arts-one-academic-year", category: "Liberal Arts", duration: "One Academic Year", tuition: 22400, durationYears: 1 },
  { key: "science-engineering-arts-physical-education-one-semester", category: "Science, Engineering, Arts and Physical Education", duration: "One Semester", tuition: 13050 },
  { key: "science-engineering-arts-physical-education-one-academic-year", category: "Science, Engineering, Arts and Physical Education", duration: "One Academic Year", tuition: 25300, durationYears: 1 },
];

const programs: CatalogSeedProgram[] = undergraduateRoutes.map((route) => ({
  slug: `beijing-normal-university-chinese-taught-undergraduate-credit-program-${route.key}-spring-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: `Chinese-taught Undergraduate Credit Program - ${route.category} (${route.duration})`,
  degreeLevel: "Non-degree",
  ...(route.durationYears ? { durationYears: route.durationYears } : {}),
  fieldCategory: "Undergraduate credit study",
  subjectArea: `${route.category} undergraduate-level credit study. The exact selected major remains subject to the application system and course availability.`,
  teachingLanguage: "Chinese",
  hskRequirement: "Teaching Chinese to Speakers of Other Languages requires HSK Level 4 with at least 180; other majors require HSK Level 5 with at least 180. Prior or current Chinese-medium academic study may exempt the HSK certificate.",
  tuitionAmount: route.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: route.duration === "One Semester" ? "semester" : "academic year",
  tuitionText: `CNY ${route.tuition.toLocaleString("en-US")} for ${route.duration.toLowerCase()}; application fee CNY 450.`,
  applicationUrl: "https://international.bnu.edu.cn/",
  applicationNote: "Applicants must be non-Chinese citizens aged 18-45, be enrolled in the second year of university or above, and submit the online form, passport, enrollment or degree proof, transcript, Chinese-language proof, one teacher recommendation and a non-criminal-record certificate. Partner exchange applicants may receive the published document or fee exemptions.",
  badgeText: "Spring 2027 non-degree",
  displayGroup: "Non-degree",
  displayGroupLabel: "Undergraduate Credit Program",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: undergraduate.fetchedAt,
  ...sourceFields(undergraduate),
  sourceFieldLineage: {
    nameEn: "official page title, fee category and study-duration options",
    ...(route.durationYears ? { durationYears: "official one-academic-year option" } : {}),
    fieldCategory: "official Undergraduate Credit Program context",
    subjectArea: "official fee category; no 2027 major list is asserted",
    teachingLanguage: "official page title",
    hskRequirement: "official Application Requirements",
    tuitionAmount: "official Tuition Fee table",
    tuitionCurrency: "official Tuition Fee table",
    tuitionPeriod: "official semester and academic-year fee rows",
    tuitionText: "official Tuition Fee and Application Procedures",
    applicationUrl: "official Application Procedures",
    applicationNote: "official Application Requirements, Procedures and Documents",
  },
}));

for (const duration of ["One Semester", "One Academic Year"] as const) {
  programs.push({
    slug: `beijing-normal-university-english-taught-graduate-credit-program-${duration === "One Semester" ? "one-semester" : "one-academic-year"}-spring-2027`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: `English-taught Graduate Credit Program (${duration})`,
    nameZh: `英文授课研究生学分项目（${duration === "One Semester" ? "一学期" : "一学年"}）`,
    degreeLevel: "Non-degree",
    ...(duration === "One Academic Year" ? { durationYears: 1 } : {}),
    fieldCategory: "Graduate credit study",
    subjectArea: "Education, Economics, Environmental Science, Philosophy and Law; the published 2026-2027 course list is reference-only and exact course availability is confirmed at registration.",
    teachingLanguage: "English",
    englishRequirement: "Applicants must meet the English requirement of the selected major. Non-native speakers must submit program-appropriate English proof or proof of current study in a fully English-taught degree; no universal standardized-test score is published.",
    tuitionText: "CNY 1,800 per credit; application fee CNY 450. Total tuition depends on the selected credit load and is not inferred.",
    applicationUrl: "https://international.bnu.edu.cn/",
    applicationNote: "Applicants must be non-Chinese citizens aged 18-45 and be current master's students or hold an equivalent qualification. Required materials include the online form, passport, final degree or enrollment proof, transcript, two teacher recommendations, English proof and a non-criminal-record certificate. Partner exchange applicants may receive the published document or fee exemptions.",
    badgeText: "Spring 2027 non-degree",
    displayGroup: "Non-degree",
    displayGroupLabel: "Graduate Credit Program",
    status: "active",
    verificationStatus: "verified",
    lastVerifiedAt: graduate.fetchedAt,
    ...sourceFields(graduate),
    sourceFieldLineage: {
      nameEn: "official Chinese page title and program introduction, translated",
      nameZh: "official page title and published duration option",
      ...(duration === "One Academic Year" ? { durationYears: "official one-academic-year option" } : {}),
      fieldCategory: "official graduate credit program context",
      subjectArea: "official program introduction and reference-only 2026-2027 course-list note",
      teachingLanguage: "official page title and program introduction",
      englishRequirement: "official Application Requirements and Application Materials",
      tuitionText: "official Tuition Fee section",
      applicationUrl: "official Application Procedures",
      applicationNote: "official Application Requirements, Procedures and Materials",
    },
  });
}

const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => {
  const source = program.slug.includes("undergraduate-credit") ? undergraduate : graduate;
  return {
    programSlug: program.slug,
    ...deadlineFields(source),
    applicationRound: `BNU Spring 2027 ${program.slug.includes("undergraduate-credit") ? "Chinese-taught Undergraduate" : "English-taught Graduate"} Credit Program`,
    sourceFieldLineage: {
      intakeTerm: "official Spring Semester label",
      intakeYear: "official March 2027 start",
      openDate: "official Application Period",
      deadlineDate: "official Application Period; Beijing end-of-day normalization",
      deadlineLabel: "official Application Period and supplementary-material deadline",
      applicationRound: "official 2027 page title",
      status: "deadline compared with capturedAt",
    },
  };
});

if (programs.length !== 6 || programIntakes.length !== 6) throw new Error("Wave 60 expected six BNU programs and six intakes.");
const generatedAt = [undergraduate.fetchedAt, graduate.fetchedAt].sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 60 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "One-semester routes retain their explicit human-readable duration but no numeric durationMonths because the pages publish no exact month or week count.",
    "The undergraduate page does not publish a 2027 major catalog, so the candidate emits only the two official tuition categories and does not relabel a 2026 major list.",
    "The English-taught graduate course list is explicitly reference-only; no individual course is promoted to a guaranteed 2027 offering.",
    "The graduate route charges per credit but publishes no required credit load, so total tuitionAmount remains absent.",
    "Named scholarship schemes have no route-specific 2027 package or deadline on these pages, so no scholarship entity is emitted.",
  ],
  notes: [
    "Wave 60 adds six newly discovered Spring 2027 BNU non-degree route variants and exact application windows.",
    "No Fall 2026 date visible on the same pages is migrated into the 2027 intake.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-60");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 60, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
