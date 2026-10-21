import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const confirmation = "publish-reviewed-50-school-directory-to-cuac-single-host";
if (process.env.CUAC_SCHOOL_DIRECTORY_PUBLISH_CONFIRMATION !== confirmation) throw new Error("School directory publication requires the exact confirmation token.");
if (process.env.CUAC_ENV !== "development" || process.env.CUAC_LOCAL_RUNTIME !== "1") throw new Error("School directory publication is restricted to the owner-controlled single-host runtime.");
const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
if (!rawUrl) throw new Error("School directory publication requires a PostgreSQL URL.");
const target = new URL(rawUrl);
if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash
  || !["127.0.0.1", "[::1]"].includes(target.hostname) || decodeURIComponent(target.username) !== "cuac_local"
  || decodeURIComponent(target.pathname.replace(/^\//, "")) !== "cuac_local") throw new Error("School directory publication is restricted to the loopback cuac_local database.");

const bundle = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.reviewed-50-school-directory.json"), "utf8")) as CatalogSeedBundle;
const review = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.reviewed-50-school-directory.review.json"), "utf8"));
const report = createCatalogMigrationValidationReport(bundle);
const handoff = bundle.handoff;
if (!report.ok || bundle.version !== 2 || review.status !== "human_review_completed"
  || !handoff || handoff.reviewReference !== review.reviewReference || handoff.prohibitedDataReviewReference !== review.reviewReference
  || review.publicationBundleSha256 !== report.bundleSha256 || review.operationPlanSha256 !== report.operationPlanSha256
  || review.confirmations?.officialSourcesReviewed !== true || review.confirmations?.prohibitedDataConfirmedExcluded !== true
  || review.confirmations?.existingDetailFieldsMustBePreserved !== true
  || review.confirmations?.reviewedPublicationMetadataMayBeRefreshed !== true
  || report.summary.schools !== 50 || report.summary.cities !== 22) {
  throw new Error(`Reviewed school directory validation failed: ${report.errors.join(" ")}`);
}

const schoolSlugs = bundle.schools!.map(row => row.slug), citySlugs = bundle.cities!.map(row => row.slug);
const pool = createPostgresPool({ databaseUrl: rawUrl, max: 1, applicationName: "cuac:reviewed-school-directory-publish", statementTimeoutMillis: 120_000 });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async tx => {
    const existingSchools = await tx.query<{ id: string; slug: string; status: string; verification_status: string }>(
      "select id,slug,status,verification_status from schools where slug=any($1::text[])", [schoolSlugs],
    );
    const existingCities = await tx.query<{ slug: string }>("select slug from cities where slug=any($1::text[])", [citySlugs]);
    const preservedSchoolSlugs = existingSchools.map(row => row.slug), preservedCitySlugs = existingCities.map(row => row.slug);
    const written = await new CatalogSeedWriter(tx).writeBundle(bundle, {
      preserveExistingSchoolSlugs: preservedSchoolSlugs,
      preserveExistingCitySlugs: preservedCitySlugs,
    });
    if (!written.ok) throw new Error(`Reviewed school directory write failed: ${written.errors.join(" ")}`);
    const schoolsBySlug = new Map(bundle.schools!.map(school => [school.slug, school]));
    for (const existing of existingSchools) {
      const school = schoolsBySlug.get(existing.slug);
      if (!school) throw new Error(`Reviewed school directory is missing preserved school ${existing.slug}.`);
      await tx.query(
        `update schools set status='active', verification_status='verified', last_verified_at=$2::timestamptz,
           source_url=$3, source_label=$4, source_field_lineage_json=$5::jsonb, updated_at=now()
         where id=$1`,
        [existing.id, school.lastVerifiedAt, school.sourceUrl, school.sourceLabel, JSON.stringify(school.sourceFieldLineage ?? {})],
      );
      await tx.query(
        `insert into catalog_source_evidence (
           entity_type, entity_id, source_url, source_label, captured_at, checksum, source_field_lineage_json, metadata_json
         ) select 'school', $1, $2, $3, $4::timestamptz, $5, $6::jsonb, $7::jsonb
         where not exists (
           select 1 from catalog_source_evidence
           where entity_type='school' and entity_id=$1 and source_url is not distinct from $2
             and source_label is not distinct from $3 and checksum is not distinct from $5
         )`,
        [existing.id, school.sourceUrl, school.sourceLabel, school.capturedAt, school.sourceSha256,
          JSON.stringify(school.sourceFieldLineage ?? {}), JSON.stringify({ importSource: "reviewed_50_school_directory" })],
      );
    }
    const verified = await tx.query<{ target_count: number; public_count: number }>(`select
      (select count(*)::int from schools where slug=any($1::text[]) and status='active' and verification_status in ('verified','stale')) target_count,
      (select count(*)::int from schools where status='active' and verification_status in ('verified','stale')) public_count`, [schoolSlugs]);
    if (verified[0]?.target_count !== 50) throw new Error(`School directory post-check found ${verified[0]?.target_count ?? 0}/50 public target schools.`);
    return {
      dependencies: {
        preservedSchools: preservedSchoolSlugs.length, addedSchools: schoolSlugs.length - preservedSchoolSlugs.length,
        activatedExistingSchools: existingSchools.filter(row => row.status !== "active"
          || !["verified", "stale"].includes(row.verification_status)).length,
        preservedCities: preservedCitySlugs.length, addedCities: citySlugs.length - preservedCitySlugs.length,
      },
      written: written.summary, publicTargetSchools: verified[0].target_count, publicSchoolCount: verified[0].public_count,
    };
  });
  console.log(JSON.stringify({ ok: true, reviewReference: review.reviewReference, bundleSha256: report.bundleSha256,
    target: { kind: "single_host_loopback", databaseName: "cuac_local" }, ...result }, null, 2));
} finally {
  await pool.end();
}
