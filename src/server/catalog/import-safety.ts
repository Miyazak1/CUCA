export type CatalogImportEnvironment = Record<string, string | undefined>;

export type DisposableCatalogImportTarget = {
  hostname: string;
  databaseName: string;
};

export function assertDisposableCatalogImportTarget(env: CatalogImportEnvironment): DisposableCatalogImportTarget {
  if (env.CUAC_CATALOG_IMPORT_TARGET !== "disposable") {
    throw new Error("Catalog import requires CUAC_CATALOG_IMPORT_TARGET=disposable.");
  }

  const rawUrl = env.DATABASE_URL || env.POSTGRES_URL || env.PG_DATABASE_URL;
  if (!rawUrl) throw new Error("Catalog import requires a PostgreSQL URL.");

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error("Catalog import target must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error("Catalog import target must use PostgreSQL.");
  }
  if (target.search || target.hash) {
    throw new Error("Catalog import target must not contain query parameters or fragments.");
  }
  if (!["127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("Catalog import is restricted to a loopback-only disposable database.");
  }
  if (decodeURIComponent(target.username) !== "cuac_rehearsal") {
    throw new Error("Catalog import requires the dedicated cuac_rehearsal database role.");
  }
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!/^cuac_(?:catalog_)?rehearsal_[a-z0-9_]+$/.test(databaseName)) {
    throw new Error("Catalog import database name must use the cuac_rehearsal_ or cuac_catalog_rehearsal_ prefix.");
  }

  return { hostname: target.hostname, databaseName };
}
