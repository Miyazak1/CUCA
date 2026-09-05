import { randomUUID } from "node:crypto";

export async function grantCuacStaffAccess(pool, userId, role) {
  const approverEmail = `cuac-access-approver-${randomUUID()}@example.invalid`;
  const { rows: [approver] } = await pool.query(
    "insert into users (email, email_normalized) values ($1, $1) returning id",
    [approverEmail],
  );
  const user = (await pool.query("select email_normalized from users where id = $1", [userId])).rows[0];
  const { rows: [grant] } = await pool.query(
    `insert into cuac_staff_access_grants
      (user_id, email, email_normalized, requested_role, status, approved_by_user_id, reason, approved_at, expires_at)
     values ($1, $2, $2, $3, 'approved', $4, 'Synthetic rehearsal access', now(), now() + interval '1 day')
     returning id`,
    [userId, user.email_normalized, role, approver.id],
  );
  return { grantId: grant.id, approverId: approver.id };
}
