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

