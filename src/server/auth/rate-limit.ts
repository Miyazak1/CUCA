import { createHash } from "node:crypto";

import { badRequest, tooManyRequests } from "../shared/errors.ts";

export const AUTH_RATE_LIMIT_ACTIONS = [
  "auth.register",
  "auth.login",
  "auth.logout",
  "auth.step_up",
  "auth.email_verification.request",
  "auth.email_verification.verify",
  "auth.password_reset.request",
  "auth.password_reset.consume",
  "auth.school_staff_invite.create",
  "auth.school_staff_invite.accept",
  "auth.school_staff_invite.revoke",
  "auth.sign_in_continuation.create",
  "auth.sign_in_continuation.consume",
] as const;

export type AuthRateLimitAction = (typeof AUTH_RATE_LIMIT_ACTIONS)[number];

export type AuthRateLimitRule = {
  maxAttempts: number;
  windowSeconds: number;
};

export type AuthRateLimitSubject = {
  email?: string | null;
  ipHash?: string | null;
  guestSessionId?: string | null;
  actorUserId?: string | null;
  sessionTokenHash?: string | null;
  route?: string | null;
};

export type AuthRateLimitDecision = {
  allowed: boolean;
  action: AuthRateLimitAction;
  keyHash: string;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
  enforcement?: "application" | "upstream";
};

export type AuthRateLimitConsumeInput = {
  action: AuthRateLimitAction;
  keyHash: string;
  rule: AuthRateLimitRule;
  now: Date;
};

export interface AuthRateLimitStore {
  consume(input: AuthRateLimitConsumeInput): Promise<AuthRateLimitDecision>;
}

export interface AuthRateLimiter {
  assertAllowed(input: { action: AuthRateLimitAction; subject: AuthRateLimitSubject; now?: Date }): Promise<AuthRateLimitDecision>;
}

export const DEFAULT_AUTH_RATE_LIMIT_RULES: Record<AuthRateLimitAction, AuthRateLimitRule> = {
  "auth.register": { maxAttempts: 5, windowSeconds: 600 },
  "auth.login": { maxAttempts: 10, windowSeconds: 300 },
  "auth.logout": { maxAttempts: 30, windowSeconds: 300 },
  "auth.step_up": { maxAttempts: 5, windowSeconds: 900 },
  "auth.email_verification.request": { maxAttempts: 5, windowSeconds: 900 },
  "auth.email_verification.verify": { maxAttempts: 10, windowSeconds: 900 },
  "auth.password_reset.request": { maxAttempts: 5, windowSeconds: 900 },
  "auth.password_reset.consume": { maxAttempts: 10, windowSeconds: 900 },
  "auth.school_staff_invite.create": { maxAttempts: 20, windowSeconds: 900 },
  "auth.school_staff_invite.accept": { maxAttempts: 10, windowSeconds: 900 },
  "auth.school_staff_invite.revoke": { maxAttempts: 30, windowSeconds: 900 },
  "auth.sign_in_continuation.create": { maxAttempts: 20, windowSeconds: 600 },
  "auth.sign_in_continuation.consume": { maxAttempts: 20, windowSeconds: 600 },
};

export class AuthRateLimitService {
  private readonly rules: Record<AuthRateLimitAction, AuthRateLimitRule>;
  private readonly store: AuthRateLimitStore;

  constructor(input: { store: AuthRateLimitStore; rules?: Partial<Record<AuthRateLimitAction, AuthRateLimitRule>> }) {
    this.store = input.store;
    this.rules = { ...DEFAULT_AUTH_RATE_LIMIT_RULES, ...input.rules };
  }

  async consume(input: { action: AuthRateLimitAction; subject: AuthRateLimitSubject; now?: Date }): Promise<AuthRateLimitDecision> {
    const now = input.now ?? new Date();
    const keyHash = createAuthRateLimitKey({ action: input.action, subject: input.subject });
    return this.store.consume({
      action: input.action,
      keyHash,
      rule: this.rules[input.action],
      now,
    });
  }

  async assertAllowed(input: { action: AuthRateLimitAction; subject: AuthRateLimitSubject; now?: Date }): Promise<AuthRateLimitDecision> {
    const decision = await this.consume(input);

    if (!decision.allowed) {
      throw tooManyRequests("Too many authentication attempts. Please try again later.", {
        action: decision.action,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }

    return decision;
  }
}

export class InMemoryAuthRateLimitStore implements AuthRateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: Date }>();

  async consume(input: AuthRateLimitConsumeInput): Promise<AuthRateLimitDecision> {
    const current = this.buckets.get(input.keyHash);
    const bucket = !current || current.resetAt.getTime() <= input.now.getTime() ? this.createBucket(input) : current;
    const allowed = bucket.count < input.rule.maxAttempts;

    if (allowed) {
      bucket.count += 1;
    }

    this.buckets.set(input.keyHash, bucket);

    return {
      allowed,
      action: input.action,
      keyHash: input.keyHash,
      remaining: Math.max(0, input.rule.maxAttempts - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(0, Math.ceil((bucket.resetAt.getTime() - input.now.getTime()) / 1000)),
      enforcement: "application",
    };
  }

  private createBucket(input: AuthRateLimitConsumeInput): { count: number; resetAt: Date } {
    return {
      count: 0,
      resetAt: new Date(input.now.getTime() + input.rule.windowSeconds * 1000),
    };
  }
}

export type SqlAuthRateLimitClient = {
  query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
};

type AuthRateLimitBucketRow = {
  attemptCount: number;
  expiresAt: Date;
};

export class PostgresAuthRateLimitStore implements AuthRateLimitStore {
  private readonly client: SqlAuthRateLimitClient;

  constructor(client: SqlAuthRateLimitClient) {
    this.client = client;
  }

  async consume(input: AuthRateLimitConsumeInput): Promise<AuthRateLimitDecision> {
    const windowStart = floorToWindow(input.now, input.rule.windowSeconds);
    const expiresAt = new Date(windowStart.getTime() + input.rule.windowSeconds * 1000);
    const rows = await this.client.query<AuthRateLimitBucketRow>(
      `insert into auth_rate_limit_buckets (
         action,
         key_hash,
         window_start,
         window_seconds,
         attempt_count,
         expires_at,
         last_attempt_at,
         metadata_json
       )
       values ($1, $2, $3, $4, 1, $5, $6, '{}'::jsonb)
       on conflict (action, key_hash, window_start) do update set
         attempt_count = auth_rate_limit_buckets.attempt_count + 1,
         last_attempt_at = $6,
         expires_at = $5
       returning
         attempt_count as "attemptCount",
         expires_at as "expiresAt"` ,
      [input.action, input.keyHash, windowStart, input.rule.windowSeconds, expiresAt, input.now],
    );
    const bucket = rows[0];

    if (!bucket) {
      throw new Error("Failed to consume Auth rate limit bucket.");
    }

    const allowed = bucket.attemptCount <= input.rule.maxAttempts;

    return {
      allowed,
      action: input.action,
      keyHash: input.keyHash,
      remaining: Math.max(0, input.rule.maxAttempts - bucket.attemptCount),
      resetAt: bucket.expiresAt,
      retryAfterSeconds: Math.max(0, Math.ceil((bucket.expiresAt.getTime() - input.now.getTime()) / 1000)),
      enforcement: "application",
    };
  }
}

export function createAuthRateLimitKey(input: { action: AuthRateLimitAction; subject: AuthRateLimitSubject }): string {
  const subjectParts = [
    ["email", normalizeEmail(input.subject.email)],
    ["ip", normalizeValue(input.subject.ipHash)],
    ["guest", normalizeValue(input.subject.guestSessionId)],
    ["actor", normalizeValue(input.subject.actorUserId)],
    ["session", normalizeValue(input.subject.sessionTokenHash)],
    ["route", normalizeValue(input.subject.route)],
  ].filter((part): part is [string, string] => Boolean(part[1]));

  if (subjectParts.length === 0) {
    throw badRequest("Auth rate limit requires at least one stable subject identifier.");
  }

  const material = [input.action, ...subjectParts.map(([key, value]) => `${key}:${value}`)].join("|");
  return `sha256:${createHash("sha256").update(material).digest("hex")}`;
}

export function hashAuthRateLimitSubjectValue(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = normalizeValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeValue(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function floorToWindow(now: Date, windowSeconds: number): Date {
  return new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
}
