import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("onboarding candidate initializes only the real student profile", async () => {
  const [html, script] = await Promise.all([
    source("public/onboarding-api.html"),
    source("public/onboarding-runtime.js"),
  ]);

  assert.match(html, /<body data-agent-mode="off" data-i18n-locales="en,vi,th,id,ms,ar">/);
  assert.match(html, /onboarding-workspace\.css\?v=/);
  assert.match(html, /src="shared-shell\.js(?:\?[^\"]*)?"/);
  assert.match(html, /src="onboarding-runtime\.js\?v=/);
  assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|onboarding\.js|data-cuac-agent/);
  assert.match(script, /requestJson\("\/api\/v1\/student\/profile"/);
  assert.match(script, /method: "PATCH"/);
  assert.match(script, /requiredRole: "student"/);
  assert.match(script, /window\.location\.assign\(localizedHref\("hub-api\.html"\)\)/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|readiness|passport|transcript|budget|agent|mock/i);
});

test("student onboarding translates static and dynamic controls while preserving locale navigation", async () => {
  const [html, messages, script] = await Promise.all([
    source("public/onboarding-api.html"),
    source("public/onboarding-i18n.js"),
    source("public/onboarding-runtime.js"),
  ]);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  assert.ok(scripts.indexOf("i18n-runtime.js") < scripts.indexOf("onboarding-i18n.js"));
  assert.ok(scripts.indexOf("onboarding-i18n.js") < scripts.indexOf("shared-shell.js"));
  assert.ok(scripts.indexOf("shared-shell.js") < scripts.indexOf("onboarding-runtime.js"));
  assert.match(script, /ui\("Display name"\)/);
  assert.match(script, /ui\("Subject areas"\)/);
  assert.match(script, /localizedHref\("hub-api\.html"\)/);
  for (const marker of ["Thiết lập tài khoản", "ตั้งค่าบัญชี", "Penyiapan akun", "Penyediaan akaun", "إعداد الحساب"]) {
    assert.match(messages, new RegExp(marker));
  }
  assert.match(messages, /MutationObserver/);
  assert.match(messages, /url\.searchParams\.set\("lang", i18n\.locale\)/);
});

test("onboarding fields match and preserve the study preference contract", async () => {
  const script = await source("public/onboarding-runtime.js");

  for (const field of ["degreeLevel", "subjectAreas", "teachingLanguage", "preferredCityIds", "fundingIntent", "intakeYear", "intakeTerm"]) {
    assert.ok(script.includes(field), `missing supported preference field: ${field}`);
  }
  assert.match(script, /subjectAreas\.length > 8/);
  assert.match(script, /displayName:/);
  assert.match(script, /targetDegreeLevel:/);
  assert.match(script, /preferences,/);
  assert.doesNotMatch(script, /currentCountry|stage|tuition|focus|cities:/);
});

test("onboarding workspace is restrained and responsive", async () => {
  const [html, css] = await Promise.all([
    source("public/onboarding-api.html"),
    source("public/onboarding-workspace.css"),
  ]);

  assert.match(html, /aria-live="polite"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 800px\)/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|border-radius:\s*(?:[1-9][0-9]|[1-9][0-9][0-9])px/);
});
