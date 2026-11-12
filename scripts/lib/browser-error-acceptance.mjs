import assert from "node:assert/strict";

export async function observeBrowserErrors(page, { allowSignedOut = false } = {}) {
  const errors = [];
  const denied = [];
  const protectedReads = new Set(["/api/v1/me", "/api/v1/student/profile", "/api/v1/student/application-sets", "/api/v1/student/saved-items", "/api/v1/notifications", "/api/v1/notifications/preferences", "/api/v1/data-rights/requests"]);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => {
    const url = new URL(response.url());
    if ([401, 403].includes(response.status()) && response.request().method() === "GET" && protectedReads.has(url.pathname)) denied.push({ path: url.pathname, status: response.status() });
  });
  await page.addInitScript(() => {
    window.__acceptanceCspViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.__acceptanceCspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
  });
  return {
    async assertClean() {
      const violations = await page.evaluate(() => window.__acceptanceCspViolations || []);
      const remaining = [...denied];
      const unexpected = errors.filter(message => {
        if (!allowSignedOut) return true;
        const status = /^Failed to load resource: the server responded with a status of (401|403) \((?:Unauthorized|Forbidden)\)$/.exec(message)?.[1];
        const index = remaining.findIndex(response => response.status === Number(status));
        if (index < 0) return true;
        remaining.splice(index, 1);
        return false;
      });
      assert.deepEqual(violations, [], "CSP blocked page content");
      assert.deepEqual(unexpected, [], "Unexpected browser console errors");
      return { violations, unexpected, expectedSignedOutReads: denied };
    },
  };
}
