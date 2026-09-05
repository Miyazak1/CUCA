import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type {
  CreateEmailVerificationChallengeInput,
  EmailVerificationChallengeRecord,
  EmailVerificationRepository,
  EmailVerificationTarget,
} from "./email-verification.ts";

export type SqlEmailVerificationClient = TransactionalSqlClient;

type EmailVerificationTargetRow = {
  userId: string;
  emailNormalized: string;
  emailVerifiedAt: Date | null;
  accountStatus: string;
};

type CreatedEmailVerificationChallengeRow = {
  challengeId: string;
};

type EmailVerificationChallengeRow = {
  id: string;
  userId: string;
  emailNormalized: string;
  status: EmailVerificationChallengeRecord["status"];
  expiresAt: Date;
  verifiedAt: Date | null;
};

type VerifiedEmailRow = {
  userId: string;
};

export class PostgresEmailVerificationRepository implements EmailVerificationRepository {
  private readonly client: SqlEmailVerificationClient;

  constructor(client: SqlEmailVerificationClient) {
    this.client = client;
  }

  async findVerificationTargetByUserId(userId: string): Promise<EmailVerificationTarget | null> {
    const rows = await this.client.query<EmailVerificationTargetRow>(
      `select
         id as "userId",
         email_normalized as "emailNormalized",
         email_verified_at as "emailVerifiedAt",
         account_status as "accountStatus"
       from users
       where id = $1
       limit 1`,
      [userId],
    );

    return rows[0] ?? null;
  }

  async createEmailVerificationChallenge(
    input: CreateEmailVerificationChallengeInput,
  ): Promise<{ challengeId: string } | null> {
    return this.client.transaction(async client => {
      await client.query("select id from users where id = $1 for update", [input.userId]);
      const rows = await client.query<CreatedEmailVerificationChallengeRow>(
        `insert into email_verification_challenges (
           user_id,
           email_normalized,
           verification_token_hash,
           status,
           requested_at,
           expires_at,
           metadata_json
         )
         select $1, $2, $3, 'pending', $4, $5, '{}'::jsonb from users
         where id = $1 and account_status = 'active' and email_normalized = $2 and email_verified_at is null
           and $5::timestamptz > greatest($4::timestamptz, clock_timestamp())
         returning id as "challengeId"`,
        [input.userId, input.emailNormalized, input.verificationTokenHash, input.now, input.expiresAt],
      );

      const challengeId = rows[0]?.challengeId;

      return challengeId ? { challengeId } : null;
    });
  }

  async findActiveEmailVerificationChallenge(input: {
    challengeId: string;
    verificationTokenHash: string;
    now: Date;
  }): Promise<EmailVerificationChallengeRecord | null> {
    const rows = await this.client.query<EmailVerificationChallengeRow>(
      `select
         id,
         user_id as "userId",
         email_normalized as "emailNormalized",
         status,
         expires_at as "expiresAt",
         verified_at as "verifiedAt"
       from email_verification_challenges
       where id = $1
         and verification_token_hash = $2
         and status = 'pending'
         and expires_at > $3
       limit 1`,
      [input.challengeId, input.verificationTokenHash, input.now],
    );

    return rows[0] ?? null;
  }

  async markEmailVerified(input: { challengeId: string; userId: string; verificationTokenHash: string; now: Date }): Promise<{ verified: boolean }> {
    return this.client.transaction(async (client) => {
      await client.query(`select id from users where id = $1 for update`, [input.userId]);
      const challenges = await client.query<VerifiedEmailRow>(
        `update email_verification_challenges c
         set status = 'verified', verified_at = $3
         from users u
         where c.id = $1 and c.user_id = $2 and u.id = c.user_id
           and c.verification_token_hash = $4 and c.status = 'pending' and c.verified_at is null
           and c.expires_at > greatest($3::timestamptz, clock_timestamp())
           and u.account_status = 'active' and u.email_normalized = c.email_normalized
           and u.email_verified_at is null
         returning c.user_id as "userId"`,
        [input.challengeId, input.userId, input.now, input.verificationTokenHash],
      );
      if (!challenges[0]) return { verified: false };

      const users = await client.query<VerifiedEmailRow>(
        `update users set email_verified_at = $2, updated_at = $2
         where id = $1 and email_verified_at is null returning id as "userId"`,
        [input.userId, input.now],
      );
      if (users.length !== 1) throw new Error("Verification target changed during verification.");
      await client.query(
        `update email_verification_challenges set status = 'revoked'
         where user_id = $1 and status = 'pending'`,
        [input.userId],
      );
      return { verified: true };
    });
  }
}
