import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createServer } from "node:http";
import { applicationSecurityHeaders, CUAC_CONTENT_SECURITY_POLICY } from "../../../src/server/index.ts";
import { createApplicationLifecycle } from "../../../src/server/shared/application-lifecycle.ts";
import { installHttpLifecycle } from "../../../src/server/infra/http-lifecycle.ts";
import { applicationRequestSecurityHeaders } from "../../../src/server/infra/security-headers.ts";

test("application security headers deny framing and unnecessary browser capabilities", () => {
  const headers = applicationSecurityHeaders({ CUAC_ENV: "production" });
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  assert.equal(headers["permissions-policy"], "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  assert.equal(headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "upgrade-insecure-requests"]) {
    assert.match(CUAC_CONTENT_SECURITY_POLICY, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(CUAC_CONTENT_SECURITY_POLICY, /unsafe-inline|unsafe-eval|\*/);
});

test("HSTS is emitted only by deployed staging or production processes", () => {
  for (const CUAC_ENV of [undefined, "development", "test"]) {
    assert.equal(applicationSecurityHeaders({ CUAC_ENV })["strict-transport-security"], undefined);
  }
  assert.ok(applicationSecurityHeaders({ CUAC_ENV: "staging" })["strict-transport-security"]);
});

test("HTTP lifecycle applies the security contract to an actual response", async () => {
  const lifecycle = createApplicationLifecycle();
  const server = createServer((_request, response) => response.end("ok"));
  const runtime = installHttpLifecycle(server, {
    lifecycle,
    responseHeaders: applicationSecurityHeaders({ CUAC_ENV: "production" }),
    exit: () => undefined,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(await response.text(), "ok");
  assert.equal(response.headers.get("content-security-policy"), CUAC_CONTENT_SECURITY_POLICY);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal((await runtime.stop()).outcome, "drained");
});

test("SSR nonces are fresh, renderer-visible, non-cacheable and ignore incoming policy", async () => {
  const lifecycle = createApplicationLifecycle();
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ policy: request.headers["content-security-policy"], nonce: request.headers["x-nonce"] }));
  });
  const runtime = installHttpLifecycle(server, {
    lifecycle, responseHeaders: request => applicationRequestSecurityHeaders(request, { CUAC_ENV: "development" }), exit() {},
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const seen = new Set();
    for (const path of ["/guides/documents?lang=ar", "/guides/documents?lang=ar", "/insights/", "/auth/verify-email?lang=vi", "/auth/reset-password", "/auth/school-invite"]) {
      const response = await fetch(origin + path, { headers: { "content-security-policy": "script-src 'nonce-attacker'", "x-nonce": "attacker" } });
      const body = await response.json();
      assert.match(body.nonce, /^[A-Za-z0-9+/]{24}$/);
      assert.equal(seen.has(body.nonce), false);
      seen.add(body.nonce);
      assert.equal(body.policy, response.headers.get("content-security-policy"));
      assert.ok(body.policy.includes(`script-src 'self' 'nonce-${body.nonce}'`));
      assert.match(body.policy, /frame-ancestors 'none'/);
      assert.doesNotMatch(body.policy, /unsafe-inline|unsafe-eval|attacker/);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
    for (const path of ["/api/v1/search", "/about.html", "/insights/rss.xml", "/guidesevil/", "/auth/other", "/auth/verify-email.html", "/api/v1/auth/verify-email"]) {
      const response = await fetch(origin + path);
      assert.equal(response.headers.get("content-security-policy"), CUAC_CONTENT_SECURITY_POLICY);
      assert.equal((await response.json()).nonce, undefined);
    }
  } finally { await runtime.stop(); }
});
