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
const prefix = "catalog.blcu-school-undergraduate-cleanup", sha = (value: string) => createHash("sha256").update(value).digest("hex");
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8"), candidate = JSON.parse(candidateText), validation = await read(`seeds/${prefix}.validation.json`), review = await read(`seeds/${prefix}.review.json`), state = await read(".cuac-local/runtime.json"), fresh = createCatalogMigrationValidationReport(candidate);
const { reviewHash, requiredApproval, ...reviewBase } = review;
if (reviewHash !== approvedHash || sha(JSON.stringify(reviewBase)) !== approvedHash || requiredApproval !== reviewReference || review.status !== "requires_explicit_approval" || review.scope.schoolOverwriteCount !== 1 || review.scope.stableProgramOverwriteCount !== 11 || review.scope.newProgramCount !== 2 || review.scope.archiveProgramCount !== 3 || review.scope.archiveScholarshipCount !== 2 || review.scope.deleteCount !== 0 || review.reconciliation.destructiveDeletion !== false || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== validation.bundleSha256) throw new Error("Approved BLCU cleanup review does not match the stored operation.");
const publication = {
  ...candidate, version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed BLCU 2026 undergraduate official PDF", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256: sha(JSON.stringify(Object.keys(candidate.programs[0]).sort())), reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  schools: candidate.schools.map((row: any) => ({ ...row, status: "active", verificationStatus: "verified", lastVerifiedAt: approvedAt })),
  programs: candidate.programs.map((row: any) => ({ ...row, status: "active", verificationStatus: "verified", lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok) throw new Error(report.errors.join("\n"));
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:blcu-school-undergraduate-cleanup-publish" });
let result: any;
try {
  const client = createTransactionalSqlClient(pool);
  result = await client.transaction(async (tx) => {
    const baseline = review.reconciliation.baseline;
    const schoolBefore = await tx.query<any>("select id,status,verification_status from schools where slug='beijing-language-and-culture-university'", []);
    if (schoolBefore.length !== 1 || schoolBefore[0].id !== baseline.school.id || !["unverified", "verified"].includes(schoolBefore[0].verification_status)) throw new Error("BLCU school baseline changed.");
    const stableSlugs = review.reconciliation.stableProgramSlugs, newSlugs = review.reconciliation.newProgramSlugs;
    const stableBefore = await tx.query<any>("select id,slug,status,verification_status from programs where slug=any($1::text[]) order by slug", [stableSlugs]);
    const expectedStableIds = new Map(baseline.stablePrograms.map((row: any) => [row.slug, row.id]));
    if (stableBefore.length !== 11 || stableBefore.some((row) => row.id !== expectedStableIds.get(row.slug) || row.status !== "active" || !["unverified", "verified"].includes(row.verification_status))) throw new Error("BLCU stable-program baseline changed.");
    const newBefore = await tx.query<any>("select slug,status,verification_status from programs where slug=any($1::text[])", [newSlugs]);
    if (newBefore.length && !(newBefore.length === 2 && newBefore.every((row) => row.status === "active" && row.verification_status === "verified"))) throw new Error("BLCU new-program conflict detected.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["beijing"] });
    if (!written.ok) throw new Error(written.errors.join(" "));
    await tx.query("update schools set language_requirement=null,hsk_requirement=null,english_requirement=null,csca_required=null,csca_requirement=null,csca_subjects='[]'::jsonb,subject_tags='[]'::jsonb,language_tags='[]'::jsonb,contact_notes=null,updated_at=now() where id=$1", [baseline.school.id]);
    const programArchiveIds = baseline.programArchives.map((row: any) => row.id), scholarshipArchiveIds = baseline.scholarshipArchives.map((row: any) => row.id);
    await tx.query("update programs set status='archived',updated_at=now() where id=any($1::uuid[]) and status='active'", [programArchiveIds]);
    await tx.query("update scholarships set status='archived',updated_at=now() where id=any($1::uuid[]) and status='active'", [scholarshipArchiveIds]);
    const schoolAfter = await tx.query<any>("select id,verification_status,source_url,csca_required from schools where id=$1", [baseline.school.id]);
    const stableAfter = await tx.query<any>("select id,slug,verification_status,status from programs where slug=any($1::text[]) order by slug", [stableSlugs]);
    const totals = await tx.query<any>("select count(*)::text programs,count(*) filter(where verification_status='verified')::text verified,count(*) filter(where verification_status<>'verified')::text legacy,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships,(select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::text verified_scholarships,(select count(*) from programs where id=any($2::uuid[]) and status='archived')::text archived_programs,(select count(*) from scholarships where id=any($3::uuid[]) and status='archived')::text archived_scholarships from programs where school_id=$1 and status='active'", [baseline.school.id, programArchiveIds, scholarshipArchiveIds]);
    if (schoolAfter[0]?.verification_status !== "verified" || schoolAfter[0]?.source_url !== candidate.schools[0].sourceUrl || schoolAfter[0]?.csca_required !== null || stableAfter.length !== 11 || stableAfter.some((row) => row.id !== expectedStableIds.get(row.slug) || row.status !== "active" || row.verification_status !== "verified") || totals[0].programs !== "109" || totals[0].verified !== "109" || totals[0].legacy !== "0" || totals[0].intakes !== "128" || totals[0].scholarships !== "7" || totals[0].verified_scholarships !== "4" || totals[0].archived_programs !== "3" || totals[0].archived_scholarships !== "2") throw new Error(`BLCU cleanup post-check failed: ${JSON.stringify({ school: schoolAfter[0], totals: totals[0] })}`);
    return { written: written.summary, totals: totals[0] };
  });
} finally { await pool.end(); }
const approval = { version: 1, approvedAt, reviewReference, approvedReviewSha256: approvedHash, publicationBundleSha256: report.bundleSha256, operation: "blcu-school-undergraduate-cleanup", physicalDeletion: false, archivedProgramSlugs: review.reconciliation.archiveProgramSlugs, archivedScholarshipSlugs: review.reconciliation.archiveScholarshipSlugs, result, prohibitedDataConfirmedExcluded: true };
await Promise.all([writeFile(`seeds/${prefix}.approved.local.json`, `${JSON.stringify(publication, null, 2)}\n`), writeFile(`seeds/${prefix}.approval.json`, `${JSON.stringify(approval, null, 2)}\n`)]);
console.log(JSON.stringify({ ok: true, reviewHash: approvedHash, ...result }, null, 2));
