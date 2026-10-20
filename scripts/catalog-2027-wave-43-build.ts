import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/bnu-graduate-credit-spring-2027-direct-2026-10-20");
const sourceId = "bnu-graduate-credit-program-chinese-spring-2027";
const expectedSha256 = "39c6b05b87c8c178fe7e2decad69967eb567e1040a85c7686309f6d74c555a2c";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
const evidence = manifest.sources?.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!evidence) throw new Error("Missing locked BNU Spring 2027 graduate-credit evidence.");
const evidenceBytes = await readFile(resolve(runRoot, evidence.artifactPath));
if (createHash("sha256").update(evidenceBytes).digest("hex") !== expectedSha256) throw new Error("BNU Wave 43 evidence hash mismatch.");

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-09.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "beijing-normal-university");
const city = dependency.cities?.find((row) => row.slug === "beijing");
if (!school || !city) throw new Error("Wave 43 BNU or Beijing dependency is missing.");
const sourceFields = { sourceUrl: evidence.finalUrl ?? evidence.url, sourceLabel: evidence.label, sourceSha256: evidence.sha256, capturedAt: evidence.fetchedAt };
const hskRequirement = "For master's-level course study: School of International Chinese Language Education requires HSK 6 score 220 plus HSKK Advanced 65; School of Chinese Language and Literature requires HSK 5 score 210; other majors require HSK 5 score 195. For doctoral-level course study: the corresponding thresholds are HSK 6 score 240 plus HSKK Advanced 65, HSK 5 score 210, and HSK 5 score 195. Prior or current Chinese-medium degree study may exempt the certificate.";
const applicationNote = "Applicants must be non-Chinese citizens aged 18-45, be current master's students or above, and submit the online form, passport, final degree or enrollment certificate, transcript, Chinese-language proof, two recommendation letters and a non-criminal-record certificate. The application fee is CNY 450; partner exchange applicants may receive the published document or fee exemptions.";
type Route = { key: string; category: string; duration: "One Semester" | "One Academic Year"; tuition: number; durationYears?: number };
const routes: Route[] = [
  { key: "liberal-arts-one-semester", category: "Liberal Arts", duration: "One Semester", tuition: 14900 },
  { key: "liberal-arts-one-academic-year", category: "Liberal Arts", duration: "One Academic Year", tuition: 29000, durationYears: 1 },
  { key: "science-engineering-arts-physical-education-one-semester", category: "Science, Engineering, Arts and Physical Education", duration: "One Semester", tuition: 19000 },
  { key: "science-engineering-arts-physical-education-one-academic-year", category: "Science, Engineering, Arts and Physical Education", duration: "One Academic Year", tuition: 37200, durationYears: 1 },
];
const programs: CatalogSeedProgram[] = routes.map((route) => ({
  slug: `beijing-normal-university-chinese-taught-graduate-credit-program-${route.key}-spring-2027`,
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: `Chinese-taught Graduate Credit Program - ${route.category} (${route.duration})`,
  degreeLevel: "Non-degree",
  ...(route.durationYears ? { durationYears: route.durationYears } : {}),
  fieldCategory: "Graduate credit study",
  subjectArea: `${route.category} graduate-level credit study. The page links 2026 master's and doctoral major catalogs only for reference; no exact 2027 major is asserted.`,
  teachingLanguage: "Chinese",
  hskRequirement,
  tuitionAmount: route.tuition,
  tuitionCurrency: "CNY",
  tuitionPeriod: route.duration === "One Semester" ? "semester" : "academic year",
  tuitionText: `CNY ${route.tuition.toLocaleString("en-US")} for ${route.duration.toLowerCase()}; application fee CNY 450.`,
  scholarshipText: "The page names Beijing Government Scholarship, Chinese Government Scholarship, International Chinese Language Teachers Scholarship and China Studies Program, but does not publish a route-specific award package or 2027 deadline.",
  applicationUrl: "https://international.bnu.edu.cn/",
  applicationNote,
  hasScholarship: true,
  badgeText: "Spring 2027 non-degree",
  displayGroup: "Non-degree",
  displayGroupLabel: "Graduate Credit Program",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: evidence.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official page title, teaching medium, fee category and study-duration options",
    ...(route.durationYears ? { durationYears: "official one-academic-year option" } : {}),
    fieldCategory: "official Graduate Credit Program context",
    subjectArea: "official fee categories and explicit use of 2026 major catalogs as references",
    teachingLanguage: "official page title",
    hskRequirement: "official Application Requirements",
    tuitionAmount: "official Tuition Fee table",
    tuitionCurrency: "official Tuition Fee table",
    tuitionPeriod: "official semester and academic-year fee rows",
    tuitionText: "official Tuition Fee and Application Procedures",
    scholarshipText: "official Scholarships section",
    applicationUrl: "official Application Procedures",
    applicationNote: "official Application Requirements, Procedures and Documents",
  },
}));
const programIntakes: CatalogSeedProgramIntake[] = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-10T00:00:00.000Z",
  deadlineDate: "2026-12-15T15:59:59.000Z",
  deadlineLabel: "Apply October 10-December 15, 2026 for study starting in March 2027. If supplementary materials are requested, re-submit them by December 20, 2026. The deadline date is normalized to end of day in Beijing because no time is published.",
  applicationRound: "BNU Spring 2027 Chinese-taught Graduate Credit Program",
  status: "open",
  ...sourceFields,
  sourceFieldLineage: { intakeTerm: "official Spring Semester label", intakeYear: "official March 2027 start", openDate: "official Application Period", deadlineDate: "official Application Period; Beijing end-of-day normalization", deadlineLabel: "official Application Period and supplementary-material deadline", applicationRound: "official 2027 page title", status: "deadline compared with capturedAt" },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: evidence.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 43 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: evidence.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [{ id: evidence.id, label: evidence.label, url: evidence.url, fetchedAt: evidence.fetchedAt, sha256: evidence.sha256 }],
  unresolved: [
    "The 2027 page links 2026 master's and doctoral major catalogs. Those major rows are not relabelled as 2027; the candidate emits only the four fee-and-duration categories explicitly supported by the current page.",
    "The scholarship section names four schemes but publishes neither route-specific 2027 deadlines nor exact benefit packages, so no scholarship entity is emitted.",
    "The English-taught graduate-credit subpage still states 2026 and is not represented as a Spring 2027 route.",
  ],
  notes: ["No applicant, account, passport, payment or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-43");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 43, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
