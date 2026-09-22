import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  requireReleaseCapability,
  resolveReleaseCapabilities,
} from "../../../src/server/index.ts";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";

test("school-handoff capability manifest exposes the current release boundary", () => {
  const manifest = resolveReleaseCapabilities({ CUAC_ENV: "production", CUAC_RELEASE_SCOPE: "school-handoff-v1" });
  assert.deepEqual(manifest, {
    version: "cuac.release-capabilities.v1",
    releaseScope: "school-handoff-v1",
    enabled: {
      publicCatalog: true,
      siteSearch: true,
      studentAccounts: true,
      savedItems: true,
      applicationPlanning: true,
      schoolHandoff: true,
      agent: false,
      payment: false,
      studentFiles: false,
      officialMaterialSubmission: false,
    },
  });
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.enabled), true);
});

test("deployed capability resolution fails closed for a missing or unknown scope", () => {
  for (const CUAC_RELEASE_SCOPE of [undefined, "", "future-release"]) {
    assert.throws(
      () => resolveReleaseCapabilities({ CUAC_ENV: "production", CUAC_RELEASE_SCOPE }),
      error => error.status === 503 && error.code === "SERVICE_UNAVAILABLE",
    );
  }
});

test("local and test processes default to the safe school-handoff scope", () => {
  for (const CUAC_ENV of [undefined, "development", "test"]) {
    assert.equal(resolveReleaseCapabilities({ CUAC_ENV }).releaseScope, "school-handoff-v1");
  }
});

test("capability checks block deferred features and allow full-platform only when explicit", () => {
  assert.throws(
    () => requireReleaseCapability("payment", { CUAC_ENV: "production", CUAC_RELEASE_SCOPE: "school-handoff-v1" }),
    error => error.status === 503 && error.details.capability === "payment",
  );
  assert.equal(
    requireReleaseCapability("payment", { CUAC_ENV: "production", CUAC_RELEASE_SCOPE: "full-platform" }).releaseScope,
    "full-platform",
  );
});

test("shared HTTP boundary rejects a disabled capability before business code", async () => {
  let called = 0;
  const route = secureApiRoute("GET", async () => { called += 1; return Response.json({ ok: true }); }, {
    env: { CUAC_ENV: "production", CUAC_RELEASE_SCOPE: "school-handoff-v1" },
    capability: "agent",
  });
  const response = await route(new Request("https://cuac.test/api/v1/agent/memories"));
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error.details.capability, "agent");
  assert.equal(called, 0);
});

test("every deferred route declares its server-enforced release capability", async () => {
  const groups = {
    agent: [
      "agent/context/candidates", "agent/context/carry-forward", "agent/memories", "agent/memories/[memoryId]",
      "agent/memories/clear", "agent/memory-settings",
    ],
    payment: [
      "billing/checkout-intents", "billing/fee-preview", "billing/invoices/[invoiceId]", "billing/provider-events",
      "ops/billing/provider-events", "ops/billing/provider-events/[eventId]/review-claim",
      "ops/billing/provider-events/[eventId]/review-escalation", "ops/billing/provider-events/[eventId]/review-resolution",
    ],
    studentFiles: [
      "student/files", "student/files/[fileId]/complete", "student/files/[fileId]/delete", "student/files/[fileId]/download",
    ],
    officialMaterialSubmission: [
      "student/application-sets/[applicationSetId]/submit",
      "student/application-sets/[applicationSetId]/choices/[choiceId]/material-preview",
      "student/application-sets/[applicationSetId]/choices/[choiceId]/material-selection",
      "student/application-sets/[applicationSetId]/choices/[choiceId]/material-snapshot",
      "student/application-sets/[applicationSetId]/choices/[choiceId]/submission-authorization",
      "ops/routing/submissions", "ops/routing/submissions/[outboxId]/review-claim",
      "ops/routing/submissions/[outboxId]/review-close", "ops/routing/submissions/[outboxId]/review-escalation",
      "ops/routing/submissions/[outboxId]/review-retry",
    ],
  };
  for (const [capability, routes] of Object.entries(groups)) {
    for (const route of routes) {
      const source = await readFile(new URL(`../../../app/api/v1/${route}/route.ts`, import.meta.url), "utf8");
      assert.match(source, new RegExp(`capability:\\s*"${capability}"`), route);
    }
  }
});
