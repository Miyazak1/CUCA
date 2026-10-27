import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import {
  assertTop150SchoolDirectoryTarget,
  loadReviewedTop150SchoolDirectory,
  protectedCatalogSnapshotSql,
  type ProtectedCatalogSnapshot,
} from "./lib/top-150-school-directory-release.ts";

const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
if (!rawUrl) throw new Error("Top-150 school-directory preflight requires a PostgreSQL URL.");
const target = assertTop150SchoolDirectoryTarget(rawUrl);
const { bundle, review, report } = await loadReviewedTop150SchoolDirectory();
const schoolSlugs = bundle.schools!.map((row) => row.slug);
const citySlugs = bundle.cities!.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: rawUrl, max: 1, applicationName: "cuac:top-150-school-directory-preflight", statementTimeoutMillis: 120_000 });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async (tx) => {
    await tx.query("set transaction isolation level repeatable read read only", []);
    const existingSchools = await tx.query<{ slug: string }>("select slug from schools where slug=any($1::text[])", [schoolSlugs]);
    const existingCities = await tx.query<{ slug: string }>("select slug from cities where slug=any($1::text[])", [citySlugs]);
    const publicTotals = await tx.query<{ schools: number; cities: number }>(`select
      (select count(*)::int from schools where status='active' and verification_status in ('verified','stale')) schools,
      (select count(*)::int from cities where status='active' and verification_status in ('verified','stale')) cities`, []);
    const protectedSnapshot = await tx.query<ProtectedCatalogSnapshot>(protectedCatalogSnapshotSql, []);
    return {
      existingTargetSchools: existingSchools.length,
      schoolsToAdd: schoolSlugs.length - existingSchools.length,
      existingRequiredCities: existingCities.length,
      citiesToAdd: citySlugs.length - existingCities.length,
      currentPublic: publicTotals[0],
      expectedMinimumPublicSchoolsAfterPublication: (publicTotals[0]?.schools ?? 0) + schoolSlugs.length - existingSchools.length,
      protectedCatalogSnapshot: protectedSnapshot[0],
    };
  });
  console.log(JSON.stringify({ ok: true, target, reviewReference: review.reviewReference, bundleSha256: report.bundleSha256, ...result }, null, 2));
} finally {
  await pool.end();
}
