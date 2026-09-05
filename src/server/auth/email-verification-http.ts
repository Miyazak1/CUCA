import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../db/postgres-client.ts";
import { transactionalMethod } from "../db/transactional-method.ts";
import { serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { hashAuthRateLimitSubjectValue, type AuthRateLimiter } from "./rate-limit.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "./session.ts";
import {
  EmailVerificationService,
  type EmailVerificationRepository,
} from "./email-verification.ts";
import { PostgresEmailVerificationRepository } from "./email-verification-postgres-repository.ts";
import { createAuthRateLimiterFromEnv } from "./runtime/rate-limit.ts";
import { readAuthBody } from "./input.ts";
import { PostgresAuthEmailOutbox } from "./postgres-email-outbox.ts";
import type { EmailTokenCipher } from "./email-token-envelope.ts";
import { createAuthEmailOutboxCipherFromEnv } from "./runtime/email-delivery.ts";

type VerificationService = Pick<EmailVerificationService, keyof EmailVerificationService>;

const guestOnlyAuthRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

const unavailableEmailVerificationRepository: EmailVerificationRepository = {
  async findVerificationTargetByUserId() {
    throw serviceUnavailable("Email verification repository is not configured.");
  },
  async createEmailVerificationChallenge() {
    throw serviceUnavailable("Email verification repository is not configured.");
  },
  async findActiveEmailVerificationChallenge() {
    throw serviceUnavailable("Email verification repository is not configured.");
  },
  async markEmailVerified() {
    throw serviceUnavailable("Email verification repository is not configured.");
  },
};

export function createEmailVerificationHttpHandlers(
  service: VerificationService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter } = {},
) {
  return {
    requestVerification: (request: Request) => handleEmailVerificationRoute(request, service, authRepository, options, "request"),
    verifyEmail: (request: Request, challengeId: string) =>
      handleEmailVerificationRoute(request, service, authRepository, options, "verify", challengeId),
  };
}

export function createEmailVerificationRouteHandlers(repository: EmailVerificationRepository = unavailableEmailVerificationRepository) {
  return createEmailVerificationHttpHandlers(new EmailVerificationService(repository), guestOnlyAuthRepository);
}

export function getEmailVerificationRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createEmailVerificationHttpHandlers(
      createPostgresEmailVerificationService(client, { emailCipher: createAuthEmailOutboxCipherFromEnv() }),
      new PostgresAuthSessionRepository(client),
      { rateLimiter: createAuthRateLimiterFromEnv({ client }) },
    );
  } catch {
    return createEmailVerificationRouteHandlers();
  }
}

export function createPostgresEmailVerificationService(client: TransactionalSqlClient, options: { emailCipher?: EmailTokenCipher } = {}) {
  const create = (tx: TransactionalSqlClient) => new EmailVerificationService(new PostgresEmailVerificationRepository(tx), {
    auditSink: new PostgresAuditWriter(tx),
    deliverySink: options.emailCipher ? new PostgresAuthEmailOutbox(tx, options.emailCipher).verificationSink() : undefined,
  });
  return {
    requestVerification: transactionalMethod(client, create, "requestVerification"),
    verifyEmail: transactionalMethod(client, create, "verifyEmail"),
  };
}

async function handleEmailVerificationRoute(
  request: Request,
  service: VerificationService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter },
  routeName: "request" | "verify",
  challengeId?: string,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose: routeName === "request" ? "student_action" : "public_catalog_read",
  });

  try {
    const body = await readAuthBody(request, routeName === "request" ? [] : ["verificationToken"]);
    await options.rateLimiter?.assertAllowed({
      action: routeName === "request" ? "auth.email_verification.request" : "auth.email_verification.verify",
      subject: {
        actorUserId: context.actorUserId,
        guestSessionId: context.guestSessionId,
        ipHash: hashRequestIp(request),
        route: challengeId ?? "/api/v1/auth/email-verification",
      },
    });
    const data =
      routeName === "request"
        ? await service.requestVerification(context)
        : await service.verifyEmail(context, challengeId, body.verificationToken);

    return jsonResponse({ data });
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
