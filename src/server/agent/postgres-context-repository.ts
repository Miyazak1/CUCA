import type {
  AgentContextCandidateRecord,
  AgentCandidateOwner,
  AgentContextRepository,
  AgentMemoryEntryRecord,
} from "./context.ts";
import { forbidden, CuacError, tooManyRequests } from "../shared/errors.ts";
import { GUEST_AGENT_CANDIDATE_CAPACITY, STUDENT_AGENT_CANDIDATE_CAPACITY } from "./candidate-policy.ts";
import { countStoredStudentMemories, lockStudentMemoryPolicy, STUDENT_MEMORY_CAPACITY, STUDENT_MEMORY_RETENTION_DAYS } from "./memory-policy.ts";

export type SqlAgentContextClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

type AgentContextCandidateRow = {
  id: string;
  anonymousSessionHash: string | null;
  userId: string | null;
  continuationId: string | null;
  candidateType: string;
  contextScope: AgentContextCandidateRecord["contextScope"];
  activeRole: string;
  tenantSchoolId: string | null;
  memoryNamespace: string | null;
  dataClass: AgentContextCandidateRecord["dataClass"];
  confidence: AgentContextCandidateRecord["confidence"];
  summary: string;
  structuredJson: Record<string, unknown>;
  sourceEntityIdsJson: readonly string[];
  status: AgentContextCandidateRecord["status"];
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
};

type AgentMemoryEntryRow = {
  id: string;
  userId: string | null;
  memoryType: string;
  contextScope: AgentMemoryEntryRecord["contextScope"];
  activeRole: string;
  tenantSchoolId: string | null;
  memoryNamespace: string;
  dataClass: AgentMemoryEntryRecord["dataClass"];
  confidence: AgentMemoryEntryRecord["confidence"];
  summary: string;
  structuredJson: Record<string, unknown>;
  source: string;
  sourceCandidateId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  clearedAt: Date | null;
};

export class PostgresAgentContextRepository implements AgentContextRepository {
  private readonly client: SqlAgentContextClient;

  constructor(client: SqlAgentContextClient) {
    this.client = client;
  }

  async assertMemoryAllowed(userId: string) {
    if (!(await lockStudentMemoryPolicy(this.client, userId)).enabled) throw forbidden("Persistent study memory is disabled.");
  }

  async createCandidate(
    input: Omit<AgentContextCandidateRecord, "id" | "createdAt" | "acceptedAt">,
  ): Promise<AgentContextCandidateRecord> {
    // Runtime composition supplies a transaction-scoped client. The separate lock statement is
    // intentional: a statement that waits for an advisory lock keeps its pre-wait MVCC snapshot.
    await this.client.query(
      `select pg_advisory_xact_lock(hashtextextended(
         case when $1 = 'guest_page' then 'guest:' || $2 else 'student:' || $3::uuid::text end, 0
       ))`,
      [input.contextScope, input.anonymousSessionHash, input.userId],
    );
    const rows = await this.client.query<AgentContextCandidateRow>(
      `with candidate_clock as materialized (select clock_timestamp() as created_at),
       candidate_capacity as materialized (
         select count(*)::int as stored_count
         from candidate_clock, agent_context_candidates existing
         where existing.payload_cleared_at is null and existing.status = 'proposed'
           and isfinite(existing.expires_at) and existing.expires_at > candidate_clock.created_at
           and existing.tenant_school_id is null
           and (($5 = 'guest_page' and existing.context_scope = 'guest_page' and existing.active_role = 'guest'
             and existing.user_id is null and existing.memory_namespace is null
             and existing.anonymous_session_hash = $1)
           or ($5 = 'student_account' and existing.context_scope = 'student_account' and existing.active_role = 'student'
             and existing.user_id = $2::uuid and existing.anonymous_session_hash is null
             and existing.memory_namespace = 'user:' || $2::uuid::text || ':student'))
       )
       insert into agent_context_candidates (
         anonymous_session_hash, user_id, continuation_id, candidate_type, context_scope,
         active_role, tenant_school_id, memory_namespace, data_class, confidence, summary,
         structured_json, source_entity_ids_json, status, expires_at, created_at
       ) select $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14,
         least($15::timestamptz, candidate_clock.created_at + case when $5 = 'guest_page' then interval '24 hours' else interval '168 hours' end),
         candidate_clock.created_at
       from candidate_clock, candidate_capacity
       where candidate_capacity.stored_count < case
         when $5 = 'guest_page' then $16::int
         when $5 = 'student_account' then $17::int
         else 0
       end
       returning
         id,
         anonymous_session_hash as "anonymousSessionHash",
         user_id as "userId",
         continuation_id as "continuationId",
         candidate_type as "candidateType",
         context_scope as "contextScope",
         active_role as "activeRole",
         tenant_school_id as "tenantSchoolId",
         memory_namespace as "memoryNamespace",
         data_class as "dataClass",
         confidence,
         summary,
         structured_json as "structuredJson",
         source_entity_ids_json as "sourceEntityIdsJson",
         status,
         expires_at as "expiresAt",
         created_at as "createdAt",
         accepted_at as "acceptedAt"`,
      [
        input.anonymousSessionHash,
        input.userId,
        input.continuationId,
        input.candidateType,
        input.contextScope,
        input.activeRole,
        input.tenantSchoolId,
        input.memoryNamespace,
        input.dataClass,
        input.confidence,
        input.summary,
        JSON.stringify(input.structured),
        JSON.stringify(input.sourceEntityIds),
        input.status,
        input.expiresAt,
        GUEST_AGENT_CANDIDATE_CAPACITY,
        STUDENT_AGENT_CANDIDATE_CAPACITY,
      ],
    );

    if (!rows[0]) {
      throw tooManyRequests("Too many pending Agent context candidates. Confirm or wait for expiry before adding another.");
    }
    return toAgentContextCandidateRecord(rows[0]);
  }

  async findCandidateForConfirmation(candidateId: string, owner: AgentCandidateOwner): Promise<AgentContextCandidateRecord | null> {
    const rows = await this.client.query<AgentContextCandidateRow>(
      `${candidateSelectSql}
       ${candidateConfirmationWhereSql}
       for update`,
      candidateOwnerParams(candidateId, owner),
    );

    return rows[0] ? toAgentContextCandidateRecord(rows[0]) : null;
  }

  async markCandidateAccepted(candidateId: string, owner: AgentCandidateOwner): Promise<boolean> {
    // A second statement checks wall-clock expiry after the row lock has been acquired.
    const rows = await this.client.query(
      `update agent_context_candidates
       set status = 'accepted',
           accepted_at = clock_timestamp(), payload_cleared_at = clock_timestamp(),
           summary = '', structured_json = '{}'::jsonb, source_entity_ids_json = '[]'::jsonb,
           anonymous_session_hash = null, continuation_id = null
       ${candidateConfirmationWhereSql}
       returning id`,
      candidateOwnerParams(candidateId, owner),
    );
    return rows.length === 1;
  }

  async createMemoryEntry(input: Omit<AgentMemoryEntryRecord, "id" | "expiresAt" | "createdAt" | "clearedAt">): Promise<AgentMemoryEntryRecord> {
    // The factory holds the account/role locks through confirmation, quota check, insertion and audit.
    if (!input.userId || input.contextScope !== "student_account" || input.activeRole !== "student"
      || input.tenantSchoolId || input.memoryNamespace !== `user:${input.userId}:student`) throw forbidden();
    if (await countStoredStudentMemories(this.client, input.userId) >= STUDENT_MEMORY_CAPACITY) {
      throw new CuacError("CONFLICT", "Student memory capacity reached. Clear stored memories before confirming another.", 409);
    }
    const rows = await this.client.query<AgentMemoryEntryRow>(
      `with memory_clock as materialized (select clock_timestamp() as created_at)
       insert into agent_memory_entries (
         user_id, memory_type, context_scope, active_role, tenant_school_id, memory_namespace,
         data_class, confidence, summary, structured_json, source, source_candidate_id, expires_at, created_at
       ) select $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12,
         memory_clock.created_at + ($13::int * interval '1 day'), memory_clock.created_at
       from memory_clock
       returning
         id,
         user_id as "userId",
         memory_type as "memoryType",
         context_scope as "contextScope",
         active_role as "activeRole",
         tenant_school_id as "tenantSchoolId",
         memory_namespace as "memoryNamespace",
         data_class as "dataClass",
         confidence,
         summary,
         structured_json as "structuredJson",
         source,
         source_candidate_id as "sourceCandidateId",
         expires_at as "expiresAt",
         created_at as "createdAt",
         cleared_at as "clearedAt"`,
      [
        input.userId,
        input.memoryType,
        input.contextScope,
        input.activeRole,
        input.tenantSchoolId,
        input.memoryNamespace,
        input.dataClass,
        input.confidence,
        input.summary,
        JSON.stringify(input.structured),
        input.source,
        input.sourceCandidateId,
        STUDENT_MEMORY_RETENTION_DAYS,
      ],
    );

    return toAgentMemoryEntryRecord(requireRow(rows, "Agent memory entry create"));
  }
}

function candidateOwnerParams(candidateId: string, owner: AgentCandidateOwner) {
  return [candidateId, owner.contextScope, owner.contextScope === "guest_page" ? owner.anonymousSessionHash : null,
    owner.contextScope === "student_account" ? owner.userId : null,
    owner.contextScope === "student_account" ? owner.memoryNamespace : null, owner.destinationUserId];
}

const candidateConfirmationWhereSql = `where id = $1
  and status = 'proposed' and accepted_at is null
  and isfinite(expires_at) and expires_at > clock_timestamp()
  and tenant_school_id is null and data_class = 'low_sensitive_preference'
  and context_scope = $2
  and payload_cleared_at is null
  and not exists (select 1 from agent_student_memory_settings s where s.user_id = $6::uuid
    and (not s.enabled or s.reset_at >= agent_context_candidates.created_at))
  and (
    (context_scope = 'guest_page' and active_role = 'guest' and user_id is null
      and memory_namespace is null and anonymous_session_hash = $3)
    or (context_scope = 'student_account' and active_role = 'student' and user_id = $4::uuid
      and anonymous_session_hash is null and memory_namespace = $5)
  )`;

function toAgentContextCandidateRecord(row: AgentContextCandidateRow): AgentContextCandidateRecord {
  return {
    id: row.id,
    anonymousSessionHash: row.anonymousSessionHash,
    userId: row.userId,
    continuationId: row.continuationId,
    candidateType: row.candidateType,
    contextScope: row.contextScope,
    activeRole: row.activeRole,
    tenantSchoolId: row.tenantSchoolId,
    memoryNamespace: row.memoryNamespace,
    dataClass: row.dataClass,
    confidence: row.confidence,
    summary: row.summary,
    structured: row.structuredJson,
    sourceEntityIds: row.sourceEntityIdsJson,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
  };
}

function toAgentMemoryEntryRecord(row: AgentMemoryEntryRow): AgentMemoryEntryRecord {
  return {
    id: row.id,
    userId: row.userId,
    memoryType: row.memoryType,
    contextScope: row.contextScope,
    activeRole: row.activeRole,
    tenantSchoolId: row.tenantSchoolId,
    memoryNamespace: row.memoryNamespace,
    dataClass: row.dataClass,
    confidence: row.confidence,
    summary: row.summary,
    structured: row.structuredJson,
    source: row.source,
    sourceCandidateId: row.sourceCandidateId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    clearedAt: row.clearedAt,
  };
}

function requireRow<T>(rows: readonly T[], action: string): T {
  const value = rows[0];

  if (!value) {
    throw new Error(`PostgreSQL did not return a row for ${action}.`);
  }

  return value;
}

const candidateSelectSql = `
select
  id,
  anonymous_session_hash as "anonymousSessionHash",
  user_id as "userId",
  continuation_id as "continuationId",
  candidate_type as "candidateType",
  context_scope as "contextScope",
  active_role as "activeRole",
  tenant_school_id as "tenantSchoolId",
  memory_namespace as "memoryNamespace",
  data_class as "dataClass",
  confidence,
  summary,
  structured_json as "structuredJson",
  source_entity_ids_json as "sourceEntityIdsJson",
  status,
  expires_at as "expiresAt",
  created_at as "createdAt",
  accepted_at as "acceptedAt"
from agent_context_candidates`;
