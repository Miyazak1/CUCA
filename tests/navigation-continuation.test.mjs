import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

async function functions(file, names) {
  const source = ts.createSourceFile(file, await fs.readFile(new URL(`../${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) { if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(source)); ts.forEachChild(node, visit); }
  visit(source);
  assert.equal(found.length, names.length);
  return found.join("\n");
}
const id = "a1111111-a111-4111-8111-a11111111111";
test("account action return links preserve explicit English and render without window access", async () => {
  const code = ts.transpileModule(await functions("app/auth/action-client.tsx", ["localeHref"]), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const href = vm.runInNewContext(`${code}\nlocaleHref`, { URL });
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) {
    const target = new URL(href(locale, "/auth.html?continue=1#reset"), "https://ucac.cn");
    assert.equal(target.searchParams.get("lang"), locale);
    assert.equal(target.searchParams.get("continue"), "1");
    assert.equal(target.hash, "#reset");
  }
});
test("public footer legal links resolve from nested editorial routes", async () => {
  const code = await functions("public/shared-shell.js", ["renderFooter"]);
  const target = {};
  const render = vm.runInNewContext(`${code}\nrenderFooter`, {
    workspaceNavigation: () => null, document: { body: { dataset: {} } }, window: { CUACI18n: { locale: "en" } },
    footerGroups: [], footerGroupsZh: [], shellText: (_key, fallback) => fallback, escapeHTML: value => value,
    brand: () => "", localizedPageHref: href => href,
  });
  render(target);
  const links = [...target.outerHTML.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1], "https://ucac.cn/insights/category/planning").pathname);
  assert.ok(links.includes("/cookies.html"));
  assert.ok(links.includes("/admissions-data-policy.html"));
});
test("shell continuation honors targetRoute, returnUrl, resumeAction and private record locators", async () => {
  const code = await functions("public/shared-shell.js", ["normalizeContinuationTarget", "continuationRequestFor"]);
  const base = new URL("https://ucac.cn/application.html?lang=vi");
  const build = vm.runInNewContext(`${code}\ncontinuationRequestFor`, {
    URL, window: { location: base }, currentRelativeUrl: () => `/application.html?applicationSet=${id}&lang=vi#info`,
    routeNameFromHref: value => new URL(value, base).pathname.split("/").pop(),
    protectedStudentRoutes: new Set(["application.html", "billing-api.html", "hub-api.html"]),
    localizedPageHref: href => { const url = new URL(href, base); url.searchParams.set("lang", "vi"); return url.pathname + url.search + url.hash; },
  });
  for (const input of [
    { targetRoute: "/programs.html", actionKey: "catalog.save_program", payloadPreview: { programId: id } },
    { returnUrl: `/application.html?applicationSet=${id}&lang=vi#info` },
    { resumeAction: { type: "navigate", href: `billing-api.html?invoice=${id}&lang=vi` } },
    {},
  ]) {
    const result = build(input);
    assert.ok(result?.targetRoute);
    if (input.targetRoute) assert.equal(result.targetRoute, input.targetRoute);
    else assert.ok(result.targetRoute.includes(id));
  }
  assert.equal(build({ returnUrl: "https://evil.example/application.html" }), null);
  assert.equal(build({ returnUrl: "/application.html?next=evil" }), null);
});

test("client continuation validation admits only registered locale/UUID queries and authorized roles", async () => {
  const code = await functions("public/auth.js", ["safeLocalUrl", "normalizeAuthRole", "validateConsumedContinuation"]);
  const validate = vm.runInNewContext(`${code}\nvalidateConsumedContinuation`, { URL, window: { location: new URL("https://ucac.cn/auth.html?lang=vi") } });
  const base = { actionKey: "navigation.open_student_workspace", requiredRole: "student", payloadPreview: {} };
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) assert.ok(validate({ ...base, targetRoute: `/application.html?applicationSet=${id}&lang=${locale}#info` }, "student"));
  for (const targetRoute of ["//evil.example/application.html", "/application.html?next=evil", "/application.html?lang=vi&lang=en", "/application.html?applicationSet=invalid", "/hub-api.html?invoice=" + id, "/application.html?checkout=unverified"]) assert.equal(validate({ ...base, targetRoute }, "student"), null);
  assert.equal(validate({ ...base, targetRoute: "/application.html?lang=vi" }, "school_staff"), null);
});

test("already signed-in continuation executes completion and assigns a URL rather than an object", async () => {
  const code = await functions("public/auth.js", ["loadCurrentActor"]);
  const assigned = [];
  const completed = [];
  const continuation = { targetRoute: "/programs.html", actionKey: "catalog.save_program", payloadPreview: { programId: id } };
  await vm.runInNewContext(`${code}\nloadCurrentActor()`, {
    requestJson: async () => ({ actorUserId: id, activeRole: "student", accountEmailVerified: true }),
    normalizeAuthRole: () => "student", setRole() {}, setMode() {}, setStatus() {},
    consumePendingContinuation: async () => continuation,
    completeConsumedContinuation: async value => { completed.push(value); return "/programs.html?lang=vi"; },
    pendingContinuation: null, authParams: new URLSearchParams("continue=1"),
    window: { location: { assign: value => assigned.push(value) } },
  });
  assert.deepEqual(completed, [continuation]);
  assert.deepEqual(assigned, ["/programs.html?lang=vi"]);
});

test("continuation save completion is idempotent and retains the current locale", async () => {
  const code = await functions("public/auth.js", ["completeConsumedContinuation"]);
  const calls = [];
  let saved = [];
  const complete = vm.runInNewContext(`${code}\ncompleteConsumedContinuation`, {
    requestJson: async (path, options) => { calls.push({ path, options }); if (options) saved = [{ entityType: options.body.entityType, entityId: options.body.entityId }]; return saved; },
    authI18n: { href: href => href + "?lang=ar" },
  });
  const continuation = { targetRoute: "/programs.html", actionKey: "catalog.save_program", payloadPreview: { programId: id } };
  assert.equal(await complete(continuation), "/programs.html?lang=ar");
  assert.equal(await complete(continuation), "/programs.html?lang=ar");
  assert.equal(calls.filter(call => call.options?.method === "POST").length, 1);
});
