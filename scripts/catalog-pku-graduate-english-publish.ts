import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { assertLocalCatalogPublishTarget, LOCAL_CATALOG_PUBLISH_CONFIRMATION } from "../src/server/catalog/local-publish-safety.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const options = new Map(process.argv.slice(2).map((arg) => { const at = arg.indexOf("="); if (!arg.startsWith("--") || at < 0) throw new Error(`Option requires value: ${arg}`); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const required = (name: string) => { const value = options.get(name)?.trim(); if (!value) throw new Error(`Missing --${name}=...`); return value; };
const reviewHash = required("review-hash"), publicationReference = required("publication-reference"), confirmation = required("confirm");
if (!/^[a-f0-9]{64}$/.test(reviewHash) || publicationReference !== "standing-user-default-publication" || confirmation !== LOCAL_CATALOG_PUBLISH_CONFIRMATION) throw new Error("Invalid PKU English graduate publication parameters.");
const root = process.cwd();
const paths = {
  candidate: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.draft.json"),
  validation: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.validation.json"),
  review: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.review.json"),
  output: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.approved.local.json"),
  approval: resolve(root, "seeds/catalog.pku-graduate-english-batch-02.approval.json"),
  state: resolve(root, ".cuac-local/runtime.json"),
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const candidateText = await readFile(paths.candidate, "utf8");
const candidate = JSON.parse(candidateText) as CatalogSeedBundle;
const [validation, review, state] = await Promise.all([parse(paths.validation), parse(paths.review), parse(paths.state)]);
const { reviewHash: storedReviewHash, ...reviewBase } = review;
if (storedReviewHash !== reviewHash || sha(JSON.stringify(reviewBase)) !== reviewHash || review.status !== "standing_user_approval" || review.scope?.newProgramRouteCount !== 101 || review.scope?.newProgramIntakeCount !== 101 || review.scope?.overwriteCount !== 0 || review.scope?.archiveCount !== 0 || review.reconciliation?.destructiveDeletion !== false || review.reconciliation?.programSlugConflicts !== 0 || review.reconciliation?.semanticConflicts !== 0 || review.sensitiveDataCheck?.result !== "pass") throw new Error("PKU English graduate standing review is invalid.");
const fresh = createCatalogMigrationValidationReport(candidate);
if (!fresh.ok || !validation.ok || sha(candidateText) !== review.candidateSha256 || fresh.bundleSha256 !== review.candidateBundleSha256 || fresh.bundleSha256 !== validation.bundleSha256 || fresh.operationPlanSha256 !== review.operationPlanSha256 || fresh.operationPlanSha256 !== validation.operationPlanSha256) throw new Error("PKU English graduate candidate changed after review.");
const approvedAt = new Date().toISOString();
const reviewReference = `standing-user-default-publication-pku-graduate-english-${reviewHash}`;
const programSlugs = candidate.programs!.map((row) => row.slug);
const sourceSchemaSha256 = sha(JSON.stringify({ programFields: [...new Set(candidate.programs!.flatMap((row) => Object.keys(row)))].sort(), intakeFields: [...new Set(candidate.programIntakes!.flatMap((row) => Object.keys(row)))].sort() }));
const publication: CatalogSeedBundle = {
  version: 2, generatedAt: approvedAt,
  handoff: { sourceSystem: "CUAC reviewed official PKU 2026 English graduate department catalogs", cleanedExportName: "catalog.pku-graduate-english-batch-02.draft.json", cleanedExportSha256: fresh.bundleSha256, sourceSchemaSha256, reviewReference, prohibitedDataReviewReference: reviewReference, approvalRecordedAt: approvedAt, sourceReadOnly: true, prohibitedDataConfirmedExcluded: true },
  cities: candidate.cities, schools: candidate.schools,
  programs: candidate.programs!.map((row) => ({ ...row, status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: approvedAt })),
  programIntakes: candidate.programIntakes, scholarships: [],
};
const report = createCatalogMigrationValidationReport(publication);
if (!report.ok || report.summary.programs !== 101 || report.summary.programIntakes !== 101 || report.summary.scholarships !== 0) throw new Error(`Invalid PKU English publication: ${report.errors.join(" ")}`);
const approval = { version: 1, approvedAt, approvalMode: "standing-product-owner-authorization", reviewReference, approvedReviewSha256: reviewHash, approvedCandidateBundleSha256: fresh.bundleSha256, publicationBundle: "seeds/catalog.pku-graduate-english-batch-02.approved.local.json", publicationBundleSha256: report.bundleSha256, schoolSlug: "peking-university", programSlugs, archivedAliases: [], prohibitedDataConfirmedExcluded: true };
async function writeOrVerify(path: string, value: unknown) { const body = `${JSON.stringify(value, null, 2)}\n`; try { await writeFile(path, body, { encoding: "utf8", flag: "wx" }); } catch (error: any) { if (error?.code !== "EEXIST") throw error; if (await readFile(path, "utf8") !== body) throw new Error(`Existing artifact differs: ${path}`); } }
await writeOrVerify(paths.output, publication);
await writeOrVerify(paths.approval, approval);
const target = assertLocalCatalogPublishTarget(state, publication, confirmation, reviewReference);
const pool = createPostgresPool({ databaseUrl: target.databaseUrl, max: 1, applicationName: "cuac:pku-graduate-english-publish" });
try {
  const client = createTransactionalSqlClient(pool);
  const result = await client.transaction(async (tx) => {
    const school = await tx.query<any>("select id,status,verification_status from schools where slug='peking-university'", []);
    const cityBefore = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='beijing'", []);
    const schoolBefore = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='peking-university'", []);
    const counts = await tx.query<any>("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count from programs where school_id=$1 and status='active'", [school[0]?.id]);
    const conflicts = await tx.query<any>("select slug from programs where slug=any($1::text[])", [programSlugs]);
    const scholarshipsBefore = await tx.query<any>("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count from scholarships where school_id=$1 and status='active'", [school[0]?.id]);
    if (school.length !== 1 || school[0].id !== review.reconciliation.databaseBaseline.schoolId || school[0].status !== "active" || school[0].verification_status !== "verified" || cityBefore.length !== 1 || cityBefore[0].snapshot.id !== review.reconciliation.databaseBaseline.cityId || counts[0]?.active_count !== 65 || counts[0]?.verified_count !== 65 || conflicts.length !== 0) throw new Error("PKU English graduate publication baseline changed.");
    const written = await new CatalogSeedWriter(tx).writeBundle(publication, { preserveExistingCitySlugs: ["beijing"], preserveExistingSchoolSlugs: ["peking-university"] });
    if (!written.ok) throw new Error(`PKU English graduate write failed: ${written.errors.join(" ")}`);
    const cityAfter = await tx.query<any>("select to_jsonb(c)-'created_at'-'updated_at' snapshot from cities c where slug='beijing'", []);
    const schoolAfter = await tx.query<any>("select to_jsonb(s)-'created_at'-'updated_at' snapshot from schools s where slug='peking-university'", []);
    const final = await tx.query<any>("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count,count(*) filter(where slug=any($2::text[]))::int published_batch from programs where school_id=$1 and status='active'", [school[0].id, programSlugs]);
    const intakeFinal = await tx.query<any>("select count(*)::int count from program_intakes i join programs p on p.id=i.program_id where p.school_id=$1 and p.slug=any($2::text[]) and i.intake_year=2026", [school[0].id, programSlugs]);
    const scholarshipsAfter = await tx.query<any>("select count(*)::int active_count,count(*) filter(where verification_status='verified')::int verified_count from scholarships where school_id=$1 and status='active'", [school[0].id]);
    if (JSON.stringify(cityAfter[0]?.snapshot) !== JSON.stringify(cityBefore[0].snapshot) || JSON.stringify(schoolAfter[0]?.snapshot) !== JSON.stringify(schoolBefore[0].snapshot)) throw new Error("PKU city or school dependency changed.");
    if (final[0]?.active_count !== 166 || final[0]?.verified_count !== 166 || final[0]?.published_batch !== 101 || intakeFinal[0]?.count !== 101 || JSON.stringify(scholarshipsAfter[0]) !== JSON.stringify(scholarshipsBefore[0])) throw new Error(`PKU English graduate post-check failed: ${JSON.stringify({ final: final[0], intakes: intakeFinal[0], scholarshipsBefore: scholarshipsBefore[0], scholarshipsAfter: scholarshipsAfter[0] })}`);
    return { written, final: final[0], intakes: intakeFinal[0], scholarships: scholarshipsAfter[0] };
  });
  console.log(JSON.stringify({ ok: true, target: target.publicTarget, approvedReviewSha256: reviewHash, publicationBundleSha256: report.bundleSha256, approvalPath: paths.approval, outputPath: paths.output, ...result }, null, 2));
} finally { await pool.end(); }
