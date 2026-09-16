import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const prefix = "catalog.zjut-scholarships-safe-new-batch-01", sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8"), candidate = JSON.parse(candidateText), validation = JSON.parse(await readFile(`seeds/${prefix}.validation.json`, "utf8")), manifestText = await readFile("work/catalog-official/zjut-complete-batch-01/manifest.json", "utf8"), manifest = JSON.parse(manifestText), state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8")), fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || candidate.scholarships.length !== 9 || candidate.programs.length !== 0) throw new Error("ZJUT scholarship candidate changed.");
const slugs = candidate.scholarships.map((row: any) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:zjut-scholarships-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug='zhejiang-university-of-technology'");
  const city = await pool.query("select id,slug,status from cities where slug='hangzhou'");
  const conflicts = await pool.query("select id,slug,status,verification_status from scholarships where slug=any($1::text[])", [slugs]);
  const totals = await pool.query("select count(*) filter(where status='active')::text programs,count(*) filter(where status='active' and verification_status='verified')::text verified_programs,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships from programs where school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows[0], city: city.rows[0], conflicts: conflicts.rows, totals: totals.rows[0] };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || city.rows.length !== 1 || city.rows[0].status !== "active" || conflicts.rows.length !== 0 || totals.rows[0].programs !== "23" || totals.rows[0].verified_programs !== "0" || totals.rows[0].scholarships !== "0") throw new Error(`ZJUT scholarship baseline changed: ${JSON.stringify(baseline)}`);
} finally { await pool.end(); }
const scholarshipSourceIds = ["zjut-chinese-government-scholarship-current", "zjut-university-scholarship-current", "zjut-phd-full-scholarship-current", "zjut-international-chinese-language-teachers-scholarship-2027-spring"];
const evidence = manifest.sources.filter((row: any) => scholarshipSourceIds.includes(row.id)).map((row: any) => ({ sourceId: row.id, sourceUrl: row.url, sourceLabel: row.label, sha256: row.sha256, capturedAt: row.fetchedAt, contentType: row.contentType }));
if (evidence.length !== 4) throw new Error("ZJUT scholarship evidence is incomplete.");
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "zhejiang-university-of-technology", dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newScholarshipCount: 9, overwriteCount: 0, archiveCount: 0, deleteCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, manifestSha256: sha(manifestText), evidence,
  standingAuthorization: { reference: "user-chat-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts nine distinct official ZJUT scholarship routes into a school that currently has no scholarships. Hangzhou and the existing school are protected dependencies; no existing school, program, intake or scholarship row is overwritten, archived or deleted." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], baseline, scholarshipSlugs: slugs },
  sourceReview: { result: "pass", note: "All four exact official ZJUT scholarship pages were acquired through the allowlisted collector with HTTP 200 and stable SHA-256 snapshots. The records are separated by named route or funding tier instead of being merged into one overview." },
  sensitiveDataCheck: { result: "pass", scope: "nine public scholarship policy records", note: "The candidate contains only public eligibility, benefit, deadline, materials-category and process descriptions. It excludes institutional bank/account routing, applicant identifiers, passport values, remittance data, staff names and contact details present elsewhere on the pages." },
  coverageReview: { result: "pass", findings: ["High-Level Graduate and Silk Road records retain their exact 2026 deadlines and published funding amounts.", "The four general ZJUT tiers remain separate because their award amounts and renewal rules differ.", "The two doctoral newcomer tiers remain separate because only one includes a monthly living allowance.", "The International Chinese Language Teachers route is explicitly labeled March 2027 intake with an October 20, 2026 deadline."] },
  reviewNotes: ["The High-Level Graduate and Silk Road deadlines have passed as of capture, but the records are retained as accurate published 2026 cycle evidence.", "Recurring end-of-May policies intentionally use a deadline label and do not invent a calendar date.", "This batch does not change ZJUT's 23 unverified legacy program rows; program reconciliation will use the two separately captured 2026 PDFs."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const publicationReference = `standing-authorized-zjut-scholarships-safe-new-batch-01-${reviewHash}`;
await writeFile(`seeds/${prefix}.review.json`, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reviewHash, publicationReference, scope: reviewBase.scope }, null, 2));
