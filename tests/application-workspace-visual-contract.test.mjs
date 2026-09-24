import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), "utf8");

test("application workspace uses the shared student page hierarchy", async () => {
  const html = await publicFile("application.html");

  assert.match(html, /application-workspace-refresh\.css\?v=20260923-workspace-convergence/);
  assert.match(html, /<header class="application-page-heading reveal">[\s\S]*?<h1>My applications<\/h1>[\s\S]*?Back to Hub[\s\S]*?<\/header>/);
  assert.equal((html.match(/<h1>My applications<\/h1>/g) || []).length, 1);
  assert.doesNotMatch(html, /<div class="status-copy">[\s\S]*?<h1>My applications<\/h1>/);
});

test("application convergence layer is scoped and replaces legacy dashboard decoration", async () => {
  const css = await publicFile("application-workspace-refresh.css");

  assert.match(css, /\.application-page-heading\s*\{[\s\S]*?var\(--workspace-content-width\)[\s\S]*?var\(--workspace-main-top\)/);
  assert.match(css, /\.application-page \.overview-section-cards \.section-status\s*\{[\s\S]*?width:\s*fit-content[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.application-page \.status-ring\s*\{[\s\S]*?grid-template-columns:\s*38px minmax\(0, 1fr\)[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /\.application-page \.choice-panel,[\s\S]*?\.application-page \.submission-status\s*\{[\s\S]*?background:\s*#fff[\s\S]*?box-shadow:\s*none/);
  assert.doesNotMatch(css, /(^|\n)(?!\s*@|\s*\/\*)\s*(?:html|body|:root|\.nav|\.workspace-nav)\b/m);
});
