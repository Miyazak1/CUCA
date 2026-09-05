import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../db/postgres-client.ts";
import { transactionalMethod } from "../db/transactional-method.ts";
import { serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { PasswordResetService, type PasswordResetRepository } from "./password-reset.ts";
import { PostgresPasswordResetRepository } from "./password-reset-postgres-repository.ts";
import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { hashAuthRateLimitSubjectValue, type AuthRateLimiter } from "./rate-limit.ts";
import { createAuthRateLimiterFromEnv } from "./runtime/rate-limit.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "./session.ts";
import { authRateLimitEmail, readAuthBody } from "./input.ts";
import { PostgresAuthEmailOutbox } from "./postgres-email-outbox.ts";
import type { EmailTokenCipher } from "./email-token-envelope.ts";
import type { PasswordHasher } from "./password-hasher.ts";
import { createAuthEmailOutboxCipherFromEnv } from "./runtime/email-delivery.ts";

type ResetService = Pick<PasswordResetService, keyof PasswordResetService>;

const guestOnlyAuthRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

const unavailablePasswordResetRepository: PasswordResetRepository = {
  async findPasswordResetTargetByEmailNormalized() {
    throw serviceUnavailable("Password reset repository is not configured.");
  },
  async createPasswordResetChallenge() {
    throw serviceUnavailable("Password reset repository is not configured.");
  },
  async findActivePasswordResetChallenge() {
    throw serviceUnavailable("Password reset repository is not configured.");
  },
  async consumePasswordReset() {
    throw serviceUnavailable("Password reset repository is not configured.");
  },
};

export function createPasswordResetHttpHandlers(
  service: ResetService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter } = {},
) {
  return {
    requestReset: (request: Request) => handlePasswordResetRoute(request, service, authRepository, options, "request"),
    resetPassword: (request: Request, challengeId: string) =>
      handlePasswordResetRoute(request, service, authRepository, options, "reset", challengeId),
  };
}

export function createPasswordResetRouteHandlers(repository: PasswordResetRepository = unavailablePasswordResetRepository) {
  return createPasswordResetHttpHandlers(new PasswordResetService(repository), guestOnlyAuthRepository);
}

export function getPasswordResetRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createPasswordResetHttpHandlers(
      createPostgresPasswordResetService(client, { emailCipher: createAuthEmailOutboxCipherFromEnv() }),
      new PostgresAuthSessionRepository(client),
      { rateLimiter: createAuthRateLimiterFromEnv({ client }) },
    );
  } catch {
    return createPasswordResetRouteHandlers();
  }
}

export function createPostgresPasswordResetService(client: TransactionalSqlClient, options: { emailCipher?: EmailTokenCipher; passwordHasher?: PasswordHasher } = {}) {
  const create = (tx: TransactionalSqlClient) => new PasswordResetService(new PostgresPasswordResetRepository(tx), {
    auditSink: new PostgresAuditWriter(tx),
    deliverySink: options.emailCipher ? new PostgresAuthEmailOutbox(tx, options.emailCipher).resetSink() : undefined,
    passwordHasher: options.passwordHasher,
  });
  return {
    requestReset: transactionalMethod(client, create, "requestReset"),
    resetPassword: transactionalMethod(client, create, "resetPassword"),
  };
}

async function handlePasswordResetRoute(
  request: Request,
  service: ResetService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter },
  routeName: "request" | "reset",
  challengeId?: string,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "public_catalog_read" });

  try {
    const body = await readAuthBody(request, routeName === "request" ? ["email"] : ["resetToken", "newPassword"]);
    await options.rateLimiter?.assertAllowed({
      action: routeName === "request" ? "auth.password_reset.request" : "auth.password_reset.consume",
      subject: {
        email: routeName === "request" ? authRateLimitEmail(body.email) : null,
        actorUserId: context.actorUserId,
        guestSessionId: context.guestSessionId,
        ipHash: hashRequestIp(request),
        route: challengeId ?? "/api/v1/auth/password-reset",
      },
    });
    const data =
      routeName === "request"
        ? await service.requestReset(context, { email: body.email })
        : await service.resetPassword(context, challengeId, body.resetToken, body.newPassword);

    return jsonResponse({ data: routeName === "request" ? { status: "accepted" } : data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function resolveRequestIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
}

function hashRequestIp(request: Request): string | null {
  const ip = resolveRequestIp(request);
  return ip ? hashAuthRateLimitSubjectValue(ip) : null;
}
