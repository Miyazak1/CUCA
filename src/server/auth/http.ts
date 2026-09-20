import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository, type SchoolTenantMembershipRepository } from "./session.ts";
import { toCurrentActorDto, type CurrentAccountRepository } from "./me.ts";

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
