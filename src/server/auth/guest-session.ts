import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";
import { isDeployedEnvironment, type RuntimeEnv } from "../shared/http-config.ts";

export const GUEST_SESSION_COOKIE_NAME = "cuac_guest";
export const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
let localSecret: string | undefined;

function guestSigningKey(env: RuntimeEnv): string {
  const configured = env.CUAC_SESSION_SECRET ?? env.SESSION_SECRET;
  if (configured) {
    if (configured.length < 32 || /replace-with|placeholder|changeme/i.test(configured)) throw serviceUnavailable("A strong session signing secret is required.");
    return configured;
  }
  if (isDeployedEnvironment(env)) throw serviceUnavailable("Session signing secret is not configured.");
  return localSecret ??= randomBytes(32).toString("base64url");
}

function signature(payload: string, env: RuntimeEnv): string {
  return createHmac("sha256", guestSigningKey(env)).update(`cuac:guest:v1:${payload}`).digest("base64url");
}

export function issueGuestSession(now = new Date(), env: RuntimeEnv = process.env) {
  const payload = `v1.${now.getTime()}.${randomBytes(32).toString("base64url")}`;
  const token = `${payload}.${signature(payload, env)}`;
  return { token, guestSessionId: guestId(payload), expiresAt: new Date(now.getTime() + GUEST_SESSION_TTL_MS) };
}

export function verifyGuestSession(token: string | null | undefined, now = new Date(), env: RuntimeEnv = process.env): string | null {
  if (!token || token.length > 200) return null;
  const match = /^(v1\.(\d{13})\.[A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const issuedAt = Number(match[2]);
  if (issuedAt > now.getTime() + 60_000 || issuedAt + GUEST_SESSION_TTL_MS <= now.getTime()) return null;
  const expected = Buffer.from(signature(match[1], env));
  const supplied = Buffer.from(match[3]);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? guestId(match[1]) : null;
}

function guestId(payload: string): string {
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export function guestSessionCookie(token: string, secure: boolean): string {
  return `${GUEST_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearGuestSessionCookie(secure: boolean): string {
  return `${guestSessionCookie("", secure)}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
