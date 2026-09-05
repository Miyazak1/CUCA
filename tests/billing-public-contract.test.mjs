import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("billing API page reads only the authenticated server invoice", async () => {
  const [html, script] = await Promise.all([
    source("public/billing-api.html"),
    source("public/billing-runtime.js"),
  ]);

  assert.match(html, /billing-workspace\.css\?v=/);
  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /src="shared-shell\.js"/);
  assert.match(html, /src="billing-runtime\.js\?v=/);
  assert.doesNotMatch(html, /completion\.js|completion\.css|cuac-data\.js|cuac-actions\.js|data-cuac-agent/);
  assert.match(script, /\/api\/v1\/billing\/invoices\/\$\{encodeURIComponent\(invoiceId\)\}/);
  assert.match(script, /credentials: "same-origin"/);
  assert.match(script, /cache: "no-store"/);
  assert.match(script, /requiredRole: "student"/);
  assert.doesNotMatch(script, /paymentMethod|cardNumber|lastFour|providerCheckoutSessionId|localStorage/);
});

test("billing page renders exactly the checkout status DTO fields", async () => {
  const script = await source("public/billing-runtime.js");

  for (const field of [
    "invoiceId",
    "applicationSetId",
    "cuacId",
    "invoiceStatus",
    "checkoutSessionId",
    "status",
    "amount",
    "paidAt",
    "canceledAt",
    "refundedAt",
  ]) {
    assert.ok(script.includes(`invoice.${field}`), `missing checkout status field: ${field}`);
  }
  for (const status of ["requires_payment", "succeeded", "canceled", "refunded"]) {
    assert.ok(script.includes(status), `missing checkout status: ${status}`);
  }
  assert.match(script, /No payment status has been assumed/);
  assert.match(script, /\^CUAC-\[0-9\]\{4\}-\[0-9\]\{6\}\$/);
  assert.match(script, /typeof value\.checkoutSessionId !== "string"/);
  assert.match(script, /billing-api\.html\?invoice=\$\{encodeURIComponent\(invoiceId\)\}/);
  assert.doesNotMatch(script, /Math\.random|setTimeout|simulate|mock|demo/i);
});

test("billing workspace is restrained, accessible, and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/billing-api.html"),
    source("public/billing-workspace.css"),
  ]);

  assert.match(html, /aria-live="polite" data-billing-view/);
  assert.match(html, /aria-label="Refresh payment status"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
