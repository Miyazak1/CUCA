import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../db/postgres-client.ts";
import { transactionalMethod } from "../db/transactional-method.ts";
import { serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { hashAuthRateLimitSubjectValue, type AuthRateLimiter } from "./rate-limit.ts";
import { createAuthRateLimiterFromEnv } from "./runtime/rate-limit.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "./session.ts";
import { SchoolStaffInviteService, type CreateSchoolStaffInviteInput, type SchoolStaffInviteRepository } from "./school-invites.ts";
import { PostgresSchoolStaffInviteRepository } from "./school-invites-postgres-repository.ts";
import { readAuthBody } from "./input.ts";

type InviteService = Pick<SchoolStaffInviteService, keyof SchoolStaffInviteService>;

const guestOnlyAuthRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

const unavailableSchoolStaffInviteRepository: SchoolStaffInviteRepository = {
  async hasLiveCuacStaffAuthority() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
  async findAccountByUserId() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
  async findSchoolById() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
  async createInvite() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
  async findActiveInviteByIdAndTokenHash() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
  async acceptInvite() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
  async revokePendingInvite() {
    throw serviceUnavailable("School staff invite repository is not configured.");
  },
};

export function createSchoolStaffInviteHttpHandlers(
  service: InviteService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter } = {},
) {
  return {
    create: (request: Request) => handleSchoolStaffInviteCreate(request, service, authRepository, options),
    accept: (request: Request, inviteId: string) => handleSchoolStaffInviteAccept(request, inviteId, service, authRepository, options),
    revoke: (request: Request, inviteId: string) => handleSchoolStaffInviteRevoke(request, inviteId, service, authRepository, options),
  };
}

export function createSchoolStaffInviteRouteHandlers(
  repository: SchoolStaffInviteRepository = unavailableSchoolStaffInviteRepository,
) {
  return createSchoolStaffInviteHttpHandlers(new SchoolStaffInviteService(repository), guestOnlyAuthRepository);
}

export function getSchoolStaffInviteRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createSchoolStaffInviteHttpHandlers(
      createPostgresSchoolStaffInviteService(client),
      new PostgresAuthSessionRepository(client),
      { rateLimiter: createAuthRateLimiterFromEnv({ client }) },
    );
  } catch {
    return createSchoolStaffInviteRouteHandlers();
  }
}

export function createPostgresSchoolStaffInviteService(client: TransactionalSqlClient) {
  const create = (tx: TransactionalSqlClient) => new SchoolStaffInviteService(new PostgresSchoolStaffInviteRepository(tx), { auditSink: new PostgresAuditWriter(tx) });
  return {
    createInvite: transactionalMethod(client, create, "createInvite"),
    acceptInvite: transactionalMethod(client, create, "acceptInvite"),
    revokeInvite: transactionalMethod(client, create, "revokeInvite"),
  };
}

async function handleSchoolStaffInviteCreate(
  request: Request,
  service: InviteService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter },
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose: "ops_support",
  });

  try {
    const body = await readAuthBody(request, ["schoolId", "email", "role"]);
    await options.rateLimiter?.assertAllowed({
      action: "auth.school_staff_invite.create",
      subject: {
        actorUserId: context.actorUserId,
        guestSessionId: context.guestSessionId,
        ipHash: hashRequestIp(request),
        route: "/api/v1/auth/school-invites",
      },
    });
    const data = await service.createInvite(context, body as CreateSchoolStaffInviteInput);

    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function handleSchoolStaffInviteAccept(
  request: Request,
  inviteId: string,
  service: InviteService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter },
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose: "school_review",
  });

  try {
    const body = await readAuthBody(request, ["inviteToken"]);
    await options.rateLimiter?.assertAllowed({
      action: "auth.school_staff_invite.accept",
      subject: {
        actorUserId: context.actorUserId,
        guestSessionId: context.guestSessionId,
        ipHash: hashRequestIp(request),
        route: inviteId,
      },
    });
    const data = await service.acceptInvite(context, inviteId, body.inviteToken);

    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function handleSchoolStaffInviteRevoke(
  request: Request,
  inviteId: string,
  service: InviteService,
  authRepository: AuthSessionRepository,
  options: { rateLimiter?: AuthRateLimiter },
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose: "ops_support",
  });

  try {
    await readAuthBody(request, []);
    await options.rateLimiter?.assertAllowed({
      action: "auth.school_staff_invite.revoke",
      subject: {
        actorUserId: context.actorUserId,
        guestSessionId: context.guestSessionId,
        ipHash: hashRequestIp(request),
        route: inviteId,
      },
    });
    const data = await service.revokeInvite(context, inviteId);

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
