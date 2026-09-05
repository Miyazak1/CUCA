import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { badRequest } from "../shared/errors.ts";
import { lockLiveCuacStaffAuthority, type CuacInternalRole } from "./cuac-staff-authority.ts";
import type {
  AcceptedSchoolStaffInvite,
  ActiveSchoolStaffInvite,
  SchoolStaffInviteAccount,
  SchoolStaffInviteRepository,
  SchoolStaffInviteRole,
  SchoolStaffInviteSchool,
} from "./school-invites.ts";

export type SqlSchoolStaffInviteClient = TransactionalSqlClient;

type AccountRow = {
  userId: string;
  emailNormalized: string;
  accountStatus: string;
};

type InviteRow = {
  id: string;
  schoolId: string;
  emailNormalized: string;
  role: string;
  invitedByUserId: string | null;
  expiresAt: Date;
};

type SchoolRow = {
  id: string;
  status: string;
};

type CreatedInviteRow = {
  inviteId: string;
};

type MembershipRow = {
  membershipId: string;
  schoolStaffRoleGranted: boolean;
};

export class PostgresSchoolStaffInviteRepository implements SchoolStaffInviteRepository {
  private readonly client: SqlSchoolStaffInviteClient;

  constructor(client: SqlSchoolStaffInviteClient) {
    this.client = client;
  }

  async hasLiveCuacStaffAuthority(input: {
    actorUserId: string;
    activeRole: CuacInternalRole;
  }): Promise<boolean> {
    return await lockLiveCuacStaffAuthority(this.client, input) !== null;
  }

  async findAccountByUserId(userId: string): Promise<SchoolStaffInviteAccount | null> {
    const rows = await this.client.query<AccountRow>(
      `select
         id as "userId",
         email_normalized as "emailNormalized",
         account_status as "accountStatus"
       from users
       where id = $1
       limit 1`,
      [userId],
    );

    return rows[0] ?? null;
  }

  async findSchoolById(schoolId: string): Promise<SchoolStaffInviteSchool | null> {
    const rows = await this.client.query<SchoolRow>(
      `select
         id,
         status
       from schools
       where id = $1
       limit 1`,
      [schoolId],
    );

    return rows[0] ?? null;
  }

  async createInvite(input: {
    schoolId: string;
    email: string;
    emailNormalized: string;
    role: SchoolStaffInviteRole;
    inviteTokenHash: string;
    invitedByUserId: string;
    now: Date;
    expiresAt: Date;
  }): Promise<{ inviteId: string }> {
    return this.client.transaction(async (client) => {
      // Serialize replacements before reading; keep FK key-share locks compatible.
      const schools = await client.query<{ id: string }>(
        "select id from schools where id = $1 and status = 'active' for no key update",
        [input.schoolId],
      );
      if (!schools[0]) throw badRequest("School is not available for staff invites.");

      await client.query(
        `update school_staff_invites
         set status = 'revoked', revoked_at = $3, updated_at = $3
         where school_id = $1 and email_normalized = $2
           and status = 'pending' and accepted_at is null and revoked_at is null`,
        [input.schoolId, input.emailNormalized, input.now],
      );
      const rows = await client.query<CreatedInviteRow>(
        `insert into school_staff_invites (
         school_id,
         email,
         email_normalized,
         role,
         token_hash,
         status,
         invited_by_user_id,
         expires_at,
         created_at,
         updated_at
       )
       values ($1, $2, $3, $4, $5, 'pending', $6, $8, $7, $7)
       returning id as "inviteId"`,
        [
          input.schoolId,
          input.email,
          input.emailNormalized,
          input.role,
          input.inviteTokenHash,
          input.invitedByUserId,
          input.now,
          input.expiresAt,
        ],
      );
      const inviteId = rows[0]?.inviteId;

      if (!inviteId) {
        throw new Error("Failed to create school staff invite.");
      }

      return { inviteId };
    });
  }

  async findActiveInviteByIdAndTokenHash(input: {
    inviteId: string;
    inviteTokenHash: string;
    now: Date;
  }): Promise<ActiveSchoolStaffInvite | null> {
    const rows = await this.client.query<InviteRow>(
      `select
         id,
         school_id as "schoolId",
         email_normalized as "emailNormalized",
         role,
         invited_by_user_id as "invitedByUserId",
         expires_at as "expiresAt"
       from school_staff_invites
       where id = $1
         and token_hash = $2
         and status = 'pending'
         and revoked_at is null
         and accepted_at is null
         and expires_at > $3
       limit 1`,
      [input.inviteId, input.inviteTokenHash, input.now],
    );

    return rows[0] ?? null;
  }

  async acceptInvite(input: {
    inviteId: string;
    userId: string;
    schoolId: string;
    role: SchoolStaffInviteRole;
    acceptedAt: Date;
    invitedByUserId: string | null;
  }): Promise<AcceptedSchoolStaffInvite | null> {
    const membershipRows = await this.client.query<MembershipRow>(
      `with accepted_invite as (
         update school_staff_invites
         set status = 'accepted',
             accepted_by_user_id = $2,
             accepted_at = $6,
             updated_at = $6
         where id = $1
           and school_id = $3
           and role = $4
           and status = 'pending'
           and revoked_at is null
           and accepted_at is null
           and expires_at > $6
         returning id, school_id, role, invited_by_user_id
       ),
       membership as (
         insert into school_staff_memberships (
           school_id,
           user_id,
           role,
           status,
           invited_by_user_id,
           created_at,
           updated_at
         )
         select school_id, $2, role, 'active', invited_by_user_id, $6, $6
         from accepted_invite
         on conflict (school_id, user_id) where removed_at is null do update set
           role = excluded.role,
           status = 'active',
           updated_at = excluded.updated_at
         returning id as "membershipId"
       ),
       role_grant as (
         insert into user_roles (
           user_id,
           role,
           granted_by_user_id,
           grant_source,
           created_at
         )
         select $2, 'school_staff', $5, 'school_staff_invite', $6
         where exists (select 1 from membership)
         on conflict (user_id, role) where revoked_at is null do nothing
         returning id
       )
       select
         membership."membershipId",
         exists(select 1 from role_grant) as "schoolStaffRoleGranted"
       from membership`,
      [input.inviteId, input.userId, input.schoolId, input.role, input.invitedByUserId, input.acceptedAt],
    );
    const membershipId = membershipRows[0]?.membershipId;

    if (!membershipId) {
      return null;
    }

    return {
      inviteId: input.inviteId,
      schoolId: input.schoolId,
      userId: input.userId,
      role: input.role,
      membershipId,
      acceptedAt: input.acceptedAt,
      schoolStaffRoleGranted: membershipRows[0].schoolStaffRoleGranted,
    };
  }

  async revokePendingInvite(input: {
    inviteId: string;
    revokedByUserId: string;
    revokedAt: Date;
  }): Promise<{ revoked: boolean }> {
    const rows = await this.client.query<CreatedInviteRow>(
      `update school_staff_invites
       set status = 'revoked',
           revoked_at = $2,
           updated_at = $2
       where id = $1
         and status = 'pending'
         and accepted_at is null
         and revoked_at is null
       returning id as "inviteId"`,
      [input.inviteId, input.revokedAt],
    );

    return { revoked: rows.length > 0 };
  }
}
