import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { legacyPageHref } from "../app/legacy-redirect.ts";

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

  for (const path of ["/home-v3.html", "/programs.html", "/program-detail.html", "/hub-api.html", "/application.html"]) assert.ok(combined.includes(`legacyPageHref("${path}", await searchParams`));
  assert.match(combined, /\{ program: programId \}/);
  assert.match(combined, /\{ applicationSet: applicationId \}/);
  assert.doesNotMatch(combined, /CuacApp|localStorage|mock-fields/);
});

test("root homepage redirect preserves explicit language, repeated and encoded query values", async () => {
  const code = ts.transpileModule(await source("app/page.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const redirects = [];
  vm.runInNewContext(code, { exports, URLSearchParams, require: name => {
    if (name === "./legacy-redirect.ts") return { legacyPageHref };
    assert.equal(name, "next/navigation");
    return { redirect: href => redirects.push(href) };
  } });
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    await exports.default({ searchParams: Promise.resolve({ lang: locale, q: "học bổng & 100%", tag: ["a", "b"], ignored: undefined }) });
    const target = new URL(redirects.pop(), "https://ucac.cn");
    assert.equal(target.pathname, "/home-v3.html");
    assert.equal(target.searchParams.get("lang"), locale);
    assert.equal(target.searchParams.get("q"), "học bổng & 100%");
    assert.deepEqual(target.searchParams.getAll("tag"), ["a", "b"]);
    assert.equal(target.searchParams.has("ignored"), false);
  }
  await exports.default({ searchParams: Promise.resolve({}) });
  assert.equal(redirects.pop(), "/home-v3.html");
});

test("legacy redirect query forwarding consumes migrated keys and trusts path identifiers", () => {
  const query = { lang: "ar", tag: ["a", "b"], program: ["wrong", "also-wrong"], guide: "documents" };
  const target = new URL(legacyPageHref("/program-detail.html", query, { program: "path-id" }, ["guide"]), "https://ucac.cn");
  assert.equal(target.searchParams.get("lang"), "ar");
  assert.deepEqual(target.searchParams.getAll("tag"), ["a", "b"]);
  assert.deepEqual(target.searchParams.getAll("program"), ["path-id"]);
  assert.equal(target.searchParams.has("guide"), false);
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
  assert.match(shell, /shellContext\.accountEmailVerified === true/);
  assert.match(shell, /role === "student" && shellContext\.accountEmailVerified !== true\) return localizedPageHref\(`auth\.html\?v=\$\{authPageVersion\}`\)/);
  assert.match(shell, /params\.set\("v", authPageVersion\)/);
  assert.match(shell, /if \(shellContext\.authState === "signed-in"\)[\s\S]*window\.location\.replace\(target\)/);
  assert.match(shellCss, /\.account-auth-pending/);
  assert.match(auth, /nextHref: "hub-api\.html"/);
  assert.match(auth, /registerHref: "onboarding-api\.html"/);
  assert.match(auth, /nextHref: "ops-admin-api\.html"/);
  assert.match(home, /window\.location\.href = window\.CUACHomeI18n\?\.href\("onboarding-api\.html"\) \|\| "onboarding-api\.html"/);

  for (const legacyTarget of ["hub.html", "favourites.html", "billing.html", "preferences.html", "onboarding.html", "school-settings.html", "ops-admin.html"]) {
    assert.doesNotMatch(`${shell}\n${auth}\n${home}`, new RegExp(`(?<![-a-z])${legacyTarget.replace(".", "\\.")}`));
  }
});

test("HTML entry points revalidate across deployments", async () => {
  const config = await source("next.config.ts");

  assert.match(config, /source: "\/"/);
  assert.match(config, /source: "\/:path\*\.html"/);
  assert.match(config, /key: "Cache-Control", value: "no-cache"/);
});
