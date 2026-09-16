import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
if ([...options.keys()].some((key) => !["review-hash", "review", "approved-at", "confirm"].includes(key))) throw new Error("Unknown publication option.");
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash) || Number.isNaN(Date.parse(approvedAt))) throw new Error("Invalid review hash or approval timestamp.");
if (confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Incorrect local publication confirmation token.");

const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.validation.json"),
  review: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.review.json"),
  output: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.approved.local.json"),
  approval: resolve(root, "seeds/catalog.beihang-scholarships-complete-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state)]);
const { reviewHash: storedHash, requiredApproval: storedApproval, ...reviewBase } = review;
if (storedHash !== approvedReviewHash || hash(JSON.stringify(reviewBase)) !== approvedReviewHash || storedApproval !== reviewReference) throw new Error("Approved Beihang scholarship review does not match the stored review.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || hash(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("Beihang scholarship candidate or validation changed after review.");
if (review.status !== "requires_explicit_approval" || review.sensitiveDataCheck?.result !== "pass" || review.scope?.newScholarshipCount !== 10 || review.scope?.archiveScholarshipAliasCount !== 1 || review.reconciliation?.destructiveDeletion !== false) throw new Error("Beihang scholarship review scope is invalid.");
const scholarships = candidate.scholarships ?? [];
const scholarshipSlugs = scholarships.map((row) => row.slug);
if (scholarships.length !== 10 || new Set(scholarshipSlugs).size !== 10 || scholarships.some((row) => row.schoolSlug !== "beihang-university" || row.status !== "draft")) throw new Error("Beihang publication must contain ten reviewed draft scholarships.");
const legacySlug = review.reconciliation.archive.slug;
const stableSlug = review.reconciliation.stableScholarship.slug;
if (legacySlug !== "beihang-university" || stableSlug !== "official-2026-beihang-high-level-postgraduate-scholarship") throw new Error("Beihang scholarship reconciliation identities changed.");

const sourceSchemaSha256 = hash(JSON.stringify({
  cityFields: [...new Set((candidate.cities ?? []).flatMap((row) => Object.keys(row)))].sort(),
  schoolFields: [...new Set((candidate.schools ?? []).flatMap((row) => Object.keys(row)))].sort(),
  scholarshipFields: [...new Set(scholarships.flatMap((row) => Object.keys(row)))].sort(),
}));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official Beihang scholarship pages",
    cleanedExportName: "catalog.beihang-scholarships-complete-batch-01.draft.json", cleanedExportSha256: fresh.bundleSha256,
    sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt,
    sourceReadOnly: true, prohibitedDataConfirmedExcluded: true,
  },
  cities: candidate.cities ?? [], schools: candidate.schools ?? [], programs: [], programIntakes: [],
  scholarships: scholarships.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
};
const publicationReport = createCatalogMigrationValidationReport(publication);
if (!publicationReport.ok || publicationReport.summary.cities !== 2 || publicationReport.summary.schools !== 1 || publicationReport.summary.scholarships !== 10) throw new Error(`Invalid Beihang scholarship publication: ${publicationReport.errors.join(" ")}`);
const approval = {
  version: 1, approvedAt, approvalMode: "explicit-product-owner-approval", reviewReference, approvedReviewSha256: approvedReviewHash,
  approvedCandidateFileSha256: hash(candidateText), approvedCandidateBundleSha256: fresh.bundleSha256,
  publicationBundle: "seeds/catalog.beihang-scholarships-complete-batch-01.approved.local.json", publicationBundleSha256: publicationReport.bundleSha256,
  schoolSlug: "beihang-university", scholarshipSlugs, preservedScholarshipSlug: stableSlug, archivedScholarshipAlias: legacySlug, prohibitedDataConfirmedExcluded: true,
};
async function writeOrVerify(path: string, value: unknown) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); }
  catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); }
}
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:beihang-scholarships-complete-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<{database_name: string; database_user: string}>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const school = await tx.query<{id: string; status: string; verification_status: string}>("select id,status,verification_status from schools where slug='beihang-university'", []);
    if (school.length !== 1 || school[0].id !== review.reconciliation.databaseBaseline.schoolId || school[0].status !== "active" || school[0].verification_status !== "verified") throw new Error("Beihang school identity changed after review.");
    const programs = await tx.query<{active_count: string; verified_count: string}>("select count(*)::text active_count,count(*) filter(where verification_status='verified')::text verified_count from programs where school_id=$1 and status='active'", [school[0].id]);
    if (programs[0]?.active_count !== "264" || programs[0]?.verified_count !== "264") throw new Error("Beihang verified program baseline changed after review.");
    const stable = await tx.query<{id: string; slug: string; status: string; verification_status: string; source_url: string; last_verified_at: Date | null}>("select id,slug,status,verification_status,source_url,last_verified_at from scholarships where slug=$1", [stableSlug]);
    if (stable.length !== 1 || stable[0].id !== review.reconciliation.databaseBaseline.stableScholarshipId || stable[0].status !== "active" || stable[0].verification_status !== "verified") throw new Error("The preserved Beihang scholarship changed after review.");
    const before = await tx.query<{slug: string; status: string; verification_status: string; last_verified_at: Date | null}>("select slug,status,verification_status,last_verified_at from scholarships where slug=any($1::text[]) order by slug", [scholarshipSlugs]);
    const legacy = await tx.query<{id: string; status: string; verification_status: string}>("select id,status,verification_status from scholarships where slug=$1", [legacySlug]);
    const preState = before.length === 0 && legacy.length === 1 && legacy[0].id === review.reconciliation.databaseBaseline.legacyScholarshipId && legacy[0].status === "active" && legacy[0].verification_status === "unverified";
    const postState = before.length === 10 && before.every((row) => row.status === "active" && row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt) && legacy.length === 1 && legacy[0].status === "archived";
    if (!preState && !postState) throw new Error("Beihang scholarship rows no longer match reviewed pre-state or approved post-state.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    await tx.query("update scholarships set status='archived',updated_at=now() where id=$1 and slug=$2 and status='active'", [review.reconciliation.databaseBaseline.legacyScholarshipId, legacySlug]);
    const finalCandidates = await tx.query<{slug: string; verification_status: string; last_verified_at: Date | null; benefit_count: string; eligibility_count: string; material_count: string; step_count: string; action_count: string}>(
      `select slug,verification_status,last_verified_at,jsonb_array_length(benefit_items)::text benefit_count,jsonb_array_length(eligibility_items)::text eligibility_count,jsonb_array_length(application_materials)::text material_count,jsonb_array_length(application_steps)::text step_count,jsonb_array_length(action_links)::text action_count from scholarships where slug=any($1::text[]) and status='active' order by slug`, [scholarshipSlugs]);
    if (finalCandidates.length !== 10 || finalCandidates.some((row) => row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== approvedAt || [row.benefit_count,row.eligibility_count,row.material_count,row.step_count,row.action_count].some((value) => Number(value) < 1))) throw new Error("Beihang rich scholarship post-publication checks failed.");
    const totals = await tx.query<{active_count: string; verified_count: string; archived_legacy: string}>("select count(*) filter(where status='active')::text active_count,count(*) filter(where status='active' and verification_status='verified')::text verified_count,count(*) filter(where slug=$2 and status='archived')::text archived_legacy from scholarships where school_id=$1", [school[0].id, legacySlug]);
    if (totals[0]?.active_count !== "11" || totals[0]?.verified_count !== "11" || totals[0]?.archived_legacy !== "1") throw new Error(`Beihang final scholarship totals invalid: ${JSON.stringify(totals[0])}`);
    return { written, activeScholarshipCount: totals[0].active_count, verifiedScholarshipCount: totals[0].verified_count, archivedLegacyCount: totals[0].archived_legacy };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: publicationReport.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
