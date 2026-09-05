import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { PostgresNotificationPublisher } from "../../notifications/postgres-repository.ts";
import { createSchoolPortalHttpHandlers, type SchoolPortalHttpService } from "../http.ts";
import { PostgresSchoolPortalRepository } from "../postgres-repository.ts";
import { SchoolPortalService, type SchoolPortalRepository } from "../service.ts";

const emptySchoolPortalRepository: SchoolPortalRepository = {
  async listApplicationQueueBySchoolId() {
    return [];
  },
  async getApplicationById() {
    return null;
  },
  async updateApplicationStatus() {
    throw serviceUnavailable("School workflow repository is not configured.");
  },
  async recordApplicationContact() {
    throw serviceUnavailable("School workflow repository is not configured.");
  },
};

const guestOnlyAuthRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

export function createSchoolPortalRouteHandlers(repository: SchoolPortalRepository = emptySchoolPortalRepository) {
  return createSchoolPortalHttpHandlers(new SchoolPortalService(repository), guestOnlyAuthRepository);
}

export function getSchoolPortalRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    const authRepository = new PostgresAuthSessionRepository(client);
    const createService = (transaction: typeof client) =>
      new SchoolPortalService(new PostgresSchoolPortalRepository(transaction), new PostgresAuditWriter(transaction),
        new PostgresNotificationPublisher(transaction));
    const reads = createService(client);
    const service: SchoolPortalHttpService = {
      listTenantApplicationQueue: reads.listTenantApplicationQueue.bind(reads),
      getTenantApplication: reads.getTenantApplication.bind(reads),
      updateTenantApplicationStatus: transactionalMethod(client, createService, "updateTenantApplicationStatus"),
      recordTenantApplicationContact: transactionalMethod(client, createService, "recordTenantApplicationContact"),
    };
    return createSchoolPortalHttpHandlers(service, authRepository, authRepository);
  } catch {
    return createSchoolPortalRouteHandlers();
  }
}
