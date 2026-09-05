import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("Ops API workspace uses only authenticated server capabilities", async () => {
  const [html, script] = await Promise.all([
    source("public/ops-admin-api.html"),
    source("public/ops-admin-runtime.js"),
  ]);

  assert.match(html, /ops-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js"/);
  assert.match(html, /src="ops-admin-runtime\.js\?v=/);
  assert.doesNotMatch(html, /completion\.js|completion\.css|cuac-data\.js|cuac-actions\.js|data-cuac-agent/);

  for (const endpoint of [
    "/api/v1/ops/operations/summary",
    "/api/v1/ops/routing/submissions?limit=50",
    "/api/v1/ops/billing/provider-events?limit=50",
    "/api/v1/ops/data-quality/catalog?limit=50",
    "/api/v1/ops/catalog-corrections?limit=50",
    "/api/v1/ops/support-sessions",
    "/api/v1/ops/application-lookups",
  ]) {
    assert.ok(script.includes(endpoint), `missing real Ops endpoint: ${endpoint}`);
  }
  assert.match(script, /\["cuac_ops", "cuac_admin"\]\.includes\(auth\.role\)/);
  assert.match(script, /credentials: "same-origin"/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|DemoState|Sample record/);
});

test("Ops write controls preserve backend revision and evidence boundaries", async () => {
  const script = await source("public/ops-admin-runtime.js");

  assert.match(script, /const body = \{ expectedRevision: revision \}/);
  assert.match(script, /body\.reference = cleanText\(values\.get\("reference"\)\)/);
  assert.match(script, /body\.reviewDueAt = new Date\(due\)\.toISOString\(\)/);
  assert.match(script, /review-claim/);
  assert.match(script, /review-escalation/);
  assert.match(script, /review-close/);
  assert.match(script, /review-retry/);
  assert.match(script, /review-resolution/);
  assert.match(script, /catalog-corrections\/\$\{encodeURIComponent\(target\)\}\/\$\{suffix\}/);
  assert.match(script, /applied_unverified/);
  assert.match(script, /rejected_unverifiable/);
  assert.match(script, /provider_not_accepted_retry_approved/);
  assert.doesNotMatch(script, /actorUserId|assignedUserId\s*:|paymentStatus\s*:|payloadSha256\s*:/);

  assert.match(script, /pagehide/);
  assert.match(script, /method: "DELETE"/);
  assert.match(script, /opsState\.supportSession = null/);
  assert.doesNotMatch(script, /studentUserId|contactEmail|passport|fileName|objectKey/);
});

test("Ops workspace stays restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/ops-admin-api.html"),
    source("public/ops-workspace.css"),
  ]);

  assert.match(html, /role="tablist"/);
  assert.match(html, /data-ops-view aria-live="polite"/);
  assert.match(css, /button:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
