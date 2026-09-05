import { forbidden } from "../shared/errors.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { lockLiveCuacStaffAuthority } from "./cuac-staff-authority.ts";
import { classifyPasswordHash } from "./password-hasher.ts";
import { AUTH_STEP_UP_TTL_MS } from "./credentials.ts";
import type {
  AuthCredentialsRepository,
  ActivateSessionStepUpInput,
  CreatedAuthSession,
  CreateAuthSessionInput,
  CreateStudentAccountInput,
  PasswordIdentityRecord,
  RevokeAuthSessionInput,
  RevokedAuthSessionResult,
  SessionReauthenticationTarget,
} from "./credentials.ts";
import type {
  AuthSessionRecord,
  CuacStaffAccessGrantRecord,
  AuthSessionRepository,
  SchoolTenantMembershipRecord,
  SchoolTenantMembershipRepository,
} from "./session.ts";

export type SqlAuthClient = TransactionalSqlClient;

type AuthSessionRow = {
  userId: string;
  selectedSurface: string;
  activeRole: string;
  tenantSchoolId: string | null;
  authStrength: string;
  expiresAt: Date;
  revokedAt: Date | null;
  accountStatus: string;
};

type PasswordIdentityRow = {
  userId: string;
  emailNormalized: string;
  passwordHash: string | null;
  accountStatus: string;
};

type CreatedUserRow = {
  userId: string;
};

type CreatedSessionRow = {
  sessionId: string;
};

type SessionAuthorityRow = Omit<CreatedAuthSession, "sessionId">;

type ActivatedStepUpRow = CreatedSessionRow & {
  stepUpExpiresAt: Date;
};

type RevokedSessionRow = {
  sessionId: string;
  userId: string;
  activeRole: string;
  tenantSchoolId: string | null;
};

type SessionReauthenticationRow = SessionReauthenticationTarget;

type SchoolTenantMembershipRow = {
  userId: string;
  schoolId: string;
  role: string;
  status: string;
};

type CuacStaffAccessGrantRow = CuacStaffAccessGrantRecord;

async function lockStepUpAuthority(client: TransactionalSqlClient, input: ActivateSessionStepUpInput): Promise<boolean> {
  if (input.selectedSurface === "student" && input.activeRole === "student" && input.tenantSchoolId === null) {
    return (await client.query("select id from user_roles where user_id = $1 and role = 'student' and revoked_at is null for share",
      [input.userId])).length === 1;
  }
  if (input.selectedSurface === "school" && input.activeRole === "school_staff" && input.tenantSchoolId) {
    return (await client.query(`select r.id from user_roles r
      join school_staff_memberships m on m.user_id = r.user_id and m.school_id = $2
        and m.status = 'active' and m.removed_at is null
        and m.role in ('admissions','counselor','viewer','school_admin')
      join schools s on s.id = m.school_id and s.status = 'active'
      where r.user_id = $1 and r.role = 'school_staff' and r.revoked_at is null
      for share of r,m,s`, [input.userId, input.tenantSchoolId])).length === 1;
  }
  if (input.selectedSurface === "ops" && input.tenantSchoolId === null
    && (input.activeRole === "cuac_ops" || input.activeRole === "cuac_admin")) {
    return await lockLiveCuacStaffAuthority(client, {
      actorUserId: input.userId,
      activeRole: input.activeRole,
    }) !== null;
  }
  return false;
}

export class PostgresAuthSessionRepository implements AuthSessionRepository, SchoolTenantMembershipRepository, AuthCredentialsRepository {
  private readonly client: SqlAuthClient;

  constructor(client: SqlAuthClient) {
    this.client = client;
  }

  async findActiveSessionByTokenHash(sessionTokenHash: string, now: Date): Promise<AuthSessionRecord | null> {
    const rows = await this.client.query<AuthSessionRow>(
      `select
         s.user_id as "userId",
         s.selected_surface as "selectedSurface",
         s.active_role as "activeRole",
         s.tenant_school_id as "tenantSchoolId",
         case when s.step_up_expires_at > $2 then 'step_up' else 'session' end as "authStrength",
         s.expires_at as "expiresAt",
         s.revoked_at as "revokedAt",
         u.account_status as "accountStatus"
       from auth_sessions s
       join users u on u.id = s.user_id
       where s.session_token_hash = $1
         and s.expires_at > $2
         and s.revoked_at is null
         and u.account_status = 'active'
         and exists (
           select 1 from user_roles r
           where r.user_id = s.user_id and r.role = s.active_role and r.revoked_at is null
         )
       limit 1`,
      [sessionTokenHash, now],
    );

    return rows[0] ?? null;
  }

  async findActiveCuacStaffAccessGrantByUserAndRole(
    userId: string,
    role: "cuac_ops" | "cuac_admin",
    now: Date,
  ): Promise<CuacStaffAccessGrantRecord | null> {
    const rows = await this.client.query<CuacStaffAccessGrantRow>(
      `select
         g.user_id as "userId",
         g.requested_role as "role",
         g.status,
         g.expires_at as "expiresAt"
       from cuac_staff_access_grants g
       where g.user_id = $1
         and g.requested_role = $2
         and g.requested_surface = 'cuac_internal'
         and g.status = 'approved'
         and g.approved_by_user_id is not null
         and g.approved_at is not null
         and g.expires_at > $3
         and g.revoked_at is null
       order by g.approved_at desc
       limit 1`,
      [userId, role, now],
    );

    return rows[0] ?? null;
  }

  async findPasswordIdentityByEmailNormalized(emailNormalized: string): Promise<PasswordIdentityRecord | null> {
    const rows = await this.client.query<PasswordIdentityRow>(
      `select
         i.user_id as "userId",
         i.email_normalized as "emailNormalized",
         i.password_hash as "passwordHash",
         u.account_status as "accountStatus"
       from auth_identities i
       join users u on u.id = i.user_id
       where i.provider = 'password'
         and i.email_normalized = $1
       limit 1`,
      [emailNormalized],
    );

    return rows[0] ?? null;
  }

  async createStudentAccount(input: CreateStudentAccountInput): Promise<{ userId: string }> {
    const users = await this.client.query<CreatedUserRow>(
      `with created_user as (
         insert into users (email, email_normalized, display_name, account_status, created_at, updated_at)
         values ($1, $2, $3, 'active', $4, $4)
         returning id
       ), created_identity as (
         insert into auth_identities (user_id, provider, provider_subject, password_hash, email_normalized, metadata_json, created_at, updated_at)
         select id, 'password', $2, $5, $2, '{}'::jsonb, $4, $4 from created_user
         returning user_id
       ), created_role as (
         insert into user_roles (user_id, role, grant_source, created_at)
         select user_id, 'student', 'self_registration', $4 from created_identity
         returning user_id
       )
       select user_id as "userId" from created_role`,
      [input.email, input.emailNormalized, input.displayName, input.now, input.passwordHash],
    );
    const userId = users[0]?.userId;

    if (!userId) {
      throw new Error("Failed to create user.");
    }

    return { userId };
  }

  async createSession(input: CreateAuthSessionInput): Promise<CreatedAuthSession> {
    if (input.upgradedPasswordHash !== undefined
      && (classifyPasswordHash(input.expectedPasswordHash) !== "scrypt_v1" || classifyPasswordHash(input.upgradedPasswordHash) !== "scrypt_v2")) {
      throw forbidden("Account is not available for this session.");
    }
    return this.client.transaction(async (client) => {
      // Read the password proof after acquiring the reset lock, in a new statement snapshot.
      await client.query(`select id from users where id = $1 for update`, [input.userId]);
      const authority = await resolveSessionAuthority(client, input);
      if (!authority) throw forbidden("Selected access context is not available.");
      const rows = await client.query<CreatedSessionRow>(
        `insert into auth_sessions (
           user_id,
           session_token_hash,
           selected_surface,
           active_role,
           tenant_school_id,
           auth_strength,
           ip_hash,
           user_agent_hash,
           created_at,
           last_seen_at,
           expires_at
         )
         select u.id, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10
         from users u
         where u.id = $1 and u.account_status = 'active'
           and exists (
             select 1 from auth_identities i where i.user_id = u.id
               and i.provider = 'password' and i.email_normalized = u.email_normalized
               and i.password_hash = $11
           )
         returning id as "sessionId"`,
        [
          input.userId,
          input.sessionTokenHash,
          authority.selectedSurface,
          authority.activeRole,
          authority.tenantSchoolId,
          input.authStrength,
          input.ipHash,
          input.userAgentHash,
          input.now,
          input.expiresAt,
          input.expectedPasswordHash,
        ],
      );

      const sessionId = rows[0]?.sessionId;

      if (!sessionId) {
        throw forbidden("Account is not available for this session.");
      }

      if (input.upgradedPasswordHash !== undefined) {
        const upgraded = await client.query<{ userId: string }>(
          `update auth_identities
           set password_hash = $3, updated_at = $4
           where user_id = $1 and provider = 'password' and password_hash = $2
           returning user_id as "userId"`,
          [input.userId, input.expectedPasswordHash, input.upgradedPasswordHash, input.now],
        );
        if (upgraded.length !== 1 || upgraded[0]?.userId !== input.userId) {
          throw forbidden("Account is not available for this session.");
        }
      }

      return { sessionId, ...authority };
    });
  }

  async revokeSessionByTokenHash(input: RevokeAuthSessionInput): Promise<RevokedAuthSessionResult> {
    const rows = await this.client.query<RevokedSessionRow>(
      `update auth_sessions
       set revoked_at = $2
       where session_token_hash = $1
         and revoked_at is null
       returning id as "sessionId", user_id as "userId", active_role as "activeRole", tenant_school_id as "tenantSchoolId"`,
      [input.sessionTokenHash, input.now],
    );

    return rows[0] ? { revoked: true, ...rows[0] } : { revoked: false };
  }

  async findSessionReauthenticationTarget(sessionTokenHash: string): Promise<SessionReauthenticationTarget | null> {
    const rows = await this.client.query<SessionReauthenticationRow>(
      `select s.id as "sessionId",s.user_id as "userId",i.password_hash as "passwordHash",
         s.expires_at as "expiresAt",s.selected_surface as "selectedSurface",
         s.active_role as "activeRole",s.tenant_school_id as "tenantSchoolId"
       from auth_sessions s
       join users u on u.id = s.user_id and u.account_status = 'active'
       join auth_identities i on i.user_id = s.user_id and i.provider = 'password'
         and i.email_normalized = u.email_normalized and i.password_hash is not null
       where s.session_token_hash = $1 and s.expires_at > clock_timestamp() and s.revoked_at is null
         and ((s.selected_surface = 'student' and s.active_role = 'student' and s.tenant_school_id is null)
           or (s.selected_surface = 'school' and s.active_role = 'school_staff' and s.tenant_school_id is not null)
           or (s.selected_surface = 'ops' and s.active_role in ('cuac_ops','cuac_admin') and s.tenant_school_id is null))
       limit 1`,
      [sessionTokenHash],
    );
    return rows[0] ?? null;
  }

  async activateSessionStepUp(input: ActivateSessionStepUpInput): Promise<{ sessionId: string; stepUpExpiresAt: Date }> {
    if (input.stepUpTtlMs !== AUTH_STEP_UP_TTL_MS) throw forbidden("Session or password is invalid.");
    return this.client.transaction(async client => {
      const users = await client.query("select id from users where id = $1 and account_status = 'active' for update", [input.userId]);
      if (users.length !== 1 || !await lockStepUpAuthority(client, input)) throw forbidden("Session or password is invalid.");
      const rows = await client.query<ActivatedStepUpRow>(
        `with authority as (select date_trunc('milliseconds', clock_timestamp()) as now)
         update auth_sessions s
         set step_up_expires_at = least(s.expires_at, authority.now + ($4 * interval '1 millisecond')),
           last_seen_at = authority.now
         from authority
         where s.id = $1 and s.user_id = $2 and s.session_token_hash = $3
           and s.expires_at > authority.now and s.revoked_at is null and s.auth_strength = 'session'
           and s.selected_surface = $6 and s.active_role = $7
           and s.tenant_school_id is not distinct from $8::uuid
           and exists (select 1 from auth_identities i where i.user_id = s.user_id
             and i.provider = 'password' and i.password_hash = $5)
         returning s.id as "sessionId",s.step_up_expires_at as "stepUpExpiresAt"`,
        [input.sessionId, input.userId, input.sessionTokenHash, input.stepUpTtlMs, input.passwordHash,
          input.selectedSurface, input.activeRole, input.tenantSchoolId],
      );
      if (rows.length !== 1) throw forbidden("Session or password is invalid.");
      return rows[0];
    });
  }

  async findActiveSchoolMembershipByUserAndSchoolId(
    userId: string,
    schoolId: string,
    now: Date,
  ): Promise<SchoolTenantMembershipRecord | null> {
    void now;

    const rows = await this.client.query<SchoolTenantMembershipRow>(
      `select
         m.user_id as "userId",
         m.school_id as "schoolId",
         m.role as "role",
         m.status as "status"
       from school_staff_memberships m
       join schools s on s.id = m.school_id and s.status = 'active'
       where m.user_id = $1
         and m.school_id = $2
         and m.status = 'active'
         and m.removed_at is null
       limit 1`,
      [userId, schoolId],
    );

    return rows[0] ?? null;
  }
}

async function resolveSessionAuthority(
  client: TransactionalSqlClient,
  input: CreateAuthSessionInput,
): Promise<SessionAuthorityRow | null> {
  if (input.requestedSurface === "student") {
    const rows = await client.query<SessionAuthorityRow>(
      `select 'student'::text as "selectedSurface", r.role as "activeRole", null::uuid as "tenantSchoolId"
       from user_roles r
       where r.user_id = $1 and r.role = 'student' and r.revoked_at is null
       limit 1
       for share of r`,
      [input.userId],
    );
    return rows[0] ?? null;
  }

  if (input.requestedSurface === "school_staff") {
    const rows = await client.query<SessionAuthorityRow>(
      `select 'school'::text as "selectedSurface", r.role as "activeRole", m.school_id as "tenantSchoolId"
       from user_roles r
       join school_staff_memberships m on m.user_id = r.user_id
         and m.school_id = $2 and m.status = 'active' and m.removed_at is null
         and m.role in ('admissions','counselor','viewer','school_admin')
       join schools s on s.id = m.school_id and s.status = 'active'
       where r.user_id = $1 and r.role = 'school_staff' and r.revoked_at is null
       limit 1
       for share of r,m,s`,
      [input.userId, input.requestedSchoolId],
    );
    return rows[0] ?? null;
  }

  const rows = await client.query<SessionAuthorityRow>(
    `select 'ops'::text as "selectedSurface", r.role as "activeRole", null::uuid as "tenantSchoolId"
     from user_roles r
     join cuac_staff_access_grants g on g.user_id = r.user_id and g.requested_role = r.role
       and g.requested_surface = 'cuac_internal' and g.status = 'approved'
       and g.approved_by_user_id is not null and g.approved_at is not null
       and g.expires_at > clock_timestamp() and g.revoked_at is null
     where r.user_id = $1 and r.role in ('cuac_ops','cuac_admin') and r.revoked_at is null
     order by case when r.role = 'cuac_ops' then 0 else 1 end
     limit 1
     for share of r,g`,
    [input.userId],
  );
  return rows[0] ?? null;
}
