import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { transactionalMethod } from "../../db/transactional-method.ts";
import { createNotificationHttpHandler, unconfiguredNotificationHttpHandler, type NotificationHttpService } from "../http.ts";
import { PostgresNotificationRepository } from "../postgres-repository.ts";
import { NotificationService } from "../service.ts";

export function getNotificationRouteHandler() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const auth = new PostgresAuthSessionRepository(client);
    const create = (tx: typeof client) => new NotificationService(
      new PostgresNotificationRepository(tx), new PostgresAuditWriter(tx),
    );
    const reads = create(client);
    const service: NotificationHttpService = {
      list: reads.list.bind(reads),
      getPreferences: reads.getPreferences.bind(reads),
      markRead: transactionalMethod(client, create, "markRead"),
      markAllRead: transactionalMethod(client, create, "markAllRead"),
      updatePreferences: transactionalMethod(client, create, "updatePreferences"),
    };
    return createNotificationHttpHandler(service, auth, auth);
  } catch {
    return unconfiguredNotificationHttpHandler();
  }
}
