import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("student application choices use server-owned application sets and exact published intakes", async () => {
  const [html, script] = await Promise.all([
    source("public/application.html"),
    source("public/application.js"),
  ]);

  assert.match(script, /applicationApi\("\/api\/v1\/student\/application-sets"/);
  assert.match(script, /applicationApi\(`\/api\/v1\/catalog\/programs\/\$\{encodeURIComponent\(programId\)\}`\)/);
  assert.match(script, /\/api\/v1\/student\/application-sets\/\$\{encodeURIComponent\(currentApplicationSet\.id\)\}\/choices/);
  assert.match(script, /\/choice-order/);
  assert.match(script, /method:\s*"DELETE"/);
  assert.match(script, /credentials:\s*"same-origin"/);
  assert.match(script, /programIntakeId:\s*selected\.programIntakeId/);
  assert.match(script, /data-program-intake-id=/);
  assert.match(script, /data-choice-id=/);
  assert.match(script, /"Idempotency-Key":\s*applicationIdempotencyKey\("application_set_create"\)/);
  assert.match(script, /"Idempotency-Key":\s*applicationIdempotencyKey\("application_choice_add"\)/);

  assert.match(html, /<select name="intake" data-intake-select required><\/select>/);
  assert.match(html, /data-application-runtime-message/);
  assert.match(html, /<body data-agent-mode="off">/);
  assert.match(html, /<select name="degree" data-degree-select disabled>/);
  assert.match(html, /<select name="university" data-university-select disabled>/);
  assert.match(html, /<select name="program" data-program-select disabled><\/select>/);
  assert.match(html, /href="hub-api\.html"/);
  assert.match(html, /href="favourites-api\.html"/);
  assert.match(html, /href="billing-api\.html"/);
  assert.match(script, /let programCatalog = \{\};/);
  assert.match(script, /detail\.id !== programId \|\| detail\.schoolId !== summary\.schoolId/);
  assert.match(script, /routeParams\.get\("invoiceId"\)/);
  assert.match(script, /\/api\/v1\/billing\/invoices\/\$\{encodeURIComponent\(invoiceLocator\)\}/);
  assert.match(script, /requestedInvoice\.applicationSetId !== directApplicationSetLocator/);
  assert.match(script, /savePendingInvoiceLocator\(requestedInvoice\)/);
  assert.match(script, /Controlled by the per-choice material envelope/);
  assert.doesNotMatch(html, /data-choice="\d+"/);
  assert.doesNotMatch(html, /data-school-id="10\d"|Fall 2026<\/option>|Zhejiang University|Nanjing University|UIBE|Fudan University|Tongji University/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|data-cuac-agent/);
  assert.doesNotMatch(html, /href="(?:hub|favourites|billing)\.html"/);
  assert.doesNotMatch(html, /USD 0|Fall 20\d{2}/);
  assert.doesNotMatch(script, /CuacDataClient|cuac:agent-action|cuac:agent-undo|Nanjing University|Fudan University|Tongji University/);
  assert.doesNotMatch(script, /Fall 20\d{2}|schoolScholarships|Transcript, passport scan, certificates/);
});

test("application lifecycle state cannot fall back to browser demo storage", async () => {
  const script = await source("public/application.js");

  for (const legacy of [
    "APPLICATION_DEMO_STATE_KEY",
    "cuacApplicationDemoState",
    "persistApplicationDemoState",
    "readApplicationDemoState",
    "writeApplicationDemoState",
    "handleAgentAction",
    "captureApplicationState",
    "restoreApplicationState",
  ]) {
    assert.doesNotMatch(script, new RegExp(legacy));
  }
  assert.match(script, /isStudentSignedIn/);
  assert.match(script, /applicationRuntimeState = "auth_required"/);
  assert.match(script, /refreshCurrentApplicationSet/);
});
