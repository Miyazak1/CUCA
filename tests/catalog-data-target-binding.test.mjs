import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateCatalogTargetBinding } from "../scripts/lib/catalog-data-candidate-runtime.ts";

const candidate = JSON.parse(await readFile(new URL("../work/catalog-quality/catalog-data-release-candidate.json", import.meta.url), "utf8"));
const valid = {
  version: 1,
  environment: "staging",
  databaseName: "cuac_staging",
  databaseUser: "cuac_migrator",
  databaseHost: "db.internal.example",
  tlsCertificateSha256: "a".repeat(64),
  confirmationTokenSha256: "b".repeat(64),
  readinessPlanSha256: candidate.readinessPlanSha256,
  operationsSha256: candidate.hashes.operationsSha256,
  preimageSha256: candidate.hashes.preimageSha256,
  migrationMode: "non_public_draft_and_archive_only",
  publicationAuthorized: false,
};

test("catalog target binding accepts an exact non-public staging identity", () => {
  assert.deepEqual(validateCatalogTargetBinding(candidate, valid), { ok: true, errors: [] });
});

test("catalog target binding rejects production, hash drift, missing TLS and publication", () => {
  const report = validateCatalogTargetBinding(candidate, { ...valid, environment: "production", operationsSha256: "c".repeat(64), tlsCertificateSha256: "", publicationAuthorized: true });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(value => value.includes("only to staging")));
  assert.ok(report.errors.some(value => value.includes("TLS")));
  assert.ok(report.errors.some(value => value.includes("hashes")));
  assert.ok(report.errors.some(value => value.includes("must not authorize publication")));
});
