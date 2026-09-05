import { randomUUID } from "node:crypto";
import { badRequest, CuacError, forbidden, serviceUnavailable, toErrorEnvelope } from "./errors.ts";
import { getApplicationLifecycle } from "./application-lifecycle.ts";
import { publicApiOrigin, type RuntimeEnv } from "./http-config.ts";
import { inputUuid } from "./input.ts";

export const API_BODY_LIMIT_BYTES = 64 * 1024;
type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export function secureApiRoute<Args extends unknown[]>(
  method: ApiMethod,
  handler: (request: Request, ...args: Args) => Promise<Response>,
  options: { env?: RuntimeEnv; body?: "json" | "empty" | "raw"; origin?: "same-origin" | "signed-external" } = {},
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const requestId = randomUUID();
    let response: Response;
    let releaseRequest: (() => void) | undefined;
    try {
      releaseRequest = getApplicationLifecycle().enterRequest();
      if (!releaseRequest) throw serviceUnavailable("Application is shutting down.");
      if (request.method !== method) throw new CuacError("METHOD_NOT_ALLOWED", "Method is not allowed.", 405);
      const headers = new Headers(request.headers);
      headers.set("x-request-id", requestId);
      let body: string | undefined;
      if (method !== "GET") {
        if (options.origin === "signed-external" && options.body !== "raw") {
          throw serviceUnavailable("External signed routes must preserve the raw request body.");
        }
        if (options.origin !== "signed-external") {
          const expectedOrigin = publicApiOrigin(options.env, request.url);
          if (request.headers.get("origin") !== expectedOrigin) throw forbidden("A matching Origin header is required.");
          const site = request.headers.get("sec-fetch-site");
          if (site && site !== "same-origin") throw forbidden("Cross-site browser writes are not allowed.");
        }
        if (options.body === "empty") await readBodyBytes(request, 0);
        else if (options.body !== "raw") body = JSON.stringify(await readJsonObject(request));
        headers.delete("content-length");
      }
      const safeRequest = options.body === "raw"
        ? new Request(request, { headers, signal: request.signal })
        : new Request(request.url, { method, headers, body, signal: request.signal });
      response = await handler(safeRequest, ...args);
    } catch (error) {
      response = Response.json(toErrorEnvelope(error, requestId), { status: error instanceof CuacError ? error.status : 500 });
      if (response.status === 405) response.headers.set("allow", method);
    } finally {
      releaseRequest?.();
    }
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    headers.set("pragma", "no-cache");
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-request-id", requestId);
    // This is a same-origin browser API; do not accidentally inherit permissive CORS.
    headers.delete("access-control-allow-origin");
    headers.delete("access-control-allow-credentials");
    return new Response(response.body, { status: response.status, headers });
  };
}

export function requireRouteUuid(value: unknown): string {
  return inputUuid(value, "Route identifier");
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")
    || ![null, "identity"].includes(request.headers.get("content-encoding"))) {
    throw new CuacError("UNSUPPORTED_MEDIA_TYPE", "Use an uncompressed application/json request body.", 415);
  }
  if (!request.body) throw badRequest("A JSON object body is required.");
  const bytes = await readBodyBytes(request, API_BODY_LIMIT_BYTES);
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw badRequest("Request body must be valid UTF-8 JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw badRequest("A JSON object body is required.");
  validateJsonTree(parsed);
  return parsed as Record<string, unknown>;
}

async function readBodyBytes(request: Request, limit: number): Promise<Uint8Array> {
  if (![null, "identity"].includes(request.headers.get("content-encoding"))) {
    throw new CuacError("UNSUPPORTED_MEDIA_TYPE", "Compressed request bodies are not supported.", 415);
  }
  const tooLarge = () => limit === 0 ? badRequest("Request body must be empty.")
    : new CuacError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw tooLarge();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CuacError("REQUEST_TIMEOUT", "Request body timed out.", 408)), 5000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw tooLarge();
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function validateJsonTree(value: unknown, depth = 0): void {
  if (depth > 16) throw badRequest("JSON nesting is too deep.");
  if (typeof value === "number" && !Number.isFinite(value)) throw badRequest("JSON numbers must be finite.");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw badRequest("JSON contains a reserved property.");
    validateJsonTree(child, depth + 1);
  }
}
