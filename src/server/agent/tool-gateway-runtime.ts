import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { PostgresCatalogRepository } from "../catalog/postgres-repository.ts";
import { CatalogService } from "../catalog/service.ts";
import type { TransactionalSqlClient } from "../db/postgres-client.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { PublicAgentToolGateway } from "./public-tool-gateway.ts";
import { AgentToolRateLimitService, PostgresAgentToolRateLimitStore } from "./tool-rate-limit.ts";

// This is an internal composition root. It exposes no HTTP route and no model/provider adapter.
export function createPostgresPublicAgentToolGateway(client: TransactionalSqlClient) {
  return {
    async execute(context: RequestContext, input: unknown) {
      const outcome = await client.transaction(async (tx) => {
        const gateway = new PublicAgentToolGateway(
          new CatalogService(new PostgresCatalogRepository(tx)),
          new PostgresAuditWriter(tx),
          new AgentToolRateLimitService(new PostgresAgentToolRateLimitStore(tx)),
        );
        return gateway.run(context, input);
      });
      if (!outcome.ok) throw outcome.error;
      return outcome.result;
    },
  };
}
