import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";

const root = process.cwd();
const paths = {
  dependency: resolve(root, "seeds/catalog.pku-school-program-batch-01.approved.local.json"),
  candidate: resolve(root, "seeds/catalog.pku-graduate-core-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.pku-graduate-core-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.pku-graduate-core-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const manifestIds = [
  "pku-graduate-admissions-guide-2026",
  "pku-graduate-tuition-2026",
  "pku-master-programs-chinese-2026",
  "pku-master-programs-english-2026",
  "pku-doctoral-programs-chinese-2026",
  "pku-doctoral-programs-english-2026",
] as const;
const evidence = new Map<string, any>();
for (const id of manifestIds) {
  const manifestPath = resolve(root, `work/catalog-official/pku-graduate-core-20260914/${id}/manifest.json`);
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const item = manifest.sources?.[0];
  if (manifest.sources?.length !== 1 || item?.id !== id || item?.status !== 200 || !/^[a-f0-9]{64}$/.test(item?.sha256 ?? "")) throw new Error(`Invalid PKU official evidence: ${id}`);
  evidence.set(id, { ...item, manifestSha256: sha(manifestText) });
}
const guide = evidence.get("pku-graduate-admissions-guide-2026")!;
const tuition = evidence.get("pku-graduate-tuition-2026")!;
const dependency = await parse(paths.dependency) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "beijing");
const school = dependency.schools?.find((row) => row.slug === "peking-university");
if (!city || !school) throw new Error("Reviewed Peking University dependency rows are unavailable.");

type Spec = { row: number; department: string; major: string; degree: "Master" | "PhD"; years?: number; durationText: string; mode: string; language: string; tuition?: number; tuitionText: string; route?: string };
const specs: Spec[] = [
  { row: 5, department: "School of Chinese as a Second Language", major: "Master of Teaching Chinese to Speakers of Other Languages", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 78000, tuitionText: "RMB 78,000 total" },
  { row: 6, department: "School of Chinese as a Second Language", major: "School Curriculum and Teaching", degree: "PhD", years: 4, durationText: "4 years", mode: "Part-time", language: "Chinese", tuition: 150000, tuitionText: "RMB 150,000 total" },
  { row: 7, department: "Law School", major: "Civil and Commercial Law", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 160000, tuitionText: "RMB 160,000 total", route: "LLM program" },
  { row: 8, department: "Law School", major: "Law", degree: "PhD", years: 4, durationText: "4 years", mode: "Part-time", language: "Chinese", tuitionText: "TBA; to be announced in another notice" },
  { row: 9, department: "Guanghua School of Management", major: "Master of Finance", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese and English", tuition: 128000, tuitionText: "RMB 128,000 total" },
  { row: 10, department: "Guanghua School of Management", major: "Auditing", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 128000, tuitionText: "RMB 128,000 total" },
  { row: 11, department: "Guanghua School of Management", major: "Master of Professional Accounting", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 158000, tuitionText: "RMB 158,000 total" },
  { row: 12, department: "Guanghua School of Management", major: "Master of Business Administration", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 188000, tuitionText: "RMB 188,000 total", route: "Global MBA" },
  { row: 13, department: "Guanghua School of Management", major: "Master of Business Administration", degree: "Master", years: 2, durationText: "2 years", mode: "Part-time", language: "Chinese", tuition: 428000, tuitionText: "RMB 428,000 total", route: "Part-time MBA" },
  { row: 14, department: "Guanghua School of Management", major: "Master of Business Administration", degree: "Master", years: 2, durationText: "2 years", mode: "Part-time", language: "Chinese", tuition: 468000, tuitionText: "RMB 468,000 total", route: "STEM MBA" },
  { row: 15, department: "Guanghua School of Management", major: "Master of Business Administration", degree: "Master", years: 2, durationText: "2 years", mode: "Part-time", language: "Chinese and English", tuition: 351000, tuitionText: "RMB 351,000 for the PKU portion", route: "Cornell-PKU Dual Degree MMH-MBA" },
  { row: 16, department: "Guanghua School of Management", major: "Executive Master of Business Administration", degree: "Master", years: 2, durationText: "2 years", mode: "Part-time", language: "Chinese", tuition: 828000, tuitionText: "RMB 828,000 total", route: "EMBA" },
  { row: 17, department: "Guanghua School of Management", major: "Executive Master of Business Administration (International Business and Management)", degree: "Master", years: 2, durationText: "2 years", mode: "Part-time", language: "English", tuition: 728000, tuitionText: "RMB 728,000 for the PKU portion", route: "Peking University-Northwestern University joint program" },
  { row: 18, department: "School of International Studies", major: "International Relations", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 95000, tuitionText: "RMB 95,000 for the PKU portion", route: "PKU-LSE Double Master's Degree" },
  { row: 19, department: "School of International Studies", major: "International Relations", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 95000, tuitionText: "RMB 95,000 for the PKU portion", route: "PKU-Sciences Po Dual Master's Degree" },
  { row: 20, department: "School of International Studies", major: "International Relations", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 150000, tuitionText: "RMB 150,000 total", route: "MIR" },
  { row: 21, department: "National School of Development", major: "Executive Master of Business Administration", degree: "Master", years: 2, durationText: "2 years", mode: "Part-time", language: "Chinese", tuition: 828000, tuitionText: "RMB 828,000 total", route: "EMBA" },
  { row: 22, department: "College of Environmental Sciences and Engineering", major: "Environment Management", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 80000, tuitionText: "RMB 80,000 for the PKU portion", route: "PKU-LSE Double Master's Degree" },
  { row: 23, department: "School of Computer Science", major: "Computer Science and Technology", degree: "Master", years: 3, durationText: "3 years", mode: "Full-time", language: "English", tuition: 150000, tuitionText: "RMB 150,000 total" },
  { row: 24, department: "School of Computer Science", major: "Computer Science and Technology", degree: "PhD", durationText: "4-5 years", mode: "Full-time", language: "English", tuitionText: "RMB 200,000-250,000 total; five-year program RMB 250,000" },
  { row: 25, department: "School of Economics", major: "Master of Finance", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 99000, tuitionText: "RMB 99,000 total" },
  { row: 26, department: "School of Economics", major: "Master of Taxation", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 99000, tuitionText: "RMB 99,000 total" },
  { row: 27, department: "School of Economics", major: "Master of International Business", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 99000, tuitionText: "RMB 99,000 total" },
  { row: 28, department: "School of Economics", major: "Master of Insurance", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 99000, tuitionText: "RMB 99,000 total" },
  { row: 29, department: "School of Economics", major: "Digital Economy", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 128000, tuitionText: "RMB 128,000 total" },
  { row: 30, department: "School of Archaeology and Museology", major: "Master of Cultural Heritage and Museology", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 80000, tuitionText: "RMB 80,000 total" },
  { row: 31, department: "School of Software and Microelectronics", major: "Electronic and Information Engineering", degree: "PhD", durationText: "4-5 years", mode: "Full-time", language: "Chinese", tuitionText: "RMB 180,000-225,000 total; five-year program RMB 225,000" },
  { row: 32, department: "Department of Sociology", major: "Social Policy", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 98000, tuitionText: "RMB 98,000 total" },
  { row: 33, department: "School of Mathematical Sciences", major: "Master of Finance", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 128000, tuitionText: "RMB 128,000 total" },
  { row: 34, department: "School of Mathematical Sciences", major: "Big Data", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 200000, tuitionText: "RMB 200,000 total" },
  { row: 35, department: "School of Foreign Languages", major: "Japanese Interpretation", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 80000, tuitionText: "RMB 80,000 total" },
  { row: 36, department: "School of Psychological and Cognitive Sciences", major: "Master of Applied Psychology", degree: "Master", years: 3, durationText: "3 years", mode: "Part-time", language: "Chinese", tuition: 198000, tuitionText: "RMB 198,000 total" },
  { row: 37, department: "School of Psychological and Cognitive Sciences", major: "Applied Psychology", degree: "PhD", years: 4, durationText: "4 years", mode: "Part-time", language: "Chinese", tuitionText: "TBA; to be announced in another notice" },
  { row: 38, department: "School of New Media", major: "Master of Journalism and Communication", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 80000, tuitionText: "RMB 80,000 total" },
  { row: 39, department: "School of New Media", major: "Master of Journalism and Communication", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 160000, tuitionText: "RMB 160,000 total" },
  { row: 40, department: "School of Journalism and Communication", major: "Master of Journalism and Communication", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 80000, tuitionText: "RMB 80,000 total" },
  { row: 41, department: "Department of Information Management", major: "Publishing", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 80000, tuitionText: "RMB 80,000 total" },
  { row: 42, department: "Department of Information Management", major: "Information Science", degree: "PhD", years: 4, durationText: "4 years", mode: "Full-time", language: "English", tuitionText: "TBA; to be announced in another notice" },
  { row: 43, department: "School of Arts", major: "Drama Film and Television", degree: "Master", years: 3, durationText: "3 years", mode: "Part-time", language: "Chinese", tuition: 100000, tuitionText: "RMB 100,000 total (40,000 + 40,000 + 20,000 by year)" },
  { row: 44, department: "School of Arts", major: "Art Theory", degree: "PhD", years: 4, durationText: "4 years", mode: "Full-time", language: "English", tuition: 200000, tuitionText: "RMB 200,000 total" },
  { row: 45, department: "School of Government", major: "Public Administration in Comparative Public Policy and International Cooperation", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "Chinese", tuition: 360000, tuitionText: "RMB 360,000 total", route: "IMPA" },
  { row: 46, department: "School of Government", major: "Public Administration in Comparative Public Policy and International Cooperation", degree: "Master", years: 2, durationText: "2 years", mode: "Full-time", language: "English", tuition: 380000, tuitionText: "RMB 380,000 total", route: "IMPA" },
];
if (specs.length !== 42 || specs.some((spec, index) => spec.row !== index + 5)) throw new Error("PKU tuition row coverage changed.");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs: CatalogSeedProgram[] = specs.map((spec) => {
  const identity = slugify(`${spec.department}-${spec.major}-${spec.degree}-${spec.language}-${spec.mode}-${spec.route ?? "standard"}`);
  const slug = `peking-university-graduate-${identity.length > 145 ? `${identity.slice(0, 137).replace(/-+$/, "")}-${spec.row}` : identity}`;
  const languageNote = spec.language.includes("English")
    ? "English-taught routes: TOEFL iBT 100+, GRE 315+, or other accepted proof; the specific program may publish additional requirements."
    : "Chinese-taught routes: HSK 6 (science 200+ or humanities 210+) with writing 65+; HSK 7-9 is also accepted.";
  return {
    slug, schoolSlug: "peking-university", citySlug: "beijing", nameEn: spec.route ? `${spec.major} - ${spec.route}` : spec.major,
    degreeLevel: spec.degree, ...(spec.years ? { durationYears: spec.years } : {}), fieldCategory: spec.department, subjectArea: spec.major,
    teachingLanguage: spec.language, ...(spec.language.includes("English") ? { englishRequirement: languageNote } : { hskRequirement: languageNote }),
    ...(spec.tuition ? { tuitionAmount: spec.tuition } : {}), tuitionCurrency: "RMB", tuitionPeriod: "total program", tuitionText: spec.tuitionText,
    scholarshipText: "New international graduate students may apply for Chinese Government, Beijing Government, and Peking University scholarships; award decisions are separate from admission.", hasScholarship: true,
    applicationUrl: guide.finalUrl, applicationNote: `${spec.department}; ${spec.mode}; ${spec.durationText}. Official tuition schedule row ${spec.row}.${spec.route ? ` Route note: ${spec.route}.` : ""}`,
    badgeText: "Official 2026 graduate route", displayTuition: spec.tuitionText, displayGroup: spec.degree.toLowerCase(), displayGroupLabel: `${spec.degree} programs`, status: "draft",
    sourceUrl: tuition.finalUrl, sourceLabel: tuition.label, sourceSha256: tuition.sha256, capturedAt: tuition.fetchedAt,
    sourceFieldLineage: { nameEn: `Tuition schedule row ${spec.row}, Major/Program and Remarks`, degreeLevel: `Tuition schedule row ${spec.row}, Type`, fieldCategory: `Tuition schedule row ${spec.row}, Departments/Schools`, teachingLanguage: `Tuition schedule row ${spec.row}, Language of Instruction`, tuitionText: `Tuition schedule row ${spec.row}, Tuition Fee in Total and Remarks`, applicationNote: `Tuition schedule row ${spec.row}, Length/Method/Remarks`, scholarshipText: "2026 graduate admissions guide, Scholarships" },
  };
});
if (new Set(programs.map((row) => row.slug)).size !== 42) throw new Error("PKU graduate slugs are not unique.");
const programIntakes = programs.map((program) => {
  const englishSpecific = String(program.teachingLanguage).includes("English");
  return {
    programSlug: program.slug, intakeTerm: "Fall", intakeYear: 2026,
    ...(englishSpecific ? {} : { openDate: "2025-10-20T00:00:00.000Z", deadlineDate: "2025-12-23T15:59:59.000Z" }),
    deadlineLabel: englishSpecific ? "Program-specific deadline; consult the respective 2026 English-program guide" : "December 23, 2025 (Beijing time)",
    applicationRound: "2026 international graduate admission", status: "closed" as const,
    sourceUrl: guide.finalUrl, sourceLabel: guide.label, sourceSha256: guide.sha256, capturedAt: guide.fetchedAt,
    sourceFieldLineage: { deadlineLabel: englishSpecific ? "Application Period note for English-taught programs" : "Application Period", applicationRound: "official page title and enrollment section" },
  };
});
const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Invalid PKU graduate candidate: ${validation.errors.join(" ")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const state = await parse(paths.state);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:pku-graduate-core-review" });
let baseline: any;
try {
  const schoolRows = await pool.query("select id,status,verification_status from schools where slug='peking-university'");
  const cityRows = await pool.query("select id,status from cities where slug='beijing'");
  const counts = await pool.query("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count from programs where school_id=$1 and status='active'", [schoolRows.rows[0]?.id]);
  const slugRows = await pool.query("select slug from programs where slug=any($1::text[])", [programs.map((row) => row.slug)]);
  const semanticRows = await pool.query("select slug,name_en,degree_level,teaching_language from programs where school_id=$1 and status='active' and lower(name_en)=any($2::text[])", [schoolRows.rows[0]?.id, programs.map((row) => row.nameEn.toLowerCase())]);
  baseline = { school: schoolRows.rows, city: cityRows.rows, counts: counts.rows[0], slugConflicts: slugRows.rows, semanticConflicts: semanticRows.rows };
} finally { await pool.end(); }
if (baseline.school.length !== 1 || baseline.school[0].status !== "active" || baseline.school[0].verification_status !== "verified" || baseline.city.length !== 1 || baseline.city[0].status !== "active" || baseline.counts.active_count !== 23 || baseline.counts.verified_count !== 23 || baseline.slugConflicts.length !== 0 || baseline.semanticConflicts.length !== 0) throw new Error(`PKU graduate baseline changed: ${JSON.stringify(baseline)}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt,
  scope: { schoolSlug: "peking-university", dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramRouteCount: 42, newProgramIntakeCount: 42, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: [...evidence.values()].map((row) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, manifestSha256: row.manifestSha256 })).sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
  visualReview: { result: "pass", pdfPagesReviewed: 4, includedRows: "5-46", excludedRows: ["1-4 generic discipline placeholders", "47 Shenzhen Graduate School link-only row"], note: "All four pages of the official 2026 tuition schedule were rendered and visually checked against the extracted table." },
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "The batch inserts 42 new non-conflicting official graduate program routes and 42 intakes. It overwrites, archives and deletes nothing; Beijing and Peking University are preserved dependencies." },
  sourceReview: { result: "pass", note: "Six exact registered official PKU 2026 sources were captured. Program identity, degree, duration, mode, language and tuition come from the four-page official tuition schedule; shared admissions fields come from the official graduate guide." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], programSlugConflicts: 0, semanticConflicts: 0, databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: 23, verifiedProgramCount: 23 } },
  unresolvedFields: ["Tuition remains TBA where the official schedule says TBA.", "English-taught deadlines remain program-specific where the general guide explicitly defers to individual program guides.", "The full department-level 2026 graduate catalogue remains a later batch; this batch includes only the 42 specific program rows in the official tuition schedule."],
  sensitiveDataCheck: { result: "pass", scope: "publication candidate", note: "Public institutional, program, admissions and tuition data only. Applicant, account, payment, bank, staff-name and personal-contact fields are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash };
await writeFile(paths.candidate, candidateText, "utf8");
await writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, summary: validation.summary, baseline: reviewBase.reconciliation.databaseBaseline, candidatePath: paths.candidate, reviewPath: paths.review }, null, 2));
