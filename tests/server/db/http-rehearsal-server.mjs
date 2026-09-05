import assert from "node:assert/strict";
import { startApplicationServer } from "../../../scripts/lib/app-server.ts";

assert.ok(process.send, "This helper must run as the owned rehearsal child.");
const target = new URL(process.env.CUAC_PG_REHEARSAL_URL);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(target.username, "cuac_rehearsal");
assert.match(target.pathname, /^\/cuac_rehearsal_[a-f0-9]{24}$/);
process.env.DATABASE_URL = target.href;
let heldExit;
const runtime = await startApplicationServer({ port: 0, host: "127.0.0.1", timeoutMs: Number(process.env.CUAC_HTTP_SHUTDOWN_TIMEOUT_MS ?? 30000),
  onEvent: event => { if (process.connected) process.send({ type: "lifecycle", ...event }); },
  exit: code => {
    if (process.env.CUAC_LIFECYCLE_HOLD_EXIT === "1" && process.connected && code === 0) {
      heldExit = code; process.send({ type: "closed", snapshot: runtime.snapshot() });
    } else process.exit(code);
  },
});
const { server } = runtime;
const address = server.address();
assert.equal(address.address, "127.0.0.1");
process.env.CUAC_PUBLIC_APP_URL = `http://127.0.0.1:${address.port}`;
process.send({ type: "ready", origin: process.env.CUAC_PUBLIC_APP_URL });

process.on("message", message => {
  if (message?.type === "stop") void runtime.stop();
  if (message?.type === "signal" && ["SIGTERM", "SIGINT"].includes(message.signal)) process.emit(message.signal);
  if (message?.type === "snapshot") process.send({ type: "snapshot", snapshot: runtime.snapshot() });
  if (message?.type === "finish" && heldExit !== undefined) process.exit(heldExit);
});
process.on("disconnect", () => { if (heldExit !== undefined) process.exit(heldExit); else void runtime.stop(); });
