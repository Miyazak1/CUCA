import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { createApplicationLifecycle, getApplicationLifecycle } from "../../../src/server/shared/application-lifecycle.ts";
import { installHttpLifecycle } from "../../../src/server/infra/http-lifecycle.ts";
import { applicationServerOptions } from "../../../scripts/lib/app-server.ts";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test("lifecycle refuses new requests after draining but waits for the admitted work exactly once", async () => {
  const lifecycle = createApplicationLifecycle(), first = lifecycle.enterRequest(), second = lifecycle.enterRequest();
  lifecycle.beginDrain(); lifecycle.beginDrain();
  assert.equal(lifecycle.enterRequest(), undefined);
  assert.throws(() => lifecycle.closeResources(), /Drain application requests/);
  let idle = false;
  const waiting = lifecycle.waitForRequests().then(() => { idle = true; });
  first(); first(); await delay(0); assert.equal(idle, false);
  assert.equal(lifecycle.snapshot().activeRequests, 1);
  second(); await waiting;
  assert.equal(idle, true);
  await lifecycle.closeResources();
  assert.equal(lifecycle.snapshot().phase, "closed");
});

test("resource close waits for drain, is idempotent and never permits resource resurrection", async () => {
  const lifecycle = createApplicationLifecycle(), close = deferred();
  let calls = 0;
  lifecycle.registerResource("postgres", async () => { calls++; await close.promise; });
  assert.throws(() => lifecycle.registerResource("postgres", async () => {}), /conflicts/);
  assert.throws(() => lifecycle.closeResources(), /Drain/);
  lifecycle.beginDrain();
  const unregister = lifecycle.registerResource("late-admitted", async () => {}); unregister(); unregister();
  const closing = lifecycle.closeResources();
  assert.equal(lifecycle.closeResources(), closing);
  assert.equal(calls, 1);
  assert.throws(() => lifecycle.registerResource("late", async () => {}), /shutting down/);
  close.resolve(); await closing;
  assert.deepEqual(lifecycle.snapshot(), { phase: "closed", activeRequests: 0, resources: [] });
  assert.throws(() => lifecycle.assertResourcesOpen(), /shutting down/);
});

test("resource failures are redacted and do not skip other registered cleanup", async () => {
  const lifecycle = createApplicationLifecycle(); let cleaned = false;
  lifecycle.registerResource("postgres", async () => { throw new Error("PRIVATE_SHUTDOWN_CREDENTIAL"); });
  lifecycle.registerResource("other", async () => { cleaned = true; });
  lifecycle.beginDrain();
  await assert.rejects(lifecycle.closeResources(), error => /shutdown failed/.test(error.message) && !error.message.includes("PRIVATE"));
  assert.equal(cleaned, true);
  assert.equal(lifecycle.snapshot().phase, "closed");
});

test("separately imported modules share the process lifecycle used by built API chunks", async () => {
  const second = await import("../../../src/server/shared/application-lifecycle.ts?independent-module");
  assert.equal(second.getApplicationLifecycle(), getApplicationLifecycle());
  assert.notEqual(createApplicationLifecycle(), getApplicationLifecycle());
});

test("managed server bind and shutdown configuration is explicit and bounded", () => {
  assert.deepEqual(applicationServerOptions({}), { port: 3000, host: "127.0.0.1", timeoutMs: 30000 });
  assert.deepEqual(applicationServerOptions({ PORT: "8080", CUAC_HTTP_HOST: "0.0.0.0", CUAC_HTTP_SHUTDOWN_TIMEOUT_MS: "60000" }), { port: 8080, host: "0.0.0.0", timeoutMs: 60000 });
  for (const PORT of ["", "0", "-1", "3000oops", "65536", "1.5"]) assert.throws(() => applicationServerOptions({ PORT }));
  for (const CUAC_HTTP_HOST of ["", "localhost", "https://host", "PRIVATE_HOST"]) assert.throws(() => applicationServerOptions({ CUAC_HTTP_HOST }));
  for (const CUAC_HTTP_SHUTDOWN_TIMEOUT_MS of ["", "0", "999", "120001", "Infinity", "1e4"]) assert.throws(() => applicationServerOptions({ CUAC_HTTP_SHUTDOWN_TIMEOUT_MS }));
});

test("HTTP shutdown waits for response and business drain before closing resources and exits once", async () => {
  const lifecycle = createApplicationLifecycle(), entered = deferred(), proceed = deferred();
  const order = [], events = [], exits = [];
  lifecycle.registerResource("postgres", async () => { order.push("resource-closed"); });
  const server = createServer(async (_req, res) => {
    const release = lifecycle.enterRequest(); entered.resolve(); await proceed.promise;
    order.push("business-finished"); release(); res.end("done");
  });
  const listenerCount = process.listenerCount("SIGTERM");
  const runtime = installHttpLifecycle(server, { lifecycle, timeoutMs: 3000, exit: code => exits.push(code), onEvent: event => events.push(event) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = fetch(origin).then(response => response.text());
  await entered.promise;
  const stopped = runtime.stop("SIGTERM");
  assert.equal(runtime.stop("SIGINT"), stopped);
  await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1000) }));
  assert.deepEqual(exits, []); assert.deepEqual(order, []);
  proceed.resolve(); assert.equal(await response, "done");
  assert.deepEqual(await stopped, { outcome: "drained", code: 0, reason: "SIGTERM", activeRequests: 0, closedResources: ["postgres"] });
  assert.deepEqual(order, ["business-finished", "resource-closed"]);
  assert.deepEqual(exits, [0]); assert.equal(events.length, 2);
  assert.equal(process.listenerCount("SIGTERM"), listenerCount);
});

test("HTTP shutdown deadline closes a stuck transport without claiming resource cleanup succeeded", async () => {
  const lifecycle = createApplicationLifecycle(), entered = deferred(), exits = [];
  let release, closed = false;
  lifecycle.registerResource("postgres", async () => { closed = true; });
  const server = createServer(() => { release = lifecycle.enterRequest(); entered.resolve(); });
  const runtime = installHttpLifecycle(server, { lifecycle, timeoutMs: 1000, exit: code => exits.push(code) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const response = fetch(`http://127.0.0.1:${server.address().port}`).catch(() => "disconnected");
  await entered.promise;
  const start = performance.now(), result = await runtime.stop();
  assert.equal(result.outcome, "deadline"); assert.equal(result.code, 1);
  assert.equal(result.activeRequests, 1); assert.deepEqual(result.closedResources, []);
  assert.ok(performance.now() - start < 2500);
  assert.deepEqual(exits, [1]); assert.equal(closed, false);
  assert.equal(await response, "disconnected");
  release(); await lifecycle.waitForRequests(); await delay(10);
});

test("a hung resource close remains inside the same overall shutdown deadline", async () => {
  const lifecycle = createApplicationLifecycle(), hanging = deferred(), exits = [];
  lifecycle.registerResource("postgres", () => hanging.promise);
  const server = createServer((_req, res) => res.end());
  const runtime = installHttpLifecycle(server, { lifecycle, timeoutMs: 1000, exit: code => exits.push(code) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const result = await runtime.stop();
  assert.equal(result.outcome, "deadline"); assert.equal(result.activeRequests, 0);
  assert.deepEqual(exits, [1]);
  hanging.resolve(); await delay(10); assert.deepEqual(exits, [1]);
});
