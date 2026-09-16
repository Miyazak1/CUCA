import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map(arg => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
if ([...options.keys()].some(key => !new Set(["review-hash", "review", "approved-at", "confirm"]).has(key))) throw new Error("Unknown publication option.");
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid review hash or approval time.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.ecnu-safe-new-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = await parse(paths.validation);
const review = await parse(paths.review);
const state = await parse(paths.state);
const { reviewHash: storedHash, publicationReference: storedReference, ...reviewBase } = review;
if (storedHash !== approvedReviewHash || createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex") !== approvedReviewHash || storedReference !== reviewReference) throw new Error("Standing-authorized ECNU review hash/reference mismatch.");
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const fresh = createCatalogMigrationValidationReport(candidate);
if (candidateSha256 !== review.candidateSha256 || !fresh.ok || !validation.ok || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("ECNU candidate or validation changed after review.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass" || review.visualReview?.result !== "pass") throw new Error("ECNU review is not eligible for standing-authorized publication.");
if (review.scope?.programRouteCount !== 280 || review.scope?.programIntakeCount !== 280 || review.scope?.newScholarshipCount !== 8 || review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.scope?.cityOverwriteCount !== 0 || review.scope?.schoolOverwriteCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot archive, delete or substantively overwrite records.");

const programs = candidate.programs ?? [];
const intakes = candidate.programIntakes ?? [];
const scholarships = candidate.scholarships ?? [];
if (programs.length !== 280 || intakes.length !== 280 || scholarships.length !== 8 || programs.some(row => row.schoolSlug !== "east-china-normal-university" || row.status !== "draft") || scholarships.some(row => row.schoolSlug !== "east-china-normal-university" || row.status !== "draft")) throw new Error("ECNU candidate scope mismatch.");
const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({ cityFields: [...new Set((candidate.cities ?? []).flatMap(row => Object.keys(row)))].sort(), schoolFields: [...new Set((candidate.schools ?? []).flatMap(row => Object.keys(row)))].sort(), programFields: [...new Set(programs.flatMap(row => Object.keys(row)))].sort(), intakeFields: [...new Set(intakes.flatMap(row => Object.keys(row)))].sort(), scholarshipFields: [...new Set(scholarships.flatMap(row => Object.keys(row)))].sort() })).digest("hex");
const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official ECNU 2026 sources", cleanedExportName: "catalog.ecnu-safe-new-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities,
  schools: candidate.schools,
  programs: programs.map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: intakes,
  scholarships: scholarships.map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 280 || report.summary.programIntakes !== 280 || report.summary.scholarships !== 8) throw new Error(`Invalid ECNU publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference, approvedReviewSha256: approvedReviewHash, approvedCandidateFileSha256: candidateSha256, approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.ecnu-safe-new-batch-01.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "east-china-normal-university", programSlugs: publication.programs!.map(row => row.slug), scholarshipSlugs: publication.scholarships!.map(row => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:ecnu-safe-new-batch-01" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const school = await tx.query<{ id: string }>("select id from schools where slug=$1 and status='active'", ["east-china-normal-university"]);
    if (school.length !== 1 || school[0].id !== "4369d14e-514d-43c9-b23f-b191dc0e41a9") throw new Error("ECNU dependency school mismatch.");
    const programSlugs = publication.programs!.map(row => row.slug);
    const scholarshipSlugs = publication.scholarships!.map(row => row.slug);
    const existingPrograms = await tx.query<{ slug: string; status: string; verification_status: string }>("select slug,status,verification_status from programs where slug=any($1::text[])", [programSlugs]);
    const existingScholarships = await tx.query<{ slug: string; status: string; verification_status: string }>("select slug,status,verification_status from scholarships where slug=any($1::text[])", [scholarshipSlugs]);
    const pre = existingPrograms.length === 0 && existingScholarships.length === 0;
    const post = existingPrograms.length === 280 && existingPrograms.every(row => row.status === "active" && row.verification_status === "verified") && existingScholarships.length === 8 && existingScholarships.every(row => row.status === "active" && row.verification_status === "verified");
    if (!pre && !post) throw new Error(`ECNU candidate slugs partially conflict: ${JSON.stringify({ programs: existingPrograms.length, scholarships: existingScholarships.length })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const finalPrograms = await tx.query<{ count: string }>("select count(*)::text count from programs where slug=any($1::text[]) and status='active' and verification_status='verified' and last_verified_at=$2", [programSlugs, approvedAt]);
    const finalIntakes = await tx.query<{ count: string }>("select count(*)::text count from program_intakes pi join programs p on p.id=pi.program_id where p.slug=any($1::text[])", [programSlugs]);
    const finalScholarships = await tx.query<{ count: string }>("select count(*)::text count from scholarships where slug=any($1::text[]) and status='active' and verification_status='verified' and last_verified_at=$2 and jsonb_array_length(benefit_items)>0 and jsonb_array_length(eligibility_items)>0 and jsonb_array_length(application_steps)>0 and jsonb_array_length(action_links)>0", [scholarshipSlugs, approvedAt]);
    if (finalPrograms[0]?.count !== "280" || finalIntakes[0]?.count !== "280" || finalScholarships[0]?.count !== "8") throw new Error(`ECNU post-check failed: ${JSON.stringify({ finalPrograms, finalIntakes, finalScholarships })}`);
    const totals = await tx.query<{ programs: string; intakes: string; scholarships: string; verified_scholarships: string }>("select (select count(*) from programs where school_id=$1 and status='active')::text programs,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships", [school[0].id]);
    if (totals[0]?.programs !== "292" || totals[0]?.intakes !== "285" || totals[0]?.scholarships !== "19" || totals[0]?.verified_scholarships !== "9") throw new Error(`ECNU total-count mismatch: ${JSON.stringify(totals[0])}`);
    return { written, schoolId: school[0].id, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
