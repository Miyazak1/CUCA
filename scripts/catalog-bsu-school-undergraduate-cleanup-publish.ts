import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const args = new Map(process.argv.slice(2).map((arg) => {
  const at = arg.indexOf("=");
  if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires a value: ${arg}`);
  return [arg.slice(2, at), arg.slice(at + 1)];
}));
if ([...args.keys()].some((key) => !["review-hash", "review", "approved-at", "confirm"].includes(key))) throw new Error("Unknown publication option.");
const required = (name: string) => {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
};
const approvedReviewHash = required("review-hash");
const reviewReference = required("review");
const approvedAt = required("approved-at");
const confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(approvedReviewHash) || Number.isNaN(Date.parse(approvedAt)) || confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Invalid BSU publication authorization options.");

const root = process.cwd();
const prefix = "catalog.bsu-school-undergraduate-cleanup";
const schoolSlug = "beijing-sport-university";
const paths = {
  candidate: resolve(root, `seeds/${prefix}.draft.json`),
  validation: resolve(root, `seeds/${prefix}.validation.json`),
  review: resolve(root, `seeds/${prefix}.review.json`),
  output: resolve(root, `seeds/${prefix}.approved.local.json`),
  approval: resolve(root, `seeds/${prefix}.approval.json`),
  safeApproval: resolve(root, "seeds/catalog.bsu-safe-new-batch-01.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, safeApproval, state] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.safeApproval), parse(paths.state)]);
const { reviewHash: storedHash, requiredApprovalText: storedApproval, ...reviewBase } = review;
if (storedHash !== approvedReviewHash || sha(JSON.stringify(reviewBase)) !== approvedReviewHash || storedApproval !== reviewReference) throw new Error("Approved BSU review hash/reference mismatch.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("BSU cleanup candidate changed after review.");
if (review.status !== "awaiting_exact_user_approval" || review.sourceReview?.result !== "pass" || review.sensitiveDataCheck?.result !== "pass" || review.reconciliation?.destructiveDeletion !== false || review.scope?.schoolOverwriteCount !== 1 || review.scope?.programOverwriteCount !== 10 || review.scope?.programIntakeUpsertCount !== 10 || review.scope?.archiveCount !== 0 || review.scope?.protectedProgramCount !== 96 || review.scope?.protectedScholarshipCount !== 1) throw new Error("BSU cleanup review scope mismatch.");
if (candidate.cities?.length !== 1 || candidate.schools?.length !== 1 || candidate.programs?.length !== 10 || candidate.programIntakes?.length !== 10 || (candidate.scholarships?.length ?? 0) !== 0) throw new Error("BSU cleanup candidate scope changed.");

const sourceSchemaSha256 = sha(JSON.stringify({
  cityFields: [...new Set(candidate.cities.flatMap(Object.keys))].sort(),
  schoolFields: [...new Set(candidate.schools.flatMap(Object.keys))].sort(),
  programFields: [...new Set(candidate.programs.flatMap(Object.keys))].sort(),
  intakeFields: [...new Set(candidate.programIntakes.flatMap(Object.keys))].sort(),
}));
const publication: CatalogSeedBundle = {
  version: 2,
  generatedAt: approvedAt,
  handoff: {
    sourceSystem: "CUAC reviewed official Beijing Sport University 2026 school and undergraduate catalog update",
    cleanedExportName: `${prefix}.draft.json`,
    cleanedExportSha256: fresh.bundleSha256,
    sourceSchemaSha256,
    reviewReference,
    prohibitedDataReviewReference: reviewReference,
    approvalRecordedAt: approvedAt,
    sourceReadOnly: true,
    prohibitedDataConfirmedExcluded: true,
  },
  cities: candidate.cities.map((row) => ({ ...row, status: "active" as const })),
  schools: candidate.schools.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programs: candidate.programs.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: candidate.programIntakes,
  scholarships: [],
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.cities !== 1 || report.summary.schools !== 1 || report.summary.programs !== 10 || report.summary.programIntakes !== 10 || report.summary.scholarships !== 0) throw new Error(`Invalid BSU publication: ${report.errors.join(" ")}`);

const programSlugs = publication.programs!.map((row) => row.slug);
const protectedProgramSlugs: string[] = safeApproval.programSlugs;
const protectedScholarshipSlugs: string[] = safeApproval.scholarshipSlugs;
if (protectedProgramSlugs.length !== 96 || protectedScholarshipSlugs.length !== 1 || programSlugs.some((slug) => protectedProgramSlugs.includes(slug))) throw new Error("BSU protected record list mismatch.");
const approval = {
  version: 1,
  approvedAt,
  approvalMode: "explicit-product-owner-approval",
  reviewReference,
  approvedReviewSha256: approvedReviewHash,
  approvedCandidateFileSha256: sha(candidateText),
  approvedCandidateBundleSha256: fresh.bundleSha256,
  publicationBundle: `seeds/${prefix}.approved.local.json`,
  publicationBundleSha256: report.bundleSha256,
  schoolSlug,
  programSlugs,
  protectedProgramSlugs,
  protectedScholarshipSlugs,
  archivedProgramAliases: [],
  archivedScholarshipAliases: [],
  prohibitedDataConfirmedExcluded: true,
};
async function writeOrVerify(path: string, value: unknown) {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); }
  catch (error: any) {
    if (error?.code !== "EEXIST") throw error;
    if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`);
  }
}
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);

const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:bsu-school-undergraduate-cleanup-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const identity = await tx.query<any>("select current_database() database_name,current_user database_user", []);
    if (identity[0]?.database_name !== target.publicTarget.databaseName || identity[0]?.database_user !== target.publicTarget.databaseUser) throw new Error("Database identity mismatch.");
    const cityBefore = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='beijing'", []);
    const schoolBefore = await tx.query<any>("select id,status,verification_status,last_verified_at from schools where slug=$1", [schoolSlug]);
    const targetProgramsBefore = await tx.query<any>("select id,slug,status,verification_status,last_verified_at from programs where slug=any($1::text[]) order by slug", [programSlugs]);
    const targetIntakesBefore = await tx.query<any>("select p.slug,pi.intake_term,pi.intake_year from program_intakes pi join programs p on p.id=pi.program_id where p.slug=any($1::text[]) order by p.slug,pi.intake_year,pi.intake_term", [programSlugs]);
    const protectedProgramsBefore = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.slug=any($1::text[])", [protectedProgramSlugs]);
    const protectedScholarshipsBefore = await tx.query<any>("select jsonb_agg(to_jsonb(s)-'created_at'-'updated_at' order by s.slug) snapshot from scholarships s where s.slug=any($1::text[])", [protectedScholarshipSlugs]);
    if (cityBefore.length !== 1 || schoolBefore.length !== 1 || schoolBefore[0].id !== review.reconciliation.databaseBaseline.schoolId || schoolBefore[0].status !== "active") throw new Error("BSU school/city baseline changed.");
    if (targetProgramsBefore.length !== 10 || targetProgramsBefore.some((row) => row.status !== "active")) throw new Error("BSU undergraduate baseline changed.");
    const intakeIsReviewed = targetIntakesBefore.length === 10 && targetIntakesBefore.every((row) => row.intake_year === 2026 && row.intake_term === "2026 本科申请");
    const intakeIsPublished = targetIntakesBefore.length === 10 && targetIntakesBefore.every((row) => row.intake_year === 2026 && row.intake_term === "Fall");
    if (!intakeIsReviewed && !intakeIsPublished) throw new Error(`BSU undergraduate intake baseline changed: ${JSON.stringify(targetIntakesBefore)}`);
    const baselineIds = new Set(review.reconciliation.databaseBaseline.programSnapshots.map((row: any) => row.id));
    if (targetProgramsBefore.some((row) => !baselineIds.has(row.id))) throw new Error("BSU undergraduate identities changed.");
    if (protectedProgramsBefore[0]?.snapshot?.length !== 96 || protectedScholarshipsBefore[0]?.snapshot?.length !== 1) throw new Error("BSU protected records are incomplete.");
    const beforeIsReviewed = schoolBefore[0].verification_status === "unverified" && targetProgramsBefore.every((row) => row.verification_status === "unverified");
    const beforeIsPublished = schoolBefore[0].verification_status === "verified" && schoolBefore[0].last_verified_at?.toISOString() === approvedAt && targetProgramsBefore.every((row) => row.verification_status === "verified" && row.last_verified_at?.toISOString() === approvedAt);
    if (!beforeIsReviewed && !beforeIsPublished) throw new Error("BSU cleanup is neither at the reviewed baseline nor the approved published state.");
    if (intakeIsReviewed) {
      const remapped = await tx.query<any>("update program_intakes pi set intake_term='Fall',updated_at=now() from programs p where pi.program_id=p.id and p.slug=any($1::text[]) and pi.intake_year=2026 and pi.intake_term='2026 本科申请' returning pi.id", [programSlugs]);
      if (remapped.length !== 10) throw new Error(`BSU intake key remap affected ${remapped.length} rows instead of 10.`);
    }
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["beijing"] });
    if (!written.ok) throw new Error(`BSU cleanup write failed: ${written.errors.join(" ")}`);
    const cityAfter = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='beijing'", []);
    const protectedProgramsAfter = await tx.query<any>("select jsonb_agg(to_jsonb(p)-'created_at'-'updated_at' order by p.slug) snapshot from programs p where p.slug=any($1::text[])", [protectedProgramSlugs]);
    const protectedScholarshipsAfter = await tx.query<any>("select jsonb_agg(to_jsonb(s)-'created_at'-'updated_at' order by s.slug) snapshot from scholarships s where s.slug=any($1::text[])", [protectedScholarshipSlugs]);
    if (JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0]?.snapshot) || JSON.stringify(protectedProgramsAfter[0]?.snapshot) !== JSON.stringify(protectedProgramsBefore[0]?.snapshot) || JSON.stringify(protectedScholarshipsAfter[0]?.snapshot) !== JSON.stringify(protectedScholarshipsBefore[0]?.snapshot)) throw new Error("BSU publication changed protected dependencies.");
    const totals = await tx.query<any>(`select
      (select count(*) from schools where id=$1 and status='active' and verification_status='verified' and last_verified_at=$2)::int school_verified,
      (select count(*) from programs where school_id=$1 and status='active')::int programs,
      (select count(*) from programs where school_id=$1 and status='active' and verification_status='verified')::int verified_programs,
      (select count(*) from program_intakes pi join programs p on p.id=pi.program_id where p.school_id=$1 and p.status='active')::int intakes,
      (select count(*) from scholarships where school_id=$1 and status='active')::int scholarships,
      (select count(*) from scholarships where school_id=$1 and status='active' and verification_status='verified')::int verified_scholarships`, [schoolBefore[0].id, approvedAt]);
    const expected = { school_verified: 1, programs: 106, verified_programs: 106, intakes: 106, scholarships: 1, verified_scholarships: 1 };
    if (Object.entries(expected).some(([key, value]) => totals[0]?.[key] !== value)) throw new Error(`BSU cleanup verification failed: ${JSON.stringify({ expected, actual: totals[0] })}`);
    return { written: written.summary, totals: totals[0], schoolId: schoolBefore[0].id };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: approvedReviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally {
  await pool.end();
}
