import assert from "node:assert/strict";
import test from "node:test";
import { assertDisposableCatalogImportTarget } from "../../../src/server/index.ts";

test("catalog import accepts only an explicitly acknowledged loopback rehearsal database", () => {
  assert.deepEqual(assertDisposableCatalogImportTarget({
    CUAC_CATALOG_IMPORT_TARGET: "disposable",
    DATABASE_URL: "postgresql://cuac_rehearsal:synthetic@127.0.0.1:5432/cuac_catalog_rehearsal_a1b2",
  }), { hostname: "127.0.0.1", databaseName: "cuac_catalog_rehearsal_a1b2" });
});

test("catalog import rejects persistent local, remote, ambiguous and option-bearing targets", () => {
  for (const env of [
    { DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/cuac_local" },
    { CUAC_CATALOG_IMPORT_TARGET: "disposable", DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/cuac_local" },
    { CUAC_CATALOG_IMPORT_TARGET: "disposable", DATABASE_URL: "postgresql://user:secret@db.example.invalid:5432/cuac_catalog_rehearsal_x" },
    { CUAC_CATALOG_IMPORT_TARGET: "disposable", DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/cuac_catalog_rehearsal_x" },
    { CUAC_CATALOG_IMPORT_TARGET: "disposable", DATABASE_URL: "postgresql://cuac_rehearsal:secret@localhost:5432/cuac_catalog_rehearsal_x" },
    { CUAC_CATALOG_IMPORT_TARGET: "disposable", DATABASE_URL: "postgresql://user:secret@127.0.0.1:5432/cuac_catalog_rehearsal_x?sslmode=disable" },
  ]) {
    assert.throws(() => assertDisposableCatalogImportTarget(env));
  }
});
