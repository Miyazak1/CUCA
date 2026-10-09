import { cache } from "react";
import { createSqlCatalogClient, getSharedPostgresPool } from "../db/postgres-client.ts";
import { PostgresCatalogRepository } from "./postgres-repository.ts";
import type { PublicGuideDto } from "./dto.ts";

function repository() {
  return new PostgresCatalogRepository(createSqlCatalogClient(getSharedPostgresPool()));
}

export const listPublishedGuidePages = cache(async (): Promise<PublicGuideDto[]> => {
  return repository().listGuides({ limit: 100, offset: 0 });
});
export const getPublishedGuidePage = cache(async (slug: string): Promise<PublicGuideDto | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return repository().getGuide(slug);
});
