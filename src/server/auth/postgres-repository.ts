import { createHash } from "node:crypto";
import { forbidden } from "../shared/errors.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import { lockLiveCuacStaffAuthority } from "./cuac-staff-authority.ts";
import { classifyPasswordHash } from "./password-hasher.ts";
import { AUTH_STEP_UP_TTL_MS } from "./credentials.ts";
import type { StaffMfaChallengeRecord, StaffMfaFactorRecord, StaffMfaRepository } from "./staff-mfa.ts";
import type {
  AuthCredentialsRepository,
  ActivateSessionStepUpInput,
  AvailableAuthWorkspace,
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
import type { CurrentAccountRecord, CurrentAccountRepository } from "./me.ts";
import type { PublicUiLocale } from "../i18n/locales.ts";

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

export class PostgresAuthSessionRepository implements AuthSessionRepository, SchoolTenantMembershipRepository, AuthCredentialsRepository, StaffMfaRepository, CurrentAccountRepository {
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
         and (
           (s.selected_surface = 'student' and s.active_role = 'student' and s.tenant_school_id is null)
           or (s.selected_surface = 'school' and s.active_role = 'school_staff' and s.tenant_school_id is not null
             and exists (
               select 1
               from school_staff_memberships m
               join schools school on school.id = m.school_id and school.status = 'active'
               where m.user_id = s.user_id
                 and m.school_id = s.tenant_school_id
                 and m.status = 'active'
                 and m.removed_at is null
                 and m.role in ('admissions','counselor','viewer','school_admin')
             ))
           or (s.selected_surface = 'ops' and s.active_role in ('cuac_ops','cuac_admin') and s.tenant_school_id is null
             and exists (
               select 1
               from cuac_staff_access_grants g
               where g.user_id = s.user_id
                 and g.requested_role = s.active_role
                 and g.requested_surface = 'cuac_internal'
                 and g.status = 'approved'
                 and g.approved_by_user_id is not null
                 and g.approved_at is not null
                 and g.expires_at > $2
                 and g.revoked_at is null
             ))
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

  async findCurrentAccountByUserId(userId: string): Promise<CurrentAccountRecord | null> {
    const rows = await this.client.query<CurrentAccountRecord>(
      `select
         email,
         (email_verified_at is not null) as "emailVerified",
         locale
       from users
       where id = $1
         and account_status = 'active'
       limit 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async updateCurrentAccountLocale(input: { userId: string; locale: PublicUiLocale; requestId: string; now: Date }) {
    return this.client.transaction(async tx => {
      const rows = await tx.query<{ locale: PublicUiLocale; changed: boolean }>(`with target as (
        select id,locale from users where id = $1 and account_status = 'active' for update
      ), updated as (
        update users u set locale = $2,updated_at = $3 from target t
        where u.id = t.id and t.locale is distinct from $2 returning u.locale,true as changed
      ) select locale,changed from updated union all
        select locale,false as changed from target where not exists (select 1 from updated) limit 1`,
      [input.userId, input.locale, input.now]);
      const result = rows[0] ?? null;
      if (result?.changed) {
        await tx.query(`insert into audit_logs (request_id,actor_user_id,actor_type,active_role,action,
          resource_type,resource_id,allowed,data_classes,redaction_applied,metadata_json)
          values ($1,$2,'user','student','auth.account_locale.updated','user',$2,true,
          '["account"]'::jsonb,true,$3::jsonb)`,
        [input.requestId, input.userId, JSON.stringify({ locale: input.locale })]);
      }
      return result;
    });
  }

  async listAvailableSessionAuthorities(userId: string, now: Date): Promise<AvailableAuthWorkspace[]> {
    const students = await this.client.query<AvailableAuthWorkspace>(
      `select 'student'::text as "selectedSurface", r.role as "activeRole",
         null::uuid as "tenantSchoolId", 'Student workspace'::text as label
       from user_roles r
       where r.user_id = $1 and r.role = 'student' and r.revoked_at is null
       limit 1`,
      [userId],
    );
    const schools = await this.client.query<AvailableAuthWorkspace>(
      `select 'school'::text as "selectedSurface", r.role as "activeRole",
         m.school_id as "tenantSchoolId",
         case when s.name_zh is null then s.name_en else s.name_en || ' · ' || s.name_zh end as label
       from user_roles r
       join school_staff_memberships m on m.user_id = r.user_id
         and m.status = 'active' and m.removed_at is null
         and m.role in ('admissions','counselor','viewer','school_admin')
       join schools s on s.id = m.school_id and s.status = 'active'
       where r.user_id = $1 and r.role = 'school_staff' and r.revoked_at is null
       order by s.name_en, m.school_id`,
      [userId],
    );
    const internal = await this.client.query<AvailableAuthWorkspace>(
      `select 'ops'::text as "selectedSurface", r.role as "activeRole",
         null::uuid as "tenantSchoolId", 'CUAC staff workspace'::text as label
       from user_roles r
       join cuac_staff_access_grants g on g.user_id = r.user_id and g.requested_role = r.role
         and g.requested_surface = 'cuac_internal' and g.status = 'approved'
         and g.approved_by_user_id is not null and g.approved_at is not null
         and g.expires_at > $2 and g.revoked_at is null
       where r.user_id = $1 and r.role in ('cuac_ops','cuac_admin') and r.revoked_at is null
       order by case when r.role = 'cuac_ops' then 0 else 1 end
       limit 1`,
      [userId, now],
    );
    return [...students, ...schools, ...internal];
  }

  async createStudentAccount(input: CreateStudentAccountInput): Promise<{ userId: string }> {
    const users = await this.client.query<CreatedUserRow>(
      `with created_user as (
         insert into users (email, email_normalized, display_name, account_status, locale, created_at, updated_at)
         values ($1, $2, $3, 'active', $7, $4, $4)
         returning id
       ), created_identity as (
         insert into auth_identities (user_id, provider, provider_subject, password_hash, email_normalized, metadata_json, created_at, updated_at)
         select id, 'password', $2, $5, $2, '{}'::jsonb, $4, $4 from created_user
         returning user_id
       ), created_role as (
         insert into user_roles (user_id, role, grant_source, created_at)
         select user_id, 'student', 'self_registration', $4 from created_identity
         returning user_id
       ), created_age_assurance as (
         insert into student_age_assurances (user_id,age_band,assurance_method,assured_at,created_at)
         select user_id,$6,'self_declaration',$4,$4 from created_role
         returning user_id
       )
       select user_id as "userId" from created_age_assurance`,
      [input.email, input.emailNormalized, input.displayName, input.now, input.passwordHash, input.ageBand, input.locale],
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

  async findMfaFactor(userId: string): Promise<StaffMfaFactorRecord | null> {
    const rows = await this.client.query<StaffMfaFactorRecord>(
      `select id as "factorId",user_id as "userId",status,
         secret_ciphertext as ciphertext,secret_iv as iv,secret_tag as tag,key_id as "keyId",
         last_used_counter as "lastUsedCounter"
       from auth_mfa_factors where user_id = $1 limit 1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  async createMfaLoginChallenge(input: Parameters<StaffMfaRepository["createMfaLoginChallenge"]>[0]): Promise<{ challengeId: string }> {
    const rows = await this.client.query<{ challengeId: string }>(
      `insert into auth_mfa_challenges (
         user_id,challenge_token_hash,purpose,selected_surface,active_role,tenant_school_id,
         password_hash_fingerprint,ip_hash,user_agent_hash,failed_attempts,expires_at,created_at
       ) values ($1,$2,'login',$3,$4,$5,$6,$7,$8,0,$9,$10)
       returning id as "challengeId"`,
      [input.userId, input.challengeTokenHash, input.selectedSurface, input.activeRole, input.tenantSchoolId,
        input.passwordHashFingerprint, input.ipHash, input.userAgentHash, input.expiresAt, input.now],
    );
    if (!rows[0]) throw forbidden("MFA challenge could not be created.");
    return rows[0];
  }

  async findUsableMfaChallengeForUpdate(challengeTokenHash: string, now: Date): Promise<StaffMfaChallengeRecord | null> {
    const rows = await this.client.query<StaffMfaChallengeRecord & { passwordHashFingerprint: string }>(
      `select c.id as "challengeId",c.user_id as "userId",u.email,
         i.password_hash as "passwordHash",c.password_hash_fingerprint as "passwordHashFingerprint",
         c.selected_surface as "selectedSurface",c.active_role as "activeRole",
         c.tenant_school_id as "tenantSchoolId",c.ip_hash as "ipHash",c.user_agent_hash as "userAgentHash",
         c.expires_at as "expiresAt",c.failed_attempts as "failedAttempts"
       from auth_mfa_challenges c
       join users u on u.id = c.user_id and u.account_status = 'active'
       join auth_identities i on i.user_id = u.id and i.provider = 'password'
         and i.email_normalized = u.email_normalized and i.password_hash is not null
       where c.challenge_token_hash = $1 and c.purpose = 'login'
         and c.expires_at > $2 and c.consumed_at is null and c.failed_attempts < 8
       limit 1 for update of c`,
      [challengeTokenHash, now],
    );
    const row = rows[0];
    if (!row || `sha256:${createHash("sha256").update(row.passwordHash).digest("hex")}` !== row.passwordHashFingerprint) return null;
    return {
      challengeId: row.challengeId,
      userId: row.userId,
      email: row.email,
      passwordHash: row.passwordHash,
      selectedSurface: row.selectedSurface,
      activeRole: row.activeRole,
      tenantSchoolId: row.tenantSchoolId,
      ipHash: row.ipHash,
      userAgentHash: row.userAgentHash,
      expiresAt: row.expiresAt,
      failedAttempts: row.failedAttempts,
    };
  }

  async upsertPendingMfaFactor(input: Parameters<StaffMfaRepository["upsertPendingMfaFactor"]>[0]): Promise<StaffMfaFactorRecord> {
    const rows = await this.client.query<StaffMfaFactorRecord>(
      `insert into auth_mfa_factors (
         user_id,factor_type,status,secret_ciphertext,secret_iv,secret_tag,key_id,created_at,updated_at
       ) values ($1,'totp','pending',$2,$3,$4,$5,$6,$6)
       on conflict (user_id) do update set
         secret_ciphertext = excluded.secret_ciphertext,secret_iv = excluded.secret_iv,
         secret_tag = excluded.secret_tag,key_id = excluded.key_id,updated_at = excluded.updated_at
       where auth_mfa_factors.status = 'pending'
       returning id as "factorId",user_id as "userId",status,
         secret_ciphertext as ciphertext,secret_iv as iv,secret_tag as tag,key_id as "keyId",
         last_used_counter as "lastUsedCounter"`,
      [input.userId, input.ciphertext, input.iv, input.tag, input.keyId, input.now],
    );
    if (!rows[0]) throw forbidden("MFA enrollment cannot replace an active factor.");
    return rows[0];
  }

  async activatePendingMfaFactor(input: Parameters<StaffMfaRepository["activatePendingMfaFactor"]>[0]): Promise<boolean> {
    const rows = await this.client.query<{ factorId: string }>(
      `with activated as (
         update auth_mfa_factors set status = 'active',last_used_counter = $3,enrolled_at = $5,updated_at = $5
         where id = $1 and user_id = $2 and status = 'pending' and last_used_counter is null
         returning id
       ), cleared as (
         delete from auth_mfa_recovery_codes where factor_id in (select id from activated)
       ), inserted as (
         insert into auth_mfa_recovery_codes (factor_id,code_hash,created_at)
         select activated.id,code_hash,$5 from activated cross join unnest($4::text[]) as code_hash
         returning factor_id
       )
       select id as "factorId" from activated
       where (select count(*) from inserted) = cardinality($4::text[])`,
      [input.factorId, input.userId, input.counter, input.recoveryCodeHashes, input.now],
    );
    return rows.length === 1;
  }

  async consumeActiveMfaTotp(input: Parameters<StaffMfaRepository["consumeActiveMfaTotp"]>[0]): Promise<boolean> {
    const rows = await this.client.query<{ factorId: string }>(
      `update auth_mfa_factors set last_used_counter = $4,updated_at = $5
       where id = $1 and user_id = $2 and status = 'active'
         and last_used_counter is not distinct from $3::integer and $4 > coalesce(last_used_counter,-1)
       returning id as "factorId"`,
      [input.factorId, input.userId, input.expectedLastUsedCounter, input.counter, input.now],
    );
    return rows.length === 1;
  }

  async consumeMfaRecoveryCode(input: Parameters<StaffMfaRepository["consumeMfaRecoveryCode"]>[0]): Promise<boolean> {
    const rows = await this.client.query<{ codeId: string }>(
      `update auth_mfa_recovery_codes c set consumed_at = $3
       from auth_mfa_factors f
       where c.factor_id = $1 and c.factor_id = f.id and f.status = 'active'
         and c.consumed_at is null and c.code_hash = any($2::text[])
       returning c.id as "codeId"`,
      [input.factorId, input.codeHashes, input.now],
    );
    return rows.length === 1;
  }

  async consumeMfaChallenge(challengeId: string, now: Date): Promise<boolean> {
    const rows = await this.client.query<{ challengeId: string }>(
      `update auth_mfa_challenges set consumed_at = $2 where id = $1
         and consumed_at is null and expires_at > $2 and failed_attempts < 8
       returning id as "challengeId"`,
      [challengeId, now],
    );
    return rows.length === 1;
  }

  async recordMfaChallengeFailure(challengeId: string): Promise<void> {
    await this.client.query(
      `update auth_mfa_challenges set failed_attempts = least(8,failed_attempts + 1)
       where id = $1 and consumed_at is null`,
      [challengeId],
    );
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
