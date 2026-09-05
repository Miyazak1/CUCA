import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createSchoolCatalogCorrectionHttpHandlers, type SchoolCatalogCorrectionHttpService } from "../http.ts";
import { PostgresSchoolCatalogCorrectionRepository } from "../postgres-repository.ts";
import { SchoolCatalogCorrectionService, type SchoolCatalogCorrectionRepository } from "../service.ts";

const unavailableRepository: SchoolCatalogCorrectionRepository = {
  async listForSchool() { throw unavailable(); },
  async submit() { throw unavailable(); },
  async listForOps() { throw unavailable(); },
  async claim() { throw unavailable(); },
  async resolve() { throw unavailable(); },
};
const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createSchoolCatalogCorrectionRouteHandlers(repository = unavailableRepository) {
  return createSchoolCatalogCorrectionHttpHandlers(
    new SchoolCatalogCorrectionService(repository, { async record() {} }), guestOnlyAuthRepository);
}

export function getSchoolCatalogCorrectionRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const authRepository = new PostgresAuthSessionRepository(client);
    const createService = (transaction: typeof client) => new SchoolCatalogCorrectionService(
      new PostgresSchoolCatalogCorrectionRepository(transaction), new PostgresAuditWriter(transaction));
    const service: SchoolCatalogCorrectionHttpService = {
      listForSchool: transactionalMethod(client, createService, "listForSchool"),
      submit: transactionalMethod(client, createService, "submit"),
      listForOps: transactionalMethod(client, createService, "listForOps"),
      claim: transactionalMethod(client, createService, "claim"),
      resolve: transactionalMethod(client, createService, "resolve"),
    };
    return createSchoolCatalogCorrectionHttpHandlers(service, authRepository, authRepository);
  } catch {
    return createSchoolCatalogCorrectionRouteHandlers();
  }
}

function unavailable() { return serviceUnavailable("School catalog correction repository is not configured."); }
