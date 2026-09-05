import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { secureApiRoute, API_BODY_LIMIT_BYTES, requireRouteUuid } from "../../../src/server/shared/http-boundary.ts";

const env = { CUAC_ENV: "production", CUAC_PUBLIC_APP_URL: "https://cuac.test" };
function request(body = "{}", headers = {}) {
  return new Request("https://cuac.test/api/v1/test", { method: "POST", headers: { origin: "https://cuac.test", "content-type": "application/json", ...headers }, body, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) });
}
const boundary = (handler) => secureApiRoute("POST", handler, { env });

test("API boundary preserves valid JSON and supplies no-store headers and a server request id", async () => {
  const route = boundary(async (req) => Response.json({ body: await req.json(), requestId: req.headers.get("x-request-id") }));
  const response = await route(request('{"name":"Synthetic"}', { "x-request-id": "untrusted-client-value" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.body, { name: "Synthetic" });
  assert.notEqual(body.requestId, "untrusted-client-value");
  assert.equal(body.requestId, response.headers.get("x-request-id"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("API boundary blocks cross-origin, missing/null/multiple Origin and same-site writes before business code", async () => {
  let called = 0;
  const route = boundary(async () => { called += 1; return Response.json({}); });
  for (const origin of ["https://evil.test", "null", "https://cuac.test.evil.test", "https://cuac.test/", "https://cuac.test https://evil.test", ""]) {
    assert.equal((await route(request("{}", { origin, "x-forwarded-host": "cuac.test", "x-forwarded-proto": "https" }))).status, 403);
  }
  for (const site of ["cross-site", "same-site", "none"]) assert.equal((await route(request("{}", { "sec-fetch-site": site }))).status, 403);
  const missingOrigin = request();
  missingOrigin.headers.delete("origin");
  assert.equal((await route(missingOrigin)).status, 403);
  assert.equal(called, 0);
});

test("API boundary fails closed without a valid deployed public origin", async () => {
  for (const value of [undefined, "http://cuac.test", "https://cuac.test/path", "https://cuac.test?token=secret", "https://user:secret@cuac.test"]) {
    const route = secureApiRoute("POST", async () => assert.fail("must not invoke business code"), { env: { CUAC_ENV: "production", CUAC_PUBLIC_APP_URL: value } });
    assert.equal((await route(request())).status, 503);
  }
  const local = secureApiRoute("POST", async () => Response.json({}), { env: { CUAC_ENV: "development" } });
  for (const path of ["/api", "/api?view=current"]) {
    assert.equal((await local(new Request(`http://127.0.0.1:3456${path}`, { method: "POST", headers: { origin: "http://127.0.0.1:3456", "content-type": "application/json" }, body: "{}" }))).status, 200);
  }
});

test("signed external boundary preserves raw bytes without requiring a browser Origin", async () => {
  const raw = '{\n  "eventId": "evt:1"\n}';
  const route = secureApiRoute("POST", async request => {
    assert.equal(await request.text(), raw);
    assert.ok(request.headers.get("x-request-id"));
    return Response.json({ accepted: true });
  }, { body: "raw", origin: "signed-external", env });
  const response = await route(new Request("https://cuac.test/api/v1/provider-events", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(raw)) },
    body: raw,
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("external boundary fails closed unless it explicitly preserves a raw body", async () => {
  const route = secureApiRoute("POST", async () => assert.fail("must not invoke business code"), {
    origin: "signed-external", env,
  });
  const response = await route(new Request("https://cuac.test/api/v1/provider-events", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  }));
  assert.equal(response.status, 503);
});

test("API boundary rejects form bodies, malformed JSON, reserved keys and excessive nesting", async () => {
  const route = boundary(async () => assert.fail("must not invoke business code"));
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", ""]) assert.equal((await route(request("{}", { "content-type": type }))).status, 415);
  assert.equal((await route(request("{}", { "content-encoding": "gzip" }))).status, 415);
  for (const body of ["{", "null", "[]", "42", '{"__proto__":{}}', '{"nested":{"constructor":{}}}', '{"number":1e999}', '{"x":'.repeat(18) + "1" + "}".repeat(18), new Uint8Array([0xff])]) {
    assert.equal((await route(request(body))).status, 400);
  }
});

test("API boundary enforces byte limits even with missing or false Content-Length", async () => {
  const route = boundary(async () => assert.fail("must not invoke business code"));
  assert.equal((await route(request("{}", { "content-length": String(API_BODY_LIMIT_BYTES + 1) }))).status, 413);
  for (const headers of [{}, { "content-length": "2" }]) {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(API_BODY_LIMIT_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close(); } });
    assert.equal((await route(request(stream, headers))).status, 413);
  }
});

test("API boundary times out incomplete request bodies and cancels the stream", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const response = await boundary(async () => assert.fail("must not invoke business code"))(request(stream));
  assert.equal(response.status, 408);
  assert.equal(cancelled, true);
});

test("API boundary masks unexpected errors and rejects wrong methods without CORS", async () => {
  const route = boundary(async () => { throw new Error("postgres://private-secret"); });
  const failed = await route(request());
  assert.equal(failed.status, 500);
  assert.doesNotMatch(await failed.text(), /private-secret/);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  const wrong = await route(new Request("https://cuac.test/api"));
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "POST");
  assert.equal(wrong.headers.get("access-control-allow-origin"), null);
  const permissiveHandler = boundary(async () => Response.json({}, { headers: { "access-control-allow-origin": "*", "access-control-allow-credentials": "true", "cache-control": "public, max-age=3600" } }));
  const protectedResponse = await permissiveHandler(request());
  assert.equal(protectedResponse.headers.get("access-control-allow-origin"), null);
  assert.equal(protectedResponse.headers.get("access-control-allow-credentials"), null);
  assert.equal(protectedResponse.headers.get("cache-control"), "no-store");
});

test("API UUID validation rejects malformed identifiers", () => {
  assert.equal(requireRouteUuid("00000000-0000-0000-0000-000000000001"), "00000000-0000-0000-0000-000000000001");
  for (const value of [undefined, null, "not-a-uuid", "../private", "00000000-0000-0000-0000-000000000001'", []]) assert.throws(() => requireRouteUuid(value), (e) => e.status === 400);
});

test("every app API HTTP export is protected by the shared boundary", async () => {
  let count = 0;
  async function inspect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) { await inspect(url); continue; }
      if (entry.name !== "route.ts") continue;
      const source = await readFile(url, "utf8");
      const ast = ts.createSourceFile(url.pathname, source, ts.ScriptTarget.Latest, true);
      assert.match(source, /import \{[^}]*secureApiRoute[^}]*\} from "@\/src\/server\/shared\/http-boundary\.ts"/);
      for (const node of ast.statements) {
        if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
        assert.equal(ts.isFunctionDeclaration(node), false, url.pathname);
        if (!ts.isVariableStatement(node)) continue;
        for (const declaration of node.declarationList.declarations) {
          const method = declaration.name.getText(ast);
          if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method)) continue;
          assert.equal(declaration.initializer.expression.getText(ast), "secureApiRoute", url.pathname);
          assert.equal(declaration.initializer.arguments[0].text, method);
          count += 1;
        }
      }
    }
  }
  await inspect(new URL("../../../app/api/", import.meta.url));
  assert.ok(count >= 61, "expected all existing API methods, not a partial subset");
});

function deleteRequest(body, headers = {}) {
  return new Request("https://cuac.test/api", { method: "DELETE", headers: { origin: "https://cuac.test", ...headers },
    body, ...(body instanceof ReadableStream ? { duplex: "half" } : {}) });
}

test("empty-body DELETE accepts absent or zero bytes without Content-Type and keeps response safeguards", async () => {
  let called = 0;
  const route = secureApiRoute("DELETE", async req => {
    assert.equal(req.body, null); assert.equal(req.headers.get("content-length"), null);
    called++; return Response.json({ ok: true });
  }, { env, body: "empty" });
  for (const body of [undefined, "", new ReadableStream({ start(c) { c.close(); } })]) {
    const res = await route(deleteRequest(body, { "content-length": "0" }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  }
  assert.equal(called, 3);
});

test("empty-body DELETE rejects bytes, false length, compressed bodies, origin and method violations", async () => {
  const route = secureApiRoute("DELETE", async () => assert.fail("must not enter business code"), { env, body: "empty" });
  for (const body of ["{}", " ", new Uint8Array([0]), new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } })]) {
    assert.equal((await route(deleteRequest(body, { "content-length": "0" }))).status, 400);
  }
  for (const length of ["1", "-1", "NaN"]) assert.equal((await route(deleteRequest(undefined, { "content-length": length }))).status, 400);
  assert.equal((await route(deleteRequest(undefined, { "content-encoding": "gzip" }))).status, 415);
  for (const headers of [{ origin: "" }, { origin: "https://evil.test" }, { "sec-fetch-site": "same-site" }]) {
    assert.equal((await route(deleteRequest(undefined, headers))).status, 403);
  }
  const wrong = await route(request());
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "DELETE");
  const jsonRoute = boundary(async () => assert.fail("default JSON route must reject empty bodies"));
  assert.equal((await jsonRoute(request(null))).status, 400);
  assert.equal((await jsonRoute(request(""))).status, 400);
});

test("empty-body DELETE times out an unterminated stream and cancels it", async () => {
  let cancelled = false;
  const route = secureApiRoute("DELETE", async () => assert.fail("must not enter business code"), { env, body: "empty" });
  const res = await route(deleteRequest(new ReadableStream({ cancel() { cancelled = true; } })));
  assert.equal(res.status, 408);
  assert.equal(cancelled, true);
});
