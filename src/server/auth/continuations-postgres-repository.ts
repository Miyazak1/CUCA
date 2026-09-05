import type {
  CreateSignInContinuationRepositoryInput,
  SignInContinuationRecord,
  SignInContinuationRepository,
} from "./continuations.ts";

export type SqlSignInContinuationClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

type CreatedContinuationRow = {
  continuationId: string;
};

type SignInContinuationRow = {
  id: string;
  guestSessionId: string | null;
  targetRoute: string;
  actionKey: string;
  requiredRole: SignInContinuationRecord["requiredRole"];
  tenantSchoolId: string | null;
  payloadPreviewJson: Record<string, unknown>;
  expiresAt: Date;
  consumedAt: Date | null;
};

type ConsumedContinuationRow = {
  continuationId: string;
};

export class PostgresSignInContinuationRepository implements SignInContinuationRepository {
  private readonly client: SqlSignInContinuationClient;

  constructor(client: SqlSignInContinuationClient) {
    this.client = client;
  }

  async createContinuation(input: CreateSignInContinuationRepositoryInput): Promise<{ continuationId: string }> {
    const rows = await this.client.query<CreatedContinuationRow>(
      `insert into sign_in_continuations (
         continuation_token_hash,
         guest_session_id,
         target_route,
         action_key,
         required_role,
         tenant_school_id,
         payload_preview_json,
         device_fingerprint_hash,
         created_at,
         expires_at
       )
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
       returning id as "continuationId"`,
      [
        input.continuationTokenHash,
        input.guestSessionId,
        input.targetRoute,
        input.actionKey,
        input.requiredRole,
        input.tenantSchoolId,
        JSON.stringify(input.payloadPreview),
        input.deviceFingerprintHash,
        input.now,
        input.expiresAt,
      ],
    );

    const continuationId = rows[0]?.continuationId;

    if (!continuationId) {
      throw new Error("Failed to create sign-in continuation.");
    }

    return { continuationId };
  }

  async findActiveContinuation(input: {
    continuationId: string;
    continuationTokenHash: string;
    now: Date;
  }): Promise<SignInContinuationRecord | null> {
    const rows = await this.client.query<SignInContinuationRow>(
      `select
         id,
         guest_session_id as "guestSessionId",
         target_route as "targetRoute",
         action_key as "actionKey",
         required_role as "requiredRole",
         tenant_school_id as "tenantSchoolId",
         payload_preview_json as "payloadPreviewJson",
         expires_at as "expiresAt",
         consumed_at as "consumedAt"
       from sign_in_continuations
       where id = $1
         and continuation_token_hash = $2
         and expires_at > $3
         and consumed_at is null
       limit 1`,
      [input.continuationId, input.continuationTokenHash, input.now],
    );

    return rows[0] ? toRecord(rows[0]) : null;
  }

  async markContinuationConsumed(input: {
    continuationId: string;
    consumedByUserId: string;
    continuationTokenHash: string;
    guestSessionId: string;
    requiredRole: Exclude<SignInContinuationRecord["requiredRole"], null>;
    activeRole: Exclude<SignInContinuationRecord["requiredRole"], null>;
    now: Date;
  }): Promise<{ consumed: boolean }> {
    const rows = await this.client.query<ConsumedContinuationRow>(
      `update sign_in_continuations
       set consumed_at = $2,
           consumed_by_user_id = $3
       where id = $1
         and consumed_at is null
         and continuation_token_hash = $4 and guest_session_id = $5
         and guest_session_id is not null and tenant_school_id is null
         and required_role = $6
         and expires_at > greatest($2::timestamptz, clock_timestamp())
         and exists (
           select 1 from users u join user_roles r on r.user_id = u.id
           where u.id = $3 and u.account_status = 'active'
             and r.role = $7 and r.revoked_at is null
         )
       returning id as "continuationId"`,
      [input.continuationId, input.now, input.consumedByUserId, input.continuationTokenHash, input.guestSessionId, input.requiredRole, input.activeRole],
    );

    return { consumed: rows.length > 0 };
  }
}

function toRecord(row: SignInContinuationRow): SignInContinuationRecord {
  return {
    id: row.id,
    guestSessionId: row.guestSessionId,
    targetRoute: row.targetRoute,
    actionKey: row.actionKey,
    requiredRole: row.requiredRole,
    tenantSchoolId: row.tenantSchoolId,
    payloadPreview: row.payloadPreviewJson,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
  };
}
