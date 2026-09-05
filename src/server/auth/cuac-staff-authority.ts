export type CuacInternalRole = "cuac_ops" | "cuac_admin";

export type LiveCuacStaffAuthority = {
  grantId: string;
  actorUserId: string;
  activeRole: CuacInternalRole;
  expiresAt: Date;
};

export type SqlCuacStaffAuthorityClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

export async function lockLiveCuacStaffAuthority(
  client: SqlCuacStaffAuthorityClient,
  input: { actorUserId: string; activeRole: CuacInternalRole },
): Promise<LiveCuacStaffAuthority | null> {
  const rows = await client.query<LiveCuacStaffAuthority>(
    `select
       g.id as "grantId",
       u.id as "actorUserId",
       r.role as "activeRole",
       g.expires_at as "expiresAt"
     from users u
     join user_roles r on r.user_id = u.id and r.role = $2 and r.revoked_at is null
     join cuac_staff_access_grants g on g.user_id = u.id and g.requested_role = r.role
     where u.id = $1 and u.account_status = 'active'
       and g.requested_surface = 'cuac_internal'
       and g.status = 'approved'
       and g.approved_by_user_id is not null
       and g.approved_at is not null
       and g.expires_at > clock_timestamp()
       and g.revoked_at is null
     for share of u, r, g
     limit 1`,
    [input.actorUserId, input.activeRole],
  );
  return rows[0] ?? null;
}
