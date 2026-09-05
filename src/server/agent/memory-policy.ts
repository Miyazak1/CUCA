import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { forbidden } from "../shared/errors.ts";

export const STUDENT_MEMORY_CAPACITY = 100;
export const STUDENT_MEMORY_RETENTION_DAYS = 365;

export async function lockStudentMemoryPolicy(client: Pick<TransactionalSqlClient, "query">, userId: string) {
  // Confirmation, clear and opt-out acquire this lock before any candidate/memory lock.
  const users = await client.query<{ id: string }>("select id from users where id = $1 and account_status = 'active' for update", [userId]);
  if (!users.length) throw forbidden("Student memory account is not available.");
  const roles = await client.query(
    "select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share", [userId],
  );
  if (!roles.length) throw forbidden("Student memory account is not available.");
  const settings = await client.query<{ enabled: boolean; revision: number }>(
    "select enabled, revision from agent_student_memory_settings where user_id = $1", [userId],
  );
  return settings[0] ?? { enabled: true, revision: 0 };
}

export async function countStoredStudentMemories(client: Pick<TransactionalSqlClient, "query">, userId: string) {
  const [row] = await client.query<{ count: number }>(
    `select count(*)::int as count from agent_memory_entries where user_id = $1 and context_scope = 'student_account'
      and active_role = 'student' and tenant_school_id is null and memory_namespace = 'user:' || $1::text || ':student'
      and cleared_at is null`, [userId],
  );
  return row.count;
}
