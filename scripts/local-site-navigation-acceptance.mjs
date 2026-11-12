import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const program = (await (await fetch(`${origin}/api/v1/catalog/programs?limit=1`)).json()).data[0];
const applicationId = "a1111111-a111-4111-8111-a11111111111";
const routes = [
  ["/", "/home-v3.html"], ["/programs", "/programs.html"], [`/programs/${program.id}`, "/program-detail.html", "program", program.id],
  ["/hub", "/hub-api.html"], [`/hub/applications/${applicationId}`, "/application.html", "applicationSet", applicationId],
  ["/guides.html", "/guides/"], ["/guide-detail.html", "/guides/documents", "guide", "documents"],
];
const report = { date: new Date().toISOString(), deployed: false, redirects: [], passed: false };
try {
  for (const locale of ["en", "vi", "th", "id", "ms", "ar"]) for (const [path, destination, key, value] of routes) {
    const query = new URLSearchParams({ lang: locale, q: "học bổng & 100%" });
    query.append("tag", "a"); query.append("tag", "b");
    if (key) query.set(key, key === "guide" ? value : "conflicting-query-id");
    const response = await fetch(`${origin}${path}?${query}`, { redirect: "manual" });
    const location = response.headers.get("location");
    const target = location ? new URL(location, origin) : null;
    const expected = new URLSearchParams(query);
    if (key === "guide") expected.delete(key); else if (key) expected.set(key, value);
    const passed = [307, 308].includes(response.status) && target?.origin === origin && target.pathname === destination && JSON.stringify([...target.searchParams].sort()) === JSON.stringify([...expected].sort());
    report.redirects.push({ locale, path, status: response.status, location, expected: destination + "?" + expected, passed });
  }
  report.passed = report.redirects.length === 42 && report.redirects.every(check => check.passed);
  assert.equal(report.passed, true, "Redirect parameter preservation failed; inspect evidence");
} finally {
  await fs.writeFile("output/feedback-20261112/site-redirect-e2e.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checked: report.redirects.length, failed: report.redirects.filter(check => !check.passed).map(check => ({ locale: check.locale, path: check.path, location: check.location })) }));
}
