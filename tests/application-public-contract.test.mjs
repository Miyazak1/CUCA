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
  assert.match(script, /const APPLICATION_PAYMENT_ENABLED = false/);
  assert.match(html, /data-application-step="payment"[^>]*hidden/);
  assert.match(html, /data-fee-card hidden/);
  assert.match(script, /let programCatalog = \{\};/);
  assert.match(script, /detail\.id !== programId \|\| \(summary && detail\.schoolId !== summary\.schoolId\)/);
  assert.match(script, /routeParams\.get\("invoiceId"\)/);
  assert.match(script, /\/api\/v1\/billing\/invoices\/\$\{encodeURIComponent\(invoiceLocator\)\}/);
  assert.match(script, /requestedInvoice\.applicationSetId !== directApplicationSetLocator/);
  assert.match(script, /renderApplicationSetSwitcher\(sets, selected\?\.id \|\| ""\)/);
  assert.match(script, /data-choice-availability=/);
  assert.match(script, /replace or remove unavailable program choices/);
  assert.match(script, /Promise\.allSettled\(\[ensureProgramDetail\(programId\), ensureProgramIntakes\(programId\)\]\)/);
  assert.match(script, /submittedToSchools \|\| !blockers\.length/);
  assert.match(script, /statusLink\.href = applicationSetHref\(currentApplicationSet, "#send"\)/);
  assert.match(script, /if \(submittedToSchools\) \{\s*await loadSchoolProgress\(\);\s*renderSubmissionState\(\);/);
  assert.match(script, /\/school-handoff/);
  assert.match(script, /\/school-progress/);
  assert.match(script, /studentSchoolStatusLabels/);
  assert.match(script, /Send materials directly to the school/);
  assert.match(script, /confirmHandoff:\s*true/);
  assert.match(script, /materialsShared !== false/);
  assert.match(script, /paymentRequired !== false/);
  assert.match(html, /Confirm and send to schools/);
  assert.match(html, /No application materials or payment details were shared/);
  assert.match(script, /prefillChoiceFromRoute\(routeParams\)/);
  assert.match(script, /catalogProgramsById\.set\(programId, summary\)/);
  assert.match(script, /program = await ensureProgramDetail\(programId\)/);
  assert.match(html, /data-application-set-switcher/);
  assert.match(script, /savePendingInvoiceLocator\(requestedInvoice\)/);
  assert.match(script, /Controlled by the per-choice material envelope/);
  assert.match(script, /appProgramCity\(\{ \.\.\.\(program \|\| \{\}\), school, city: school\.cityZh \|\| school\.city \|\| program\?\.city \}\)/);
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
