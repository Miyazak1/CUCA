import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { buildAuditEvent } from "../src/server/audit/audit.ts";
import { PostgresAuditWriter } from "../src/server/audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";

const confirmation = "apply-scholarship-cycle-batch-01-to-cuac-local";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if ([...args].some(arg => arg !== "--apply" && arg !== `--confirm=${confirmation}`)) {
  throw new Error("Only --apply and the documented --confirm token are supported.");
}
if (apply && !args.has(`--confirm=${confirmation}`)) {
  throw new Error("Explicit local apply confirmation is required.");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const parsedUrl = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
  throw new Error("Scholarship cycle registration is restricted to loopback PostgreSQL.");
}

type Operation = {
  scholarshipSlug: string; expectedVersion: number; expectedStatus: "active";
  expectedVerificationStatus: "verified"; expectedDeadlineDate: string; expectedApplicationRound: string;
  seriesKey: string; cycleKey: string; intakeYear: number; intakeLabel: string;
  supersedesScholarshipSlug: string | null; officialSourceUrl: string; officialSourceSha256: string;
  capturedAt: string;
};
type Batch = { version: number; batchId: string; reviewReference: string; publicationAuthorized: boolean;
  evidencePath: string; evidenceSha256: string;
  operations: Operation[] };
const batch = JSON.parse(await readFile(resolve("catalog-sources/remediations/scholarship-cycle-batch-01.json"), "utf8")) as Batch;
assert.equal(batch.version, 1);
assert.equal(batch.batchId, "scholarship-cycle-batch-01");
assert.equal(batch.publicationAuthorized, true);
assert.ok(batch.operations.length > 0);

const evidenceBytes = await readFile(resolve(batch.evidencePath));
assert.equal(sha256(evidenceBytes), batch.evidenceSha256, "Reviewed evidence extract hash changed.");
const evidence = JSON.parse(evidenceBytes.toString("utf8")) as {
  derivedFromCandidateSha256?: unknown;
  priorApproval?: { reviewReference?: unknown; prohibitedDataConfirmedExcluded?: unknown; approvalMode?: unknown };
  source?: { url?: unknown; sha256?: unknown; capturedAt?: unknown };
  record?: Record<string, unknown>;
};
assert.equal(evidence.derivedFromCandidateSha256,
  "6d520c5ac30be5ab28239c975d3e9a19e6cc08dbbc50a00b2bea6cb79eb2a8d4");
assert.equal(evidence.priorApproval?.reviewReference, batch.reviewReference);
assert.equal(evidence.priorApproval?.prohibitedDataConfirmedExcluded, true);
assert.equal(evidence.priorApproval?.approvalMode, "standing-user-default-publication");

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
      and g.revoked_at is null and g.expires_at>clock_timestamp()
    where u.account_status='active' limit 1`, []);
  assert.ok(actorRows[0], "An active local CUAC administrator is required.");
  const context = createRequestContext({ actorUserId: actorRows[0].actorUserId, activeRole: "cuac_admin",
    selectedSurface: "ops", purpose: "catalog_management", authStrength: "step_up", requestId: randomUUID() });
  const audit = new PostgresAuditWriter(tx);
  const results: Array<Record<string, unknown>> = [];

  for (const operation of batch.operations) {
    const approvedRecord = evidence.record;
    assert.equal(approvedRecord?.slug, operation.scholarshipSlug,
      `${operation.scholarshipSlug} is absent from the reviewed evidence extract.`);
    assert.ok(approvedRecord);
    assert.equal(approvedRecord.sourceUrl, operation.officialSourceUrl);
    assert.equal(approvedRecord.sourceSha256, operation.officialSourceSha256);
    assert.equal(approvedRecord.deadlineDate, operation.expectedDeadlineDate);
    assert.equal(approvedRecord.applicationRound, operation.expectedApplicationRound);
    assert.equal(evidence.source?.url, operation.officialSourceUrl);
    assert.equal(evidence.source?.sha256, operation.officialSourceSha256);
    assert.equal(evidence.source?.capturedAt, operation.capturedAt);

    const rows = await tx.query<{ id: string; version: number; status: string; verificationStatus: string;
      deadlineDate: Date | null; applicationRound: string | null; sourceUrl: string | null }>(`
      select id::text,version,status,verification_status as "verificationStatus",deadline_date as "deadlineDate",
        application_round as "applicationRound",source_url as "sourceUrl"
      from scholarships where slug=$1 for update`, [operation.scholarshipSlug]);
    const current = rows[0];
    assert.ok(current, `${operation.scholarshipSlug} is missing.`);
    assert.equal(current.version, operation.expectedVersion, `${operation.scholarshipSlug} version changed.`);
    assert.equal(current.status, operation.expectedStatus);
    assert.equal(current.verificationStatus, operation.expectedVerificationStatus);
    assert.equal(current.deadlineDate?.toISOString().slice(0, 10), operation.expectedDeadlineDate);
    assert.equal(current.applicationRound, operation.expectedApplicationRound);
    assert.equal(current.sourceUrl, operation.officialSourceUrl);

    let supersedesScholarshipId: string | null = null;
    if (operation.supersedesScholarshipSlug) {
      const predecessors = await tx.query<{ id: string }>(`select id::text from scholarships where slug=$1`,
        [operation.supersedesScholarshipSlug]);
      assert.ok(predecessors[0], `${operation.supersedesScholarshipSlug} predecessor is missing.`);
      supersedesScholarshipId = predecessors[0].id;
    }
    const existing = await tx.query<{ scholarshipId: string; seriesKey: string; cycleKey: string;
      intakeYear: number; intakeLabel: string; supersedesScholarshipId: string | null;
      officialSourceUrl: string; officialSourceSha256: string; capturedAt: Date }>(`
      select scholarship_id::text as "scholarshipId",series_key as "seriesKey",cycle_key as "cycleKey",
        intake_year as "intakeYear",intake_label as "intakeLabel",
        supersedes_scholarship_id::text as "supersedesScholarshipId",official_source_url as "officialSourceUrl",
        official_source_sha256 as "officialSourceSha256",captured_at as "capturedAt"
      from scholarship_cycle_lineage where scholarship_id=$1`, [current.id]);
    if (existing[0]) {
      assert.deepEqual({ ...existing[0], capturedAt: existing[0].capturedAt.toISOString() }, {
        scholarshipId: current.id, seriesKey: operation.seriesKey, cycleKey: operation.cycleKey,
        intakeYear: operation.intakeYear, intakeLabel: operation.intakeLabel, supersedesScholarshipId,
        officialSourceUrl: operation.officialSourceUrl, officialSourceSha256: operation.officialSourceSha256,
        capturedAt: new Date(operation.capturedAt).toISOString(),
      });
      results.push({ scholarshipSlug: operation.scholarshipSlug, outcome: "already_registered" });
      continue;
    }
    if (!apply) {
      results.push({ scholarshipSlug: operation.scholarshipSlug, outcome: "would_register",
        seriesKey: operation.seriesKey, cycleKey: operation.cycleKey, intakeYear: operation.intakeYear });
      continue;
    }
    await tx.query(`insert into scholarship_cycle_lineage (scholarship_id,series_key,cycle_key,intake_year,
      intake_label,supersedes_scholarship_id,official_source_url,official_source_sha256,captured_at,registered_by_user_id)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [current.id, operation.seriesKey, operation.cycleKey,
      operation.intakeYear, operation.intakeLabel, supersedesScholarshipId, operation.officialSourceUrl,
      operation.officialSourceSha256, operation.capturedAt, actorRows[0].actorUserId]);
    await audit.record(buildAuditEvent(context, { action: "ops.catalog.scholarship_cycle.register",
      resourceType: "catalog_scholarship_cycle", resourceId: current.id, allowed: true,
      policyDecisionId: batch.reviewReference, dataClasses: ["public_catalog", "audit_security"],
      metadata: { batchId: batch.batchId, scholarshipSlug: operation.scholarshipSlug,
        seriesKey: operation.seriesKey, cycleKey: operation.cycleKey, intakeYear: operation.intakeYear,
        sourceSha256: operation.officialSourceSha256 } }));
    results.push({ scholarshipSlug: operation.scholarshipSlug, outcome: "registered",
      seriesKey: operation.seriesKey, cycleKey: operation.cycleKey, intakeYear: operation.intakeYear });
  }
  if (apply) await connection.query("commit"); else await connection.query("rollback");
  console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry_run", batchId: batch.batchId,
    reviewReference: batch.reviewReference, results }, null, 2));
} catch (error) {
  await connection.query("rollback").catch(() => undefined);
  throw error;
} finally {
  connection.release();
  await pool.end();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
