import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const confirmation = "publish-reviewed-current-2027-prerequisites-to-cuac-single-host";
if (process.env.CUAC_CURRENT_2027_PUBLISH_CONFIRMATION !== confirmation) throw new Error("Current 2027 publication requires the exact confirmation token.");
if (process.env.CUAC_ENV !== "development" || process.env.CUAC_LOCAL_RUNTIME !== "1") throw new Error("Current 2027 publication is restricted to the owner-controlled single-host runtime.");
const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
if (!rawUrl) throw new Error("Current 2027 publication requires a PostgreSQL URL.");
const target = new URL(rawUrl);
if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash
  || !["127.0.0.1", "[::1]"].includes(target.hostname) || decodeURIComponent(target.username) !== "cuac_local"
  || decodeURIComponent(target.pathname.replace(/^\//, "")) !== "cuac_local") throw new Error("Current 2027 publication is restricted to the loopback cuac_local database.");

const bundle = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.current-2027-prerequisites.reviewed.json"), "utf8")) as CatalogSeedBundle;
const review = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.current-2027-prerequisites.review.json"), "utf8"));
const report = createCatalogMigrationValidationReport(bundle);
const handoff = bundle.handoff;
if (!report.ok || bundle.version !== 2 || !handoff || handoff.reviewReference !== review.reviewReference
  || handoff.prohibitedDataReviewReference !== review.reviewReference || review.status !== "human_review_completed"
  || review.publicationBundleSha256 !== report.bundleSha256 || review.operationPlanSha256 !== report.operationPlanSha256
  || review.confirmations?.contentReviewed !== true || review.confirmations?.officialSourcesReviewed !== true
  || review.confirmations?.publicContentConfirmed !== true || review.confirmations?.prohibitedDataConfirmedExcluded !== true
  || report.summary.cities !== 11 || report.summary.programs !== 346 || report.summary.programIntakes !== 347 || report.summary.schools !== 15) {
  throw new Error(`Current 2027 reviewed bundle validation failed: ${report.errors.join(" ")}`);
}

const schoolSlugs = bundle.schools!.map(row => row.slug), citySlugs = bundle.cities!.map(row => row.slug);
const pool = createPostgresPool({ databaseUrl: rawUrl, max: 1, applicationName: "cuac:current-2027-prerequisites-publish", statementTimeoutMillis: 120_000 });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async tx => {
    const existingSchools = await tx.query<{ slug: string }>("select slug from schools where slug=any($1::text[])", [schoolSlugs]);
    const existingCities = await tx.query<{ slug: string }>("select slug from cities where slug=any($1::text[])", [citySlugs]);
    const preservedSchoolSlugs = existingSchools.map(row => row.slug);
    const preservedCitySlugs = existingCities.map(row => row.slug);
    const conflicts = await tx.query<{ slug: string }>(`select p.slug from programs p join schools s on s.id=p.school_id
      join jsonb_to_recordset($1::jsonb) x(slug text,school_slug text) on x.slug=p.slug
      where s.slug<>x.school_slug limit 1`, [JSON.stringify(bundle.programs!.map(row => ({ slug: row.slug, school_slug: row.schoolSlug })))]);
    if (conflicts.length) throw new Error("An existing program slug belongs to a different school.");
    const written = await new CatalogSeedWriter(tx).writeBundle(bundle, {
      preserveExistingCitySlugs: preservedCitySlugs,
      preserveExistingSchoolSlugs: preservedSchoolSlugs,
    });
    if (!written.ok) throw new Error(`Current 2027 catalog write failed: ${written.errors.join(" ")}`);
    const verified = await tx.query<{ count: number }>(`select count(*)::int count from program_intakes i join programs p on p.id=i.program_id
      join jsonb_to_recordset($1::jsonb) x(program_slug text,intake_term text,intake_year integer)
        on x.program_slug=p.slug and x.intake_term=i.intake_term and x.intake_year=i.intake_year
      where p.status='active' and i.status='open' and (i.deadline_date is null or i.deadline_date>clock_timestamp())`,
    [JSON.stringify(bundle.programIntakes!.map(row => ({ program_slug: row.programSlug, intake_term: row.intakeTerm, intake_year: row.intakeYear })))]);
    if (verified[0]?.count !== 347) throw new Error(`Current 2027 post-check found ${verified[0]?.count ?? 0}/347 open intakes.`);
    return {
      dependencies: {
        preservedSchools: preservedSchoolSlugs.length,
        addedSchools: schoolSlugs.length - preservedSchoolSlugs.length,
        preservedCities: preservedCitySlugs.length,
        addedCities: citySlugs.length - preservedCitySlugs.length,
      },
      written: written.summary,
      verifiedOpenIntakes: verified[0].count,
    };
  });
  console.log(JSON.stringify({ ok: true, reviewReference: review.reviewReference, bundleSha256: report.bundleSha256,
    target: { kind: "single_host_loopback", databaseName: "cuac_local" }, ...result }, null, 2));
} finally {
  await pool.end();
}
