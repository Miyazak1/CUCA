import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

type Row = Record<string, unknown>;

const root = process.cwd();
const readJson = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha256 = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const exactSha = (value: unknown) => /^[a-f0-9]{64}$/i.test(String(value ?? ""));
const prohibitedSource = (value: unknown) => /(cscapilot\.com|csca\.app|wentchina\.com)/i.test(String(value ?? ""));

const [policy, routeReadiness, registry] = await Promise.all([
  readJson("catalog-sources/owner-default-acceptance.json"),
  readJson("work/city-data/city-route-readiness.draft.json"),
  readJson("catalog-sources/official-sources.json"),
]);
if (policy.decision !== "default_accept_hash_pinned_official_evidence_candidates"
  || policy.authorization?.candidatePreparationAuthorized !== true
  || policy.review?.humanReviewCompleted !== false
  || policy.authorization?.persistentDatabaseWriteAuthorized !== false
  || policy.authorization?.publicationAuthorized !== false) throw new Error("Owner acceptance policy is invalid or over-authorizing.");
if (routeReadiness.publicationAuthorized !== false) throw new Error("City route report must remain non-authorizing.");

const eligible = (routeReadiness.cities as Row[])
  .filter(city => city.routeState === "active_catalog_route" && city.evidenceStage === "rich_draft_available")
  .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
if (eligible.length !== routeReadiness.summary.activeRouteWithStructuredDraft) throw new Error("City route summary does not match its rows.");
const registryById = new Map((registry.sources as Row[]).map(source => [String(source.id), source]));

const operations: Row[] = [];
for (const route of eligible) {
  const slug = String(route.slug);
  const base = `seeds/catalog.${slug}-city-rich-batch-01`;
  const [draft, validation, evidence] = await Promise.all([
    readJson(`${base}.draft.json`), readJson(`${base}.validation.json`), readJson(`${base}.evidence.json`),
  ]);
  const city = draft.cities?.[0] as Row | undefined;
  if (!city || draft.cities.length !== 1 || city.slug !== slug) throw new Error(`Unexpected city draft identity: ${slug}`);
  if (validation.ok !== true || validation.publicationAuthorized !== false || validation.errors?.length
    || validation.summary?.cities !== 1 || validation.operations?.[0]?.slug !== slug) throw new Error(`Invalid city validation report: ${slug}`);
  if (evidence.citySlug !== slug || evidence.publicationAuthorized !== false || evidence.status !== "unreviewed_draft") throw new Error(`Invalid city evidence identity: ${slug}`);
  if (city.status !== "draft" || city.verificationStatus !== "unverified" || !String(city.sourceUrl).startsWith("https://")
    || prohibitedSource(city.sourceUrl) || !exactSha(city.sourceSha256)) throw new Error(`Unsafe city draft: ${slug}`);
  const evidenceSources = evidence.sources as Row[];
  if (!evidenceSources.length) throw new Error(`City evidence is empty: ${slug}`);
  for (const source of evidenceSources) {
    const registered = registryById.get(String(source.id));
    if (!registered || registered.url !== source.url || !String(source.url).startsWith("https://")
      || prohibitedSource(source.url) || !exactSha(source.snapshotSha256)) throw new Error(`Unregistered or unsafe evidence ${source.id} for ${slug}`);
  }
  if (!evidenceSources.some(source => source.url === city.sourceUrl && source.snapshotSha256 === city.sourceSha256)) throw new Error(`Primary city source is not pinned in evidence: ${slug}`);
  operations.push({
    slug,
    route: { schoolCount: route.schoolCount, programCount: route.programCount },
    city: {
      slug: city.slug, nameZh: city.nameZh ?? null, nameEn: city.nameEn, region: city.region ?? null,
      province: city.province ?? null, monthlyCost: city.monthlyCost ?? null, monthlyCostRmb: city.monthlyCostRmb ?? null,
      costLevel: city.costLevel ?? null, density: city.density ?? null, tags: city.tags ?? [], content: city.content ?? {},
      nearby: city.nearby ?? [], sortOrder: city.sortOrder ?? 0, version: city.version ?? 1,
      status: "draft", verificationStatus: "unverified", sourceUrl: city.sourceUrl, sourceLabel: city.sourceLabel,
      sourceNote: "Owner-default accepted official-evidence candidate; human review not completed; publication not authorized.",
      sourceFieldLineage: city.sourceFieldLineage ?? {},
    },
    evidence: {
      validationSha256: sha256(validation), evidenceSha256: sha256(evidence),
      bundleSha256: validation.bundleSha256, operationPlanSha256: validation.operationPlanSha256,
      primarySnapshotSha256: city.sourceSha256, sourceCount: evidenceSources.length,
    },
  });
}

const state = await readJson(".cuac-local/runtime.json");
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:catalog-city-release-candidate" });
const connection = await pool.connect();
try {
  await connection.query("begin isolation level repeatable read read only");
  const slugs = operations.map(operation => operation.slug);
  const cities = (await connection.query("select to_jsonb(c) data from cities c where slug=any($1::text[]) order by slug", [slugs])).rows.map(row => row.data as Row);
  if (cities.length !== slugs.length) throw new Error("One or more candidate cities are absent from the database.");
  const cityIds = cities.map(city => city.id);
  const schools = (await connection.query(`select to_jsonb(s) data from cities c cross join lateral (
    select s.* from schools s where s.city_id=c.id and s.status='active' and exists (
      select 1 from programs p where p.school_id=s.id and p.status='active' and coalesce(p.city_id,s.city_id)=c.id)
    order by s.slug limit 1) s where c.id=any($1::uuid[]) order by c.slug`, [cityIds])).rows.map(row => row.data as Row);
  if (schools.length !== slugs.length) throw new Error("Every city candidate must have an active school with an active program.");
  const schoolIds = schools.map(school => school.id);
  const programs = (await connection.query(`select to_jsonb(p) data from schools s cross join lateral (
    select p.* from programs p where p.school_id=s.id and p.status='active' and coalesce(p.city_id,s.city_id)=s.city_id
    order by p.slug limit 1) p where s.id=any($1::uuid[]) order by s.slug`, [schoolIds])).rows.map(row => row.data as Row);
  if (programs.length !== slugs.length) throw new Error("Every city rehearsal fixture must include an active program.");
  const identity = (await connection.query("select current_database() database_name, current_user database_user")).rows[0];
  const currentBySlug = new Map(cities.map(city => [String(city.slug), city]));
  const expectedFirstPassChanges = operations.filter(operation => {
    const current = currentBySlug.get(operation.slug) as Row;
    const city = operation.city as Row;
    return current.name_zh !== city.nameZh || current.name_en !== city.nameEn || current.region !== city.region
      || current.province !== city.province || current.monthly_cost !== city.monthlyCost || current.monthly_cost_rmb !== city.monthlyCostRmb
      || current.cost_level !== city.costLevel || current.density !== city.density || canonical(current.tags) !== canonical(city.tags)
      || canonical(current.content_json) !== canonical(city.content) || canonical(current.nearby) !== canonical(city.nearby)
      || current.sort_order !== city.sortOrder || current.version !== city.version || current.status !== "draft"
      || current.verification_status !== "unverified" || current.source_url !== city.sourceUrl || current.source_label !== city.sourceLabel
      || current.source_note !== city.sourceNote || canonical(current.source_field_lineage_json) !== canonical(city.sourceFieldLineage);
  }).length;
  const preimage = { cities };
  // Rehearsal fixtures are copied into an isolated database that intentionally
  // contains no production/local staff identities. Verification provenance is
  // part of the source database preimage, but its user foreign key is not a
  // dependency of the city candidate itself, so detach that actor reference
  // only in the disposable fixture rows.
  const detachVerificationActor = (row: Row): Row => ({ ...row, verified_by_user_id: null });
  const fixtures = {
    // The source database may already contain a locally published city. The
    // portable rehearsal must model the only lifecycle state this non-public
    // candidate is allowed to mutate; it must never prove that a verified row
    // can be downgraded. Production/staging target binding separately captures
    // and checks the real target preimage before any execution is authorized.
    cities: cities.map(row => ({
      ...detachVerificationActor(row),
      status: "draft",
      verification_status: "unverified",
      last_verified_at: null,
      next_review_due_at: null,
    })),
    schools: schools.map(detachVerificationActor),
    programs: programs.map(detachVerificationActor),
  };
  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    status: "owner_default_accepted_non_public_city_candidate",
    decision: { reference: policy.decisionReference, perRecordHumanReviewRequiredByOwner: false, humanReviewCompleted: false },
    authorization: { candidatePreparationAuthorized: true, executionAuthorized: false, persistentDatabaseWriteAuthorized: false, publicationAuthorized: false },
    sourceDatabase: { databaseName: identity.database_name, databaseUser: identity.database_user, transaction: "repeatable read read only" },
    operations,
    preimage,
    rehearsalFixtures: fixtures,
    hashes: { operationsSha256: sha256(operations), preimageSha256: sha256(preimage), rehearsalFixturesSha256: sha256(fixtures) },
    summary: { candidateCities: operations.length, expectedFirstPassChanges, excludedNoRouteCities: routeReadiness.summary.noActiveCatalogRoute, fixtureSchools: schools.length, fixturePrograms: programs.length },
  };
  const outputPath = resolve(root, "work/city-data/catalog-city-release-candidate.json");
  await mkdir(resolve(root, "work/city-data"), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, status: artifact.status, authorization: artifact.authorization, hashes: artifact.hashes, summary: artifact.summary }, null, 2));
  await connection.query("rollback");
} catch (error) {
  try { await connection.query("rollback"); } catch { /* cleanup only */ }
  throw error;
} finally {
  connection.release();
  await pool.end();
}
