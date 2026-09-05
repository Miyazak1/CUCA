import { randomUUID } from "node:crypto";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { transactionalMethod } from "../db/transactional-method.ts";
import { inputInteger } from "../shared/input.ts";
import { AgentMemoryManagementService } from "./memory-management.ts";
import { PostgresAgentMemoryManagementRepository } from "./postgres-memory-management-repository.ts";
import { STUDENT_MEMORY_RETENTION_DAYS } from "./memory-policy.ts";

// Student controls use these transactions; no Agent tool receives this service.
export function createPostgresAgentMemoryManagementService(client: TransactionalSqlClient) {
  const create = (tx: TransactionalSqlClient) => new AgentMemoryManagementService(new PostgresAgentMemoryManagementRepository(tx), new PostgresAuditWriter(tx));
  return {
    list: transactionalMethod(client, create, "list"),
    clearOne: transactionalMethod(client, create, "clearOne"),
    clearAll: transactionalMethod(client, create, "clearAll"),
    setEnabled: transactionalMethod(client, create, "setEnabled"),
  };
}

export async function sweepAgentCandidates(client: TransactionalSqlClient, batchSize = 100) {
  const limit = inputInteger(batchSize, "batchSize", 1, 500);
  return client.transaction(async (tx) => {
    const result = await new PostgresAgentMemoryManagementRepository(tx).sweepCandidates(limit);
    if (result.clearedCandidateCount) await new PostgresAuditWriter(tx).record({
      requestId: randomUUID(), actorUserId: null, activeRole: "system", tenantSchoolId: null,
      action: "agent.context_candidates.sweep", resourceType: "agent_context_candidate", resourceId: null,
      allowed: true, policyDecisionId: null, dataClasses: ["low_sensitive_preference"], metadata: result,
    });
    return result;
  });
}

export async function sweepExpiredStudentMemories(client: TransactionalSqlClient, batchSize = 100) {
  const limit = inputInteger(batchSize, "batchSize", 1, 500);
  return client.transaction(async (tx) => {
    const result = await new PostgresAgentMemoryManagementRepository(tx).sweepExpiredStudentMemories(limit);
    if (result.clearedMemoryCount) await new PostgresAuditWriter(tx).record({
      requestId: randomUUID(), actorUserId: null, activeRole: "system", tenantSchoolId: null,
      action: "agent.memories.retention_sweep", resourceType: "agent_memory_entry", resourceId: null,
      allowed: true, policyDecisionId: null, dataClasses: ["low_sensitive_preference"],
      metadata: { ...result, retentionDays: STUDENT_MEMORY_RETENTION_DAYS },
    });
    return result;
  });
}
