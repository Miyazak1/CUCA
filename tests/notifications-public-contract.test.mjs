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
  assert.match(html, /<body data-agent-mode="off" data-i18n-locales="en,vi,th,id,ms,ar">/);
  assert.doesNotMatch(html, /<script src="notifications\.js"/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|data-cuac-agent/);
  assert.match(html, /href="hub-api\.html"/);
  assert.match(html, /href="preferences-api\.html#notification-preferences"/);
  assert.doesNotMatch(html, /href="(?:hub|preferences)\.html/);
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
    "privacy_requests",
    "account_security",
  ]) {
    assert.match(html, new RegExp(`data-notification-topic="${topic}"`));
    assert.match(script, new RegExp(`${topic}:`));
  }
  assert.match(html, /checked disabled data-notification-topic="account_security"/);
  assert.match(html, /checked disabled data-notification-topic="privacy_requests"/);
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

test("student notification center localizes controls without translating server notices", async () => {
  const [html, messages, script, css] = await Promise.all([
    source("public/notifications.html"),
    source("public/notifications-i18n.js"),
    source("public/notifications-runtime.js"),
    source("public/notifications-workspace.css"),
  ]);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("notifications-i18n.js"));
  assert.ok(scripts.indexOf("notifications-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("notifications-runtime.js"));
  assert.match(script, /new Intl\.DateTimeFormat\(notificationLocale/);
  assert.match(script, /localizedHref\(actionPath\)/);
  assert.match(script, /Original notification content/);
  assert.match(script, /escapeHtml\(item\.title\)/);
  assert.match(script, /escapeHtml\(item\.body\)/);
  assert.doesNotMatch(script, /translate|machineTranslation|machine_translation/i);
  for (const marker of ["Thông báo", "การแจ้งเตือน", "Notifikasi", "الإشعارات"]) {
    assert.match(messages, new RegExp(marker));
  }
  assert.match(messages, /MutationObserver/);
  assert.match(messages, /url\.searchParams\.set\("lang", i18n\.locale\)/);
  assert.match(css, /\.notice-source-language/);
});
