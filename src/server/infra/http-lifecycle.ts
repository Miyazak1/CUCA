import type { Server, ServerResponse, RequestListener } from "node:http";
import type { Socket } from "node:net";
import { randomUUID } from "node:crypto";
import { getApplicationLifecycle, type ApplicationLifecycle } from "../shared/application-lifecycle.ts";

type StopReason = "SIGTERM" | "SIGINT" | "requested" | "server_error";
type StopOutcome = "drained" | "deadline" | "failed";
export type ShutdownResult = { outcome: StopOutcome; code: number; reason: StopReason; activeRequests: number; closedResources: string[] };
type Options = {
  timeoutMs?: number;
  lifecycle?: ApplicationLifecycle;
  exit?: (code: number) => void;
  onEvent?: (event: { event: string; reason?: StopReason; outcome?: StopOutcome; activeRequests: number; closedResources?: string[] }) => void;
};

export function installHttpLifecycle(server: Server, options: Options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) throw new Error("HTTP shutdown deadline must be between 1000 and 120000 milliseconds.");
  const lifecycle = options.lifecycle ?? getApplicationLifecycle();
  const listeners = server.listeners("request");
  if (listeners.length !== 1 || lifecycle.snapshot().phase !== "running") throw new Error("HTTP lifecycle requires one owned request handler and a running application.");
  const handler = listeners[0] as RequestListener;
  const sockets = new Set<Socket>();
  const responses = new Set<ServerResponse>();
  let stopping: Promise<ShutdownResult> | undefined;
  const exit = options.exit ?? (code => process.exit(code));
  const report = (event: Parameters<NonNullable<Options["onEvent"]>>[0]) => { try { options.onEvent?.(event); } catch { /* Diagnostic sinks do not own shutdown. */ } };

  const request: RequestListener = (req, res) => {
    if (lifecycle.snapshot().phase !== "running") {
      const requestId = randomUUID();
      res.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", pragma: "no-cache",
        "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-request-id": requestId, connection: "close" });
      res.end(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Application is shutting down.", requestId } }));
      return;
    }
    responses.add(res);
    const responseDone = () => { responses.delete(res); res.removeListener("finish", responseDone); res.removeListener("close", responseDone); };
    res.once("finish", responseDone); res.once("close", responseDone);
    try {
      Promise.resolve(handler.call(server, req, res)).catch(() => { res.destroy(); void stop("server_error"); });
    } catch { res.destroy(); void stop("server_error"); }
  };
  const connected = (socket: Socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); };
  server.removeListener("request", handler);
  server.on("request", request);
  server.on("connection", connected);
  const terminate = () => { void stop("SIGTERM"); };
  const interrupt = () => { void stop("SIGINT"); };
  const serverError = () => { void stop("server_error"); };
  process.on("SIGTERM", terminate);
  process.on("SIGINT", interrupt);
  server.on("error", serverError);

  function stop(reason: StopReason = "requested"): Promise<ShutdownResult> {
    if (stopping) return stopping;
    lifecycle.beginDrain();
    for (const response of responses) {
      response.shouldKeepAlive = false;
      if (!response.headersSent) response.setHeader("connection", "close");
    }
    let resolveResult: (result: ShutdownResult) => void;
    stopping = new Promise(resolve => { resolveResult = resolve; });
    let finished = false;
    const complete = (outcome: StopOutcome, closedResources: string[] = []) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      const code = outcome === "drained" && reason !== "server_error" ? 0 : 1;
      if (code !== 0) {
        server.closeAllConnections();
        for (const socket of sockets) socket.destroy();
      }
      process.removeListener("SIGTERM", terminate);
      process.removeListener("SIGINT", interrupt);
      server.removeListener("connection", connected);
      server.removeListener("error", serverError);
      const result = { outcome, code, reason, activeRequests: lifecycle.snapshot().activeRequests, closedResources };
      report({ event: "application.stopped", ...result });
      resolveResult(result);
      exit(code);
    };
    // Keep a referenced timer until HTTP, abandoned API work and registered resources all finish.
    const deadline = setTimeout(() => complete("deadline"), timeoutMs);
    report({ event: "application.draining", reason, activeRequests: lifecycle.snapshot().activeRequests });
    const httpClosed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeIdleConnections();
    void Promise.all([httpClosed, lifecycle.waitForRequests()]).then(async () => {
      const names = lifecycle.snapshot().resources;
      await lifecycle.closeResources();
      complete("drained", names);
    }).catch(() => complete("failed"));
    return stopping;
  }
  return { stop, snapshot: () => lifecycle.snapshot() };
}
