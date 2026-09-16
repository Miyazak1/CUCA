import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map(arg => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedReviewHash = required("review-hash"), reviewReference = required("review"), approvalRecordedAt = required("approved-at"), confirmation = required("confirm");
if ([...options.keys()].some(key => !new Set(["review-hash", "review", "approved-at", "confirm"]).has(key))) throw new Error("Unknown publication option.");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash)) throw new Error("Review hash must be a lowercase SHA-256 digest.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvalRecordedAt) || Number.isNaN(Date.parse(approvalRecordedAt))) throw new Error("Approval time must be an ISO UTC timestamp.");

const root = process.cwd();
const paths = { candidate: resolve(root, "seeds/catalog.nju-complete-batch-02.draft.json"), validation: resolve(root, "seeds/catalog.nju-complete-batch-02.validation.json"), review: resolve(root, "seeds/catalog.nju-complete-batch-02.review.json"), prior: resolve(root, "seeds/catalog.nju-school-program-batch-01.approved.local.json"), output: resolve(root, "seeds/catalog.nju-complete-batch-02.approved.local.json"), approval: resolve(root, "seeds/catalog.nju-complete-batch-02.approval.json"), state: resolve(root, ".cuac-local/runtime.json") };
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const storedValidation = await parse(paths.validation), review = await parse(paths.review), prior = await parse(paths.prior), state = await parse(paths.state);
const { reviewHash: storedReviewHash, publicationReference: _publicationReference, ...reviewBase } = review;
const actualReviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
if (storedReviewHash !== approvedReviewHash || actualReviewHash !== approvedReviewHash) throw new Error("Standing-authorized review hash does not match the stored NJU review.");
const candidateFileSha256 = createHash("sha256").update(candidateText).digest("hex");
if (candidateFileSha256 !== review.candidateSha256) throw new Error("NJU candidate changed after review.");
const freshValidation = createCatalogMigrationValidationReport(candidate);
if (!freshValidation.ok || !storedValidation.ok || freshValidation.bundleSha256 !== storedValidation.bundleSha256 || freshValidation.operationPlanSha256 !== storedValidation.operationPlanSha256) throw new Error("NJU validation no longer matches the reviewed bundle.");
if (review.status !== "standing_user_approval" || review.standingAuthorization?.instruction !== "发布默认允许" || review.sensitiveDataCheck?.result !== "pass" || review.visualReview?.result !== "pass") throw new Error("NJU review is not eligible for standing-authorized publication.");
if (review.scope?.newProgramRouteCount !== 202 || review.scope?.masterRouteCount !== 141 || review.scope?.doctoralRouteCount !== 61 || review.scope?.newProgramIntakeCount !== 202 || review.scope?.newScholarshipCount !== 3) throw new Error("NJU review scope mismatch.");
if (review.scope?.archiveProgramAliasCount !== 0 || review.scope?.archiveScholarshipAliasCount !== 0 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Standing authorization cannot archive or delete records.");
if (JSON.stringify(candidate.cities) !== JSON.stringify(prior.cities) || JSON.stringify(candidate.schools) !== JSON.stringify(prior.schools)) throw new Error("NJU dependency replay is not byte-equivalent to the prior approved bundle.");

const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({ cityFields: [...new Set((candidate.cities ?? []).flatMap(item => Object.keys(item)))].sort(), schoolFields: [...new Set((candidate.schools ?? []).flatMap(item => Object.keys(item)))].sort(), programFields: [...new Set((candidate.programs ?? []).flatMap(item => Object.keys(item)))].sort(), intakeFields: [...new Set((candidate.programIntakes ?? []).flatMap(item => Object.keys(item)))].sort(), scholarshipFields: [...new Set((candidate.scholarships ?? []).flatMap(item => Object.keys(item)))].sort() })).digest("hex");
const publication: CatalogSeedBundle = { version: 2, generatedAt: approvalRecordedAt, handoff: { sourceSystem: "CUAC reviewed official Nanjing University 2026 sources", cleanedExportName: "catalog.nju-complete-batch-02.draft.json", cleanedExportSha256: freshValidation.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true }, cities: candidate.cities, schools: candidate.schools, programs: (candidate.programs ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })), programIntakes: (candidate.programIntakes ?? []).map(row => ({ ...row, status: "closed" as const })), scholarships: (candidate.scholarships ?? []).map(row => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })) };
const publicationReport = createCatalogMigrationValidationReport(publication);
if (!publicationReport.ok || publicationReport.summary.schools !== 1 || publicationReport.summary.programs !== 202 || publicationReport.summary.programIntakes !== 202 || publicationReport.summary.scholarships !== 3) throw new Error(`NJU publication bundle is invalid: ${publicationReport.errors.join(" ")}`);
const approvalRecord = { version: 1, approvedAt: approvalRecordedAt, reviewReference, approvedReviewSha256: approvedReviewHash, approvalMode: "standing-user-default-publication", approvedCandidate: "seeds/catalog.nju-complete-batch-02.draft.json", approvedCandidateFileSha256: candidateFileSha256, approvedCandidateBundleSha256: freshValidation.bundleSha256, publicationBundle: "seeds/catalog.nju-complete-batch-02.approved.local.json", publicationBundleSha256: publicationReport.bundleSha256, schoolSlug: "nanjing-university", dependencyCitySlugs: candidate.cities?.map(row => row.slug), dependencySchoolReplay: true, programSlugs: publication.programs?.map(row => row.slug), scholarshipSlugs: publication.scholarships?.map(row => row.slug), archivedProgramAliases: [], archivedScholarshipAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const text = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, text, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== text) throw new Error(`Existing artifact does not match this publication: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approvalRecord);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:nju-complete-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() as database_name,current_user as database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Connected PostgreSQL identity does not match the CUAC local runtime.");
    const school = await tx.query<{ id: string }>("select id from schools where slug=$1 and status='active' and verification_status='verified'", ["nanjing-university"]);
    if (school.length !== 1 || school[0].id !== "e2eab575-1249-4294-a180-1f45963ec5ff") throw new Error(`NJU dependency school does not match the reviewed target: ${JSON.stringify(school)}`);
    const before = await tx.query<{ degree_level: string; routes: string }>("select degree_level,count(*)::text routes from programs where school_id=$1 and status='active' group by degree_level order by degree_level", [school[0].id]);
    if (before.length !== 1 || before[0].degree_level !== "Undergraduate" || before[0].routes !== "59") throw new Error(`NJU program baseline changed after review: ${JSON.stringify(before)}`);
    const relations = await tx.query<{ intakes: string; scholarships: string }>("select (select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships", [school[0].id]);
    if (relations[0]?.intakes !== "59" || relations[0]?.scholarships !== "1") throw new Error(`NJU related-record baseline changed after review: ${JSON.stringify(relations[0])}`);
    const programConflicts = await tx.query<{ slug: string }>("select slug from programs where slug=any($1::text[])", [publication.programs!.map(row => row.slug)]);
    const scholarshipConflicts = await tx.query<{ slug: string }>("select slug from scholarships where slug=any($1::text[])", [publication.scholarships!.map(row => row.slug)]);
    if (programConflicts.length || scholarshipConflicts.length) throw new Error(`NJU publication conflicts appeared after review: ${JSON.stringify({ programConflicts, scholarshipConflicts })}`);
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    const counts = await tx.query<{ undergraduate: string; master: string; doctoral: string; intakes: string; scholarships: string; verified_scholarships: string }>("select (select count(*) from programs where school_id=$1 and status='active' and degree_level='Undergraduate')::text undergraduate,(select count(*) from programs where school_id=$1 and status='active' and degree_level='Master')::text master,(select count(*) from programs where school_id=$1 and status='active' and degree_level='Doctoral')::text doctoral,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships", [school[0].id]);
    if (counts[0]?.undergraduate !== "59" || counts[0]?.master !== "141" || counts[0]?.doctoral !== "61" || counts[0]?.intakes !== "261" || counts[0]?.scholarships !== "4" || counts[0]?.verified_scholarships !== "4") throw new Error(`NJU post-publication count mismatch: ${JSON.stringify(counts[0])}`);
    return { writeSummary: written.summary, schoolId: school[0].id, counts: counts[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: publicationReport.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
