import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createRequirementGovernanceHttpHandlers, type RequirementGovernanceHttpService } from "../requirement-governance-http.ts";
import { PostgresRequirementGovernance } from "../postgres-requirement-governance.ts";

const unavailableService: RequirementGovernanceHttpService = {
  async getVersion() { throw unavailable(); },
  async listVersions() { throw unavailable(); },
  async createDraft() { throw unavailable(); },
  async approve() { throw unavailable(); },
  async publish() { throw unavailable(); },
  async withdraw() { throw unavailable(); },
};

const guestOnlyAuthRepository = {
  async findActiveSessionByTokenHash() { return null; },
};

export function createRequirementGovernanceRouteHandlers(service: RequirementGovernanceHttpService = unavailableService) {
  return createRequirementGovernanceHttpHandlers(service, guestOnlyAuthRepository);
}

export function getRequirementGovernanceRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    return createRequirementGovernanceHttpHandlers(
      new PostgresRequirementGovernance(client),
      new PostgresAuthSessionRepository(client),
    );
  } catch {
    return createRequirementGovernanceRouteHandlers();
  }
}

function unavailable() {
  return serviceUnavailable("Requirement governance repository is not configured.");
}
