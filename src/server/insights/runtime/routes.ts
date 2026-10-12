import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createInsightGovernanceHttpHandlers, type InsightGovernanceHttpService } from "../http.ts";
import { PostgresInsightGovernance } from "../postgres-governance.ts";

const unavailableService: InsightGovernanceHttpService = {
  async listPosts() { throw unavailable(); }, async listVersions() { throw unavailable(); }, async getVersion() { throw unavailable(); },
  async createPost() { throw unavailable(); }, async createDraft() { throw unavailable(); }, async publish() { throw unavailable(); }, async withdraw() { throw unavailable(); },
};
const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createInsightGovernanceRouteHandlers(service: InsightGovernanceHttpService = unavailableService) {
  return createInsightGovernanceHttpHandlers(service, guestOnlyAuthRepository);
}

export function getInsightGovernanceRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createInsightGovernanceHttpHandlers(new PostgresInsightGovernance(client), new PostgresAuthSessionRepository(client));
  } catch { return createInsightGovernanceRouteHandlers(); }
}
function unavailable() { return serviceUnavailable("Insight governance repository is not configured."); }
