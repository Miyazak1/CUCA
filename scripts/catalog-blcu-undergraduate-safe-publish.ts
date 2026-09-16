import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const prefix = "catalog.blcu-undergraduate-safe-batch-01";
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(`seeds/${prefix}.draft.json`, "utf8");
const candidate = JSON.parse(candidateText), validation = await read(`seeds/${prefix}.validation.json`), review = await read(`seeds/${prefix}.review.json`), state = await read(".cuac-local/runtime.json");
const fresh = createCatalogMigrationValidationReport(candidate), { reviewHash, publicationReference, ...reviewBase } = review;
if (sha(JSON.stringify(reviewBase)) !== reviewHash || review.status !== "standing_user_approval" || review.scope.newProgramCount !== 36 || review.scope.newIntakeCount !== 46 || review.scope.schoolOverwriteCount || review.scope.archiveCount || review.scope.deleteCount || review.reconciliation.destructiveDeletion || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== validation.bundleSha256) throw new Error("BLCU undergraduate review mismatch.");
const approvedAt = new Date().toISOString();
const publication = {
  ...candidate, version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed BLCU 2026 undergraduate official PDF", cleanedExportName: `${prefix}.draft.json`, cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256: sha(JSON.stringify(Object.keys(candidate.programs[0]).sort())), reviewReference: publicationReference, prohibitedDataReviewReference: publicationReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  programs: candidate.programs.map((row: any) => ({ ...row, status: "active", verificationStatus: "verified", lastVerifiedAt: approvedAt })),
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok) throw new Error(report.errors.join("\n"));
await Promise.all([
  writeFile(`seeds/${prefix}.approved.local.json`, `${JSON.stringify(publication, null, 2)}\n`),
  writeFile(`seeds/${prefix}.approval.json`, `${JSON.stringify({ version: 1, approvedAt, approvalMode: "standing-user-default-publication", reviewReference: publicationReference, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, programSlugs: publication.programs.map((row: any) => row.slug), archivedRecords: [], prohibitedDataConfirmedExcluded: true }, null, 2)}\n`),
]);
const target = assertLocalCatalogPublishTarget(state, publication, LOCAL_CATALOG_PUBLISH_CONFIRMATION, publicationReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:blcu-undergraduate-safe-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const slugs = publication.programs.map((row: any) => row.slug);
    const before = await tx.query<any>("select slug,status,verification_status from programs where slug=any($1::text[])", [slugs]);
    if (before.length && !(before.length === 36 && before.every((row) => row.status === "active" && row.verification_status === "verified"))) throw new Error("BLCU undergraduate partial conflict.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["beijing"], preserveExistingSchoolSlugs: ["beijing-language-and-culture-university"] });
    if (!written.ok) throw new Error(written.errors.join(" "));
    const school = await tx.query<any>("select id from schools where slug='beijing-language-and-culture-university'", []);
    const totals = await tx.query<any>("select count(*)::text programs,count(*) filter(where verification_status='verified')::text verified,count(*) filter(where verification_status<>'verified')::text legacy,(select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1)::text intakes,(select count(*) from scholarships where school_id=$1 and status='active')::text scholarships from programs where school_id=$1 and status='active'", [school[0].id]);
    if (totals[0].programs !== "110" || totals[0].verified !== "96" || totals[0].legacy !== "14" || totals[0].intakes !== "106" || totals[0].scholarships !== "9") throw new Error(`BLCU undergraduate post-check failed: ${JSON.stringify(totals[0])}`);
    return { written: written.summary, totals: totals[0] };
  });
  console.log(JSON.stringify({ ok: true, reviewHash, ...result }, null, 2));
} finally { await pool.end(); }
