import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "./session.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../db/postgres-client.ts";
import { transactionalMethod } from "../db/transactional-method.ts";
import { serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { hashAuthRateLimitSubjectValue, type AuthRateLimiter } from "./rate-limit.ts";
import {
  SignInContinuationService,
  type SignInContinuationRepository,
  type CreateSignInContinuationInput,
} from "./continuations.ts";
import { PostgresSignInContinuationRepository } from "./continuations-postgres-repository.ts";
import { createAuthRateLimiterFromEnv } from "./runtime/rate-limit.ts";
import { readAuthBody } from "./input.ts";

type ContinuationService = Pick<SignInContinuationService, keyof SignInContinuationService>;

const guestOnlyAuthRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

const unavailableContinuationRepository: SignInContinuationRepository = {
  async createContinuation() {
    throw serviceUnavailable("Sign-in continuation repository is not configured.");
  },
  async findActiveContinuation() {
    throw serviceUnavailable("Sign-in continuation repository is not configured.");
  },
  async markContinuationConsumed() {
    throw serviceUnavailable("Sign-in continuation repository is not configured.");
  },
};

export function createSignInContinuationHttpHandlers(
  service: ContinuationService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter } = {},
) {
  return {
    create: (request: Request) => handleContinuationRoute(request, service, authRepository, options, "create"),
    consume: (request: Request, continuationId: string) =>
      handleContinuationRoute(request, service, authRepository, options, "consume", continuationId),
  };
}

export function createSignInContinuationRouteHandlers(repository: SignInContinuationRepository = unavailableContinuationRepository) {
  return createSignInContinuationHttpHandlers(new SignInContinuationService(repository), guestOnlyAuthRepository);
}

export function getSignInContinuationRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createSignInContinuationHttpHandlers(
      createPostgresSignInContinuationService(client),
      new PostgresAuthSessionRepository(client),
      { rateLimiter: createAuthRateLimiterFromEnv({ client }) },
    );
  } catch {
    return createSignInContinuationRouteHandlers();
  }
}

export function createPostgresSignInContinuationService(client: TransactionalSqlClient) {
  const create = (tx: TransactionalSqlClient) => new SignInContinuationService(new PostgresSignInContinuationRepository(tx), { auditSink: new PostgresAuditWriter(tx) });
  return {
    createGuestContinuation: transactionalMethod(client, create, "createGuestContinuation"),
    consumeContinuation: transactionalMethod(client, create, "consumeContinuation"),
  };
}

async function handleContinuationRoute(
  request: Request,
  service: ContinuationService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter },
  routeName: "create" | "consume",
  continuationId?: string,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose: routeName === "create" ? "public_catalog_read" : "student_action",
  });

  try {
    const body = await readAuthBody(request, routeName === "create"
      ? ["targetRoute", "actionKey", "requiredRole", "payloadPreview", "deviceFingerprint"] : ["continuationToken"]);
    await options.rateLimiter?.assertAllowed({
      action: routeName === "create" ? "auth.sign_in_continuation.create" : "auth.sign_in_continuation.consume",
      subject: {
        actorUserId: context.actorUserId,
        guestSessionId: context.guestSessionId,
        ipHash: hashRequestIp(request),
        route: continuationId ?? "/api/v1/auth/sign-in-continuations",
      },
    });
    const data =
      routeName === "create"
        ? await service.createGuestContinuation(context, body as CreateSignInContinuationInput)
        : await service.consumeContinuation(context, continuationId, body.continuationToken);

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
