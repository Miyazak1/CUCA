import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type {
  CreatePasswordResetChallengeInput,
  PasswordResetChallengeRecord,
  PasswordResetRepository,
  PasswordResetTarget,
} from "./password-reset.ts";

export type SqlPasswordResetClient = TransactionalSqlClient;

type PasswordResetTargetRow = {
  userId: string;
  emailNormalized: string;
  accountStatus: string;
  hasPasswordIdentity: boolean;
};

type CreatedPasswordResetChallengeRow = {
  challengeId: string;
};

type PasswordResetChallengeRow = {
  id: string;
  userId: string;
  emailNormalized: string;
  status: PasswordResetChallengeRecord["status"];
  expiresAt: Date;
  consumedAt: Date | null;
};

type UpdatedRow = {
  id: string;
};

export class PostgresPasswordResetRepository implements PasswordResetRepository {
  private readonly client: SqlPasswordResetClient;

  constructor(client: SqlPasswordResetClient) {
    this.client = client;
  }

  async findPasswordResetTargetByEmailNormalized(emailNormalized: string): Promise<PasswordResetTarget | null> {
    const rows = await this.client.query<PasswordResetTargetRow>(
      `select
         u.id as "userId",
         u.email_normalized as "emailNormalized",
         u.account_status as "accountStatus",
         (i.id is not null and i.password_hash is not null) as "hasPasswordIdentity"
       from users u
       left join auth_identities i
         on i.user_id = u.id
        and i.provider = 'password'
        and i.email_normalized = u.email_normalized
       where u.email_normalized = $1
       limit 1`,
      [emailNormalized],
    );

    return rows[0] ?? null;
  }

  async createPasswordResetChallenge(input: CreatePasswordResetChallengeInput): Promise<{ challengeId: string } | null> {
    return this.client.transaction(async client => {
      await client.query("select id from users where id = $1 for update", [input.userId]);
      const rows = await client.query<CreatedPasswordResetChallengeRow>(
        `insert into password_reset_challenges (
           user_id,
           email_normalized,
           reset_token_hash,
           status,
           requested_at,
           expires_at,
           metadata_json
         )
         select $1, $2, $3, 'pending', $4, $5, '{}'::jsonb from users u
         where u.id = $1 and u.account_status = 'active' and u.email_normalized = $2
           and $5::timestamptz > greatest($4::timestamptz, clock_timestamp())
           and exists (select 1 from auth_identities i where i.user_id = u.id and i.provider = 'password'
             and i.email_normalized = u.email_normalized and i.password_hash is not null)
         returning id as "challengeId"`,
        [input.userId, input.emailNormalized, input.resetTokenHash, input.now, input.expiresAt],
      );

      const challengeId = rows[0]?.challengeId;

      return challengeId ? { challengeId } : null;
    });
  }

  async findActivePasswordResetChallenge(input: {
    challengeId: string;
    resetTokenHash: string;
    now: Date;
  }): Promise<PasswordResetChallengeRecord | null> {
    const rows = await this.client.query<PasswordResetChallengeRow>(
      `select
         id,
         user_id as "userId",
         email_normalized as "emailNormalized",
         status,
         expires_at as "expiresAt",
         consumed_at as "consumedAt"
       from password_reset_challenges
       where id = $1
         and reset_token_hash = $2
         and status = 'pending'
         and expires_at > $3
       limit 1`,
      [input.challengeId, input.resetTokenHash, input.now],
    );

    return rows[0] ?? null;
  }

  async consumePasswordReset(input: {
    challengeId: string;
    userId: string;
    resetTokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<{ reset: boolean; revokedSessionCount: number }> {
    return this.client.transaction(async (client) => {
      // Login and credential mutations serialize on the same user, then read fresh state.
      await client.query(`select id from users where id = $1 for update`, [input.userId]);
      const challenges = await client.query<UpdatedRow>(
        `update password_reset_challenges c
         set status = 'consumed', consumed_at = $3
         from users u
         where c.id = $1 and c.user_id = $2 and u.id = c.user_id
           and c.reset_token_hash = $4 and c.status = 'pending' and c.consumed_at is null
           and c.expires_at > greatest($3::timestamptz, clock_timestamp())
           and u.account_status = 'active' and u.email_normalized = c.email_normalized
           and exists (
             select 1 from auth_identities i where i.user_id = u.id
               and i.provider = 'password' and i.email_normalized = u.email_normalized
               and i.password_hash is not null
           )
         returning c.id`,
        [input.challengeId, input.userId, input.now, input.resetTokenHash],
      );
      if (!challenges[0]) return { reset: false, revokedSessionCount: 0 };

      const identities = await client.query<UpdatedRow>(
        `update auth_identities
         set password_hash = $2, updated_at = $3
         where user_id = $1 and provider = 'password'
           and email_normalized = (select email_normalized from users where id = $1)
         returning id`,
        [input.userId, input.passwordHash, input.now],
      );
      if (identities.length !== 1) throw new Error("Password identity changed during reset.");

      const sessions = await client.query<UpdatedRow>(
        `update auth_sessions set revoked_at = $2
         where user_id = $1 and revoked_at is null returning id`,
        [input.userId, input.now],
      );
      await client.query(
        `update password_reset_challenges set status = 'revoked'
         where user_id = $1 and status = 'pending'`,
        [input.userId],
      );
      return { reset: true, revokedSessionCount: sessions.length };
    });
  }
}
