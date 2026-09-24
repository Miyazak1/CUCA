import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { PostgresCatalogAdminRepository } from "../src/server/catalog-admin/postgres-repository.ts";
import type { CatalogReadinessRecord } from "../src/server/catalog-admin/service.ts";
import type { TransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Readiness remediation inventory is restricted to loopback PostgreSQL.");
}
const outputArgument = process.argv.slice(2).find(value => value.startsWith("--output="));
const outputPath = resolve(outputArgument?.slice("--output=".length)
  || "work/catalog-quality/catalog-readiness-remediation.json");
if (process.argv.slice(2).some(value => !value.startsWith("--output="))) {
  throw new Error("Only --output=<path> is supported. This command is read-only.");
}

const registry = JSON.parse(await readFile(resolve("catalog-sources/official-sources.json"), "utf8")) as {
  sources?: Array<{ id?: unknown; url?: unknown }>;
};
const registeredUrls = new Map((registry.sources ?? [])
  .filter(source => typeof source.id === "string" && typeof source.url === "string")
  .map(source => [String(source.url), String(source.id)]));

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000,
  statement_timeout: 20_000 });
const connection = await pool.connect();
const tx: TransactionalSqlClient = {
  async query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]) {
    return (await connection.query(statement, [...params])).rows as T[];
  },
  async transaction<T>(work: (client: TransactionalSqlClient) => Promise<T>) { return work(tx); },
};

try {
  // Authority validation deliberately takes a shared row lock, which PostgreSQL
  // does not permit in READ ONLY transactions. The outer rollback remains the
  // no-write boundary for this inventory command.
  await connection.query("begin");
  const actors = await tx.query<{ actorUserId: string; activeRole: "cuac_admin" }>(`select u.id::text as "actorUserId",
    'cuac_admin'::text as "activeRole" from users u join user_roles r on r.user_id=u.id and r.role='cuac_admin'
    and r.revoked_at is null join cuac_staff_access_grants g on g.user_id=u.id and g.requested_role='cuac_admin'
    and g.status='approved' and g.revoked_at is null and g.expires_at>clock_timestamp()
    where u.account_status='active' limit 1`, []);
  if (!actors[0]) throw new Error("An active CUAC admin fixture is required for the local read-only inventory.");
  const repository = new PostgresCatalogAdminRepository(tx);
  const result = await repository.listReadiness({ ...actors[0], entityType: null, status: null,
    readiness: "blocked", reason: null, query: null, limit: 20_000, offset: 0 });
  if (!result.authorized) throw new Error("Catalog readiness inventory authority was revoked.");
  if (result.value.items.length !== result.value.total) throw new Error("Blocked readiness inventory was truncated.");

  const metadata = await tx.query<{ entityType: CatalogReadinessRecord["entityType"]; entityId: string;
    sourceUrl: string | null; sourceLabel: string | null; citySlug: string | null; cityStatus: string | null;
    schoolSlug: string | null; schoolStatus: string | null; programSlug: string | null; programStatus: string | null }>(`
    select 'city'::text as "entityType",c.id::text as "entityId",c.source_url as "sourceUrl",
      c.source_label as "sourceLabel",c.slug as "citySlug",c.status as "cityStatus",
      null::text as "schoolSlug",null::text as "schoolStatus",null::text as "programSlug",null::text as "programStatus"
      from cities c union all
    select 'school',s.id::text,s.source_url,s.source_label,c.slug,c.status,s.slug,s.status,null,null
      from schools s left join cities c on c.id=s.city_id union all
    select 'program',p.id::text,p.source_url,p.source_label,c.slug,c.status,s.slug,s.status,p.slug,p.status
      from programs p left join cities c on c.id=p.city_id left join schools s on s.id=p.school_id union all
    select 'scholarship',sc.id::text,sc.source_url,sc.source_label,c.slug,c.status,s.slug,s.status,p.slug,p.status
      from scholarships sc left join programs p on p.id=sc.program_id left join schools s on s.id=sc.school_id
      left join cities c on c.id=s.city_id`, []);
  const metadataByKey = new Map(metadata.map(row => [`${row.entityType}:${row.entityId}`, row]));
  const records = result.value.items.map(item => {
    const source = metadataByKey.get(`${item.entityType}:${item.entityId}`);
    const registrySourceId = source?.sourceUrl ? registeredUrls.get(source.sourceUrl) ?? null : null;
    return { entityType: item.entityType, entityId: item.entityId, slug: item.slug, label: item.label,
      status: item.status, version: item.version, blockingReasons: item.blockingReasons,
      category: classify(item.blockingReasons), sourceUrl: source?.sourceUrl ?? null,
      sourceLabelPresent: Boolean(source?.sourceLabel), registrySourceId,
      dependencies: { citySlug: source?.citySlug ?? null, cityStatus: source?.cityStatus ?? null,
        schoolSlug: source?.schoolSlug ?? null, schoolStatus: source?.schoolStatus ?? null,
        programSlug: source?.programSlug ?? null, programStatus: source?.programStatus ?? null },
      remediationDisposition: disposition(item.blockingReasons, registrySourceId) };
  });
  const byEntityType = countBy(records.flatMap(record => [record.entityType]));
  const byReason = countBy(records.flatMap(record => record.blockingReasons));
  const byCategory = countBy(records.flatMap(record => [record.category]));
  const byReasonCombination = countBy(records.map(record => [...record.blockingReasons].sort().join("+")));
  const byDisposition = countBy(records.map(record => record.remediationDisposition));
  const report = { version: 1, generatedAt: new Date().toISOString(), mode: "read_only",
    publicationAuthorized: false, databaseWriteAuthorized: false,
    sourceRegistry: { registeredSourceCount: registeredUrls.size },
    summary: { totalCatalogRecords: result.value.summary.total, readyRecords: result.value.summary.ready,
      blockedRecords: result.value.total, byEntityType, byReason, byCategory, byReasonCombination, byDisposition },
    safeguards: ["No catalog or evidence rows were written.", "No record was published or changed.",
      "Official registry matching is exact-URL metadata only and does not authorize remediation.",
      "Archived records and inactive dependencies are not auto-activated."], records };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary }, null, 2));
} finally {
  await connection.query("rollback").catch(() => undefined);
  connection.release();
  await pool.end();
}

function classify(reasons: string[]): string {
  if (reasons.includes("archived")) return "intentional_lifecycle";
  if (reasons.some(reason => ["inactive_city", "inactive_school", "inactive_program"].includes(reason))) {
    return "upstream_lifecycle";
  }
  if (reasons.some(reason => ["invalid_source_url", "missing_source_label", "missing_source_evidence"].includes(reason))) {
    return "evidence_gap";
  }
  return "content_gap";
}

function disposition(reasons: string[], registrySourceId: string | null): string {
  if (reasons.includes("archived")) return "keep_blocked_archived";
  if (reasons.some(reason => ["inactive_city", "inactive_school", "inactive_program"].includes(reason))) {
    return "requires_dependency_review";
  }
  if (reasons.includes("missing_source_evidence") && registrySourceId) return "registered_source_needs_evidence_replay";
  if (reasons.some(reason => ["invalid_source_url", "missing_source_label", "missing_source_evidence"].includes(reason))) {
    return "requires_official_evidence";
  }
  return "requires_catalog_content";
}

function countBy(values: string[]): Record<string, number> {
  return Object.fromEntries([...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
    new Map<string, number>())].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}
