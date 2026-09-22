import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createServer } from "node:http";
import { applicationSecurityHeaders, CUAC_CONTENT_SECURITY_POLICY } from "../../../src/server/index.ts";
import { createApplicationLifecycle } from "../../../src/server/shared/application-lifecycle.ts";
import { installHttpLifecycle } from "../../../src/server/infra/http-lifecycle.ts";

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
