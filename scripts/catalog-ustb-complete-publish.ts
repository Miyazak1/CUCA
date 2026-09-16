import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const allowed = new Set(["review-hash", "review", "approved-at", "confirm"]);
if ([...options.keys()].some((key) => !allowed.has(key))) throw new Error("Unknown publication option.");
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvedAt) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid review hash or approval timestamp.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.ustb-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.ustb-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.ustb-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.ustb-complete-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.ustb-complete-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const validation = await parse(paths.validation);
const review = await parse(paths.review);
const state = await parse(paths.state);
const { reviewHash: storedHash, requiredApproval: storedApproval, ...reviewBase } = review;
if (storedHash !== approvedReviewHash || hash(JSON.stringify(reviewBase)) !== approvedReviewHash || storedApproval !== reviewReference) throw new Error("Approved USTB review hash/reference does not match the stored review.");
const fresh = createCatalogMigrationValidationReport(candidate);
const candidateSha256 = hash(candidateText);
if (candidateSha256 !== review.candidateSha256 || !fresh.ok || !validation.ok || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("USTB candidate or validation changed after review.");
if (review.status !== "requires_explicit_approval" || review.sensitiveDataCheck?.result !== "pass" || review.visualReview?.result !== "pass") throw new Error("USTB candidate has not passed completed review.");
if (review.scope?.programRouteCount !== 156 || review.scope?.programIntakeCount !== 156 || review.scope?.newScholarshipCount !== 5 || review.scope?.stableProgramOverwriteCount !== 11 || review.scope?.archiveProgramAliasCount !== 1 || review.scope?.archiveScholarshipAliasCount !== 1) throw new Error("USTB review scope mismatch.");
const programAliases = review.reconciliation?.archives?.filter((row: any) => row.entityType === "program").map((row: any) => row.slug);
const scholarshipAliases = review.reconciliation?.archives?.filter((row: any) => row.entityType === "scholarship").map((row: any) => row.slug);
if (JSON.stringify(programAliases) !== JSON.stringify(["university-of-science-and-technology-beijing-construction-management"]) || JSON.stringify(scholarshipAliases) !== JSON.stringify(["university-of-science-and-technology-beijing"]) || review.reconciliation?.destructiveDeletion !== false) throw new Error("USTB archival plan mismatch.");

const sourceSchemaSha256 = hash(JSON.stringify({ cityFields: [...new Set((candidate.cities ?? []).flatMap((row) => Object.keys(row)))].sort(), schoolFields: [...new Set((candidate.schools ?? []).flatMap((row) => Object.keys(row)))].sort(), programFields: [...new Set((candidate.programs ?? []).flatMap((row) => Object.keys(row)))].sort(), intakeFields: [...new Set((candidate.programIntakes ?? []).flatMap((row) => Object.keys(row)))].sort(), scholarshipFields: [...new Set((candidate.scholarships ?? []).flatMap((row) => Object.keys(row)))].sort() }));
const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official University of Science and Technology Beijing 2026 program, admissions and scholarship sources", cleanedExportName: "catalog.ustb-complete-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: (candidate.cities ?? []).map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  schools: (candidate.schools ?? []).map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: (candidate.programs ?? []).map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: (candidate.programIntakes ?? []).map((row) => ({ ...row, status: "closed" as const })),
  scholarships: (candidate.scholarships ?? []).map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.cities !== 1 || report.summary.schools !== 1 || report.summary.programs !== 156 || report.summary.programIntakes !== 156 || report.summary.scholarships !== 5) throw new Error(`Invalid USTB publication bundle: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "explicit-product-owner-approval", reviewReference, approvedReviewSha256: approvedReviewHash, approvedCandidateFileSha256: candidateSha256, approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.ustb-complete-batch-01.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "university-of-science-and-technology-beijing", programSlugs: publication.programs!.map((row) => row.slug), scholarshipSlugs: publication.scholarships!.map((row) => row.slug), archivedProgramAliases: programAliases, archivedScholarshipAliases: scholarshipAliases, prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:ustb-complete-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const school = await tx.query<{ id: string }>("select id from schools where slug='university-of-science-and-technology-beijing'", []);
    const city = await tx.query<{ id: string }>("select id from cities where slug='beijing'", []);
    if (school.length !== 1 || school[0].id !== review.reconciliation.databaseBaseline.schoolId || city.length !== 1 || city[0].id !== review.reconciliation.databaseBaseline.cityId) throw new Error("USTB/Beijing identity changed after review.");
    const stableProgramIds = await tx.query<{ id: string; status: string; verification_status: string }>("select id,status,verification_status from programs where id=any($1::uuid[]) order by id", [review.reconciliation.databaseBaseline.stableProgramIds]);
    if (stableProgramIds.length !== 11 || stableProgramIds.some((row) => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("USTB stable program baseline changed after review.");
    const legacyPrograms = await tx.query<{ slug: string; status: string }>("select slug,status from programs where slug=any($1::text[])", [programAliases]);
    const legacyScholarships = await tx.query<{ slug: string; status: string }>("select slug,status from scholarships where slug=any($1::text[])", [scholarshipAliases]);
    if (legacyPrograms.length !== 1 || legacyScholarships.length !== 1 || legacyPrograms.some((row) => !["active", "archived"].includes(row.status)) || legacyScholarships.some((row) => !["active", "archived"].includes(row.status))) throw new Error("USTB legacy aliases no longer match the reviewed state.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    await tx.query("update programs set status='archived',updated_at=now() where slug=any($1::text[]) and status='active'", [programAliases]);
    await tx.query("update scholarships set status='archived',updated_at=now() where slug=any($1::text[]) and status='active'", [scholarshipAliases]);
    const activePrograms = await tx.query<{ count: string }>("select count(*)::text count from programs where school_id=$1 and status='active'", [school[0].id]);
    const verifiedCandidates = await tx.query<{ count: string }>("select count(*)::text count from programs where slug=any($1::text[]) and status='active' and verification_status='verified' and last_verified_at=$2", [publication.programs!.map((row) => row.slug), approvedAt]);
    const intakes = await tx.query<{ count: string }>("select count(distinct p.slug)::text count from program_intakes pi join programs p on p.id=pi.program_id where p.slug=any($1::text[]) and pi.status='closed'", [publication.programs!.map((row) => row.slug)]);
    const scholarships = await tx.query<{ count: string }>("select count(*)::text count from scholarships where slug=any($1::text[]) and status='active' and verification_status='verified' and last_verified_at=$2", [publication.scholarships!.map((row) => row.slug), approvedAt]);
    const archives = await tx.query<{ programs: string; scholarships: string }>("select (select count(*) from programs where slug=any($1::text[]) and status='archived')::text programs,(select count(*) from scholarships where slug=any($2::text[]) and status='archived')::text scholarships", [programAliases, scholarshipAliases]);
    if (activePrograms[0]?.count !== "156" || verifiedCandidates[0]?.count !== "156" || intakes[0]?.count !== "156" || scholarships[0]?.count !== "5" || archives[0]?.programs !== "1" || archives[0]?.scholarships !== "1") throw new Error(`USTB post-publication verification failed: ${JSON.stringify({ activePrograms: activePrograms[0], verifiedCandidates: verifiedCandidates[0], intakes: intakes[0], scholarships: scholarships[0], archives: archives[0] })}`);
    return { written, schoolId: school[0].id, activeProgramCount: activePrograms[0].count, verifiedCandidateProgramCount: verifiedCandidates[0].count, candidateIntakeProgramCount: intakes[0].count, activeVerifiedScholarshipCount: scholarships[0].count, archived: archives[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
