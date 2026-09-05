import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsOperationsMonitoringHttpHandlers, type OpsOperationsMonitoringHttpService } from "../http.ts";
import { PostgresOpsOperationsMonitoringRepository } from "../postgres-repository.ts";
import { OpsOperationsMonitoringService, type OpsOperationsMonitoringRepository } from "../service.ts";

const unavailableRepository: OpsOperationsMonitoringRepository = {
  async readOperationsSummary() {
    throw serviceUnavailable("Ops operations monitoring repository is not configured.");
  },
};

const guestOnlyAuthRepository = {
  async findActiveSessionByTokenHash() { return null; },
};

export function createOpsOperationsMonitoringRouteHandlers(repository = unavailableRepository) {
  return createOpsOperationsMonitoringHttpHandlers(
    new OpsOperationsMonitoringService(repository, { async record() {} }),
    guestOnlyAuthRepository,
  );
}

export function getOpsOperationsMonitoringRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const createService = (transaction: typeof client) => new OpsOperationsMonitoringService(
      new PostgresOpsOperationsMonitoringRepository(transaction),
      new PostgresAuditWriter(transaction),
    );
    const service: OpsOperationsMonitoringHttpService = {
      getOperationsSummary: transactionalMethod(client, createService, "getOperationsSummary"),
    };
    return createOpsOperationsMonitoringHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch {
    return createOpsOperationsMonitoringRouteHandlers();
  }
}
