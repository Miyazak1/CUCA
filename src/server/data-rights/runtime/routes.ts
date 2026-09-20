import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../../notifications/postgres-repository.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createDataRightsHttpHandlers } from "../http.ts";
import { PostgresDataRightsRepository } from "../postgres-repository.ts";
import { DataRightsService, type DataRightsRepository } from "../service.ts";

const unavailableRepository: DataRightsRepository = {
  async listOwn() { throw serviceUnavailable("Data-rights repository is not configured."); },
  async createOwn() { throw serviceUnavailable("Data-rights repository is not configured."); },
  async cancelOwn() { throw serviceUnavailable("Data-rights repository is not configured."); },
  async confirmOwn() { throw serviceUnavailable("Data-rights repository is not configured."); },
};
const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createDataRightsRouteHandlers(repository = unavailableRepository) {
  return createDataRightsHttpHandlers(new DataRightsService(repository, { async record() {} }), guestOnlyAuthRepository);
}

export function getDataRightsRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const create = (tx: typeof client) => new DataRightsService(new PostgresDataRightsRepository(tx), new PostgresAuditWriter(tx),
      new PostgresNotificationPublisher(tx));
    const reads = create(client);
    return createDataRightsHttpHandlers({ listOwn: reads.listOwn.bind(reads),
      createOwn: transactionalMethod(client, create, "createOwn"), cancelOwn: transactionalMethod(client, create, "cancelOwn"),
      confirmOwn: transactionalMethod(client, create, "confirmOwn") },
    new PostgresAuthSessionRepository(client));
  } catch { return createDataRightsRouteHandlers(); }
}
