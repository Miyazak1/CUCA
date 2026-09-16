import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map(arg => {
  const index = arg.indexOf("=");
  if (!arg.startsWith("--") || index < 0) throw new Error(`Option requires a value: ${arg}`);
  return [arg.slice(2, index), arg.slice(index + 1)];
}));
const allowed = new Set(["review-hash", "review", "approved-at", "confirm"]);
const unknown = [...options.keys()].filter(key => !allowed.has(key));
if (unknown.length) throw new Error(`Unknown options: ${unknown.join(", ")}`);
const required = (name: string) => {
  const value = options.get(name)?.trim();
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
};
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvalRecordedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash)) throw new Error("Review hash must be a lowercase SHA-256 digest.");
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(approvalRecordedAt) || Number.isNaN(Date.parse(approvalRecordedAt))) throw new Error("Approval time must be an ISO UTC timestamp.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local catalog publication confirmation token.");

const root = process.cwd();
const locations = {
  candidate: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.sjtu-scholarships-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidate = await parse(locations.candidate) as CatalogSeedBundle;
const storedValidation = await parse(locations.validation);
const review = await parse(locations.review);
const state = await parse(locations.state);

const actualReviewHash = createHash("sha256").update(JSON.stringify(review)).digest("hex");
if (actualReviewHash !== approvedReviewHash) throw new Error("User-approved review hash does not match the stored SJTU scholarship review.");
const freshValidation = createCatalogMigrationValidationReport(candidate);
const approvedCandidateHash = review.candidateBundleSha256;
if (!freshValidation.ok || freshValidation.bundleSha256 !== approvedCandidateHash) throw new Error("Stored SJTU scholarship review does not match a valid candidate bundle.");
if (!storedValidation.ok || storedValidation.bundleSha256 !== approvedCandidateHash || storedValidation.operationPlanSha256 !== freshValidation.operationPlanSha256) throw new Error("Stored validation does not match the approved SJTU candidate.");
if (review.status !== "awaiting_user_approval" || review.sensitiveDataCheck?.result !== "pass" || review.sensitiveDataCheck?.scope !== "candidate bundle only") throw new Error("SJTU scholarship candidate is not approved for publication review.");
if (review.scope?.schoolSlug !== "shanghai-jiao-tong-university" || review.scope?.schoolCount !== 1 || review.scope?.scholarshipCount !== 4 || review.scope?.existingVerifiedCount !== 1 || review.scope?.newScholarshipCount !== 4 || review.scope?.archiveCount !== 1) throw new Error("SJTU review scope must contain four new scholarships and one archive.");

const scholarships = candidate.scholarships ?? [];
const scholarshipSlugs = scholarships.map(item => item.slug);
if (scholarships.length !== 4 || new Set(scholarshipSlugs).size !== 4 || scholarships.some(item => item.schoolSlug !== "shanghai-jiao-tong-university" || item.status !== "draft")) throw new Error("SJTU candidate must contain four distinct draft scholarships.");
const stableMatchingSlugs: string[] = review.reconciliation?.stableMatchingSlugs;
const legacyAliases: string[] = review.reconciliation?.legacyAliasesToArchive;
if (!Array.isArray(stableMatchingSlugs) || stableMatchingSlugs.length !== 0) throw new Error("SJTU review must not identify a stable matching record.");
if (!Array.isArray(legacyAliases) || legacyAliases.length !== 1 || legacyAliases[0] !== "official-2026-sjtu-international-graduate-scholarships" || review.reconciliation?.destructiveDeletion !== false) throw new Error("SJTU review must archive exactly the reviewed aggregate without deletion.");
const sourceSchemaSha256 = createHash("sha256").update(JSON.stringify({
  version: candidate.version,
  cityFields: [...new Set((candidate.cities ?? []).flatMap(item => Object.keys(item)))].sort(),
  schoolFields: [...new Set((candidate.schools ?? []).flatMap(item => Object.keys(item)))].sort(),
  scholarshipFields: [...new Set(scholarships.flatMap(item => Object.keys(item)))].sort(),
})).digest("hex");

const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvalRecordedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official Shanghai Jiao Tong University 2026 scholarship sources",
    cleanedExportName: "catalog.sjtu-scholarships-batch-01.draft.json",
    cleanedExportSha256: approvedCandidateHash,
    sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt,
    sourceReadOnly: true, prohibitedDataConfirmedExcluded: true,
  },
  cities: (candidate.cities ?? []).map(item => ({ ...item, status: "active" as const })),
  schools: (candidate.schools ?? []).map(item => ({ ...item, status: "active" as const })),
  programs: [], programIntakes: [],
  scholarships: scholarships.map(item => ({ ...item, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
};
const publicationReport = createCatalogMigrationValidationReport(publication);
if (!publicationReport.ok || publicationReport.summary.cities !== 1 || publicationReport.summary.schools !== 1 || publicationReport.summary.programs !== 0 || publicationReport.summary.programIntakes !== 0 || publicationReport.summary.scholarships !== 4) throw new Error(`SJTU publication bundle is invalid: ${publicationReport.errors.join(" ")}`);
const approvalRecord = {
  version: 1, approvedAt: approvalRecordedAt, reviewReference, approvedReviewSha256: approvedReviewHash,
  approvedCandidate: "seeds/catalog.sjtu-scholarships-batch-01.draft.json", approvedCandidateBundleSha256: approvedCandidateHash,
  publicationBundle: "seeds/catalog.sjtu-scholarships-batch-01.approved.local.json", publicationBundleSha256: publicationReport.bundleSha256,
  schoolSlug: "shanghai-jiao-tong-university", scholarshipSlugs, stableMatchingSlugs, archivedLegacyAliases: legacyAliases,
  prohibitedDataConfirmedExcluded: true,
};
async function writeOrVerify(path: string, value: unknown) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, content, { encoding: "utf8", flag: "wx" }); }
  catch (error: any) {
    if (error?.code !== "EEXIST") throw error;
    if (await readFile(path, "utf8") !== content) throw new Error(`Existing artifact does not match this approval: ${path}`);
  }
}
await writeOrVerify(locations.output, publication);
await writeOrVerify(locations.approval, approvalRecord);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:sjtu-scholarships-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() as database_name, current_user as database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Connected PostgreSQL identity does not match the CUAC local runtime.");
    const schoolRows = await tx.query<{ status: string; verification_status: string; program_count: string }>(
      `select s.status, s.verification_status, count(p.id) filter (where p.status = 'active')::text as program_count
       from schools s left join programs p on p.school_id = s.id where s.slug = $1 group by s.id, s.status, s.verification_status`,
      ["shanghai-jiao-tong-university"],
    );
    if (schoolRows.length !== 1 || schoolRows[0]?.status !== "active" || schoolRows[0]?.verification_status !== "verified" || schoolRows[0]?.program_count !== "45") throw new Error("SJTU no longer matches the reviewed verified school with 45 active programs.");
    const reviewedSlugs = [...scholarshipSlugs, ...legacyAliases];
    const beforeRows = await tx.query<{ slug: string; status: string; verification_status: string; last_verified_at: Date | null }>(
      `select slug, status, verification_status, last_verified_at from scholarships where slug = any($1::text[]) order by slug`, [reviewedSlugs],
    );
    const isPreState = beforeRows.length === 1 && beforeRows[0]?.slug === legacyAliases[0] && beforeRows[0]?.status === "active" && beforeRows[0]?.verification_status === "verified";
    const publishedRows = beforeRows.filter(row => scholarshipSlugs.includes(row.slug));
    const archivedRowsBefore = beforeRows.filter(row => legacyAliases.includes(row.slug));
    const isPostState = publishedRows.length === 4 && publishedRows.every(row => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvalRecordedAt) && archivedRowsBefore.length === 1 && archivedRowsBefore[0]?.status === "archived";
    if (!isPreState && !isPostState) throw new Error("SJTU scholarships no longer match the reviewed pre-state or this approval's post-state.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    await tx.query(`update scholarships set status = 'archived', updated_at = now() where slug = any($1::text[]) and status = 'active'`, [legacyAliases]);
    const finalRows = await tx.query<{ slug: string; verification_status: string; last_verified_at: Date | null; body_count: string; benefit_count: string; eligibility_count: string; material_count: string; step_count: string; action_count: string }>(
      `select slug, verification_status, last_verified_at, jsonb_array_length(body_sections)::text as body_count,
        jsonb_array_length(benefit_items)::text as benefit_count, jsonb_array_length(eligibility_items)::text as eligibility_count,
        jsonb_array_length(application_materials)::text as material_count, jsonb_array_length(application_steps)::text as step_count,
        jsonb_array_length(action_links)::text as action_count from scholarships where slug = any($1::text[]) and status = 'active' order by slug`,
      [scholarshipSlugs],
    );
    if (finalRows.length !== 4 || finalRows.some(row => row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== approvalRecordedAt || [row.body_count, row.benefit_count, row.eligibility_count, row.material_count, row.step_count, row.action_count].some(value => Number(value) < 1))) throw new Error("Post-publication SJTU rich scholarship checks failed.");
    const archivedRows = await tx.query<{ status: string }>(`select status from scholarships where slug = any($1::text[])`, [legacyAliases]);
    if (archivedRows.length !== 1 || archivedRows[0]?.status !== "archived") throw new Error("The reviewed SJTU aggregate was not archived.");
    const count = await tx.query<{ count: string }>(`select count(*)::text as count from scholarships sc join schools s on s.id = sc.school_id where s.slug = $1 and sc.status = 'active' and sc.verification_status = 'verified'`, ["shanghai-jiao-tong-university"]);
    if (count[0]?.count !== "4") throw new Error("SJTU must expose exactly four active verified scholarships after publication.");
    return { written, scholarshipSlugs: finalRows.map(row => row.slug), archivedLegacyAliases: legacyAliases, finalScholarshipCount: finalRows.length };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, approvedCandidateBundleSha256: approvedCandidateHash, publicationBundleSha256: publicationReport.bundleSha256, approvalPath: locations.approval, outputPath: locations.output, ...result }, null, 2));
} finally { await pool.end(); }
