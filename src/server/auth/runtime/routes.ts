import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { AuthCredentialsService, type AuthCredentialsRepository } from "../credentials.ts";
import { createAuthCredentialsHttpHandlers } from "../credentials-http.ts";
import { PostgresAuthSessionRepository } from "../postgres-repository.ts";
import { createAuthRateLimiterFromEnv } from "./rate-limit.ts";
import type { PasswordHasher } from "../password-hasher.ts";

const unavailableCredentialsRepository: AuthCredentialsRepository = {
  async findPasswordIdentityByEmailNormalized() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async createStudentAccount() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async createSession() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async revokeSessionByTokenHash() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async findSessionReauthenticationTarget() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
  async activateSessionStepUp() {
    throw serviceUnavailable("Auth credentials repository is not configured.");
  },
};

export function createAuthCredentialsRouteHandlers(
  repository: AuthCredentialsRepository = unavailableCredentialsRepository,
  options: { rateLimiter?: ReturnType<typeof createAuthRateLimiterFromEnv> } = {},
) {
  return createAuthCredentialsHttpHandlers(new AuthCredentialsService(repository), {
    secureCookies: process.env.NODE_ENV === "production",
    rateLimiter: options.rateLimiter,
  });
}

export function getAuthCredentialsRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createAuthCredentialsHttpHandlers(createPostgresAuthCredentialsService(client), {
      secureCookies: process.env.NODE_ENV === "production",
      rateLimiter: createAuthRateLimiterFromEnv({ client }),
    });
  } catch {
    return createAuthCredentialsRouteHandlers();
  }
}

export function createPostgresAuthCredentialsService(client: TransactionalSqlClient, options: { passwordHasher?: PasswordHasher } = {}) {
  const create = (tx: TransactionalSqlClient) => new AuthCredentialsService(new PostgresAuthSessionRepository(tx), { auditSink: new PostgresAuditWriter(tx), passwordHasher: options.passwordHasher });
  return {
    registerStudent: transactionalMethod(client, create, "registerStudent"),
    createStudentSession: transactionalMethod(client, create, "createStudentSession"),
    stepUpSession: transactionalMethod(client, create, "stepUpSession"),
    revokeSession: transactionalMethod(client, create, "revokeSession"),
  };
}
