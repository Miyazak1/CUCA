import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const confirmation = "publish-reviewed-2027-release-to-cuac-single-host";
if (process.env.CUAC_2027_RELEASE_PUBLISH_CONFIRMATION !== confirmation) throw new Error("2027 release publication requires the exact confirmation token.");
if (process.env.CUAC_ENV !== "development" || process.env.CUAC_LOCAL_RUNTIME !== "1") throw new Error("2027 release publication is restricted to the owner-controlled single-host runtime.");
const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_DATABASE_URL;
if (!rawUrl) throw new Error("2027 release publication requires a PostgreSQL URL.");
const target = new URL(rawUrl);
if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash
  || !["127.0.0.1", "[::1]"].includes(target.hostname) || decodeURIComponent(target.username) !== "cuac_local"
  || decodeURIComponent(target.pathname.replace(/^\//, "")) !== "cuac_local") throw new Error("2027 release publication is restricted to the loopback cuac_local database.");

const bundle = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.2027-release.reviewed.json"), "utf8")) as CatalogSeedBundle;
const review = JSON.parse(await readFile(resolve(process.cwd(), "seeds/catalog.2027-release.review.json"), "utf8"));
const report = createCatalogMigrationValidationReport(bundle);
const handoff = bundle.handoff;
if (!report.ok || bundle.version !== 2 || review.status !== "human_review_completed"
  || review.reviewReference !== "project-owner-chat-approval-2026-10-20-100-school"
  || !handoff || handoff.reviewReference !== review.reviewReference || handoff.prohibitedDataReviewReference !== review.reviewReference
  || review.publicationBundleSha256 !== report.bundleSha256 || review.operationPlanSha256 !== report.operationPlanSha256
  || review.confirmations?.projectOwnerApprovedDirectPublication !== true || review.confirmations?.officialSourcesReviewed !== true
  || review.confirmations?.prohibitedDataConfirmedExcluded !== true || review.confirmations?.missingDataMayRemainEmpty !== true
  || review.confirmations?.unresolvedDatesWereNotInferred !== true || review.confirmations?.existingSchoolAndCityProfilesMustBePreserved !== true
  || report.summary.cities !== 34 || report.summary.schools !== 99 || report.summary.programs !== 2031
  || report.summary.programIntakes !== 1958 || report.summary.scholarships !== 95) {
  throw new Error(`Reviewed 2027 release validation failed: ${report.errors.join(" ")}`);
}

const schoolSlugs = bundle.schools!.map((row) => row.slug);
const citySlugs = bundle.cities!.map((row) => row.slug);
const programSlugs = bundle.programs!.map((row) => row.slug);
const intakeKeys = bundle.programIntakes!.map((row) => ({ program_slug: row.programSlug, intake_term: row.intakeTerm, intake_year: row.intakeYear, status: row.status }));
const expectedOpenIntakes = bundle.programIntakes!.filter((row) => row.status === "open").length;
const expectedClosedIntakes = bundle.programIntakes!.filter((row) => (row.status ?? "closed") === "closed").length;
const scholarshipSlugs = bundle.scholarships!.map((row) => row.slug);
const pool = createPostgresPool({ databaseUrl: rawUrl, max: 1, applicationName: "cuac:reviewed-2027-release-publish", statementTimeoutMillis: 180_000 });
try {
  const result = await createTransactionalSqlClient(pool).transaction(async (tx) => {
    const existingSchools = await tx.query<{ slug: string }>("select slug from schools where slug=any($1::text[])", [schoolSlugs]);
    const existingCities = await tx.query<{ slug: string }>("select slug from cities where slug=any($1::text[])", [citySlugs]);
    if (existingSchools.length !== schoolSlugs.length || existingCities.length !== citySlugs.length) {
      throw new Error(`2027 release dependencies changed: found ${existingSchools.length}/${schoolSlugs.length} schools and ${existingCities.length}/${citySlugs.length} cities.`);
    }
    const conflicts = await tx.query<{ slug: string }>(`select p.slug from programs p join schools s on s.id=p.school_id
      join jsonb_to_recordset($1::jsonb) x(slug text,school_slug text) on x.slug=p.slug
      where s.slug<>x.school_slug limit 1`, [JSON.stringify(bundle.programs!.map((row) => ({ slug: row.slug, school_slug: row.schoolSlug })))]);
    if (conflicts.length) throw new Error("An existing program slug belongs to a different school.");

    const written = await new CatalogSeedWriter(tx).writeBundle(bundle, {
      preserveExistingSchoolSlugs: existingSchools.map((row) => row.slug),
      preserveExistingCitySlugs: existingCities.map((row) => row.slug),
    });
    if (!written.ok) throw new Error(`Reviewed 2027 release write failed: ${written.errors.join(" ")}`);

    const verified = await tx.query<{ programs: number; intakes: number; open_intakes: number; closed_intakes: number; scholarships: number }>(`select
      (select count(*)::int from programs where slug=any($1::text[]) and status='active' and verification_status='verified') programs,
      (select count(*)::int from program_intakes i join programs p on p.id=i.program_id
        join jsonb_to_recordset($2::jsonb) x(program_slug text,intake_term text,intake_year integer,status text)
          on x.program_slug=p.slug and x.intake_term=i.intake_term and x.intake_year=i.intake_year) intakes,
      (select count(*)::int from program_intakes i join programs p on p.id=i.program_id
        join jsonb_to_recordset($2::jsonb) x(program_slug text,intake_term text,intake_year integer,status text)
          on x.program_slug=p.slug and x.intake_term=i.intake_term and x.intake_year=i.intake_year where i.status='open') open_intakes,
      (select count(*)::int from program_intakes i join programs p on p.id=i.program_id
        join jsonb_to_recordset($2::jsonb) x(program_slug text,intake_term text,intake_year integer,status text)
          on x.program_slug=p.slug and x.intake_term=i.intake_term and x.intake_year=i.intake_year where i.status='closed') closed_intakes,
      (select count(*)::int from scholarships where slug=any($3::text[]) and status='active' and verification_status='verified') scholarships`,
    [programSlugs, JSON.stringify(intakeKeys), scholarshipSlugs]);
    const row = verified[0];
    if (!row || row.programs !== 2031 || row.intakes !== 1958 || row.open_intakes !== expectedOpenIntakes
      || row.closed_intakes !== expectedClosedIntakes || row.scholarships !== 95) {
      throw new Error(`2027 release post-check failed: ${JSON.stringify(row)}`);
    }
    return {
      dependencies: { preservedSchools: existingSchools.length, preservedCities: existingCities.length },
      written: written.summary,
      verified: row,
    };
  });
  console.log(JSON.stringify({
    ok: true,
    reviewReference: review.reviewReference,
    bundleSha256: report.bundleSha256,
    target: { kind: "single_host_loopback", databaseName: "cuac_local" },
    ...result,
  }, null, 2));
} finally {
  await pool.end();
}
