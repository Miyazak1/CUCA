import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsAccountDeletionHttpHandlers, type OpsAccountDeletionHttpService } from "../http.ts";
import { PostgresAccountDeletionExecutionRepository } from "../postgres-repository.ts";
import { OpsAccountDeletionService, type AccountDeletionExecutionRepository } from "../service.ts";

const unavailable: AccountDeletionExecutionRepository = {
  async list() { throw serviceUnavailable("Account-deletion execution queue is unavailable."); },
  async refresh() { throw serviceUnavailable("Account-deletion execution queue is unavailable."); },
  async recordLegalHoldReview() { throw serviceUnavailable("Account-deletion execution queue is unavailable."); },
  async quarantine() { throw serviceUnavailable("Account-deletion execution queue is unavailable."); },
};
const guest = { async findActiveSessionByTokenHash() { return null; } };
export function createOpsAccountDeletionRouteHandlers(repository = unavailable) {
  return createOpsAccountDeletionHttpHandlers(new OpsAccountDeletionService(repository, { async record() {} }), guest);
}
export function getOpsAccountDeletionRouteHandlers() {
  try { const client = createTransactionalSqlClient(getSharedPostgresPool());
    const create = (tx: typeof client) => new OpsAccountDeletionService(
      new PostgresAccountDeletionExecutionRepository(tx), new PostgresAuditWriter(tx));
    const service: OpsAccountDeletionHttpService = {
      list: transactionalMethod(client, create, "list"), refresh: transactionalMethod(client, create, "refresh"),
      reviewLegalHold: transactionalMethod(client, create, "reviewLegalHold"),
      quarantine: transactionalMethod(client, create, "quarantine"),
    };
    return createOpsAccountDeletionHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch { return createOpsAccountDeletionRouteHandlers(); }
}
