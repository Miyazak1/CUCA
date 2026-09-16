import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = {
  manifest: resolve(root, "work/catalog-official/dut-complete-batch-01/manifest.json"),
  draft: resolve(root, "seeds/catalog.dut-safe-new-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.dut-safe-new-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.dut-safe-new-batch-01.review.json"),
};
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.draft, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const manifestText = await readFile(paths.manifest, "utf8");
const manifest = JSON.parse(manifestText);
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok || candidate.programs?.length !== 3 || candidate.programIntakes?.length !== 3 || candidate.scholarships?.length !== 4) throw new Error("DUT candidate failed locked scope validation.");
const sourceIds = new Set(["dut-chinese-government-scholarship-2026", "dut-undergraduate-english-admissions-2026", "dut-master-chinese-admissions-2026", "dut-master-english-admissions-2026", "dut-doctoral-chinese-admissions-2026", "dut-doctoral-english-admissions-2026", "dut-cgs-type-a-scholarship-2026", "dut-china-link-scholarship-2026", "dut-youth-of-excellence-scholarship-2026", "dut-presidential-scholarship-2026"]);
const evidence = manifest.sources.filter((row: any) => sourceIds.has(row.id));
if (evidence.length !== 10 || evidence.some((row: any) => row.status !== 200 || row.contentType !== "text/html" || !/^[a-f0-9]{64}$/.test(row.sha256))) throw new Error("DUT evidence manifest incomplete.");

const state = JSON.parse(await readFile(resolve(root, ".cuac-local/runtime.json"), "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:dut-safe-new-review" });
let preflight: any;
try {
  const programSlugs = candidate.programs!.map(row => row.slug);
  const scholarshipSlugs = candidate.scholarships!.map(row => row.slug);
  const conflicts = await pool.query<{ kind: string; slug: string }>("select 'program' kind,slug from programs where slug=any($1::text[]) union all select 'scholarship' kind,slug from scholarships where slug=any($2::text[])", [programSlugs, scholarshipSlugs]);
  if (conflicts.rows.length) throw new Error(`Standing-authorized DUT slugs conflict: ${JSON.stringify(conflicts.rows)}`);
  const totals = await pool.query("select (select id from schools where slug='dalian-university-of-technology') school_id,(select count(*) from programs where school_id=(select id from schools where slug='dalian-university-of-technology') and status='active')::int programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=(select id from schools where slug='dalian-university-of-technology'))::int intakes,(select count(*) from scholarships where school_id=(select id from schools where slug='dalian-university-of-technology') and status='active')::int scholarships,(select count(*) from scholarships where school_id=(select id from schools where slug='dalian-university-of-technology') and status='active' and verification_status='verified')::int verified_scholarships", []);
  preflight = totals.rows[0];
  if (JSON.stringify(preflight) !== JSON.stringify({ school_id: "513f6ff8-1e21-4066-9760-b1eba665363d", programs: 12, intakes: 5, scholarships: 3, verified_scholarships: 1 })) throw new Error(`DUT database baseline changed: ${JSON.stringify(preflight)}`);
} finally { await pool.end(); }

const candidateSha256 = sha(candidateText);
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  standingAuthorization: { instruction: "发布默认允许", scope: "new, non-conflicting official catalog records only" },
  scope: { schoolSlug: "dalian-university-of-technology", programRouteCount: 3, masterRouteCount: 3, englishRouteCount: 3, programIntakeCount: 3, newScholarshipCount: 4, cityOverwriteCount: 0, schoolOverwriteCount: 0, stableScholarshipUpdateCount: 0, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  sourceManifestSha256: sha(manifestText),
  evidence: evidence.map((row: any) => ({ sourceId: row.id, sourceUrl: row.finalUrl, sourceLabel: row.label, sha256: row.sha256, fetchedAt: row.fetchedAt, contentType: row.contentType })),
  sourceReview: { result: "pass", note: "Ten registered DUT 2026 official HTML pages were captured. Program names, schools, subjects, language and the 1+1 duration were checked against the published Youth of Excellence table; tuition and admissions context were cross-checked against the English-taught master guide." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: preflight, retainedVerifiedScholarshipSlug: "official-2026-dut-chinese-government-scholarship" },
  coverageLimitations: ["The six official 2026 major-list attachments are protected by an attachment CAPTCHA. The collector did not bypass it, so this batch publishes only the three program routes explicitly enumerated in official HTML.", "The existing school row, 12 unverified legacy undergraduate routes and two unverified legacy scholarship aliases remain untouched pending a separate exact hashed reconciliation.", "The existing verified combined DUT Chinese Government Scholarship High-level Postgraduate and Silk Road record is retained and not duplicated."],
  sensitiveDataCheck: { result: "pass", scope: "candidate bundle only", note: "Only public institutional, program, admissions and scholarship data are included. Named staff, personal contact details, applicant records, accounts and payment data are excluded." },
  visualReview: { result: "pass", artifact: "official DUT HTML admissions and scholarship pages", note: "The public page hierarchy, program table and scholarship sections were inspected and match the rich-detail fields in the candidate." },
  reviewNotes: ["All seven publication slugs are new; this batch performs no archive, deletion or substantive overwrite and therefore fits the user's default-publication authorization.", "The legacy school object is included unchanged only as a referential dependency."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-dut-safe-new-batch-01-${reviewHash}` };
await writeFile(paths.validation, `${JSON.stringify({ ...validation, candidateSha256, sourceManifestSha256: sha(manifestText) }, null, 2)}\n`, "utf8");
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference: review.publicationReference, scope: reviewBase.scope, preflight, paths }, null, 2));
