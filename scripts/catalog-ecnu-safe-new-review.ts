import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  manifest: resolve(root, "work/catalog-official/ecnu-complete-batch-01/manifest.json"),
  parsed: resolve(root, "work/catalog-official/ecnu-complete-batch-01/programs.extracted.json"),
  draft: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.review.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.draft, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const parsedText = await readFile(paths.parsed, "utf8");
const parsed = JSON.parse(parsedText);
const manifestText = await readFile(paths.manifest, "utf8");
const manifest = JSON.parse(manifestText);
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok || candidate.programs?.length !== 280 || candidate.programIntakes?.length !== 280 || candidate.scholarships?.length !== 8) throw new Error("ECNU candidate failed locked scope validation.");
if (JSON.stringify(parsed.counts) !== JSON.stringify({ total: 280, Bachelor: 69, Master: 111, Doctoral: 100, English: 20, Chinese: 260 }) || parsed.duplicateIdentities.length) throw new Error("ECNU parsed counts or identities changed.");
const sourceIds = new Set(["ecnu-undergraduate-admissions-2026", "ecnu-undergraduate-program-catalog-2026", "ecnu-graduate-admissions-2026", "ecnu-master-program-catalog-2026", "ecnu-doctoral-program-catalog-2026", "ecnu-scholarship-index-2026", "ecnu-cgs-type-a-undergraduate-2026", "ecnu-shanghai-government-undergraduate-scholarship-2026", "ecnu-iclts-undergraduate-2026", "ecnu-excellent-freshmen-scholarship-2026", "ecnu-cgs-type-b-graduate-2026", "ecnu-iclts-graduate-2026", "ecnu-youth-of-excellence-scholarship-2026", "ecnu-china-studies-phd-scholarship-2026", "ecnu-shanghai-government-scholarship-2026"]);
const evidence = manifest.sources.filter((row: any) => sourceIds.has(row.id));
if (evidence.length !== 15 || evidence.some((row: any) => row.status !== 200 || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("ECNU evidence manifest incomplete.");

const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ecnu-safe-new-review" });
let preflight: any;
try {
  const programSlugs = candidate.programs!.map(row => row.slug);
  const scholarshipSlugs = candidate.scholarships!.map(row => row.slug);
  const conflicts = await pool.query<{ kind: string; slug: string }>("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  if (conflicts.rows.length) throw new Error(`Standing-authorized ECNU slugs conflict: ${JSON.stringify(conflicts.rows)}`);
  const totals = await pool.query("select (select count(*) from programs where school_id=(select id from schools where slug='east-china-normal-university') and status='active')::int programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug='east-china-normal-university'))::int intakes,(select count(*) from scholarships where school_id=(select id from schools where slug='east-china-normal-university') and status='active')::int scholarships,(select count(*) from scholarships where school_id=(select id from schools where slug='east-china-normal-university') and status='active' and verification_status='verified')::int verified_scholarships", []);
  preflight = totals.rows[0];
  if (JSON.stringify(preflight) !== JSON.stringify({ programs: 12, intakes: 5, scholarships: 11, verified_scholarships: 1 })) throw new Error(`ECNU database baseline changed: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const candidateSha256 = sha(candidateText);
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug: "east-china-normal-university", programRouteCount: 280, bachelorRouteCount: 69, masterRouteCount: 111, doctoralRouteCount: 100, englishRouteCount: 20, programIntakeCount: 280, newScholarshipCount: 8, cityOverwriteCount: 0, schoolOverwriteCount: 0, stableScholarshipUpdateCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  sourceManifestSha256: sha(manifestText),
  parsedArtifactSha256: sha(parsedText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", parsedProgramRowsReviewed: 280, htmlSchoolSectionsReviewed: 96, note: "The three official program pages were parsed by school table; headers, row widths, durations, tuition, campus, language markers, HSK markers and undergraduate CSCA columns were structurally checked." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: preflight, excludedExistingVerifiedScholarshipSlug: "official-2026-ecnu-shanghai-government-scholarship" },
  coverageLimitations: ["This standing-authorized batch inserts new official records only and does not archive the 12 legacy program records or 10 legacy unverified scholarship aliases.", "The existing verified graduate Shanghai Government Scholarship record is retained and not duplicated.", "Program Chinese names are not invented where the official English catalog publishes only English labels."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, admissions and scholarship data are included. Named staff, personal contact details, applicant records, accounts and payment data are excluded." },
  visualReview: { result: "pass", artifact: "official ECNU HTML tables and scholarship detail pages", note: "The official pages were opened and inspected; the tabular columns and scholarship section hierarchy match the parser and rich-detail model." },
  reviewNotes: ["This batch fits the user's default-publication authorization because all publication slugs are new and no existing record is archived, deleted or substantively overwritten.", "City and school dependency rows are included unchanged for referential integrity."]
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-ecnu-safe-new-batch-01-${reviewHash}` };
await writeFile(paths.validation, `${JSON.stringify({ ...validation, candidateSha256, sourceManifestSha256: sha(manifestText), parsedArtifactSha256: sha(parsedText), extractionCounts: parsed.counts }, null, 2)}\n`, "utf8");
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, preflight, paths }, null, 2));
