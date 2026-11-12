import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const CUAC_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export function applicationSecurityHeaders(
  env: Record<string, string | undefined> = process.env,
): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    "content-security-policy": CUAC_CONTENT_SECURITY_POLICY,
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
  const environment = env.CUAC_ENV?.trim().toLowerCase();
  if (environment === "staging" || environment === "production") {
    headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  }
  return Object.freeze(headers);
}

/** Supply trusted per-request nonces to both the RSC renderer and the browser. */
export function applicationRequestSecurityHeaders(
  request: IncomingMessage,
  env: Record<string, string | undefined> = process.env,
): Readonly<Record<string, string>> {
  const headers = applicationSecurityHeaders(env);
  const path = (request.url || "").split("?")[0];
  const editorialPage = /^\/(?:guides|insights)(?:\/|$)/.test(path) && !path.endsWith(".xml");
  const accountActionPage = /^\/auth\/(?:verify-email|reset-password|school-invite)\/?$/.test(path);
  if (!editorialPage && !accountActionPage) return headers;
  const nonce = randomBytes(18).toString("base64");
  const policy = headers["content-security-policy"]
    .replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`)
    .replace("style-src 'self'", `style-src 'self' 'nonce-${nonce}'`);
  // Incoming CSP values are untrusted; the renderer must see only our policy.
  request.headers["content-security-policy"] = policy;
  request.headers["x-nonce"] = nonce;
  return Object.freeze({ ...headers, "content-security-policy": policy, "cache-control": "private, no-store" });
}

