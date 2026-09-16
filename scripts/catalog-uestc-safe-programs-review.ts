import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd(), batch = "uestc-safe-programs-batch-01";
const paths = { complete: resolve(root, "seeds/catalog.uestc-complete-batch-01.draft.json"), pdfManifest: resolve(root, "work/catalog-official/uestc-complete-batch-01/manifest.json"), completeReview: resolve(root, "seeds/catalog.uestc-complete-batch-01.review.json"), candidate: resolve(root, `seeds/catalog.${batch}.draft.json`), validation: resolve(root, `seeds/catalog.${batch}.validation.json`), review: resolve(root, `seeds/catalog.${batch}.review.json`), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const read = async (path: string) => { const text = await readFile(path, "utf8"); return { text, value: JSON.parse(text) }; };
const [completeFile, pdfManifestFile, completeReviewFile, stateFile] = await Promise.all([paths.complete, paths.pdfManifest, paths.completeReview, paths.state].map(read));
const complete = completeFile.value as CatalogSeedBundle, pdfManifest = pdfManifestFile.value, completeReview = completeReviewFile.value, state = stateFile.value;
const schoolSlug = "university-of-electronic-science-and-technology-of-china";
const pdf = pdfManifest.sources?.find((row: any) => row.id === "uestc-admission-brochure-en-2026");
if (complete.cities?.length !== 1 || complete.schools?.length !== 1 || complete.schools[0].slug !== schoolSlug || complete.programs?.length !== 72 || complete.programIntakes?.length !== 72 || complete.scholarships?.length !== 10) throw new Error("UESTC complete candidate scope changed.");
if (!pdf || pdf.status !== 200 || pdf.sha256 !== "cd4ea8f64f11474c569dcd6dd9a38960ccbc8fe9ae4a606ec59d066396418d70" || completeReview.sourceReview?.result !== "pass" || completeReview.sensitiveDataCheck?.result !== "pass") throw new Error("UESTC reviewed PDF evidence is unavailable.");
if ([...complete.programs, ...complete.programIntakes].some((row: any) => row.sourceSha256 !== pdf.sha256)) throw new Error("UESTC program record is not bound to the reviewed PDF.");

const programSlugs = complete.programs.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:uestc-safe-programs-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug=$1", [schoolSlug]);
  const city = await pool.query("select id,slug,status,verification_status from cities where slug='chengdu'");
  const activePrograms = await pool.query("select id,slug,status,verification_status from programs where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const conflicts = await pool.query("select id,slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [programSlugs]);
  const activeScholarships = await pool.query("select id,slug,status,verification_status from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const intakes = await pool.query("select count(*)::int count from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1", [school.rows[0]?.id]);
  baseline = { school: school.rows, city: city.rows, activePrograms: activePrograms.rows, conflicts: conflicts.rows, activeScholarships: activeScholarships.rows, intakeCount: intakes.rows[0]?.count ?? 0 };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "unverified" || city.rows.length !== 1 || city.rows[0].status !== "active") throw new Error("UESTC dependency baseline changed.");
  if (activePrograms.rows.length !== 3 || conflicts.rows.length !== 0 || activePrograms.rows.some((row: any) => row.verification_status !== "unverified")) throw new Error("UESTC program baseline changed.");
  if (activeScholarships.rows.length !== 3 || activeScholarships.rows.some((row: any) => row.verification_status !== "unverified")) throw new Error("UESTC scholarship baseline changed.");
} finally { await pool.end(); }

const candidate: CatalogSeedBundle = { version: 1, generatedAt: pdfManifest.generatedAt, cities: complete.cities, schools: complete.schools, programs: complete.programs, programIntakes: complete.programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`, validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`UESTC safe-program validation failed: ${validation.errors.join(" ")}`);
const reviewBase = {
  version: 1, status: "standing_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug, dependencyCityReplayCount: 1, dependencySchoolReplayCount: 1, newProgramRouteCount: 72, newProgramIntakeCount: 72, newScholarshipCount: 0, overwriteCount: 0, archiveCount: 0 },
  candidateSha256: sha(candidateText), candidateBundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
  evidence: [{ sourceId: pdf.id, sourceUrl: pdf.finalUrl, sourceLabel: pdf.label, sha256: pdf.sha256, fetchedAt: pdf.fetchedAt, contentType: pdf.contentType, manifestSha256: sha(pdfManifestFile.text) }],
  standingAuthorization: { reference: "user-chat-2026-09-13-default-publication", instruction: "发布默认允许", appliesBecause: "This batch inserts only 72 new non-conflicting official program routes and 72 intakes. Chengdu city and the UESTC school are read-only dependencies; no record is overwritten or archived." },
  sourceReview: { result: "pass", note: "The official 2026 UESTC brochure snapshot was captured on 2026-09-13 and its 12 pages were text-extracted; the program tables were rendered and visually checked. A 2026-09-14 refresh was refused because the current PDF exceeds the 15 MiB collector limit, so the prior immutable reviewed snapshot remains the evidence." },
  visualReview: { result: "pass", artifact: "UESTC 2026 Admission Brochure PDF", pagesReviewed: completeReview.sourceReview.pdfPagesReviewed, note: completeReview.sourceReview.note },
  reconciliation: { destructiveDeletion: false, overwrites: [], archives: [], deferredLegacyProgramSlugs: baseline.activePrograms.map((row: any) => row.slug), deferredLegacyScholarshipSlugs: baseline.activeScholarships.map((row: any) => row.slug), databaseBaseline: { schoolId: baseline.school[0].id, cityId: baseline.city[0].id, activeProgramCount: baseline.activePrograms.length, activeScholarshipCount: baseline.activeScholarships.length, intakeCount: baseline.intakeCount } },
  coverageLimitations: ["The UESTC school profile and three old program aliases require explicit overwrite/archive review and remain unchanged.", "Ten brochure-level scholarship routes remain draft because their benefit item arrays are empty; three legacy scholarships also remain unchanged.", "Three current scholarship webpages returned access-control challenge HTML on 2026-09-14 and are not used by this batch."],
  sensitiveDataCheck: { result: "pass", scope: "safe program publication candidate", note: "Only public institutional, program and admissions fields are included. Scholarship, applicant, account, payment, bank and personal-contact data are excluded." },
};
const reviewHash = sha(JSON.stringify(reviewBase)), publicationReference = `standing-authorized-${batch}-${reviewHash}`;
await Promise.all([writeFile(paths.candidate, candidateText, "utf8"), writeFile(paths.validation, `${JSON.stringify(validation, null, 2)}\n`, "utf8"), writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, publicationReference }, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, batch, reviewHash, publicationReference, scope: reviewBase.scope, paths }, null, 2));
