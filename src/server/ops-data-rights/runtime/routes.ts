import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { PostgresNotificationPublisher } from "../../notifications/postgres-repository.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createOpsDataRightsHttpHandlers } from "../http.ts";
import { PostgresOpsDataRightsRepository } from "../postgres-repository.ts";
import { OpsDataRightsService, type OpsDataRightsRepository } from "../service.ts";
const unavailable: OpsDataRightsRepository = { async list(){throw serviceUnavailable("Data-rights review is unavailable.");},
  async claim(){throw serviceUnavailable("Data-rights review is unavailable.");}, async escalate(){throw serviceUnavailable("Data-rights review is unavailable.");},
  async propose(){throw serviceUnavailable("Data-rights review is unavailable.");},async approve(){throw serviceUnavailable("Data-rights review is unavailable.");} };
const guest = { async findActiveSessionByTokenHash(){ return null; } };
export function createOpsDataRightsRouteHandlers(repository=unavailable) { return createOpsDataRightsHttpHandlers(new OpsDataRightsService(repository,{async record(){}}),guest); }
export function getOpsDataRightsRouteHandlers() { try { const client=createTransactionalSqlClient(getSharedPostgresPool());
  const create=(tx:typeof client)=>new OpsDataRightsService(new PostgresOpsDataRightsRepository(tx),new PostgresAuditWriter(tx),
    new PostgresNotificationPublisher(tx));
  return createOpsDataRightsHttpHandlers({ list:transactionalMethod(client,create,"list"),
    claim:transactionalMethod(client,create,"claim"),escalate:transactionalMethod(client,create,"escalate"),
    propose:transactionalMethod(client,create,"propose"),approve:transactionalMethod(client,create,"approve") },new PostgresAuthSessionRepository(client));
  } catch { return createOpsDataRightsRouteHandlers(); } }
