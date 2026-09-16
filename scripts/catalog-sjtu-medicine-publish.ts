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
const candidatePath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.review.json");
const outputPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.approved.local.json");
const approvalPath = resolve(root, "seeds/catalog.sjtu-medicine-batch-01.approval.json");
const statePath = resolve(root, ".cuac-local/runtime.json");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidate = await parse(candidatePath) as CatalogSeedBundle;
const storedValidation = await parse(validationPath);
const review = await parse(reviewPath);
const state = await parse(statePath);
const actualReviewHash = createHash("sha256").update(JSON.stringify(review)).digest("hex");
if (actualReviewHash !== approvedReviewHash) throw new Error("User-approved review hash does not match the stored SJTU Medicine review.");
const freshValidation = createCatalogMigrationValidationReport(candidate);
const approvedCandidateHash = review.candidateBundleSha256;
if (!freshValidation.ok || freshValidation.bundleSha256 !== approvedCandidateHash) throw new Error("Stored review does not match a valid candidate bundle.");
if (!storedValidation.ok || storedValidation.bundleSha256 !== approvedCandidateHash || storedValidation.operationPlanSha256 !== freshValidation.operationPlanSha256) throw new Error("Stored validation does not match the approved candidate bundle.");
if (review.status !== "awaiting_user_approval" || review.sensitiveDataCheck?.result !== "pass" || review.sensitiveDataCheck?.scope !== "candidate bundle only") throw new Error("SJTU Medicine review is not ready for publication.");
if (review.scope?.schoolCount !== 1 || review.scope?.programCount !== 3 || review.scope?.intakeCount !== 3 || review.scope?.chineseProgramCount !== 2 || review.scope?.englishProgramCount !== 1) throw new Error("SJTU Medicine review scope mismatch.");
const legacyAliases: string[] = review.reconciliation?.legacyAliasesToArchive;
const stableMatchingSlugs: string[] = review.reconciliation?.stableMatchingSlugs;
if (!Array.isArray(legacyAliases) || legacyAliases.length !== 0) throw new Error("SJTU Medicine publication must not archive aliases.");
if (!Array.isArray(stableMatchingSlugs) || stableMatchingSlugs.length !== 2 || new Set(stableMatchingSlugs).size !== 2) throw new Error("SJTU Medicine reconciliation requires two stable matches.");
if (stableMatchingSlugs.some(slug => !(candidate.programs ?? []).some(program => program.slug === slug))) throw new Error("A stable match is absent from the candidate.");

const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvalRecordedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official Shanghai Jiao Tong University School of Medicine 2026 admissions sources",
    cleanedExportName: "catalog.sjtu-medicine-batch-01.draft.json", cleanedExportSha256: approvedCandidateHash,
    sourceSchemaSha256: "88f279b9ee98d01e4a4b337c0467c652cebd8b11b4bc412156f975231d917cb3",
    reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true,
  },
  cities: (candidate.cities ?? []).map(city => ({ ...city, status: "active" as const })),
  schools: (candidate.schools ?? []).map(school => ({ ...school, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
  programs: (candidate.programs ?? []).map(program => ({ ...program, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvalRecordedAt })),
  programIntakes: candidate.programIntakes ?? [], scholarships: [],
};
const publicationReport = createCatalogMigrationValidationReport(publication);
if (!publicationReport.ok || publicationReport.summary.schools !== 1 || publicationReport.summary.programs !== 3 || publicationReport.summary.programIntakes !== 3) throw new Error(`Publication bundle is invalid: ${publicationReport.errors.join(" ")}`);
const approvalRecord = {
  version: 1, approvedAt: approvalRecordedAt, reviewReference, approvedReviewSha256: approvedReviewHash,
  approvedCandidate: "seeds/catalog.sjtu-medicine-batch-01.draft.json", approvedCandidateBundleSha256: approvedCandidateHash,
  publicationBundle: "seeds/catalog.sjtu-medicine-batch-01.approved.local.json", publicationBundleSha256: publicationReport.bundleSha256,
  schoolSlugs: publication.schools?.map(item => item.slug) ?? [], programSlugs: publication.programs?.map(item => item.slug) ?? [],
  archivedLegacyAliases: legacyAliases, stableMatchingSlugs, prohibitedDataConfirmedExcluded: true,
};
async function writeOrVerify(path: string, value: unknown) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, content, { encoding: "utf8", flag: "wx" }); }
  catch (error: any) {
    if (error?.code !== "EEXIST") throw error;
    if (await readFile(path, "utf8") !== content) throw new Error(`Existing artifact does not match this approval: ${path}`);
  }
}
await writeOrVerify(outputPath, publication);
await writeOrVerify(approvalPath, approvalRecord);
const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:sjtu-medicine-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async tx => {
    const identity = await tx.query<{ database_name: string; database_user: string }>("select current_database() as database_name, current_user as database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Connected PostgreSQL identity does not match the CUAC local runtime.");
    const stableRows = await tx.query<{ slug: string; status: string; verification_status: string }>(
      `select p.slug, p.status, p.verification_status from programs p join schools s on s.id = p.school_id where s.slug = $1 and p.slug = any($2::text[]) order by p.slug`,
      ["shanghai-jiao-tong-university-school-of-medicine", stableMatchingSlugs],
    );
    if (stableRows.length !== 2 || stableRows.some(row => row.status !== "active" || row.verification_status !== "unverified")) throw new Error("The two stable medical programs no longer match the reviewed active/unverified state.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication);
    if (!written.ok) throw new Error(`Catalog write failed: ${written.errors.join(" ")}`);
    return { written, stableMatches: stableRows.map(row => row.slug).sort(), archived: [] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, approvedCandidateBundleSha256: approvedCandidateHash, publicationBundleSha256: publicationReport.bundleSha256, approvalPath, outputPath, ...result }, null, 2));
} finally { await pool.end(); }
