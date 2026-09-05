import { serviceUnavailable } from "../../shared/errors.ts";
import { createSqlCatalogClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { PostgresCatalogRepository } from "../postgres-repository.ts";
import { CatalogService, type PublicCatalogRepository } from "../service.ts";
import { createCatalogHttpHandlers } from "../http.ts";

const unavailableRepository: PublicCatalogRepository = {
  async listPrograms() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async getProgram() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async listProgramIntakes() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async getProgramRequirements() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async listSchools() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async getSchool() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async listScholarships() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async getScholarship() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async listCities() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
  async getCity() {
    throw serviceUnavailable("PostgreSQL catalog repository is not configured.");
  },
};

export function createCatalogRouteHandlers(repository: PublicCatalogRepository = unavailableRepository) {
  return createCatalogHttpHandlers(new CatalogService(repository));
}

export function getCatalogRouteHandlers() {
  try {
    const pool = getSharedPostgresPool();
    return createCatalogRouteHandlers(new PostgresCatalogRepository(createSqlCatalogClient(pool)));
  } catch (error) {
    if (isServiceUnavailable(error)) {
      return createCatalogRouteHandlers();
    }

    throw error;
  }
}

function isServiceUnavailable(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "SERVICE_UNAVAILABLE";
}
