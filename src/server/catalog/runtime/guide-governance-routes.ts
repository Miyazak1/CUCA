import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createGuideGovernanceHttpHandlers, type GuideGovernanceHttpService } from "../guide-governance-http.ts";
import { PostgresGuideGovernance } from "../postgres-guide-governance.ts";

const unavailableService: GuideGovernanceHttpService = {
  async listGuides() { throw unavailable(); },
  async listVersions() { throw unavailable(); }, async getVersion() { throw unavailable(); }, async createDraft() { throw unavailable(); },
  async approve() { throw unavailable(); }, async publish() { throw unavailable(); }, async withdraw() { throw unavailable(); },
};
const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createGuideGovernanceRouteHandlers(service: GuideGovernanceHttpService = unavailableService) {
  return createGuideGovernanceHttpHandlers(service, guestOnlyAuthRepository);
}

export function getGuideGovernanceRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createGuideGovernanceHttpHandlers(new PostgresGuideGovernance(client), new PostgresAuthSessionRepository(client));
  } catch { return createGuideGovernanceRouteHandlers(); }
}

function unavailable() { return serviceUnavailable("Guide governance repository is not configured."); }
