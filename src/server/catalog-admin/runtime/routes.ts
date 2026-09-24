import { PostgresAuditWriter } from "../../audit/postgres-writer.ts";
import { PostgresAuthSessionRepository } from "../../auth/postgres-repository.ts";
import { createTransactionalSqlClient, getSharedPostgresPool } from "../../db/postgres-client.ts";
import { serviceUnavailable } from "../../shared/errors.ts";
import { createCatalogAdminHttpHandlers, type CatalogAdminHttpService } from "../http.ts";
import { PostgresCatalogAdminRepository } from "../postgres-repository.ts";
import { CatalogAdminService } from "../service.ts";

const unavailableService: CatalogAdminHttpService = {
  async listCities() { throw unavailable(); }, async getCity() { throw unavailable(); },
  async createCity() { throw unavailable(); }, async updateCity() { throw unavailable(); },
  async publishCity() { throw unavailable(); }, async archiveCity() { throw unavailable(); },
  async restoreCity() { throw unavailable(); },
  async listSchools() { throw unavailable(); }, async getSchool() { throw unavailable(); },
  async createSchool() { throw unavailable(); }, async updateSchool() { throw unavailable(); },
  async publishSchool() { throw unavailable(); }, async archiveSchool() { throw unavailable(); },
  async restoreSchool() { throw unavailable(); },
  async listPrograms() { throw unavailable(); }, async getProgram() { throw unavailable(); },
  async createProgram() { throw unavailable(); }, async updateProgram() { throw unavailable(); },
  async publishProgram() { throw unavailable(); }, async archiveProgram() { throw unavailable(); },
  async restoreProgram() { throw unavailable(); },
  async listScholarships() { throw unavailable(); }, async getScholarship() { throw unavailable(); },
  async createScholarship() { throw unavailable(); }, async updateScholarship() { throw unavailable(); },
  async publishScholarship() { throw unavailable(); }, async archiveScholarship() { throw unavailable(); },
  async restoreScholarship() { throw unavailable(); },
  async listReadiness() { throw unavailable(); }, async getReadiness() { throw unavailable(); },
  async listReleaseManifests() { throw unavailable(); }, async getReleaseManifest() { throw unavailable(); },
  async createReleaseManifest() { throw unavailable(); }, async supersedeReleaseManifest() { throw unavailable(); },
};
const guestOnlyAuthRepository = { async findActiveSessionByTokenHash() { return null; } };

export function createCatalogAdminRouteHandlers(service: CatalogAdminHttpService = unavailableService) {
  return createCatalogAdminHttpHandlers(service, guestOnlyAuthRepository);
}

export function getCatalogAdminRouteHandlers() {
  try {
    const client = createTransactionalSqlClient(getSharedPostgresPool());
    const service = new CatalogAdminService(new PostgresCatalogAdminRepository(client), new PostgresAuditWriter(client));
    return createCatalogAdminHttpHandlers(service, new PostgresAuthSessionRepository(client));
  } catch { return createCatalogAdminRouteHandlers(); }
}

function unavailable() { return serviceUnavailable("Catalog management repository is not configured."); }
