import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type { AgentMemoryManagementRepository, StoredStudyMemory } from "./memory-management.ts";
import { countStoredStudentMemories, lockStudentMemoryPolicy } from "./memory-policy.ts";
import { badRequest, CuacError } from "../shared/errors.ts";

export class PostgresAgentMemoryManagementRepository implements AgentMemoryManagementRepository {
  private readonly client: Pick<TransactionalSqlClient, "query">;

  constructor(client: Pick<TransactionalSqlClient, "query">) { this.client = client; }

  lockPolicy(userId: string) { return lockStudentMemoryPolicy(this.client, userId); }

  countStored(userId: string) { return countStoredStudentMemories(this.client, userId); }

  async list(userId: string, limit: number, cursor: string | null) {
    let anchor: string | null = null;
    if (cursor) {
      const rows = await this.client.query<{ createdAt: string }>(
        `select created_at::text as "createdAt" from agent_memory_entries where ${ownedMemorySql} and id = $2`, [userId, cursor],
      );
      if (!rows[0]) throw badRequest("Memory cursor is not available.");
      anchor = rows[0].createdAt;
    }
    return this.client.query<StoredStudyMemory>(
      `select id, memory_type as "memoryType", structured_json as structured, created_at as "createdAt", expires_at as "expiresAt"
       from agent_memory_entries where ${ownedMemorySql}
         and cleared_at is null and (expires_at is null or (isfinite(expires_at) and expires_at > clock_timestamp()))
         and memory_type = 'study_goal' and data_class = 'low_sensitive_preference' and confidence = 'user_confirmed'
         and ($3::timestamptz is null or (created_at, id) < ($3::timestamptz, $4::uuid))
       order by created_at desc, id desc limit $2`, [userId, limit, anchor, cursor],
    );
  }

  async clearOne(userId: string, memoryId: string) {
    const rows = await this.client.query(
      `update agent_memory_entries set ${clearMemorySql} where ${ownedMemorySql} and id = $2
       and (cleared_at is null or summary <> '' or structured_json <> '{}'::jsonb or source <> 'user_cleared') returning id`, [userId, memoryId],
    );
    const sources = await this.scrubConfirmedSources(userId, memoryId);
    return rows.length === 1 || sources > 0;
  }

  async reset(userId: string, expectedRevision: number, enabled?: boolean) {
    const [settings] = await this.client.query<{ enabled: boolean; revision: number }>(
      `insert into agent_student_memory_settings (user_id, enabled, revision, reset_at, updated_at)
       select $1, coalesce($2::boolean, true), 1, clock_timestamp(), clock_timestamp()
       where $3::int = 0 or exists (select 1 from agent_student_memory_settings where user_id = $1 and revision = $3)
       on conflict (user_id) do update set enabled = coalesce($2::boolean, agent_student_memory_settings.enabled),
         revision = agent_student_memory_settings.revision + 1, reset_at = clock_timestamp(), updated_at = clock_timestamp()
       where agent_student_memory_settings.revision = $3
       returning enabled, revision`, [userId, enabled ?? null, expectedRevision],
    );
    if (!settings) throw new CuacError("CONFLICT", "Memory settings changed. Reload before making a new decision.", 409);
    const candidates = await this.client.query(
      `update agent_context_candidates set status = case when status = 'proposed' then 'rejected' else status end,
         payload_cleared_at = clock_timestamp(), summary = '', structured_json = '{}'::jsonb,
         source_entity_ids_json = '[]'::jsonb, anonymous_session_hash = null, continuation_id = null
       where user_id = $1 and context_scope = 'student_account' and active_role = 'student' and tenant_school_id is null
         and memory_namespace = 'user:' || $1::text || ':student'
         and payload_cleared_at is null returning id`, [userId],
    );
    const sources = await this.scrubConfirmedSources(userId);
    const memories = await this.client.query(
      `update agent_memory_entries set ${clearMemorySql} where ${ownedMemorySql}
       and (cleared_at is null or summary <> '' or structured_json <> '{}'::jsonb or source <> 'user_cleared') returning id`, [userId],
    );
    return { ...settings, clearedCount: memories.length, clearedCandidateCount: candidates.length + sources };
  }

  private async scrubConfirmedSources(userId: string, memoryId: string | null = null) {
    const rows = await this.client.query(
      `update agent_context_candidates c set payload_cleared_at = clock_timestamp(), summary = '', structured_json = '{}'::jsonb,
         source_entity_ids_json = '[]'::jsonb, anonymous_session_hash = null, continuation_id = null
       where c.payload_cleared_at is null and c.status = 'accepted' and c.tenant_school_id is null
         and ((c.context_scope = 'guest_page' and c.active_role = 'guest' and c.user_id is null)
           or (c.context_scope = 'student_account' and c.active_role = 'student' and c.user_id = $1::uuid
             and c.memory_namespace = 'user:' || $1::text || ':student'))
         and c.id in (select source_candidate_id from agent_memory_entries where ${ownedMemorySql} and ($2::uuid is null or id = $2))
       returning c.id`, [userId, memoryId],
    );
    return rows.length;
  }

  async sweepCandidates(limit: number) {
    const rows = await this.client.query(
      `with due as materialized (
         select id from agent_context_candidates
         where payload_cleared_at is null and tenant_school_id is null
           and ((context_scope = 'guest_page' and active_role = 'guest') or (context_scope = 'student_account' and active_role = 'student'))
           and (status in ('accepted', 'rejected', 'expired') or
             (status = 'proposed' and (not isfinite(expires_at) or expires_at <= clock_timestamp())))
         order by expires_at, id limit $1 for update skip locked
       ) update agent_context_candidates c set status = case when c.status = 'proposed' then 'expired' else c.status end,
         payload_cleared_at = clock_timestamp(), summary = '', structured_json = '{}'::jsonb,
         source_entity_ids_json = '[]'::jsonb, anonymous_session_hash = null, continuation_id = null
       from due where c.id = due.id returning c.id`, [limit],
    );
    return { clearedCandidateCount: rows.length };
  }

  async sweepExpiredStudentMemories(limit: number) {
    const memories = await this.client.query<{ id: string }>(
      `with due as materialized (
         select id from agent_memory_entries
         where cleared_at is null and context_scope = 'student_account' and active_role = 'student'
           and tenant_school_id is null and data_class = 'low_sensitive_preference'
           and (expires_at is null or not isfinite(expires_at) or expires_at <= clock_timestamp())
         order by expires_at nulls first, id limit $1 for update skip locked
       ) update agent_memory_entries m set cleared_at = clock_timestamp(), summary = '',
         structured_json = '{}'::jsonb, source = 'retention_expired'
       from due where m.id = due.id returning m.id`, [limit],
    );
    if (!memories.length) return { clearedMemoryCount: 0, clearedCandidateCount: 0 };
    const memoryIds = memories.map(row => row.id);
    const candidates = await this.client.query(
      `update agent_context_candidates c set payload_cleared_at = clock_timestamp(), summary = '',
         structured_json = '{}'::jsonb, source_entity_ids_json = '[]'::jsonb,
         anonymous_session_hash = null, continuation_id = null
       where c.payload_cleared_at is null and c.status = 'accepted' and c.tenant_school_id is null
         and exists (
           select 1 from agent_memory_entries m where m.id = any($1::uuid[])
             and m.source_candidate_id = c.id and m.context_scope = 'student_account'
             and m.active_role = 'student' and m.tenant_school_id is null
             and m.memory_namespace = 'user:' || m.user_id::text || ':student'
             and ((c.context_scope = 'guest_page' and c.active_role = 'guest' and c.user_id is null
                 and c.memory_namespace is null)
               or (c.context_scope = 'student_account' and c.active_role = 'student'
                 and c.user_id = m.user_id and c.memory_namespace = m.memory_namespace))
         ) returning c.id`, [memoryIds],
    );
    return { clearedMemoryCount: memories.length, clearedCandidateCount: candidates.length };
  }
}

const ownedMemorySql = `user_id = $1 and context_scope = 'student_account' and active_role = 'student'
  and tenant_school_id is null and memory_namespace = 'user:' || $1::text || ':student'`;
const clearMemorySql = `cleared_at = coalesce(cleared_at, clock_timestamp()), summary = '', structured_json = '{}'::jsonb, source = 'user_cleared'`;
