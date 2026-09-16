import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  catalogManifest: resolve(root, "work/catalog-official/2026-09-14T05-33-43-651Z/manifest.json"),
  admissionsManifest: resolve(root, "work/catalog-official/scut-refresh-core-20260914/manifest.json"),
  dependency: resolve(root, "seeds/catalog.scut-school-scholarships-batch-01.approved.local.json"),
  candidate: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.scut-undergraduate-batch-01.review.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const decode = (value: string) => value
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/gi, "'").replace(/&quot;/gi, "\"")
  .replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const [catalogManifestText, admissionsManifestText, catalogManifest, admissionsManifest, dependency, state] = await Promise.all([
  readFile(paths.catalogManifest, "utf8"), readFile(paths.admissionsManifest, "utf8"), parse(paths.catalogManifest), parse(paths.admissionsManifest), parse(paths.dependency), parse(paths.state),
]);
const catalogSource = catalogManifest.sources?.find((row: any) => row.id === "scut-full-time-undergraduate-program-catalog-current");
const admissionsSource = admissionsManifest.sources?.find((row: any) => row.id === "scut-undergraduate-programs-2026");
if (catalogManifest.sources?.length !== 1 || catalogSource?.status !== 200 || catalogSource?.contentType !== "text/html" || catalogSource?.byteLength !== 56764 || catalogSource?.sha256 !== "86965d2628648bb8921bfc34ea129c3f1231f5b00f60a9a508bfad7f02b6fd6c") throw new Error("SCUT undergraduate catalog evidence changed.");
if (admissionsSource?.status !== 200 || admissionsSource?.contentType !== "text/html" || admissionsSource?.byteLength !== 48417 || admissionsSource?.sha256 !== "1fb35db69bbaf7aabc8eab632c93ad58d4973fcac706bcf0288a8f2a7297c76c") throw new Error("SCUT international undergraduate admissions evidence changed.");
const catalogHtml = await readFile(resolve(root, "work/catalog-official/2026-09-14T05-33-43-651Z", catalogSource.artifactPath), "utf8");
if (!catalogHtml.includes("Full-time Undergraduate Programs") || !catalogHtml.includes("School of Mechanical and Automotive Engineering") || !catalogHtml.includes("School of Medicine")) throw new Error("SCUT undergraduate catalog structure changed.");

type ExtractedProgram = { school: string; name: string; sourceOrdinal: number };
const extracted: ExtractedProgram[] = [];
const headingPattern = /<div><strong>(School of[^<]+)<\/strong>[^<]*<\/div>([\s\S]*?)(?=<div><strong>School of|<p><!--EndFragment-->)/g;
let headingMatch: RegExpExecArray | null;
while ((headingMatch = headingPattern.exec(catalogHtml))) {
  const school = decode(headingMatch[1]);
  for (const listItem of headingMatch[2].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const leaves = [...listItem[1].matchAll(/<div>([^<]*)<\/div>/g)].map((row) => decode(row[1])).filter(Boolean);
    const names = leaves.length > 1 ? leaves : [decode(listItem[1])].filter(Boolean);
    for (const name of names) extracted.push({ school, name, sourceOrdinal: extracted.length + 1 });
  }
}
const duplicateKeys = extracted.filter((row, index, rows) => rows.findIndex((candidate) => candidate.school === row.school && candidate.name === row.name) !== index);
const unique = extracted.filter((row, index, rows) => rows.findIndex((candidate) => candidate.school === row.school && candidate.name === row.name) === index);
if (new Set(extracted.map((row) => row.school)).size !== 25 || extracted.length !== 100 || unique.length !== 99 || duplicateKeys.length !== 1 || duplicateKeys[0].school !== "School of Materials Science and Engineering" || duplicateKeys[0].name !== "Polymer Materials & Engineering") throw new Error("SCUT undergraduate extraction count or duplicate identity changed.");

const city = dependency.cities?.find((row: any) => row.slug === "guangzhou");
const school = dependency.schools?.find((row: any) => row.slug === "south-china-university-of-technology");
if (!city || !school || school.verificationStatus !== "verified") throw new Error("Reviewed SCUT dependency rows are unavailable.");
const schoolSlug = school.slug;
const programs: CatalogSeedProgram[] = unique.map((row) => ({
  slug: `${schoolSlug}-undergraduate-${slugify(row.school)}-${slugify(row.name)}`,
  schoolSlug,
  citySlug: "guangzhou",
  nameEn: row.name,
  degreeLevel: "Undergraduate",
  fieldCategory: row.school,
  subjectArea: row.name,
  cscaRequirement: "The current SCUT international undergraduate admission requirements require a CSCA certificate; exact subjects are not published on the reviewed HTML pages.",
  applicationUrl: "https://www.scut.edu.cn/apply",
  applicationNote: `Listed under ${row.school} in SCUT's current full-time undergraduate catalog. Teaching medium and language threshold are route-specific. The general deadline is June 30 each year, but some majors may use a different deadline set by the professional school.`,
  badgeText: "Official SCUT undergraduate catalog",
  displayGroup: "undergraduate",
  displayGroupLabel: "Undergraduate programs",
  status: "draft",
  sourceUrl: catalogSource.finalUrl,
  sourceLabel: catalogSource.label,
  sourceSha256: catalogSource.sha256,
  capturedAt: catalogSource.fetchedAt,
  sourceFieldLineage: {
    nameEn: `Admission > Undergraduate > Full-time Undergraduate Programs; ${row.school}; source item ${row.sourceOrdinal}`,
    degreeLevel: "official page title and admissions breadcrumb",
    fieldCategory: `official catalog heading ${row.school}`,
    cscaRequirement: "current international undergraduate admissions page, Admission Requirements item 3",
    applicationUrl: "current international undergraduate admissions page, Application Procedure",
    applicationNote: "official catalog grouping plus current international undergraduate Teaching Language and Application Deadline sections",
  },
}));
if (new Set(programs.map((row) => row.slug)).size !== 99) throw new Error("SCUT undergraduate route slugs are not unique.");
const programIntakes = programs.map((program) => ({
  programSlug: program.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineLabel: "June 30 each year; some majors may have a different professional-school deadline",
  applicationRound: "Current international undergraduate admissions",
  status: "closed" as const,
  sourceUrl: admissionsSource.finalUrl,
  sourceLabel: admissionsSource.label,
  sourceSha256: admissionsSource.sha256,
  capturedAt: admissionsSource.fetchedAt,
  sourceFieldLineage: { intakeTerm: "Study Starting Time: September of each year", deadlineLabel: "Application Deadline section", applicationRound: "international undergraduate page title and scope" },
}));
const generatedAt = [catalogSource.fetchedAt, admissionsSource.fetchedAt].sort().at(-1);
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`Invalid SCUT undergraduate candidate: ${validation.errors.join(" ")}`);
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;

const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:scut-undergraduate-review" });
let baseline: any;
try {
  const schoolRows = await pool.query("select id,status,verification_status from schools where slug=$1", [schoolSlug]);
  const cityRows = await pool.query("select id,status from cities where slug='guangzhou'");
  const counts = await pool.query("select count(*)::int total_count,count(*) filter(where status='active')::int active_count,count(*) filter(where status='active' and verification_status='verified')::int verified_count from programs where school_id=$1", [schoolRows.rows[0]?.id]);
  const slugConflicts = await pool.query("select slug,status,verification_status from programs where slug=any($1::text[])", [programs.map((row) => row.slug)]);
  const existing = await pool.query("select slug,name_en,degree_level,field_category,status from programs where school_id=$1", [schoolRows.rows[0]?.id]);
  const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const semanticConflicts = programs.flatMap((program) => existing.rows.filter((row: any) => row.degree_level === program.degreeLevel && normalize(row.name_en) === normalize(program.nameEn) && normalize(row.field_category) === normalize(program.fieldCategory)).map((row: any) => ({ candidateSlug: program.slug, existingSlug: row.slug, existingStatus: row.status })));
  const scholarships = await pool.query("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count from scholarships where school_id=$1 and status='active'", [schoolRows.rows[0]?.id]);
  baseline = { school: schoolRows.rows, city: cityRows.rows, counts: counts.rows[0], slugConflicts: slugConflicts.rows, semanticConflicts, scholarships: scholarships.rows[0] };
} finally { await pool.end(); }
if (baseline.school.length !== 1 || baseline.school[0].status !== "active" || baseline.school[0].verification_status !== "verified" || baseline.city.length !== 1 || baseline.city[0].status !== "active" || baseline.counts.total_count !== 0 || baseline.slugConflicts.length !== 0 || baseline.semanticConflicts.length !== 0 || baseline.scholarships.active_count !== 8 || baseline.scholarships.verified_count !== 8) throw new Error(`SCUT safe-new baseline changed: ${JSON.stringify(baseline)}`);

const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, sourceSchoolCount: 25, sourceItemCount: 100, exactDuplicateExcludedCount: 1, newProgramRouteCount: 99, newProgramIntakeCount: 99, overwriteCount: 0, archiveCount: 0, newScholarshipCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: [catalogSource, admissionsSource].map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType, byteLength: row.byteLength })),
  sourceManifestSha256: { catalog: sha(catalogManifestText), admissions: sha(admissionsManifestText) },
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts only 99 new non-conflicting official undergraduate program records and their 2026 intake rows. It overwrites, archives and deletes nothing; the reviewed Guangzhou and SCUT rows are preserved dependencies." },
  sourceReview: { result: "pass", note: "The exact official SCUT catalog page sits under Admission > Undergraduate > Full-time Undergraduate Programs and lists 100 entries across 25 schools. One exact same-school duplicate is excluded, leaving 99 unique records. The current international undergraduate page explicitly applies to international students and supplies admissions context." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], excludedExactDuplicate: duplicateKeys, programSlugConflicts: 0, semanticConflicts: 0, databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: 0, verifiedProgramCount: 0, activeScholarshipCount: 8, verifiedScholarshipCount: 8 } },
  unresolvedFields: ["The reviewed HTML does not map a specific teaching medium to each catalog entry, so teachingLanguage, HSK and English-score fields are absent.", "The reviewed HTML does not publish route-level duration or tuition, so those fields are absent.", "The exact CSCA subject allocation is unresolved because the official prospectus PDFs exceed the collector's 15 MiB cap.", "The general June 30 deadline has explicit major-level exceptions, so no exact deadlineDate is asserted."],
  failedClosedSources: [
    { sourceId: "scut-prospectus-en-pdf-2026", result: "declared file size exceeds 15 MiB", action: "not downloaded; size cap was not bypassed" },
    { sourceId: "scut-prospectus-zh-pdf-2026", result: "declared file size exceeds 15 MiB", action: "not downloaded; size cap was not bypassed" },
  ],
  sensitiveDataCheck: { result: "pass", scope: "publication candidate", note: "Public institution, program and admissions-policy fields only. Applicant, account, passport, payment, bank, staff-name, personal-contact and application-record data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
  writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash }, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, reviewHash, sourceSchools: 25, sourceItems: 100, exactDuplicateExcluded: duplicateKeys, newPrograms: 99, candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256, candidatePath: paths.candidate, reviewPath: paths.review }, null, 2));
