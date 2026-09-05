import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsBillingReviewHttpHandlers, type OpsBillingReviewHttpService } from "../http.ts";
import { PostgresOpsBillingReviewRepository } from "../postgres-repository.ts";
import { OpsBillingReviewService, type OpsBillingReviewRepository } from "../service.ts";

const unavailableRepository: OpsBillingReviewRepository = {
  async listQuarantinedEvents() { throw unavailable(); },
  async claimReview() { throw unavailable(); },
  async escalateReview() { throw unavailable(); },
  async resolveReview() { throw unavailable(); },
};

const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createOpsBillingReviewRouteHandlers(repository = unavailableRepository) {
  return createOpsBillingReviewHttpHandlers(new OpsBillingReviewService(repository, { async record() {} }), guestOnlyAuthRepository);
}

export function getOpsBillingReviewRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const createService = (transaction: typeof client) => new OpsBillingReviewService(
      new PostgresOpsBillingReviewRepository(transaction), new PostgresAuditWriter(transaction));
    const service: OpsBillingReviewHttpService = {
      listQuarantinedEvents: transactionalMethod(client, createService, "listQuarantinedEvents"),
      claimReview: transactionalMethod(client, createService, "claimReview"),
      escalateReview: transactionalMethod(client, createService, "escalateReview"),
      resolveReview: transactionalMethod(client, createService, "resolveReview"),
    };
    return createOpsBillingReviewHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch {
    return createOpsBillingReviewRouteHandlers();
  }
}

function unavailable() {
  return serviceUnavailable("Ops billing review repository is not configured.");
}
