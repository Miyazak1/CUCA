import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("public and Hub app routes redirect away from the local-storage prototype", async () => {
  const routes = await Promise.all([
    source("app/page.tsx"),
    source("app/programs/page.tsx"),
    source("app/programs/[programId]/page.tsx"),
    source("app/hub/page.tsx"),
    source("app/hub/applications/[applicationId]/page.tsx"),
  ]);
  const combined = routes.join("\n");

  assert.match(combined, /redirect\("\/home-v3\.html"\)/);
  assert.match(combined, /redirect\("\/programs\.html"\)/);
  assert.match(combined, /redirect\(`\/program-detail\.html\?program=\$\{encodeURIComponent\(programId\)\}`\)/);
  assert.match(combined, /redirect\("\/hub-api\.html"\)/);
  assert.match(combined, /redirect\(`\/application\.html\?applicationSet=\$\{encodeURIComponent\(applicationId\)\}`\)/);
  assert.doesNotMatch(combined, /CuacApp|localStorage|mock-fields/);
});

test("application route locator selects only an exact owned application set", async () => {
  const script = await source("public/application.js");

  assert.match(script, /APPLICATION_SET_LOCATOR_PATTERN/);
  assert.match(script, /const routeParams = new URLSearchParams\(location\.search\)/);
  assert.match(script, /routeParams\.get\("applicationSet"\)/);
  assert.match(script, /routeParams\.get\("invoiceId"\)/);
  assert.match(script, /requestedInvoice\?\.applicationSetId \|\| directApplicationSetLocator/);
  assert.match(script, /sets\.find\(\(applicationSet\) => applicationSet\?\.id === applicationSetLocator\)/);
  assert.match(script, /requested application set is not available to this student account/);
  assert.doesNotMatch(script, /applicationSetLocator[^\n]+\|\| sets\[0\]/);
});

test("shared navigation and Auth stay on server-backed workspaces", async () => {
  const [shell, shellCss, auth, home] = await Promise.all([
    source("public/shared-shell.js"),
    source("public/shared-shell.css"),
    source("public/auth.js"),
    source("public/home-v3.js"),
  ]);

  assert.match(shell, /href: "hub-api\.html"/);
  assert.match(shell, /"school-portal\.html"/);
  assert.match(shell, /"ops-admin-api\.html"/);
  assert.match(shell, /"favourites-api\.html"/);
  assert.match(shell, /"billing-api\.html"/);
  assert.match(shell, /"preferences-api\.html"/);
  assert.match(shell, /if \(!runtimeAuthState\.resolved\)/);
  assert.match(shell, /account-auth-pending/);
  assert.match(shell, /function activeWorkspaceHref\(\)/);
  assert.match(shell, /if \(shellContext\.authState === "signed-in"\)[\s\S]*window\.location\.replace\(target\)/);
  assert.match(shellCss, /\.account-auth-pending/);
  assert.match(auth, /nextHref: "hub-api\.html"/);
  assert.match(auth, /registerHref: "onboarding-api\.html"/);
  assert.match(auth, /nextHref: "ops-admin-api\.html"/);
  assert.match(home, /window\.location\.href = "onboarding-api\.html"/);

  for (const legacyTarget of ["hub.html", "favourites.html", "billing.html", "preferences.html", "onboarding.html", "school-settings.html", "ops-admin.html"]) {
    assert.doesNotMatch(`${shell}\n${auth}\n${home}`, new RegExp(`(?<![-a-z])${legacyTarget.replace(".", "\\.")}`));
  }
});
