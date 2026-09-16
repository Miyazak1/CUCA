import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { candidate: resolve(root, "seeds/catalog.ahu-scholarship-safe-new-batch-01.draft.json"), validation: resolve(root, "seeds/catalog.ahu-scholarship-safe-new-batch-01.validation.json"), review: resolve(root, "seeds/catalog.ahu-scholarship-safe-new-batch-01.review.json"), manifest: resolve(root, "work/catalog-official/ahu-scholarship-batch-01/manifest.json"), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, stateText] = await Promise.all([readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.state, "utf8")]);
const candidate = JSON.parse(candidateText), validation = JSON.parse(validationText), manifest = JSON.parse(manifestText), state = JSON.parse(stateText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("AHU candidate validation changed.");
const scholarshipSlug = candidate.scholarships[0].slug;
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ahu-scholarship-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug='anhui-university'");
  const city = await pool.query("select id,slug,status from cities where slug='hefei'");
  const conflict = await pool.query("select id,slug,status,verification_status from scholarships where slug=$1", [scholarshipSlug]);
  const active = await pool.query("select id,slug,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  if (school.rows.length !== 1 || city.rows.length !== 1 || conflict.rows.length !== 0 || active.rows.length !== 1) throw new Error("AHU safe-new database baseline changed.");
  baseline = { school: school.rows[0], city: city.rows[0], existingScholarships: active.rows };
} finally { await pool.end(); }
const source = manifest.sources[0];
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "anhui-university", dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newScholarshipCount: 1, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText),
  candidateBundleSha256: fresh.bundleSha256,
  operationPlanSha256: fresh.operationPlanSha256,
  manifestSha256: sha(manifestText),
  evidence: [{ sourceId: source.id, sourceUrl: source.finalUrl, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType, byteLength: source.byteLength }],
  standingAuthorization: { reference: "user-chat-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts one non-conflicting official AHU scholarship record. Hefei and Anhui University are replayed only as protected dependencies; no existing record is overwritten, archived or deleted." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], databaseBaseline: { schoolId: baseline.school.id, cityId: baseline.city.id, existingScholarships: baseline.existingScholarships } },
  sourceReview: { result: "pass", note: "The exact official AHU PDF was acquired through the allowlisted collector, is a current 2026/2027 brochure, is under 15 MiB, and all 10 pages were visually inspected." },
  visualReview: { result: "pass", pagesReviewed: [1,2,3,4,5,6,7,8,9,10], findings: ["The document directly supports category, dates, eligibility, language requirements, materials, selection and annual review.", "The document does not itemize scholarship coverage or allowance amounts; those fields remain explicitly unpublished.", "Bank account, passport/application identifiers and institutional contact details on pages 3-6 and 8-10 are excluded from the catalog record."] },
  sensitiveDataCheck: { result: "pass", scope: "one public scholarship policy record", note: "No applicant data, passport value, personal contact, bank account, payment routing, uploaded file or account credential is included." },
  coverageLimitations: ["This batch does not verify or overwrite the existing AHU school profile, two program records or the old merged scholarship overview.", "The AHU brochure directs applicants to the CSC system for the major list and does not publish benefit amounts in the document."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-ahu-scholarship-safe-new-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewPath: paths.review, reviewHash, publicationReference: review.publicationReference }, null, 2));
