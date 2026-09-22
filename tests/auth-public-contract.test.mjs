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

  for (const endpoint of ["/api/v1/auth/sessions", "/api/v1/auth/register", "/api/v1/auth/password-reset", "/api/v1/auth/email-verification", "/api/v1/auth/mfa/enrollment", "/api/v1/auth/mfa/complete", "/api/v1/me"]) {
    assert.match(script, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(script, /credentials:\s*"same-origin"/);
  assert.match(shell, /actor\.accountEmail/);
  assert.match(shell, /actor\.accountEmailVerified/);
  assert.match(shell, /Registered account email/);
  assert.match(script, /body:\s*\{ email, password \}/);
  assert.match(script, /workspaceSelectionRequired/);
  assert.match(script, /dataset\.workspaceIndex/);
  assert.match(script, /selectedSurface:\s*workspace\.selectedSurface/);
  assert.match(script, /"cuac_admin"/);
  assert.match(script, /requiredRole === "cuac_admin"/);
  assert.match(script, /safeLocalUrl/);
  assert.match(script, /sign-in-continuations\/\$\{encodeURIComponent\(capability\.continuationId\)\}\/consume/);
  assert.match(script, /catalog\.save_program/);
  assert.match(script, /catalog\.save_school/);
  assert.match(script, /catalog\.save_scholarship/);
  assert.match(script, /completeConsumedContinuation/);
  assert.match(script, /window\.history\.replaceState/);
  assert.doesNotMatch(script, /cuacAuthDemoState|cuacAuthContinuationDemoState|localStorage|sessionStorage/);
  assert.match(html, /data-workspace-picker/);
  assert.match(html, /data-auth-panel="mfa"/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /data-mfa-recovery-codes/);
  assert.match(script, /mfaRequired/);
  assert.match(script, /recoveryCodes/);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
  assert.match(script, /data-workspace-index/);
  assert.doesNotMatch(html, /data-auth-school-id|data-auth-role|data-reset-account-type/);
  assert.match(html, /One CUAC account/);
  assert.match(html, /data-register-password[^>]+minlength="15"/);
  assert.doesNotMatch(html, /Keep me signed in|Study goal|social-auth|Agent context|Agent conversations/);

  assert.match(shell, /fetch\("\/api\/v1\/me"/);
  assert.match(shell, /fetch\("\/api\/v1\/auth\/logout"/);
  assert.match(shell, /runtimeAuthState/);
  assert.match(shell, /authStrength: actor\.authStrength === "step_up"/);
  assert.match(shell, /mode === "ops"/);
  assert.match(shell, /描述需要检查的运营风险/);
  assert.match(shell, /runtimeAuthReadyPromise\.finally\(initAgentShell\)/);
  assert.match(shell, /fetch\("\/api\/v1\/auth\/guest-session"/);
  assert.match(shell, /fetch\("\/api\/v1\/auth\/sign-in-continuations"/);
  assert.match(shell, /navigation\.open_student_workspace/);
  assert.match(shell, /requireStudentSignedInReady/);
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
  assert.match(client, /type AuthLocale = "en" \| "vi" \| "th" \| "id" \| "ms" \| "ar"/);
  assert.match(client, /document\.documentElement\.dir = localeMeta\[resolvedLocale\]\.dir/);
  assert.match(client, /document\.title = `\$\{translate\(resolvedLocale/);
  assert.match(client, /url\.searchParams\.set\("lang", locale\)/);
  assert.match(client, /translate\(locale, message\)/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|console\./);
  assert.match(verifyPage, /AuthActionClient kind="verify"/);
  assert.match(resetPage, /AuthActionClient kind="reset"/);
});

test("public account entry supports bounded student locales without translating account data", async () => {
  const [html, messages, script] = await Promise.all([
    source("public/auth.html"),
    source("public/auth-i18n.js"),
    source("public/auth.js"),
  ]);
  assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("auth-i18n.js"));
  assert.ok(scripts.indexOf("auth-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("auth.js"));
  for (const marker of ["Đăng nhập", "เข้าสู่ระบบ", "Masuk", "Log masuk", "تسجيل الدخول"]) assert.match(messages, new RegExp(marker));
  assert.match(messages, /url\.searchParams\.set\("lang", i18n\.locale\)/);
  assert.match(messages, /document\.createTreeWalker/);
  assert.match(script, /authUi\(workspace\.selectedSurface/);
  assert.match(script, /authUi\(verificationMessage\)/);
  assert.match(script, /authI18n\?\.href\(destination\)/);
  assert.doesNotMatch(script, /authUi\(workspace\.label\)|authUi\(email\)|authUi\(firstName\)|authUi\(lastName\)/);
});

test("registration requires age eligibility and provides a one-time guardian approval page", async () => {
  const [html, script, guardianHtml, guardianScript, guardianMessages] = await Promise.all([
    source("public/auth.html"), source("public/auth.js"),
    source("public/auth-guardian-consent.html"), source("public/auth-guardian-consent.js"),
    source("public/auth-guardian-consent-i18n.js"),
  ]);
  assert.match(html, /data-register-age-band required/);
  assert.match(html, /data-guardian-fields hidden/);
  assert.match(script, /ageBand === "under_14"/);
  assert.match(script, /guardianConsentRequired/);
  assert.match(guardianHtml, /children's privacy notice/i);
  assert.match(guardianHtml, /data-i18n-locales="en,vi,th,id,ms,ar"/);
  assert.match(guardianMessages, /النسخة الإنجليزية/);
  assert.match(guardianHtml, /href="\/children-privacy\.html" hreflang="en"/);
  assert.match(guardianScript, /guardianUi\(message\)/);
  assert.match(guardianScript, /window\.history\.replaceState/);
  assert.match(guardianScript, /guardian-consent\/\$\{action\}/);
  assert.doesNotMatch(guardianScript, /localStorage|sessionStorage|console\./);
});

test("school invitation action separates new staff activation from explicit existing-account binding", async () => {
  const [client, page, route] = await Promise.all([
    source("app/auth/school-invite/school-invite-client.tsx"),
    source("app/auth/school-invite/page.tsx"),
    source("app/api/v1/auth/school-invites/[inviteId]/activate/route.ts"),
  ]);

  assert.match(client, /window\.location\.hash\.slice\(1\)/);
  assert.match(client, /window\.history\.replaceState/);
  assert.match(client, /\/api\/v1\/auth\/school-invites\/\$\{encodeURIComponent\(credential\.inviteId\)\}\/\$\{action\}/);
  assert.match(client, /action: "activate" \| "accept"/);
  assert.match(client, /This does not create student access/);
  assert.match(client, /Accept with this account/);
  assert.match(client, /minLength=\{15\}/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|console\./);
  assert.match(page, /SchoolInviteClient/);
  assert.match(route, /secureApiRoute\("POST"/);
  assert.match(route, /getSchoolStaffInviteRouteHandlers\(\)\.activate/);
  assert.doesNotMatch(route, /sha256|token_hash|insert\s+|update\s+/i);
});
