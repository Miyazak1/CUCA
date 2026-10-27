import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import {
  assertTop150SchoolDirectoryTarget,
  loadReviewedTop150SchoolDirectory,
  protectedCatalogSnapshotSql,
  TOP_150_SCHOOL_DIRECTORY_PUBLISH_CONFIRMATION,
  type ProtectedCatalogSnapshot,
} from "./lib/top-150-school-directory-release.ts";

if (process.env.CUAC_TOP150_SCHOOL_DIRECTORY_PUBLISH_CONFIRMATION !== TOP_150_SCHOOL_DIRECTORY_PUBLISH_CONFIRMATION) {
  throw new Error("Top-150 school-directory publication requires the exact confirmation token.");
}
const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
if (!rawUrl) throw new Error("Top-150 school-directory publication requires a PostgreSQL URL.");
const target = assertTop150SchoolDirectoryTarget(rawUrl);
const { bundle, review, report } = await loadReviewedTop150SchoolDirectory();
const schoolSlugs = bundle.schools!.map((row) => row.slug);
const citySlugs = bundle.cities!.map((row) => row.slug);
const schoolsBySlug = new Map(bundle.schools!.map((school) => [school.slug, school]));
const pool = createPostgresPool({ databaseUrl: rawUrl, max: 1, applicationName: "cuac:top-150-school-directory-publish", statementTimeoutMillis: 180_000 });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async (tx) => {
    const before = (await tx.query<ProtectedCatalogSnapshot>(protectedCatalogSnapshotSql, []))[0];
    const existingSchools = await tx.query<{ id: string; slug: string; status: string; verification_status: string }>(
      "select id,slug,status,verification_status from schools where slug=any($1::text[])", [schoolSlugs],
    );
    const existingCities = await tx.query<{ slug: string }>("select slug from cities where slug=any($1::text[])", [citySlugs]);
    const preservedSchoolSlugs = existingSchools.map((row) => row.slug);
    const preservedCitySlugs = existingCities.map((row) => row.slug);
    const written = await new CatalogSeedWriter(tx).writeBundle(bundle, {
      preserveExistingSchoolSlugs: preservedSchoolSlugs,
      preserveExistingCitySlugs: preservedCitySlugs,
    });
    if (!written.ok) throw new Error(`Top-150 school-directory write failed: ${written.errors.join(" ")}`);

    for (const existing of existingSchools) {
      const school = schoolsBySlug.get(existing.slug);
      if (!school) throw new Error(`Reviewed top-150 directory is missing preserved school ${existing.slug}.`);
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
          JSON.stringify(school.sourceFieldLineage ?? {}), JSON.stringify({ importSource: "reviewed_top_150_school_directory" })],
      );
    }

    const verified = (await tx.query<{ target_count: number; public_count: number }>(`select
      (select count(*)::int from schools where slug=any($1::text[]) and status='active' and verification_status in ('verified','stale')) target_count,
      (select count(*)::int from schools where status='active' and verification_status in ('verified','stale')) public_count`, [schoolSlugs]))[0];
    if (verified?.target_count !== 150) throw new Error(`Top-150 school-directory post-check found ${verified?.target_count ?? 0}/150 public target schools.`);
    const after = (await tx.query<ProtectedCatalogSnapshot>(protectedCatalogSnapshotSql, []))[0];
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error(`School-only publication changed protected catalog records: ${JSON.stringify({ before, after })}`);
    }
    return {
      dependencies: {
        preservedSchools: preservedSchoolSlugs.length,
        addedSchools: schoolSlugs.length - preservedSchoolSlugs.length,
        activatedExistingSchools: existingSchools.filter((row) => row.status !== "active"
          || !["verified", "stale"].includes(row.verification_status)).length,
        preservedCities: preservedCitySlugs.length,
        addedCities: citySlugs.length - preservedCitySlugs.length,
      },
      written: written.summary,
      publicTargetSchools: verified.target_count,
      publicSchoolCount: verified.public_count,
      protectedCatalogSnapshot: after,
    };
  });
  console.log(JSON.stringify({ ok: true, target, reviewReference: review.reviewReference, bundleSha256: report.bundleSha256, ...result }, null, 2));
} finally {
  await pool.end();
}
