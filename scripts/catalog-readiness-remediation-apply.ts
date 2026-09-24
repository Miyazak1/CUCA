import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { PostgresAuditWriter } from "../src/server/audit/postgres-writer.ts";
import { PostgresCatalogAdminRepository } from "../src/server/catalog-admin/postgres-repository.ts";
import { CatalogAdminService, type CatalogSchoolRecord } from "../src/server/catalog-admin/service.ts";
import type { TransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";

const confirmation = "apply-catalog-readiness-batch-01-to-cuac-local";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if ([...args].some(arg => arg !== "--apply" && arg !== `--confirm=${confirmation}`)) {
  throw new Error("Only --apply and the documented --confirm token are supported.");
}
if (apply && !args.has(`--confirm=${confirmation}`)) throw new Error("Explicit local apply confirmation is required.");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const parsedUrl = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
  throw new Error("Catalog readiness remediation is restricted to loopback PostgreSQL.");
}

type Operation = { entityType: "school"; slug: string; expectedVersion: number;
  expectedBlockingReasons: string[]; field: "schoolType"; from: null; to: string; sourceUrl: string;
  sourceSha256: string; artifactPath: string; supportingText: string; sourceFieldLineage: string;
  priorApprovalPath: string };
const batch = JSON.parse(await readFile(resolve("catalog-sources/remediations/catalog-readiness-batch-01.json"), "utf8")) as {
  version: number; batchId: string; reviewReference: string; publicationAuthorized: boolean; operations: Operation[] };
assert.equal(batch.version, 1); assert.equal(batch.batchId, "catalog-readiness-batch-01");
assert.equal(batch.publicationAuthorized, true); assert.equal(batch.operations.length, 1);

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
  await connection.query("begin");
  const actorRows = await tx.query<{ actorUserId: string }>(`select u.id::text as "actorUserId" from users u
    join user_roles r on r.user_id=u.id and r.role='cuac_admin' and r.revoked_at is null
    join cuac_staff_access_grants g on g.user_id=u.id and g.requested_role='cuac_admin' and g.status='approved'
      and g.revoked_at is null and g.expires_at>clock_timestamp() where u.account_status='active' limit 1`, []);
  assert.ok(actorRows[0], "An active local CUAC administrator is required.");
  const context = createRequestContext({ actorUserId: actorRows[0].actorUserId, activeRole: "cuac_admin",
    selectedSurface: "ops", purpose: "catalog_management", authStrength: "step_up", requestId: randomUUID() });
  const repository = new PostgresCatalogAdminRepository(tx);
  const service = new CatalogAdminService(repository, new PostgresAuditWriter(tx));
  const results: Array<Record<string, unknown>> = [];

  for (const operation of batch.operations) {
    const artifact = await readFile(resolve(operation.artifactPath));
    assert.equal(createHash("sha256").update(artifact).digest("hex"), operation.sourceSha256,
      `${operation.slug} official snapshot hash changed.`);
    assert.ok(artifact.toString("utf8").includes(operation.supportingText),
      `${operation.slug} supporting official text is missing.`);
    const priorApproval = JSON.parse(await readFile(resolve(operation.priorApprovalPath), "utf8")) as {
      schoolSlug?: unknown; prohibitedDataConfirmedExcluded?: unknown; approvalMode?: unknown };
    assert.equal(priorApproval.schoolSlug, operation.slug);
    assert.equal(priorApproval.prohibitedDataConfirmedExcluded, true);
    assert.equal(priorApproval.approvalMode, "standing-user-default-publication");

    const listed = await service.listSchools(context, { query: operation.slug, limit: 10, offset: 0 });
    const current = listed.items.find(item => item.slug === operation.slug);
    assert.ok(current, `${operation.slug} is missing.`);
    const readiness = await service.getReadiness(context, "school", current.id);
    if (current.schoolType === operation.to && readiness.ready) {
      await verifyAppliedHistory(tx, current.id);
      results.push({ slug: operation.slug, outcome: "already_applied", version: current.version });
      continue;
    }
    assert.equal(current.version, operation.expectedVersion, `${operation.slug} version changed.`);
    assert.equal(current.schoolType, operation.from, `${operation.slug} current value changed.`);
    assert.equal(current.sourceUrl, operation.sourceUrl, `${operation.slug} source URL changed.`);
    assert.deepEqual([...readiness.blockingReasons].sort(), [...operation.expectedBlockingReasons].sort());
    assert.ok(current.cityId, `${operation.slug} has no catalog city relationship.`);
    if (!apply) {
      results.push({ slug: operation.slug, outcome: "would_apply", from: operation.from, to: operation.to,
        version: current.version, blockingReasons: readiness.blockingReasons });
      continue;
    }
    const updated = await service.updateSchool(context, current.id, { expectedVersion: current.version,
      document: schoolDocument(current, operation.to) });
    const published = await service.publishSchool(context, current.id, { expectedVersion: updated.version,
      reviewDueAt: new Date(Date.now() + 180 * 86_400_000).toISOString() });
    const after = await service.getReadiness(context, "school", current.id);
    assert.equal(published.status, "active"); assert.equal(published.verificationStatus, "verified");
    assert.equal(published.schoolType, operation.to); assert.equal(after.ready, true);
    await verifyAppliedHistory(tx, current.id);
    results.push({ slug: operation.slug, outcome: "applied", previousVersion: current.version,
      version: published.version, readiness: "ready", sourceSha256: operation.sourceSha256,
      sourceFieldLineage: operation.sourceFieldLineage, reviewReference: batch.reviewReference });
  }
  if (apply) await connection.query("commit"); else await connection.query("rollback");
  console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry_run", batchId: batch.batchId,
    publicationAuthorized: batch.publicationAuthorized, results }, null, 2));
} catch (error) {
  await connection.query("rollback").catch(() => undefined);
  throw error;
} finally {
  connection.release();
  await pool.end();
}

function schoolDocument(record: CatalogSchoolRecord, schoolType: string): Record<string, unknown> {
  const { id: _id, version: _version, status: _status, verificationStatus: _verificationStatus,
    verifiedByUserId: _verifiedByUserId, lastVerifiedAt: _lastVerifiedAt, nextReviewDueAt: _nextReviewDueAt,
    createdAt: _createdAt, updatedAt: _updatedAt, ...document } = record;
  return { ...document, schoolType };
}

async function verifyAppliedHistory(client: TransactionalSqlClient, schoolId: string): Promise<void> {
  const revisions = await client.query<{ entityVersion: number; action: string; changedFields: string[] }>(`
    select entity_version as "entityVersion",action,changed_fields_json as "changedFields"
    from catalog_entity_revisions where entity_type='school' and entity_id=$1
    order by entity_version desc limit 2`, [schoolId]);
  assert.deepEqual(revisions.map(row => [row.entityVersion, row.action]), [[3, "published"], [2, "updated"]]);
  assert.ok(revisions[1]?.changedFields.includes("schoolType"));
  const audits = await client.query<{ action: string }>(`select action from audit_logs
    where resource_type='catalog_school' and resource_id=$1 and action in
      ('ops.catalog.school.update','ops.catalog.school.publish') order by created_at desc limit 2`, [schoolId]);
  assert.deepEqual(new Set(audits.map(row => row.action)),
    new Set(["ops.catalog.school.update", "ops.catalog.school.publish"]));
}
