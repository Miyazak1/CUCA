import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const prefix = "catalog.blcu-undergraduate-safe-batch-01";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8");
const candidate = JSON.parse(candidateText);
const validation = JSON.parse(await readFile(`seeds/${prefix}.validation.json`, "utf8"));
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || fresh.bundleSha256 !== validation.bundleSha256 || candidate.programs.length !== 36 || candidate.programIntakes.length !== 46) throw new Error("BLCU undergraduate candidate changed.");
const state = JSON.parse(await readFile(".cuac-local/runtime.json", "utf8"));
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:blcu-undergraduate-safe-review" });
let baseline: any;
try {
  const school = await pool.query("select id,status,verification_status from schools where slug='beijing-language-and-culture-university'");
  const conflicts = await pool.query("select id,slug,name_en from programs where slug=any($1::text[])", [candidate.programs.map((row: any) => row.slug)]);
  const totals = await pool.query("select count(*)::text programs,count(*) filter(where verification_status='verified')::text verified,count(*) filter(where verification_status<>'verified')::text legacy,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships from programs where school_id=$1 and status='active'", [school.rows[0]?.id]);
  const legacy = await pool.query("select id,slug,name_en,name_zh from programs where school_id=$1 and status='active' and verification_status<>'verified' order by slug", [school.rows[0]?.id]);
  baseline = { school: school.rows[0], conflicts: conflicts.rows, totals: totals.rows[0], protectedLegacyPrograms: legacy.rows };
  if (!baseline.school || baseline.school.verification_status !== "unverified" || baseline.conflicts.length || baseline.totals.programs !== "74" || baseline.totals.verified !== "60" || baseline.totals.legacy !== "14" || baseline.totals.intakes !== "60" || baseline.totals.scholarships !== "9" || legacy.rows.length !== 14) throw new Error(`BLCU undergraduate baseline changed: ${JSON.stringify(baseline)}`);
} finally { await pool.end(); }

const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  standingAuthorization: { reference: "user-chat-top-300-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts 36 new non-conflicting official undergraduate/associate routes and 46 intake rows. It does not overwrite, archive or delete any catalog record." },
  scope: { schoolSlug: "beijing-language-and-culture-university", newProgramCount: 36, newIntakeCount: 46, schoolOverwriteCount: 0, archiveCount: 0, deleteCount: 0 },
  candidateSha256: sha(candidateText), bundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256,
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], baseline },
  evidence: { sourceId: "blcu-undergraduate-programs-pdf-2026", sourceUrl: candidate.programs[0].sourceUrl, sourceLabel: candidate.programs[0].sourceLabel, sha256: candidate.programs[0].sourceSha256, capturedAt: candidate.programs[0].capturedAt, pagesReviewed: 2 },
  visualReview: { result: "pass", pagesReviewed: [1, 2], note: "Both PDF pages were rendered at 180 DPI and inspected in full. Program headings, partner institutions, campuses, tuition columns, intake terms and 2026 deadlines are legible." },
  interpretationPolicy: { englishTitles: "Derived editorial translations are explicitly marked in sourceFieldLineage.", unresolvedFields: "Teaching language and duration are absent unless the PDF states them directly or the cultivation arrangement explicitly spans four/two years." },
  excludedSemanticConflicts: ["BLCU-Beijing University of Science and Technology Chinese Language and Artificial Intelligence directions", "existing Chinese-language tracks", "existing translation tracks", "International Chinese Language Education", "International Economics and Trade and digital-business variants", "Digital Finance and Digital Accounting", "Chinese Studies", "the repeated English-taught Hearing and Speech Rehabilitation listing"],
  sensitiveDataCheck: { result: "pass", scope: "36 public program routes and 46 intake rows", note: "Institutional telephone and email shown on the PDF were not copied. No applicant, account, payment, passport, bank or personal-contact data is included." },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-${prefix}-${reviewHash}` };
await writeFile(`seeds/${prefix}.review.json`, `${JSON.stringify(review, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reviewHash, scope: reviewBase.scope }, null, 2));
