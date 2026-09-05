import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import test from "node:test";
import { ClamAvCliScanner } from "../../../src/server/index.ts";

function fakeProcess(exitCode, calls) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  const chunks = [];
  child.stdin.on("data", chunk => chunks.push(chunk));
  child.stdin.on("finish", () => queueMicrotask(() => child.emit("close", exitCode)));
  child.kill = () => { queueMicrotask(() => child.emit("close", 2)); return true; };
  calls.push({ child, chunks });
  return child;
}

test("ClamAV scanner streams bytes, computes SHA-256 and maps reviewed exit codes", async () => {
  for (const [exitCode, outcome] of [[0, "clean"], [1, "malware"], [2, "scan_error"]]) {
    const calls = [];
    const scanner = new ClamAvCliScanner("clamdscan", {
      spawn(command, args) {
        assert.equal(command, "clamdscan");
        assert.deepEqual(args, ["--stream", "--no-summary"]);
        return fakeProcess(exitCode, calls);
      },
      timeoutMilliseconds: 1_000,
    });
    const result = await scanner.scan(Readable.from([Buffer.from("abc"), Buffer.from("def")]), 6);
    assert.equal(result.outcome, outcome);
    assert.equal(result.observedBytes, 6);
    assert.equal(Buffer.concat(calls[0].chunks).toString(), "abcdef");
    assert.equal(result.actualSha256, exitCode < 2 ? createHash("sha256").update("abcdef").digest("hex") : null);
    assert.equal(result.provider, "clamav");
  }
});

test("ClamAV scanner refuses streams larger than the authorized object", async () => {
  const scanner = new ClamAvCliScanner("clamdscan", { spawn: () => fakeProcess(0, []), timeoutMilliseconds: 1_000 });
  const result = await scanner.scan(Readable.from([Buffer.alloc(8)]), 7);
  assert.equal(result.outcome, "scan_error");
  assert.equal(result.actualSha256, null);
  assert.equal(result.observedBytes, 8);
});
