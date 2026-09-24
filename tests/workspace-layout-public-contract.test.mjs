import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), "utf8");

test("student workspace pages share the same viewport edge, content width and top rhythm", async () => {
  const [shared, hub, application, saved, notifications, preferences, billing] = await Promise.all([
    publicFile("shared-shell.css"),
    publicFile("hub-workspace.css"),
    publicFile("application.css"),
    publicFile("saved-workspace.css"),
    publicFile("notifications-workspace.css"),
    publicFile("preferences-workspace.css"),
    publicFile("billing-workspace.css"),
  ]);

  assert.match(shared, /--workspace-content-width:\s*1200px/);
  assert.match(shared, /--workspace-main-top:\s*32px/);
  assert.match(shared, /--shell-page-width:\s*min\(1440px,\s*calc\(100vw - 64px\)\)/);
  assert.match(shared, /body\s*\{[\s\S]*?margin:\s*0/);
  assert.match(shared, /\.nav\s*\{[\s\S]*?box-sizing:\s*content-box[\s\S]*?max-width:\s*var\(--shell-page-width\)[\s\S]*?padding:\s*14px var\(--shell-section-x\)/);
  assert.match(shared, /\.workspace-nav\s*\{[\s\S]*?width:\s*var\(--shell-page-width\)/);

  for (const css of [hub, saved, notifications, preferences, billing]) {
    assert.match(css, /width:\s*min\(var\(--workspace-content-width\),\s*calc\(100% - \(var\(--workspace-page-gutter\) \* 2\)\)\)/);
    assert.match(css, /padding:\s*var\(--workspace-main-top\) 0 var\(--workspace-main-bottom\)/);
  }

  assert.match(application, /--page-width:\s*min\(var\(--workspace-content-width\),\s*calc\(100vw - \(var\(--workspace-page-gutter\) \* 2\)\)\)/);
  assert.match(application, /\.application-overview\s*\{[\s\S]*?margin-top:\s*32px/);
  assert.match(application, /\.submission-status\s*\{[\s\S]*?margin-top:\s*var\(--workspace-main-top\)/);
});

test("student workspace entry pages load the synchronized layout revision", async () => {
  const pages = ["hub-api.html", "application.html", "favourites-api.html", "notifications.html", "preferences-api.html", "billing-api.html"];
  for (const page of pages) {
    const html = await publicFile(page);
    assert.match(html, /shared-shell\.css\?v=20260923-shell-isolation/, page);
    assert.match(html, /-workspace\.css\?v=20260923-workspace-spacing|application\.css\?v=20260923-workspace-spacing/, page);
  }
});
