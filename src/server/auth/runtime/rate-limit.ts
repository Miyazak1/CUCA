import { serviceUnavailable } from "../../shared/errors.ts";
import {
  AuthRateLimitService,
  createAuthRateLimitKey,
  DEFAULT_AUTH_RATE_LIMIT_RULES,
  InMemoryAuthRateLimitStore,
  PostgresAuthRateLimitStore,
  type AuthRateLimiter,
  type AuthRateLimitAction,
  type AuthRateLimitDecision,
  type AuthRateLimitSubject,
  type SqlAuthRateLimitClient,
} from "../rate-limit.ts";

export type AuthRateLimitRuntimeBackend = "gateway" | "waf" | "postgres" | "memory" | "redis" | "disabled" | "unknown";

export function createAuthRateLimiterFromEnv(input: {
  env?: Record<string, string | undefined>;
  client?: SqlAuthRateLimitClient;
} = {}): AuthRateLimiter | undefined {
  const env = input.env ?? process.env;
  const environment = resolveEnvironment(env);
  const strict = environment === "staging" || environment === "production";
  const enforced = normalize(env.CUAC_AUTH_RATE_LIMIT_ENFORCED) === "true";
  const backend = resolveBackend(env.CUAC_AUTH_RATE_LIMIT_BACKEND);

  if (!enforced) {
    if (strict) {
      throw serviceUnavailable("Auth rate limiting must be enforced in staging/production.");
    }

    return undefined;
  }

  switch (backend) {
    case "gateway":
    case "waf":
      return new UpstreamAuthRateLimiter(backend);
    case "postgres":
      if (strict) {
        throw serviceUnavailable("PostgreSQL Auth rate limiting is not accepted as the staging/production shared limiter.");
      }
      if (!input.client) {
        throw serviceUnavailable("PostgreSQL Auth rate limiter client is not configured.");
      }
      return new AuthRateLimitService({ store: new PostgresAuthRateLimitStore(input.client) });
    case "memory":
      if (strict) {
        throw serviceUnavailable("In-memory Auth rate limiting must not be used in staging/production.");
      }
      return new AuthRateLimitService({ store: new InMemoryAuthRateLimitStore() });
    case "redis":
      throw serviceUnavailable("Redis Auth rate limiter adapter is not implemented yet. Use gateway or WAF enforcement for now.");
    case "disabled":
    case "unknown":
    default:
      if (strict) {
        throw serviceUnavailable("Auth rate limit backend must be gateway or WAF for staging/production until Redis support is implemented.");
      }
      return undefined;
  }
}

class UpstreamAuthRateLimiter implements AuthRateLimiter {
  private readonly backend: "gateway" | "waf";

  constructor(backend: "gateway" | "waf") {
    this.backend = backend;
  }

  async assertAllowed(input: {
    action: AuthRateLimitAction;
    subject: AuthRateLimitSubject;
    now?: Date;
  }): Promise<AuthRateLimitDecision> {
    const now = input.now ?? new Date();
    const rule = DEFAULT_AUTH_RATE_LIMIT_RULES[input.action];

    return {
      allowed: true,
      action: input.action,
      keyHash: createAuthRateLimitKey({ action: input.action, subject: input.subject }),
      remaining: rule.maxAttempts,
      resetAt: new Date(now.getTime() + rule.windowSeconds * 1000),
      retryAfterSeconds: 0,
      enforcement: "upstream",
    };
  }
}

function resolveBackend(value: string | undefined): AuthRateLimitRuntimeBackend {
  const normalized = normalize(value);

  if (["gateway", "waf", "postgres", "memory", "redis", "disabled"].includes(normalized)) {
    return normalized as AuthRateLimitRuntimeBackend;
  }

  return "unknown";
}

function resolveEnvironment(env: Record<string, string | undefined>): "development" | "staging" | "production" | "unknown" {
  const value = normalize(env.CUAC_ENV ?? env.DEPLOY_ENV ?? env.NODE_ENV);

  if (value === "production" || value === "prod") {
    return "production";
  }

  if (value === "staging" || value === "stage") {
    return "staging";
  }

  if (value === "development" || value === "dev" || value === "test") {
    return "development";
  }

  return "unknown";
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
