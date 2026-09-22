import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { randomUUID } from "node:crypto";
import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository, type SchoolTenantMembershipRepository } from "./session.ts";
import { toCurrentActorDto, type CurrentAccountRepository } from "./me.ts";
import { badRequest, CuacError, forbidden, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { authInput } from "./input.ts";
import { normalizeUiLocale, PUBLIC_UI_LOCALES, type PublicUiLocale } from "../i18n/locales.ts";

const guestOnlyRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

export function createAuthHttpHandlers(
  repository: AuthSessionRepository & Partial<CurrentAccountRepository> = guestOnlyRepository,
  schoolTenantMembershipRepository?: SchoolTenantMembershipRepository,
) {
  return {
    async getMe(request: Request) {
      const context = await resolveRequestContextFromRequest(request, repository, { schoolTenantMembershipRepository });
      const account = context.actorUserId && repository.findCurrentAccountByUserId
        ? await repository.findCurrentAccountByUserId(context.actorUserId)
        : null;
      return Response.json({ data: toCurrentActorDto(context, account) });
    },
    async updateLocale(request: Request) {
      const requestId = request.headers.get("x-request-id") ?? randomUUID();
      try {
        const context = await resolveRequestContextFromRequest(request, repository, { schoolTenantMembershipRepository });
        if (!context.actorUserId || context.activeRole !== "student" || context.selectedSurface !== "student" || context.tenantSchoolId) {
          throw forbidden("Student account access is required.");
        }
        if (!repository.updateCurrentAccountLocale) throw serviceUnavailable("Account language preferences are unavailable.");
        const value = authInput(await request.json(), ["locale"]);
        const normalized = normalizeUiLocale(value.locale);
        if (!normalized || !PUBLIC_UI_LOCALES.includes(normalized as PublicUiLocale)) throw badRequest("UI locale is not supported.");
        const result = await repository.updateCurrentAccountLocale({ userId: context.actorUserId,
          locale: normalized as PublicUiLocale, requestId, now: new Date() });
        if (!result) throw forbidden("Student account access is required.");
        return Response.json({ data: { accountLocale: result.locale, changed: result.changed } }, {
          headers: { "x-request-id": requestId },
        });
      } catch (error) {
        return Response.json(toErrorEnvelope(error, requestId), {
          status: error instanceof CuacError ? error.status : 500,
          headers: { "x-request-id": requestId },
        });
      }
    },
  };
}

export function getAuthHttpHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const repository = new PostgresAuthSessionRepository(createTransactionalSqlClient(pool));
    return createAuthHttpHandlers(repository, repository);
  } catch {
    return createAuthHttpHandlers();
  }
}
