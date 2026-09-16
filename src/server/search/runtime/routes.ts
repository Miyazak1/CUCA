import { serviceUnavailable } from "../../shared/errors.ts";
import { createSqlCatalogClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { createSiteSearchHttpHandler } from "../http.ts";
import { PostgresSiteSearchRepository } from "../postgres-repository.ts";
import { SiteSearchService, type SiteSearchRepository } from "../service.ts";

const unavailableRepository: SiteSearchRepository = {
  async search() { throw serviceUnavailable("PostgreSQL site search repository is not configured."); },
};

export function createSiteSearchRouteHandler(repository: SiteSearchRepository = unavailableRepository) {
  return createSiteSearchHttpHandler(new SiteSearchService(repository));
}

export function getSiteSearchRouteHandler() {
  try {
    return createSiteSearchRouteHandler(new PostgresSiteSearchRepository(createSqlCatalogClient(getSharedPostgresPool())));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "SERVICE_UNAVAILABLE") return createSiteSearchRouteHandler();
    throw error;
  }
}
