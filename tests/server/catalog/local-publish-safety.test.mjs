import assert from "node:assert/strict";
import test from "node:test";
import { createLocalDevelopmentState } from "../../../scripts/lib/local-development.ts";
import { LOCAL_CATALOG_PUBLISH_CONFIRMATION, assertLocalCatalogPublishTarget } from "../../../src/server/index.ts";

const review = "product-owner-chat-approval-2026-09-10";
const state = createLocalDevelopmentState({
  postgresImageId: `sha256:${"a".repeat(64)}`,
  postgresPort: 62251,
  applicationPort: 52118,
  now: new Date("2026-09-10T09:00:00.000Z"),
  bytes: () => Buffer.alloc(32, 7),
  uuid: (() => {
    const values = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    return () => values.shift();
  })(),
});
const bundle = {
  version: 2,
  generatedAt: "2026-09-10T09:00:00.000Z",
  handoff: {
    sourceSystem: "official", cleanedExportName: "official-sources.json",
    cleanedExportSha256: "a".repeat(64), sourceSchemaSha256: "b".repeat(64),
    reviewReference: review, prohibitedDataReviewReference: review,
    approvalRecordedAt: "2026-09-10T09:00:00.000Z", sourceReadOnly: true,
    prohibitedDataConfirmedExcluded: true,
  },
};

test("local catalog publication accepts only the generated CUAC local target and matching review", () => {
  const result = assertLocalCatalogPublishTarget(state, bundle, LOCAL_CATALOG_PUBLISH_CONFIRMATION, review);
  assert.deepEqual(result.publicTarget, {
    hostname: "127.0.0.1", port: 62251, databaseName: "cuac_local", databaseUser: "cuac_local",
    postgresContainer: "cuac-pg-local", postgresVolume: "cuac-pg-local-data-v1",
  });
  assert.match(result.databaseUrl, /^postgresql:\/\/cuac_local:/);
});

test("local catalog publication rejects missing confirmation, unreviewed bundles and mismatched reviews", () => {
  assert.throws(() => assertLocalCatalogPublishTarget(state, bundle, undefined, review));
  assert.throws(() => assertLocalCatalogPublishTarget(state, { ...bundle, version: 1 }, LOCAL_CATALOG_PUBLISH_CONFIRMATION, review));
  assert.throws(() => assertLocalCatalogPublishTarget(state, bundle, LOCAL_CATALOG_PUBLISH_CONFIRMATION, "another-review"));
  assert.throws(() => assertLocalCatalogPublishTarget({ ...state, databaseName: "other" }, bundle, LOCAL_CATALOG_PUBLISH_CONFIRMATION, review));
});
