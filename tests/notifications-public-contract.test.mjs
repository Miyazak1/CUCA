import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("notification center uses account-scoped server state and revisions", async () => {
  const [html, script] = await Promise.all([
    source("public/notifications.html"),
    source("public/notifications-runtime.js"),
  ]);

  assert.match(html, /notifications-runtime\.js\?v=/);
  assert.match(html, /notifications-workspace\.css\?v=/);
  assert.match(html, /<body data-agent-mode="off">/);
  assert.doesNotMatch(html, /<script src="notifications\.js"/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|data-cuac-agent/);
  for (const endpoint of [
    "/api/v1/notifications?",
    "/api/v1/notifications/preferences",
    "/api/v1/notifications/read-all",
    "/api/v1/notifications/${encodeURIComponent(id)}/read",
  ]) {
    assert.ok(script.includes(endpoint), `missing ${endpoint}`);
  }
  assert.match(script, /expectedRevision:\s*item\.revision/);
  assert.match(script, /expectedRevision:\s*current\.revision/);
  assert.match(script, /credentials:\s*"same-origin"/);
  assert.match(script, /url\.origin !== location\.origin/);
  assert.match(script, /method:\s*"PATCH"/);
  assert.match(script, /method:\s*"PUT"/);
  assert.match(script, /nextCursor/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|CuacDataClient|DemoState|data-dismiss|dismissedState/);
});

test("notification controls expose only backend topics and supported actions", async () => {
  const [html, script] = await Promise.all([
    source("public/notifications.html"),
    source("public/notifications-runtime.js"),
  ]);

  for (const topic of [
    "application_updates",
    "billing_updates",
    "deadline_reminders",
    "document_reminders",
    "funding_updates",
    "account_security",
  ]) {
    assert.match(html, new RegExp(`data-notification-topic="${topic}"`));
    assert.match(script, new RegExp(`${topic}:`));
  }
  assert.match(html, /checked disabled data-notification-topic="account_security"/);
  assert.doesNotMatch(html, /data-quiet-pref|data-filter="agent"|Agent result/);
  assert.doesNotMatch(script, /mark unread|data-dismiss|Agent result/i);
});

test("notification workspace is restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/notifications.html"),
    source("public/notifications-workspace.css"),
  ]);

  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
