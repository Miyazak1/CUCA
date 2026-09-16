import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { candidate: resolve(root, "seeds/catalog.ahu-programs-safe-new-batch-01.draft.json"), validation: resolve(root, "seeds/catalog.ahu-programs-safe-new-batch-01.validation.json"), review: resolve(root, "seeds/catalog.ahu-programs-safe-new-batch-01.review.json"), manifest: resolve(root, "work/catalog-official/ahu-programs-batch-01/manifest.json"), parsed: resolve(root, "work/catalog-official/ahu-programs-batch-01/parsed-programs.json"), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [candidateText, validationText, manifestText, parsedText, stateText] = await Promise.all([readFile(paths.candidate, "utf8"), readFile(paths.validation, "utf8"), readFile(paths.manifest, "utf8"), readFile(paths.parsed, "utf8"), readFile(paths.state, "utf8")]);
const candidate = JSON.parse(candidateText), validation = JSON.parse(validationText), manifest = JSON.parse(manifestText), parsed = JSON.parse(parsedText), state = JSON.parse(stateText);
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256 || candidate.programs.length !== 168) throw new Error("AHU program candidate validation changed.");
const slugs = candidate.programs.map((row: any) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ahu-programs-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug='anhui-university'");
  const city = await pool.query("select id,slug,status from cities where slug='hefei'");
  const conflicts = await pool.query("select id,slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [slugs]);
  const activePrograms = await pool.query("select id,slug,name_en,degree_level,status,verification_status from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [school.rows[0]?.id]);
  const scholarships = await pool.query("select id,slug,status,verification_status,last_verified_at from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  if (school.rows.length !== 1 || city.rows.length !== 1 || conflicts.rows.length !== 0 || activePrograms.rows.length !== 2 || !activePrograms.rows.every((row: any) => row.name_en === "Economics" && row.verification_status === "unverified") || scholarships.rows.length !== 2) throw new Error("AHU safe-new program database baseline changed.");
  baseline = { school: school.rows[0], city: city.rows[0], activePrograms: activePrograms.rows, intakeCount: intakes.rows[0].count, activeScholarships: scholarships.rows };
} finally { await pool.end(); }
const reviewBase = {
  version: 1,
  status: "standing_user_approval",
  generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "anhui-university", dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, sourceProgramCount: 169, excludedSemanticConflictCount: 1, newProgramRouteCount: 168, newProgramIntakeCount: 0, overwriteCount: 0, archiveCount: 0, scholarshipMutationCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: fresh.bundleSha256, operationPlanSha256: fresh.operationPlanSha256, manifestSha256: sha(manifestText), parsedProgramsSha256: sha(parsedText),
  evidence: manifest.sources.map((source: any) => ({ sourceId: source.id, sourceUrl: source.finalUrl, sourceLabel: source.label, sha256: source.sha256, fetchedAt: source.fetchedAt, contentType: source.contentType, byteLength: source.byteLength, lastModified: source.lastModified })),
  standingAuthorization: { reference: "user-chat-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts 168 new non-conflicting official AHU program records. It replays Hefei and Anhui University only as protected dependencies and changes no existing school, program, intake or scholarship record." },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], excludedSemanticConflicts: [{ degreeLevel: "Undergraduate", nameEn: "Economics", sourceRowCount: 1, existingRecordCount: 2, reason: "Two active unverified undergraduate Economics records already exist and require a separate cleanup decision." }], databaseBaseline: baseline },
  sourceReview: { result: "pass", note: "Both exact official AHU PDFs were acquired through the allowlisted collector, are below 15 MiB, and explicitly identify themselves as undergraduate/master programs for international students." },
  visualReview: { result: "pass", pagesReviewed: { undergraduate: [1,2], master: [1,2] }, extractedCounts: parsed.degreeCounts, findings: ["All four pages were visually reviewed against the extracted sequence, school and English major columns.", "Undergraduate sequence 1-80 and master sequence 1-89 are complete without gaps.", "The PDFs do not state an intake year, deadline, teaching language, tuition or scholarship eligibility; those fields and all intake rows are intentionally absent."] },
  sensitiveDataCheck: { result: "pass", scope: "168 public institutional program records", note: "The two source PDFs contain only public school/major tables. No applicant, passport, contact, payment, bank or account data is included." },
  coverageLimitations: ["Program catalogs were last modified on the official server in February 2025 and are presented by AHU as current, not as a year-specific 2026 intake list.", "No program intake rows are published because the source PDFs do not state a year or deadline.", "The unverified school profile and duplicate undergraduate Economics records remain unchanged pending separate official evidence and explicit cleanup approval."],
};
const reviewHash = sha(JSON.stringify(reviewBase));
const review = { ...reviewBase, reviewHash, publicationReference: `standing-authorized-ahu-programs-safe-new-batch-01-${reviewHash}` };
await writeFile(paths.review, `${JSON.stringify(review, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewPath: paths.review, reviewHash, publicationReference: review.publicationReference }, null, 2));
