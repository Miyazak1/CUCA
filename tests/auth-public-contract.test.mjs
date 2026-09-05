import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public account page uses real Auth APIs without browser-owned authentication state", async () => {
  const [html, script, shell] = await Promise.all([
    source("public/auth.html"),
    source("public/auth.js"),
    source("public/shared-shell.js"),
  ]);

  for (const endpoint of ["/api/v1/auth/sessions", "/api/v1/auth/register", "/api/v1/auth/password-reset", "/api/v1/auth/email-verification", "/api/v1/me"]) {
    assert.match(script, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(script, /credentials:\s*"same-origin"/);
  assert.match(script, /selectedSurface:\s*roleProfiles\[currentRole\]\.requestSurface/);
  assert.match(script, /"cuac_admin"/);
  assert.match(script, /requiredRole === "cuac_admin"/);
  assert.match(script, /safeLocalUrl/);
  assert.match(script, /sign-in-continuations\/\$\{encodeURIComponent\(capability\.continuationId\)\}\/consume/);
  assert.match(script, /window\.history\.replaceState/);
  assert.doesNotMatch(script, /cuacAuthDemoState|cuacAuthContinuationDemoState|localStorage|sessionStorage/);
  assert.match(html, /data-auth-school-id/);
  assert.match(html, /data-auth-role="ops">CUAC staff<\/button>/);
  assert.match(html, /data-register-password[^>]+minlength="15"/);
  assert.doesNotMatch(html, /Keep me signed in|Study goal|social-auth|Agent context|Agent conversations/);

  assert.match(shell, /fetch\("\/api\/v1\/me"/);
  assert.match(shell, /fetch\("\/api\/v1\/auth\/logout"/);
  assert.match(shell, /runtimeAuthState/);
  assert.match(shell, /fetch\("\/api\/v1\/auth\/guest-session"/);
  assert.match(shell, /fetch\("\/api\/v1\/auth\/sign-in-continuations"/);
  assert.match(shell, /navigation\.open_student_workspace/);
  assert.doesNotMatch(shell, /cuacAuthDemoState|cuacAuthContinuationDemoState|approved-preview|readStoredAuthState/);
});

test("email action pages clear fragment credentials and submit only explicit POST bodies", async () => {
  const [client, verifyPage, resetPage] = await Promise.all([
    source("app/auth/action-client.tsx"),
    source("app/auth/verify-email/page.tsx"),
    source("app/auth/reset-password/page.tsx"),
  ]);

  assert.match(client, /window\.location\.hash\.slice\(1\)/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /verificationToken:\s*credential\.token/);
  assert.match(client, /resetToken:\s*credential\.token/);
  assert.match(client, /newPassword/);
  assert.match(client, /method:\s*"POST"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|console\./);
  assert.match(verifyPage, /AuthActionClient kind="verify"/);
  assert.match(resetPage, /AuthActionClient kind="reset"/);
});
