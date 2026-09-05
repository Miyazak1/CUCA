import { createHash } from "node:crypto";
import type { AgentToolDefinition, AgentToolRateLimit } from "./tool-registry.ts";
import { badRequest, tooManyRequests } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";

export type AgentToolRateLimitDecision = {
  allowed: boolean;
  attemptCount: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type AgentToolRateLimitConsumeInput = {
  toolKey: string;
  keyHash: string;
  rule: AgentToolRateLimit;
};

export type AgentToolRateLimitStore = {
  consume(input: AgentToolRateLimitConsumeInput): Promise<AgentToolRateLimitDecision>;
};

export type AgentToolRateLimiter = {
  assertAllowed(context: RequestContext, definition: AgentToolDefinition): Promise<AgentToolRateLimitDecision>;
};

export class AgentToolRateLimitService implements AgentToolRateLimiter {
  private readonly store: AgentToolRateLimitStore;

  constructor(store: AgentToolRateLimitStore) {
    this.store = store;
  }

  async assertAllowed(context: RequestContext, definition: AgentToolDefinition): Promise<AgentToolRateLimitDecision> {
    validateRule(definition.rateLimit);
    const decision = await this.store.consume({
      toolKey: definition.toolKey,
      keyHash: createAgentToolRateLimitKey(context, definition.toolKey),
      rule: definition.rateLimit,
    });
    if (!decision.allowed) {
      throw tooManyRequests("Too many Agent tool calls. Please try again later.", {
        toolKey: definition.toolKey,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
    return decision;
  }
}

export class PostgresAgentToolRateLimitStore implements AgentToolRateLimitStore {
  private readonly client: {
    query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
  };

  constructor(client: {
    query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]): Promise<T[]>;
  }) {
    this.client = client;
  }

  async consume(input: AgentToolRateLimitConsumeInput): Promise<AgentToolRateLimitDecision> {
    validateRule(input.rule);
    const rows = await this.client.query<{
      attemptCount: number;
      expiresAt: Date;
      retryAfterSeconds: number;
    }>(
      `with rate_clock as materialized (
         select clock_timestamp() as now_at
       ), rate_window as materialized (
         select now_at,
           to_timestamp(floor(extract(epoch from now_at) / $3::int) * $3::int) as window_start
         from rate_clock
       ), consumed as (
         insert into agent_tool_rate_limit_buckets (
           tool_key, key_hash, window_start, window_seconds, attempt_count, expires_at, last_attempt_at
         ) select $1, $2, window_start, $3::int, 1,
           window_start + ($3::int * interval '1 second'), now_at
         from rate_window
         on conflict (tool_key, key_hash, window_start) do update set
           attempt_count = least(agent_tool_rate_limit_buckets.attempt_count + 1, 2147483647),
           last_attempt_at = excluded.last_attempt_at,
           expires_at = excluded.expires_at
         returning attempt_count as "attemptCount", expires_at as "expiresAt"
       ) select "attemptCount", "expiresAt",
         greatest(0, ceil(extract(epoch from ("expiresAt" - clock_timestamp()))))::int as "retryAfterSeconds"
       from consumed`,
      [input.toolKey, input.keyHash, input.rule.windowSeconds],
    );
    const bucket = rows[0];
    if (!bucket) throw new Error("Failed to consume Agent tool rate limit bucket.");
    return {
      allowed: bucket.attemptCount <= input.rule.maxCalls,
      attemptCount: bucket.attemptCount,
      remaining: Math.max(0, input.rule.maxCalls - bucket.attemptCount),
      resetAt: bucket.expiresAt,
      retryAfterSeconds: bucket.retryAfterSeconds,
    };
  }
}

export function createAgentToolRateLimitKey(context: RequestContext, toolKey: string): string {
  const owner = context.activeRole === "guest" && !context.actorUserId && context.guestSessionId
    ? `guest:${context.guestSessionId}`
    : context.activeRole === "student" && context.actorUserId
      ? `student:${context.actorUserId}`
      : null;
  if (!owner) throw badRequest("Agent tool rate limit requires a resolved guest or student identity.");
  const material = ["cuac.agent-tool-rate.v1", toolKey, context.activeRole, context.selectedSurface, owner].join("|");
  return `sha256:${createHash("sha256").update(material).digest("hex")}`;
}

function validateRule(rule: AgentToolRateLimit): void {
  if (!Number.isSafeInteger(rule.maxCalls) || rule.maxCalls < 1 || rule.maxCalls > 10_000
    || !Number.isSafeInteger(rule.windowSeconds) || rule.windowSeconds < 1 || rule.windowSeconds > 86_400) {
    throw badRequest("Agent tool rate limit rule is invalid.");
  }
}
