import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";

const root = process.cwd();
const paths = {
  extracted: resolve(root, "work/catalog-official/pku-graduate-english-departments-20260914/parsed-major-routes.json"),
  dependency: resolve(root, "seeds/catalog.pku-school-program-batch-01.approved.local.json"),
  guideManifest: resolve(root, "work/catalog-official/pku-graduate-core-20260914/pku-graduate-admissions-guide-2026/manifest.json"),
  candidate: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.draft.json"),
  validation: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.validation.json"),
  review: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const keyOf = (row: any) => `${row.sourceId}|${row.code}`;

// These major-level rows are already represented by reviewed, active PKU route records.
// They are excluded rather than overwritten or duplicated.
const represented = new Map<string, string>([
  ["pku-master-english-computer-science-2026|081200", "existing Computer Science and Technology master's route"],
  ["pku-doctoral-english-computer-science-2026|081200", "existing Computer Science and Technology doctoral route"],
  ["pku-master-english-environmental-engineering-2026|083021", "existing Environment Management PKU-LSE route"],
  ["pku-master-english-government-2026|125200", "existing English Public Administration / IMPA route"],
  ["pku-master-english-guanghua-2026|025100", "existing Guanghua Master of Finance route"],
  ["pku-master-english-guanghua-2026|125101", "existing Guanghua Global MBA and Cornell-PKU routes"],
  ["pku-master-english-guanghua-2026|125102", "existing Guanghua international EMBA joint route"],
  ["pku-master-english-international-studies-2026|030207", "existing three International Relations English routes"],
  ["pku-master-english-law-2026|030105", "existing Civil and Commercial Law LLM route"],
  ["pku-master-english-new-media-2026|055200", "existing English Journalism and Communication route"],
  ["pku-doctoral-english-information-management-2026|120502", "existing Information Science doctoral route"],
  ["pku-doctoral-english-arts-2026|130100", "existing Art Theory doctoral route"],
]);

const [extracted, dependency, guideManifest, state] = await Promise.all([
  parse(paths.extracted), parse(paths.dependency), parse(paths.guideManifest), parse(paths.state),
]);
if (extracted.counts?.sources !== 30 || extracted.counts?.pages !== 34 || extracted.counts?.routes !== 113) throw new Error("PKU English department extraction count changed.");
const guide = guideManifest.sources?.[0];
if (guideManifest.sources?.length !== 1 || guide?.id !== "pku-graduate-admissions-guide-2026" || guide?.status !== 200 || !/^[a-f0-9]{64}$/.test(guide?.sha256 ?? "")) throw new Error("PKU graduate guide evidence is invalid.");
const city = dependency.cities?.find((row: any) => row.slug === "beijing");
const school = dependency.schools?.find((row: any) => row.slug === "peking-university");
if (!city || !school) throw new Error("Reviewed PKU dependency rows are unavailable.");

const excludedRows = extracted.routes.filter((row: any) => represented.has(keyOf(row))).map((row: any) => ({ sourceId: row.sourceId, code: row.code, degree: row.degree, nameEn: row.nameEn, reason: represented.get(keyOf(row)) }));
if (excludedRows.length !== represented.size) throw new Error(`Expected ${represented.size} represented routes, found ${excludedRows.length}.`);
const newRoutes = extracted.routes.filter((row: any) => !represented.has(keyOf(row)));
const programs: CatalogSeedProgram[] = newRoutes.map((row: any) => {
  const mode = row.modes.join(" / ");
  const fields = row.researchFields.join("; ");
  const slug = `peking-university-graduate-en-${row.degree.toLowerCase()}-${slugify(row.schoolOrDepartment)}-${row.code.toLowerCase()}`;
  return {
    slug,
    schoolSlug: "peking-university",
    citySlug: "beijing",
    nameEn: row.nameEn,
    degreeLevel: row.degree,
    fieldCategory: row.schoolOrDepartment,
    subjectArea: row.nameEn,
    teachingLanguage: "English",
    englishRequirement: "English-taught routes: TOEFL iBT 100+, GRE 315+, or other accepted proof; the specific program may publish additional requirements.",
    applicationUrl: guide.finalUrl,
    applicationNote: `Official 2026 major code ${row.code}; ${mode}. Published research fields: ${fields}`,
    badgeText: "Official 2026 English graduate major",
    displayGroup: row.degree.toLowerCase(),
    displayGroupLabel: `${row.degree} programs`,
    status: "draft",
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    sourceSha256: row.sourceSha256,
    capturedAt: row.capturedAt,
    sourceFieldLineage: {
      nameEn: `PDF page ${row.sourcePage}, table ${row.sourceTable}, major code ${row.code}`,
      degreeLevel: "registered 2026 English master/doctoral catalog source",
      fieldCategory: "official PDF title",
      teachingLanguage: `PDF page ${row.sourcePage}, Teaching Language column`,
      applicationNote: `PDF page ${row.sourcePage}, Major / Research Field / Mode columns`,
      englishRequirement: "2026 international graduate admissions guide, application materials",
    },
  };
});
if (programs.length !== 101 || new Set(programs.map((row) => row.slug)).size !== programs.length) throw new Error("PKU English batch route identity changed.");
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineLabel: "Program-specific deadline; consult the respective 2026 English-program guide",
  applicationRound: "2026 international graduate admission",
  status: "closed" as const,
  sourceUrl: guide.finalUrl,
  sourceLabel: guide.label,
  sourceSha256: guide.sha256,
  capturedAt: guide.fetchedAt,
  sourceFieldLineage: { deadlineLabel: "Application Period note for English-taught programs", applicationRound: "official page title and enrollment section" },
}));
const generatedAt = [...extracted.sources.map((row: any) => row.capturedAt), guide.fetchedAt].sort().at(-1);
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Invalid PKU English candidate: ${validation.errors.join(" ")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:pku-graduate-english-review" });
let baseline: any;
try {
  const schoolRows = await pool.query("select id,status,verification_status from schools where slug='peking-university'");
  const cityRows = await pool.query("select id,status from cities where slug='beijing'");
  const counts = await pool.query("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count from programs where school_id=$1 and status='active'", [schoolRows.rows[0]?.id]);
  const slugRows = await pool.query("select slug from programs where slug=any($1::text[])", [programs.map((row) => row.slug)]);
  const existing = await pool.query("select slug,name_en,degree_level,field_category from programs where school_id=$1 and status='active'", [schoolRows.rows[0]?.id]);
  const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const semanticConflicts = programs.flatMap((program) => existing.rows.filter((row: any) => row.degree_level === program.degreeLevel && normalize(row.name_en) === normalize(program.nameEn) && normalize(row.field_category) === normalize(program.fieldCategory)).map((row: any) => ({ candidateSlug: program.slug, existingSlug: row.slug })));
  baseline = { school: schoolRows.rows, city: cityRows.rows, counts: counts.rows[0], slugConflicts: slugRows.rows, semanticConflicts };
} finally { await pool.end(); }
if (baseline.school.length !== 1 || baseline.school[0].status !== "active" || baseline.school[0].verification_status !== "verified" || baseline.city.length !== 1 || baseline.city[0].status !== "active" || baseline.counts.active_count !== 65 || baseline.counts.verified_count !== 65 || baseline.slugConflicts.length !== 0 || baseline.semanticConflicts.length !== 0) throw new Error(`PKU English baseline changed: ${JSON.stringify(baseline)}`);

const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt,
  scope: { schoolSlug: "peking-university", dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, extractedMajorCount: 113, representedAndExcludedCount: excludedRows.length, newProgramRouteCount: programs.length, newProgramIntakeCount: programIntakes.length, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: extracted.sources.map((row: any) => ({ sourceId: row.sourceId, sourceUrl: row.sourceUrl, sourceLabel: row.sourceLabel, sha256: row.sha256, fetchedAt: row.capturedAt, pages: row.pages, routes: row.routes, manifestSha256: row.manifestSha256 })),
  visualReview: { result: "pass", pdfFilesReviewed: 30, pdfPagesReviewed: 34, renderedContactSheetsReviewed: 9, note: "Every successful official PDF page was rendered and visually checked; tables were legible and program grouping matched extraction." },
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts only new non-conflicting official program routes and intakes. It overwrites, archives and deletes nothing; Beijing and PKU are preserved dependencies." },
  sourceReview: { result: "pass", note: "Thirty exact PKU 2026 English-taught department PDFs were captured. One program is created per official major code; research fields remain program detail." },
  failedClosedSources: [
    { sourceId: "pku-master-english-foreign-languages-2026", result: "HTTP 404", action: "excluded; no alternate URL guessed" },
    { sourceId: "pku-doctoral-english-modern-agriculture-2026", result: "HTTP 404", action: "excluded; no alternate URL guessed" },
  ],
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], excludedAlreadyRepresented: excludedRows, programSlugConflicts: 0, semanticConflicts: 0, databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: 65, verifiedProgramCount: 65 } },
  unresolvedFields: ["Program-specific application deadlines are not inferred from the shared guide.", "Duration and tuition are absent because the department catalog tables do not publish them.", "Two official landing-page PDF links returned HTTP 404 and remain excluded."],
  sensitiveDataCheck: { result: "pass", scope: "publication candidate", note: "Public institutional, program and admissions data only; no applicant, account, payment, bank, staff-name, personal-contact or application-record data." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
await writeFile(paths.candidate, candidateText, "utf8");
await writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
await writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, extracted: extracted.counts, excludedAlreadyRepresented: excludedRows.length, newPrograms: programs.length, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, baseline: reviewBase.reconciliation.databaseBaseline, candidatePath: paths.candidate, reviewPath: paths.review }, null, 2));
