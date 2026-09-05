import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { forbidden, serviceUnavailable } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";

export const OPS_OPERATIONS_REGISTRY_VERSION = "cuac.ops-operations-registry.v1" as const;
export const OPS_OPERATIONS_EXCEPTION_WINDOW_HOURS = 24;

export const OPS_OPERATIONS_METRIC_REGISTRY = [
  { queueKey: "auth_email_delivery", source: "auth_email_outbox" },
  { queueKey: "notification_delivery", source: "notification_deliveries" },
  { queueKey: "student_file_processing", source: "student_file_assets" },
  { queueKey: "official_submission_delivery", source: "official_submission_outbox" },
  { queueKey: "payment_reconciliation", source: "payment_provider_events" },
] as const;

export type OpsOperationsQueueKey = (typeof OPS_OPERATIONS_METRIC_REGISTRY)[number]["queueKey"];
export type OpsMonitoringRole = "cuac_ops" | "cuac_admin";

export type OpsOperationsMetricRow = {
  queueKey: string;
  generatedAt: Date;
  exceptionWindowStartedAt: Date;
  dueCount: number;
  inFlightCount: number;
  expiredLeaseCount: number;
  exceptionsLast24Hours: number;
  oldestDueAt: Date | null;
};

export type OpsOperationsQueueSummary = Omit<OpsOperationsMetricRow,
  "queueKey" | "generatedAt" | "exceptionWindowStartedAt"> & {
  queueKey: OpsOperationsQueueKey;
};

export type OpsOperationsSummary = {
  schemaVersion: 1;
  registryVersion: typeof OPS_OPERATIONS_REGISTRY_VERSION;
  generatedAt: Date;
  exceptionWindowStartedAt: Date;
  queues: OpsOperationsQueueSummary[];
  totals: {
    dueCount: number;
    inFlightCount: number;
    expiredLeaseCount: number;
    exceptionsLast24Hours: number;
  };
};

export type ReadOpsOperationsSummaryResult =
  | { authorized: false }
  | { authorized: true; rows: OpsOperationsMetricRow[] };

export type OpsOperationsMonitoringRepository = {
  readOperationsSummary(input: {
    actorUserId: string;
    activeRole: OpsMonitoringRole;
  }): Promise<ReadOpsOperationsSummaryResult>;
};

export class OpsOperationsMonitoringService {
  private readonly repository: OpsOperationsMonitoringRepository;
  private readonly auditSink: AuditSink;

  constructor(
    repository: OpsOperationsMonitoringRepository,
    auditSink: AuditSink,
  ) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async getOperationsSummary(context: RequestContext): Promise<OpsOperationsSummary> {
    const actor = requireOpsMonitoringContext(context);
    const decision = evaluatePolicy(context, "ops.read_governed_summary", {
      type: "ops_summary",
      dataClasses: ["ops_confidential", "audit_security"],
    });
    if (!decision.allowed) throw forbidden(decision.reason);

    const result = await this.repository.readOperationsSummary(actor);
    if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
    const summary = materializeSummary(result.rows);
    await this.auditSink.record(buildAuditEvent(context, {
      action: "ops.operations_summary.read",
      resourceType: "ops_operations_registry",
      resourceId: OPS_OPERATIONS_REGISTRY_VERSION,
      allowed: true,
      policyDecisionId: decision.id,
      dataClasses: ["ops_confidential", "audit_security"],
      metadata: {
        registryVersion: OPS_OPERATIONS_REGISTRY_VERSION,
        queueCount: summary.queues.length,
        ...summary.totals,
      },
    }));
    return summary;
  }
}

function materializeSummary(rows: OpsOperationsMetricRow[]): OpsOperationsSummary {
  if (rows.length !== OPS_OPERATIONS_METRIC_REGISTRY.length) throw corruptSummary();
  let generatedAt: Date | undefined;
  let exceptionWindowStartedAt: Date | undefined;
  const queues = rows.map((row, index): OpsOperationsQueueSummary => {
    const registered = OPS_OPERATIONS_METRIC_REGISTRY[index];
    if (!registered || row.queueKey !== registered.queueKey || !validDate(row.generatedAt)
      || !validDate(row.exceptionWindowStartedAt)) throw corruptSummary();
    generatedAt ??= row.generatedAt;
    exceptionWindowStartedAt ??= row.exceptionWindowStartedAt;
    if (row.generatedAt.getTime() !== generatedAt.getTime()
      || row.exceptionWindowStartedAt.getTime() !== exceptionWindowStartedAt.getTime()
      || row.exceptionWindowStartedAt.getTime() >= row.generatedAt.getTime()) throw corruptSummary();
    const dueCount = safeCount(row.dueCount);
    const inFlightCount = safeCount(row.inFlightCount);
    const expiredLeaseCount = safeCount(row.expiredLeaseCount);
    const exceptionsLast24Hours = safeCount(row.exceptionsLast24Hours);
    if ((dueCount === 0 && row.oldestDueAt !== null)
      || (dueCount > 0 && (!validDate(row.oldestDueAt) || row.oldestDueAt.getTime() > row.generatedAt.getTime()))) {
      throw corruptSummary();
    }
    return {
      queueKey: registered.queueKey,
      dueCount,
      inFlightCount,
      expiredLeaseCount,
      exceptionsLast24Hours,
      oldestDueAt: row.oldestDueAt,
    };
  });
  if (!generatedAt || !exceptionWindowStartedAt) throw corruptSummary();
  const totals = queues.reduce((total, queue) => ({
    dueCount: total.dueCount + queue.dueCount,
    inFlightCount: total.inFlightCount + queue.inFlightCount,
    expiredLeaseCount: total.expiredLeaseCount + queue.expiredLeaseCount,
    exceptionsLast24Hours: total.exceptionsLast24Hours + queue.exceptionsLast24Hours,
  }), { dueCount: 0, inFlightCount: 0, expiredLeaseCount: 0, exceptionsLast24Hours: 0 });
  if (Object.values(totals).some(value => !Number.isSafeInteger(value))) throw corruptSummary();
  return {
    schemaVersion: 1,
    registryVersion: OPS_OPERATIONS_REGISTRY_VERSION,
    generatedAt,
    exceptionWindowStartedAt,
    queues,
    totals,
  };
}

function requireOpsMonitoringContext(context: RequestContext): { actorUserId: string; activeRole: OpsMonitoringRole } {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")
    || context.selectedSurface !== "ops" || context.purpose !== "ops_monitoring" || context.tenantSchoolId !== null
    || (context.authStrength !== "session" && context.authStrength !== "step_up")) {
    throw forbidden("Authenticated CUAC operations monitoring context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function safeCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) throw corruptSummary();
  return value;
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function corruptSummary() {
  return serviceUnavailable("Ops operations summary is unavailable.");
}
