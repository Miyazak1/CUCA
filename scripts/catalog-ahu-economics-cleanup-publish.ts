import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedHash = required("review-hash"), reviewReference = required("review"), approvedAt = required("approved-at");
if (!/^[a-f0-9]{64}$/.test(approvedHash) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid approval parameters.");
const prefix = "catalog.ahu-economics-cleanup", sha = (value: string) => createHash("sha256").update(value).digest("hex"), read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8"), candidate = JSON.parse(candidateText), validation = await read(`seeds/${prefix}.validation.json`), review = await read(`seeds/${prefix}.review.json`), state = await read(".cuac-local/runtime.json"), fresh = createCatalogMigrationValidationReport(candidate);
const { reviewHash, requiredApproval, ...reviewBase } = review;
if (reviewHash !== approvedHash || sha(JSON.stringify(reviewBase)) !== approvedHash || requiredApproval !== reviewReference || review.status !== "requires_explicit_approval" || review.scope.newOfficialProgramCount !== 1 || review.scope.archiveProgramAliasCount !== 2 || review.scope.archiveScholarshipAliasCount !== 1 || review.scope.overwriteCount !== 0 || review.scope.deleteCount !== 0 || review.reconciliation.destructiveDeletion !== false || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== validation.bundleSha256) throw new Error("Approved AHU cleanup review does not match the stored operation.");
const publication = { ...candidate, version: 2, generatedAt: approvedAt, handoff: { sourceSystem: "CUAC reviewed official Anhui University program catalog", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256: sha(JSON.stringify(Object.keys(candidate.programs[0]).sort())), reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true }, programs: candidate.programs.map((row: any) => ({ ...row, status: "active", verificationStatus: "verified", lastVerifiedAt: approvedAt })) };
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok) throw new Error(report.errors.join("\n"));
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:ahu-economics-cleanup-publish" });
let result: any;
try {
  result = await createTransactionalSqlClient(pool).transaction(async (tx) => {
    const baseline = review.reconciliation.baseline;
    const school = await tx.query<any>("select id,status from schools where slug='anhui-university'", []);
    if (school.length !== 1 || school[0].id !== baseline.school.id || school[0].status !== "active") throw new Error("AHU school baseline changed.");
    const oldProgramIds = baseline.programs.map((row: any) => row.id), oldScholarshipId = baseline.scholarship.id;
    const oldPrograms = await tx.query<any>("select id,status,verification_status from programs where id=any($1::uuid[])", [oldProgramIds]);
    const oldScholarship = await tx.query<any>("select id,status,verification_status from scholarships where id=$1", [oldScholarshipId]);
    if (oldPrograms.length !== 2 || oldPrograms.some((row) => row.verification_status === "verified" || !["active","archived"].includes(row.status)) || oldScholarship.length !== 1 || oldScholarship[0].verification_status === "verified" || !["active","archived"].includes(oldScholarship[0].status)) throw new Error("AHU archive baseline changed.");
    const existingNew = await tx.query<any>("select id,status,verification_status from programs where slug=$1", [review.reconciliation.newProgramSlug]);
    if (existingNew.length && !(existingNew.length === 1 && existingNew[0].status === "active" && existingNew[0].verification_status === "verified")) throw new Error("AHU official Economics target conflicts.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["hefei"], preserveExistingSchoolSlugs: ["anhui-university"] });
    if (!written.ok) throw new Error(written.errors.join(" "));
    await tx.query("update programs set status='archived',updated_at=now() where id=any($1::uuid[]) and status='active'", [oldProgramIds]);
    await tx.query("update scholarships set status='archived',updated_at=now() where id=$1 and status='active'", [oldScholarshipId]);
    const totals = await tx.query<any>("select count(*) filter(where status='active')::text programs,count(*) filter(where status='active' and verification_status='verified')::text verified_programs,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships,(select count(*) from programs where id=any($2::uuid[]) and status='archived')::text archived_programs,(select count(*) from scholarships where id=$3 and status='archived')::text archived_scholarships from programs where school_id=$1", [school[0].id, oldProgramIds, oldScholarshipId]);
    const official = await tx.query<any>("select id,status,verification_status,name_en,name_zh,field_category from programs where slug=$1", [review.reconciliation.newProgramSlug]);
    if (totals[0]?.programs !== "169" || totals[0]?.verified_programs !== "169" || totals[0]?.scholarships !== "1" || totals[0]?.verified_scholarships !== "1" || totals[0]?.archived_programs !== "2" || totals[0]?.archived_scholarships !== "1" || official.length !== 1 || official[0].status !== "active" || official[0].verification_status !== "verified" || official[0].name_en !== "Economics" || official[0].name_zh !== "经济学" || official[0].field_category !== "Economy") throw new Error(`AHU cleanup post-check failed: ${JSON.stringify({ totals: totals[0], official: official[0] })}`);
    return { written: written.summary, totals: totals[0], officialProgramId: official[0].id };
  });
} finally { await pool.end(); }
const approval = { version: 1, approvedAt, reviewReference, approvedReviewSha256: approvedHash, publicationBundleSha256: report.bundleSha256, operation: "ahu-economics-and-legacy-cleanup", physicalDeletion: false, archivedProgramSlugs: review.reconciliation.archiveProgramSlugs, archivedScholarshipSlugs: review.reconciliation.archiveScholarshipSlugs, result, prohibitedDataConfirmedExcluded: true };
await Promise.all([writeFile(`seeds/${prefix}.approved.local.json`, `${JSON.stringify(publication, null, 2)}\n`), writeFile(`seeds/${prefix}.approval.json`, `${JSON.stringify(approval, null, 2)}\n`)]);
console.log(JSON.stringify({ ok: true, reviewHash: approvedHash, ...result }, null, 2));
