import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../public/${path}`, import.meta.url), "utf8");

test("legal routes are stable, governed and fail closed without approved content", async () => {
  const pages = {
    "privacy.html": "privacy_notice",
    "terms.html": "terms_of_service",
    "cookies.html": "cookie_notice",
    "admissions-data-policy.html": "admissions_data_policy",
  };
  const runtime = await read("legal-runtime.js");
  const shell = await read("shared-shell.js");
  for (const [page, key] of Object.entries(pages)) {
    const html = await read(page);
    assert.match(html, new RegExp(`data-notice-key="${key}"`));
    assert.match(html, /legal-runtime\.js/);
    assert.match(html, /data-legal-version/);
    assert.match(html, /data-legal-effective/);
    assert.match(html, /data-legal-review/);
    assert.doesNotMatch(html, /Synthetic|placeholder legal|Lorem ipsum/i);
  }
  assert.match(runtime, /\/api\/v1\/notices\//);
  assert.match(runtime, /Production release remains blocked/);
  assert.match(runtime, /textContent = item\.heading/);
  assert.doesNotMatch(runtime, /innerHTML|localStorage|sessionStorage|document\.cookie/);
  for (const href of Object.keys(pages)) assert.match(shell, new RegExp(href.replace(".", "\\.")));
  assert.doesNotMatch(shell, /\["Privacy", "home-v3\.html#application-guides"\]|\["Terms", "home-v3\.html#application-guides"\]/);
});
