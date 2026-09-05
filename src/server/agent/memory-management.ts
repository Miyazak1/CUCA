import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { CuacError, badRequest, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputInteger, inputRecord, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { parseStoredCandidate } from "./candidate-input.ts";
import { STUDENT_MEMORY_CAPACITY } from "./memory-policy.ts";

export type StoredStudyMemory = {
  id: string; memoryType: string; structured: Record<string, unknown>; createdAt: Date; expiresAt: Date | null;
};
export type AgentMemoryManagementRepository = {
  lockPolicy(userId: string): Promise<{ enabled: boolean; revision: number }>;
  countStored(userId: string): Promise<number>;
  list(userId: string, limit: number, cursor: string | null): Promise<StoredStudyMemory[]>;
  clearOne(userId: string, memoryId: string): Promise<boolean>;
  reset(userId: string, expectedRevision: number, enabled?: boolean): Promise<{ enabled: boolean; revision: number; clearedCount: number; clearedCandidateCount: number }>;
};

export class AgentMemoryManagementService {
  private readonly repository: AgentMemoryManagementRepository;
  private readonly audit: AuditSink;

  constructor(repository: AgentMemoryManagementRepository, audit: AuditSink) {
    this.repository = repository;
    this.audit = audit;
  }

  async list(context: RequestContext, input: unknown = {}) {
    requireMemoryControlContext(context);
    const fields = inputRecord(input, ["limit", "cursor"]);
    const limit = inputInteger(fields.limit ?? 20, "limit", 1, 100);
    const cursor = fields.cursor === undefined ? null : inputUuid(fields.cursor, "cursor");
    const policy = await this.repository.lockPolicy(context.actorUserId!);
    const storedCount = await this.repository.countStored(context.actorUserId!);
    const rows = policy.enabled ? await this.repository.list(context.actorUserId!, limit + 1, cursor) : [];
    const items = [];
    for (const row of rows.slice(0, limit)) {
      try {
        const content = parseStoredCandidate({ candidateType: row.memoryType, structured: row.structured,
          dataClass: "low_sensitive_preference", contextScope: "student_account", activeRole: "student" });
        items.push({ id: row.id, memoryType: content.candidateType, summary: content.summary, structured: content.structured,
          confidence: "user_confirmed", createdAt: row.createdAt, expiresAt: row.expiresAt });
      } catch (error) { if (!(error instanceof CuacError)) throw error; }
    }
    await this.record(context, "agent.memory.list", null, { count: items.length });
    return { ...policy, storedCount, capacity: STUDENT_MEMORY_CAPACITY, items, nextCursor: rows.length > limit ? rows[limit - 1].id : null };
  }

  async clearOne(context: RequestContext, memoryId: string) {
    requireMemoryControlContext(context);
    memoryId = inputUuid(memoryId, "memoryId");
    await this.repository.lockPolicy(context.actorUserId!);
    const cleared = await this.repository.clearOne(context.actorUserId!, memoryId);
    if (cleared) await this.record(context, "agent.memory.clear", memoryId, {});
    return { cleared };
  }

  async clearAll(context: RequestContext, input: unknown) {
    requireMemoryControlContext(context);
    const fields = inputRecord(input, ["expectedRevision"]);
    const expectedRevision = requireRevision(fields.expectedRevision);
    const policy = await this.repository.lockPolicy(context.actorUserId!);
    requireCurrentRevision(policy.revision, expectedRevision);
    requireRevisionCapacity(policy.revision);
    const result = await this.repository.reset(context.actorUserId!, expectedRevision);
    await this.record(context, "agent.memory.clear_all", null, result);
    return result;
  }

  async setEnabled(context: RequestContext, input: unknown) {
    requireMemoryControlContext(context);
    const fields = inputRecord(input, ["enabled", "expectedRevision"]);
    if (typeof fields.enabled !== "boolean") throw badRequest("enabled must be a boolean.");
    const expectedRevision = requireRevision(fields.expectedRevision);
    const policy = await this.repository.lockPolicy(context.actorUserId!);
    requireCurrentRevision(policy.revision, expectedRevision);
    if (policy.enabled !== fields.enabled) {
      requireRevisionCapacity(policy.revision);
      const result = await this.repository.reset(context.actorUserId!, expectedRevision, fields.enabled);
      await this.record(context, "agent.memory.preference.update", null, result);
      return { enabled: result.enabled, revision: result.revision };
    }
    return policy;
  }

  private async record(context: RequestContext, action: string, resourceId: string | null, metadata: unknown) {
    await this.audit.record(buildAuditEvent(context, { action, resourceId, resourceType: "agent_memory_entry",
      allowed: true, policyDecisionId: context.policyDecisionId, dataClasses: ["low_sensitive_preference"], metadata }));
  }
}

export function requireMemoryControlContext(context: RequestContext): void {
  if (!context.actorUserId || context.activeRole !== "student" || context.selectedSurface !== "student"
    || context.purpose !== "student_action" || !["session", "step_up"].includes(context.authStrength)
    || context.tenantSchoolId || !context.dataClassAllowlist.includes("low_sensitive_preference")) {
    throw forbidden("Student memory controls require an authenticated student action.");
  }
}

function requireRevision(value: unknown) { return inputInteger(value, "expectedRevision", 0, 2_147_483_647); }
function requireCurrentRevision(actual: number, expected: number) {
  if (actual !== expected) throw new CuacError("CONFLICT", "Memory settings changed. Reload before making a new decision.", 409);
}
function requireRevisionCapacity(revision: number) {
  if (revision >= 2_147_483_647) throw serviceUnavailable("Memory settings cannot be changed at this time.");
}
