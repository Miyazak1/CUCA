import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsRoutingReviewHttpHandlers, type OpsRoutingReviewHttpService } from "../http.ts";
import { PostgresOpsRoutingReviewRepository } from "../postgres-repository.ts";
import { OpsRoutingReviewService, type OpsRoutingReviewRepository } from "../service.ts";

const unavailableRepository: OpsRoutingReviewRepository = {
  async listQuarantinedDeliveries() { throw unavailable(); },
  async claimReview() { throw unavailable(); },
  async escalateReview() { throw unavailable(); },
  async closeReview() { throw unavailable(); },
  async approveRetry() { throw unavailable(); },
};

const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createOpsRoutingReviewRouteHandlers(repository = unavailableRepository) {
  return createOpsRoutingReviewHttpHandlers(
    new OpsRoutingReviewService(repository, { async record() {} }), guestOnlyAuthRepository);
}

export function getOpsRoutingReviewRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const createService = (transaction: typeof client) => new OpsRoutingReviewService(
      new PostgresOpsRoutingReviewRepository(transaction), new PostgresAuditWriter(transaction));
    const service: OpsRoutingReviewHttpService = {
      listQuarantinedDeliveries: transactionalMethod(client, createService, "listQuarantinedDeliveries"),
      claimReview: transactionalMethod(client, createService, "claimReview"),
      escalateReview: transactionalMethod(client, createService, "escalateReview"),
      closeReview: transactionalMethod(client, createService, "closeReview"),
      approveRetry: transactionalMethod(client, createService, "approveRetry"),
    };
    return createOpsRoutingReviewHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch {
    return createOpsRoutingReviewRouteHandlers();
  }
}

function unavailable() {
  return serviceUnavailable("Ops routing review repository is not configured.");
}
