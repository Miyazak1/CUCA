import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("application profile UI reads and writes the canonical private student records", async () => {
  const [html, script] = await Promise.all([
    source("public/application.html"),
    source("public/application.js"),
  ]);

  for (const endpoint of [
    "/api/v1/student/applicant-profile",
    "/api/v1/student/education-records",
    "/api/v1/student/assessment-records",
    "/api/v1/student/files",
  ]) {
    assert.match(script, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  for (const field of [
    "fullName",
    "contactEmail",
    "citizenshipCountry",
    "institutionName",
    "institutionCountry",
    "educationLevel",
    "attendanceStatus",
    "assessmentCategory",
    "assessmentName",
    "resultStatus",
    "resultForm",
    "components",
  ]) {
    assert.match(`${html}\n${script}`, new RegExp(`\\b${field}\\b`));
  }

  assert.match(script, /expectedRevision:\s*applicantProfileRecord\?\.revision \|\| 0/);
  assert.match(script, /expectedRevision:\s*educationHistoryRecord\.revision/);
  assert.match(script, /expectedRevision:\s*assessmentHistoryRecord\.revision/);
  assert.match(script, /function isApplicantRecordReady\(profile = applicantProfileRecord\)/);
  assert.match(script, /profile\?\.revision > 0/);
  assert.doesNotMatch(script, /function isStudentProfileReady\(profile = getStudentProfile\(\)\)/);
  assert.match(script, /error\.status === 409/);
  assert.match(html, /data-education-record-form/);
  assert.match(html, /data-assessment-record-form/);
  assert.match(script, /data-edit-education-record/);
  assert.match(html, /data-cancel-education-edit/);
  assert.match(script, /data-edit-assessment-record/);
  assert.match(html, /data-assessment-component-list|data-cancel-assessment-edit/);
  assert.match(script, /method:\s*recordId \? "PATCH" : "POST"/);
  assert.match(script, /assessmentComponentsFromForm/);
});

test("application profile UI cannot infer private records or permanent submission consent", async () => {
  const [html, script] = await Promise.all([
    source("public/application.html"),
    source("public/application.js"),
  ]);
  const combined = `${html}\n${script}`;

  for (const legacy of [
    "Maya Chen",
    "maya@example.com",
    "Taylor's University",
    "schoolInfoConsent",
    "cuacOnboardingPreview",
    "cuacAuthDemoState",
    "passportReady",
    "transcriptReady",
    "fundingIntent",
    "budgetRange",
    "academicSummary",
  ]) {
    assert.doesNotMatch(combined, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(html, /data-submit-consent|type="checkbox"[^>]*checked|profile-document-matrix/);
  assert.match(script, /function isSubmissionAuthorizationReady\(\)[\s\S]+choices\.every[\s\S]+submissionAuthorization\?\.current === true[\s\S]+materialSnapshot\?\.current === true/);
  assert.match(script, /complete server material selection, preflight and per-choice authorization/);
  assert.match(html, /Nothing here creates permanent account-level consent/);
});

test("application material envelopes use exact choice-bound server evidence", async () => {
  const [html, script] = await Promise.all([
    source("public/application.html"),
    source("public/application.js"),
  ]);

  for (const route of [
    "material-selection",
    "material-preview",
    "preflight",
    "submission-authorization",
    "material-snapshot",
    "application_disclosure",
  ]) assert.match(script, new RegExp(route));

  for (const field of [
    "expectedMaterialSelectionRevision",
    "expectedVersions",
    "expectedNotice",
    "expectedPolicy",
    "materialContentSha256",
    "expectedAuthorizationScopeSha256",
    "expectedMaterialContentSha256",
  ]) assert.match(script, new RegExp(`\\b${field}\\b`));

  assert.match(script, /share_selected_application_materials_with_target_school/);
  assert.match(script, /preview\.contentSha256 !== state\.preview\?\.contentSha256/);
  assert.match(script, /notice\.contentSha256 !== priorNotice\.contentSha256/);
  assert.match(script, /policy\.documentSha256 !== priorPolicy\.documentSha256/);
  assert.match(script, /method:\s*"DELETE"[\s\S]+authorizationId/);
  assert.match(script, /Saving or previewing does not authorize disclosure/);
  assert.match(html, /data-material-choice-tabs/);
  assert.match(html, /data-material-envelope-workspace/);
  assert.doesNotMatch(`${html}\n${script}`, /accountLevelConsent|globalSubmissionConsent|authorizationReady\s*=\s*true/);
});

test("private file UI follows upload intent, integrity, scan and owner actions", async () => {
  const [html, script] = await Promise.all([
    source("public/application.html"),
    source("public/application.js"),
  ]);
  assert.match(html, /data-private-file-upload-form/);
  assert.match(html, /PDF, JPG, PNG or DOCX/);
  assert.match(script, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(script, /Idempotency-Key[\s\S]+student_file_upload/);
  assert.match(script, /pending_scan/);
  assert.match(script, /status === "clean"/);
  assert.match(script, /\/complete/);
  assert.match(script, /\/download/);
  assert.match(script, /\/delete/);
  assert.match(html, /Only server scan results can mark a file clean/);
});

test("application billing and final submission use server-authoritative contracts", async () => {
  const [html, script] = await Promise.all([
    source("public/application.html"),
    source("public/application.js"),
  ]);
  const combined = `${html}\n${script}`;

  for (const endpoint of [
    "/api/v1/billing/fee-preview",
    "/api/v1/billing/checkout-intents",
    "/api/v1/billing/invoices/",
    "/api/v1/auth/step-up",
    "/submit",
  ]) assert.match(script, new RegExp(endpoint.replaceAll("/", "\\/")));

  assert.match(script, /function currentApplicationChoiceIds\(\)[\s\S]+\.sort\(\)/);
  assert.match(script, /applicationChoiceIds:\s*currentApplicationChoiceIds\(\)/);
  assert.match(script, /checkoutUrl\.protocol !== "https:"/);
  assert.match(script, /status\.status === "succeeded"[\s\S]+refreshAllChoicePreflights/);
  assert.match(script, /billingEntitlement\?\.current === true/);
  assert.match(script, /body:\s*\{ expectedRevision: currentApplicationSet\.revision, choiceIds, confirmSubmission: true \}/);
  assert.match(script, /acceptanceScope !== "cuac_internal"/);
  assert.match(html, /type="password"[^>]+autocomplete="current-password"/);
  assert.match(html, /Card and bank credentials never enter this application/);
  assert.match(html, /CUAC internal acceptance/);

  for (const forbidden of [
    "paid-demo",
    "free-submitted",
    "processing-demo",
    "mock-cuac",
    "startPaymentSimulation",
    "paymentSimulationTimer",
    "data-complete-payment",
    "data-payment-fail",
    "cardNumber",
    "cvv",
  ]) assert.doesNotMatch(combined, new RegExp(forbidden));
});
