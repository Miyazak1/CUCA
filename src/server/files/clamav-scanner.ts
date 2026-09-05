import { createHash } from "node:crypto";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { serviceUnavailable } from "../shared/errors.ts";

export type PrivateFileScanResult = {
  outcome: "clean" | "malware" | "scan_error";
  actualSha256: string | null;
  observedBytes: number;
  provider: string;
};

export type PrivateFileScanner = {
  scan(stream: Readable, maximumBytes: number): Promise<PrivateFileScanResult>;
};

type ScannerDependencies = {
  spawn(command: string, args: readonly string[]): ChildProcessByStdio<Writable, null, null>;
  timeoutMilliseconds?: number;
};

const defaultDependencies: ScannerDependencies = {
  spawn: (command, args) => spawn(command, args, { stdio: ["pipe", "ignore", "ignore"], windowsHide: true }),
};

export function createClamAvScannerFromEnv(
  env: Record<string, string | undefined> = process.env,
  dependencies: ScannerDependencies = defaultDependencies,
): PrivateFileScanner {
  const command = env.CUAC_CLAMDSCAN_PATH?.trim() || "clamdscan";
  if (command.length > 512 || hasControlCharacter(command)) throw serviceUnavailable("Malware scanner configuration is unavailable.");
  return new ClamAvCliScanner(command, dependencies);
}

export class ClamAvCliScanner implements PrivateFileScanner {
  private readonly command: string;
  private readonly dependencies: ScannerDependencies;

  constructor(command = "clamdscan", dependencies: ScannerDependencies = defaultDependencies) {
    if (!command || command.length > 512 || hasControlCharacter(command)) throw serviceUnavailable("Malware scanner configuration is unavailable.");
    this.command = command;
    this.dependencies = dependencies;
  }

  async scan(stream: Readable, maximumBytes: number): Promise<PrivateFileScanResult> {
    if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 100 * 1024 * 1024) {
      throw serviceUnavailable("Malware scan size policy is unavailable.");
    }
    const child = this.dependencies.spawn(this.command, ["--stream", "--no-summary"]);
    const digest = createHash("sha256");
    let observedBytes = 0;
    let exceeded = false;
    const timeout = setTimeout(() => child.kill(), this.dependencies.timeoutMilliseconds ?? 120_000);
    try {
      const exit = new Promise<number | null>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        observedBytes += buffer.byteLength;
        if (observedBytes > maximumBytes) {
          exceeded = true;
          stream.destroy();
          child.stdin.destroy();
          child.kill();
          break;
        }
        digest.update(buffer);
        if (!child.stdin.write(buffer)) await onceDrain(child.stdin);
      }
      if (!exceeded) child.stdin.end();
      const code = await exit;
      if (exceeded) return { outcome: "scan_error", actualSha256: null, observedBytes, provider: "clamav" };
      return {
        outcome: code === 0 ? "clean" : code === 1 ? "malware" : "scan_error",
        actualSha256: code === 0 || code === 1 ? digest.digest("hex") : null,
        observedBytes,
        provider: "clamav",
      };
    } catch {
      child.kill();
      return { outcome: "scan_error", actualSha256: null, observedBytes, provider: "clamav" };
    } finally {
      clearTimeout(timeout);
      stream.destroy();
    }
  }
}

function onceDrain(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once("drain", resolve);
    stream.once("error", reject);
  });
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
