import { createTransactionalSqlClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { PostgresAuthSessionRepository } from "./postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository, type SchoolTenantMembershipRepository } from "./session.ts";
import { toCurrentActorDto } from "./me.ts";

const guestOnlyRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

export function createAuthHttpHandlers(
  repository: AuthSessionRepository = guestOnlyRepository,
  schoolTenantMembershipRepository?: SchoolTenantMembershipRepository,
) {
  return {
    async getMe(request: Request) {
      const context = await resolveRequestContextFromRequest(request, repository, { schoolTenantMembershipRepository });
      return Response.json({ data: toCurrentActorDto(context) });
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
