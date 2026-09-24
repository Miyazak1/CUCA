import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { assertLocalDevelopmentState, localDatabaseUrl } from "./lib/local-development.ts";
import { cityCandidateSha256, validateCityReleaseCandidate } from "./lib/catalog-city-candidate-runtime.ts";

type Row = Record<string, unknown>;

const confirmation = "--confirm=publish-owner-accepted-city-catalog-to-cuac-local";
if (!process.argv.includes(confirmation)) {
  throw new Error(`Local city publication requires ${confirmation}.`);
}

const root = process.cwd();
const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8")) as Row;
const candidate = await readJson("work/city-data/catalog-city-release-candidate.json");
const validation = validateCityReleaseCandidate(candidate);
if (!validation.ok) throw new Error(`City release candidate is invalid: ${validation.errors.join("; ")}`);

const operations = candidate.operations as Row[];
const expectedSlugs = operations.map(operation => String(operation.slug)).sort((a, b) => a.localeCompare(b));
if (!expectedSlugs.length || new Set(expectedSlugs).size !== expectedSlugs.length) {
  throw new Error("City release candidate must contain unique operations.");
}

const drafts = new Map<string, Row>();
for (const operation of operations) {
  const slug = String(operation.slug);
  const draftBundle = await readJson(`seeds/catalog.${slug}-city-rich-batch-01.draft.json`);
  const draftCities = draftBundle.cities as Row[];
  const draft = draftCities?.[0];
  const city = operation.city as Row;
  const evidence = operation.evidence as Row;
  if (draftCities?.length !== 1 || draft?.slug !== slug || draft?.sourceUrl !== city.sourceUrl
    || draft?.sourceSha256 !== evidence.primarySnapshotSha256 || draft?.status !== "draft"
    || draft?.verificationStatus !== "unverified") {
    throw new Error(`City draft no longer matches the hash-pinned release candidate: ${slug}`);
  }
  drafts.set(slug, draft);
}

const runtime = await readJson(".cuac-local/runtime.json");
assertLocalDevelopmentState(runtime);
const databaseUrl = localDatabaseUrl(runtime);
const pool = createPostgresPool({ databaseUrl, max: 1, applicationName: "cuac:catalog-city-publish-local" });
const connection = await pool.connect();
const releasedAt = new Date().toISOString();
const backupDirectory = resolve(root, "work/city-data/local-publication-backups");
const backupPath = resolve(backupDirectory, `cities-${releasedAt.replace(/[:.]/g, "-")}.json`);

try {
  await connection.query("begin isolation level serializable");
  const current = (await connection.query(
    "select to_jsonb(c) data from cities c where c.slug=any($1::text[]) order by c.slug for update",
    [expectedSlugs],
  )).rows.map(row => row.data as Row);
  const currentPreimage = { cities: current };
  if (current.length !== expectedSlugs.length
    || cityCandidateSha256(currentPreimage) !== (candidate.hashes as Row).preimageSha256) {
    throw new Error("Local city rows changed after the release candidate was built; rebuild the candidate before publishing.");
  }

  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, `${JSON.stringify({
    version: 1,
    target: "cuac-local",
    capturedAt: releasedAt,
    candidateHashes: candidate.hashes,
    preimage: currentPreimage,
  }, null, 2)}\n`, "utf8");

  for (const operation of operations) {
    const city = operation.city as Row;
    const evidence = operation.evidence as Row;
    const draft = drafts.get(String(operation.slug)) as Row;
    const result = await connection.query(`update cities set
      name_zh=$2, name_en=$3, region=$4, province=$5, monthly_cost=$6, monthly_cost_rmb=$7,
      cost_level=$8, density=$9, tags=$10::jsonb, content_json=$11::jsonb, nearby=$12::jsonb,
      sort_order=$13, version=$14, status='active', verification_status='verified', source_url=$15,
      source_label=$16, source_note=$17, source_field_lineage_json=$18::jsonb, verified_by_user_id=null,
      last_verified_at=$19::timestamptz, next_review_due_at=null, updated_at=now()
      where slug=$1`, [
      city.slug, city.nameZh, city.nameEn, city.region, city.province, city.monthlyCost, city.monthlyCostRmb,
      city.costLevel, city.density, JSON.stringify(city.tags), JSON.stringify(city.content), JSON.stringify(city.nearby),
      city.sortOrder, city.version, city.sourceUrl, city.sourceLabel,
      "Owner accepted hash-pinned official-evidence city data without per-record manual review for the local release.",
      JSON.stringify(city.sourceFieldLineage), releasedAt,
    ]);
    if (result.rowCount !== 1) throw new Error(`City publication update missed ${operation.slug}.`);

    const cityId = current.find(row => row.slug === operation.slug)?.id;
    await connection.query(`insert into catalog_source_evidence (
      entity_type, entity_id, source_url, source_label, captured_at, checksum, source_field_lineage_json, metadata_json
    ) select 'city', $1::uuid, $2, $3, $4::timestamptz, $5, $6::jsonb, $7::jsonb
      where not exists (
        select 1 from catalog_source_evidence
        where entity_type='city' and entity_id=$1::uuid and source_url is not distinct from $2
          and source_label is not distinct from $3 and checksum is not distinct from $5
      )`, [
      cityId, city.sourceUrl, city.sourceLabel, draft.capturedAt ?? releasedAt,
      evidence.primarySnapshotSha256, JSON.stringify(city.sourceFieldLineage),
      JSON.stringify({ importSource: "catalog_city_local_publication_v1", candidateHash: (candidate.hashes as Row).operationsSha256 }),
    ]);
  }

  const published = await connection.query(`select count(*)::int count from cities c
    where c.slug=any($1::text[]) and c.status='active' and c.verification_status='verified'
      and exists (select 1 from schools s where s.city_id=c.id and s.status='active')`, [expectedSlugs]);
  if (published.rows[0]?.count !== expectedSlugs.length) throw new Error("Not every city is public-query eligible after publication.");

  await connection.query("commit");
  console.log(JSON.stringify({
    ok: true,
    target: "cuac-local",
    publishedCities: expectedSlugs.length,
    releasedAt,
    backupPath,
    candidateOperationsSha256: (candidate.hashes as Row).operationsSha256,
  }, null, 2));
} catch (error) {
  try { await connection.query("rollback"); } catch { /* rollback best effort */ }
  throw error;
} finally {
  connection.release();
  await pool.end();
}
