import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const confirmation = "publish-reviewed-100-official-catalog-to-cuac-single-host";
if (process.env.CUAC_REVIEWED_100_PUBLISH_CONFIRMATION !== confirmation) throw new Error("100-school catalog publication requires the exact confirmation token.");
if (process.env.CUAC_ENV !== "development" || process.env.CUAC_LOCAL_RUNTIME !== "1") throw new Error("100-school catalog publication is restricted to the owner-controlled single-host runtime.");
const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
if (!rawUrl) throw new Error("100-school catalog publication requires a PostgreSQL URL.");
const target = new URL(rawUrl);
if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.search || target.hash || !['127.0.0.1', '[::1]'].includes(target.hostname)
  || decodeURIComponent(target.username) !== "cuac_local" || decodeURIComponent(target.pathname.replace(/^\//, "")) !== "cuac_local") throw new Error("100-school catalog publication is restricted to the loopback cuac_local database.");
const bundle = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const review = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.reviewed-100-official-release.review.json"), "utf8"));
const report = createCatalogMigrationValidationReport(bundle);
if (!report.ok || bundle.version !== 2 || review.status !== "human_review_completed" || review.confirmations?.projectOwnerApprovedDirectPublication !== true
  || bundle.handoff?.reviewReference !== review.reviewReference || review.publicationBundleSha256 !== report.bundleSha256
  || review.operationPlanSha256 !== report.operationPlanSha256 || report.summary.schools !== 100 || report.summary.programs < 10_000
  || report.summary.programIntakes < 9_000 || report.summary.scholarships < 300) throw new Error(`Reviewed 100-school catalog validation failed: ${report.errors.join(" ")}`);
const schoolSlugs = bundle.schools!.map((row) => row.slug), citySlugs = bundle.cities!.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: rawUrl, max: 1, applicationName: "cuac:reviewed-100-official-publish", statementTimeoutMillis: 120_000 });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async (tx) => {
    const existingSchools = await tx.query<{ slug: string }>("select slug from schools where slug=any($1::text[])", [schoolSlugs]);
    const existingCities = await tx.query<{ slug: string }>("select slug from cities where slug=any($1::text[])", [citySlugs]);
    const written = await new CatalogSeedWriter(tx).writeBundle(bundle, { preserveExistingSchoolSlugs: [], preserveExistingCitySlugs: [] });
    if (!written.ok) throw new Error(`Reviewed 100-school catalog write failed: ${written.errors.join(" ")}`);
    const verified = await tx.query<{ target_schools: number; public_schools: number; target_programs: number; public_programs: number; target_intakes: number; public_scholarships: number }>(`select
      (select count(*)::int from schools where slug=any($1::text[]) and status='active' and verification_status in ('verified','stale')) target_schools,
      (select count(*)::int from schools where status='active' and verification_status in ('verified','stale')) public_schools,
      (select count(*)::int from programs where slug=any($2::text[]) and status='active' and verification_status in ('verified','stale')) target_programs,
      (select count(*)::int from programs where status='active' and verification_status in ('verified','stale')) public_programs,
      (select count(*)::int from program_intakes pi join programs p on p.id=pi.program_id where p.slug=any($2::text[])) target_intakes,
      (select count(*)::int from scholarships where status='active' and verification_status in ('verified','stale')) public_scholarships`, [schoolSlugs, bundle.programs!.map((row) => row.slug)]);
    const row = verified[0];
    if (!row || row.target_schools !== 100 || row.target_programs !== report.summary.programs || row.target_intakes < report.summary.programIntakes || row.public_schools < 100) throw new Error(`100-school catalog post-check failed: ${JSON.stringify(row)}`);
    return { dependencies: { existingSchools: existingSchools.length, addedSchools: schoolSlugs.length - existingSchools.length, existingCities: existingCities.length, addedCities: citySlugs.length - existingCities.length }, written: written.summary, ...row };
  });
  console.log(JSON.stringify({ ok: true, reviewReference: review.reviewReference, bundleSha256: report.bundleSha256, target: { kind: "single_host_loopback", databaseName: "cuac_local" }, ...result }, null, 2));
} finally { await pool.end(); }
