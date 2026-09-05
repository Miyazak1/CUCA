import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsApplicationSupportHttpHandlers, type OpsApplicationSupportHttpService } from "../http.ts";
import { PostgresOpsApplicationSupportRepository } from "../postgres-repository.ts";
import { OpsApplicationSupportService, type OpsApplicationSupportRepository } from "../service.ts";

const unavailableRepository: OpsApplicationSupportRepository = {
  async openApplicationSupportSession() {
    throw serviceUnavailable("Ops application support repository is not configured.");
  },
  async resolveApplicationSupportSession() {
    throw serviceUnavailable("Ops application support repository is not configured.");
  },
  async closeApplicationSupportSession() {
    throw serviceUnavailable("Ops application support repository is not configured.");
  },
  async findApplicationSupportByCuacId() {
    throw serviceUnavailable("Ops application support repository is not configured.");
  },
};

const guestOnlyAuthRepository = {
  async findActiveSessionByTokenHash() { return null; },
};

export function createOpsApplicationSupportRouteHandlers(repository = unavailableRepository) {
  return createOpsApplicationSupportHttpHandlers(
    new OpsApplicationSupportService(repository, { async record() {} }),
    guestOnlyAuthRepository,
  );
}

export function getOpsApplicationSupportRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    const createService = (transaction: typeof client) => new OpsApplicationSupportService(
      new PostgresOpsApplicationSupportRepository(transaction),
      new PostgresAuditWriter(transaction),
    );
    const service: OpsApplicationSupportHttpService = {
      openApplicationSupportSession: transactionalMethod(client, createService, "openApplicationSupportSession"),
      getApplicationBySupportSession: transactionalMethod(client, createService, "getApplicationBySupportSession"),
      closeApplicationSupportSession: transactionalMethod(client, createService, "closeApplicationSupportSession"),
    };
    return createOpsApplicationSupportHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch {
    return createOpsApplicationSupportRouteHandlers();
  }
}
