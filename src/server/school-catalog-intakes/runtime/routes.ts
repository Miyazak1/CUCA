import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createSchoolCatalogIntakeHttpHandlers, type SchoolCatalogIntakeHttpService } from "../http.ts";
import { PostgresSchoolCatalogIntakeRepository } from "../postgres-repository.ts";
import { SchoolCatalogIntakeService, type SchoolCatalogIntakeRepository } from "../service.ts";

const unavailableRepository: SchoolCatalogIntakeRepository = {
  async list() { throw unavailable(); }, async saveDraft() { throw unavailable(); },
  async publish() { throw unavailable(); }, async withdraw() { throw unavailable(); },
};
const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createSchoolCatalogIntakeRouteHandlers(repository = unavailableRepository) {
  return createSchoolCatalogIntakeHttpHandlers(new SchoolCatalogIntakeService(repository, { async record() {} }), guestOnlyAuthRepository);
}

export function getSchoolCatalogIntakeRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const authRepository = new PostgresAuthSessionRepository(client);
    const createService = (transaction: typeof client) => new SchoolCatalogIntakeService(
      new PostgresSchoolCatalogIntakeRepository(transaction), new PostgresAuditWriter(transaction));
    const service: SchoolCatalogIntakeHttpService = {
      list: transactionalMethod(client, createService, "list"),
      saveDraft: transactionalMethod(client, createService, "saveDraft"),
      publish: transactionalMethod(client, createService, "publish"),
      withdraw: transactionalMethod(client, createService, "withdraw"),
    };
    return createSchoolCatalogIntakeHttpHandlers(service, authRepository, authRepository);
  } catch { return createSchoolCatalogIntakeRouteHandlers(); }
}

function unavailable() { return serviceUnavailable("School intake management repository is not configured."); }
