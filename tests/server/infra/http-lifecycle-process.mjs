import assert from "node:assert/strict";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createApplicationLifecycle } from "../../../src/server/shared/application-lifecycle.ts";
import { installHttpLifecycle } from "../../../src/server/infra/http-lifecycle.ts";

assert.equal(process.platform, "linux");
assert.equal(process.getuid(), 1000);
assert.equal(process.version, process.env.CUAC_LIFECYCLE_NODE);
const mode = process.argv[2];
assert.ok(["drain", "deadline"].includes(mode));
const lifecycle = createApplicationLifecycle();
let releaseWork;
const work = new Promise(resolve => { releaseWork = resolve; });
lifecycle.registerResource("synthetic-resource", async () => { await delay(20); });
const server = createServer(async (_request, response) => {
  const release = lifecycle.enterRequest();
  console.log(JSON.stringify({ event: "fixture.ready", activeRequests: lifecycle.snapshot().activeRequests }));
  await work; release(); response.end("finished");
});
installHttpLifecycle(server, { lifecycle, timeoutMs: 1000, onEvent: event => {
  console.log(JSON.stringify(event));
  if (event.event === "application.draining" && mode === "drain") void delay(100).then(releaseWork);
} });
server.listen(0, "127.0.0.1", () => {
  void fetch(`http://127.0.0.1:${server.address().port}`).then(response => response.text()).catch(() => undefined);
});
