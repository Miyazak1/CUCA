import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsDataQualityHttpHandlers, type OpsDataQualityHttpService } from "../http.ts";
import { PostgresOpsDataQualityRepository } from "../postgres-repository.ts";
import { OpsDataQualityService, type OpsDataQualityRepository } from "../service.ts";

const unavailableRepository: OpsDataQualityRepository = {
  async listCandidates() { throw unavailable(); },
  async claimReview() { throw unavailable(); },
  async escalateReview() { throw unavailable(); },
  async resolveReview() { throw unavailable(); },
};

const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createOpsDataQualityRouteHandlers(repository = unavailableRepository) {
  return createOpsDataQualityHttpHandlers(
    new OpsDataQualityService(repository, { async record() {} }), guestOnlyAuthRepository);
}

export function getOpsDataQualityRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const createService = (transaction: typeof client) => new OpsDataQualityService(
      new PostgresOpsDataQualityRepository(transaction), new PostgresAuditWriter(transaction));
    const service: OpsDataQualityHttpService = {
      listCandidates: transactionalMethod(client, createService, "listCandidates"),
      claimReview: transactionalMethod(client, createService, "claimReview"),
      escalateReview: transactionalMethod(client, createService, "escalateReview"),
      resolveReview: transactionalMethod(client, createService, "resolveReview"),
    };
    return createOpsDataQualityHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch {
    return createOpsDataQualityRouteHandlers();
  }
}

function unavailable() {
  return serviceUnavailable("Ops data-quality repository is not configured.");
}
