import { badRequest } from "../shared/errors.ts";
import { inputRecord, inputText } from "../shared/input.ts";

const ignoredAuthority = ["schoolId", "invitedByUserId", "revokedByUserId"];

export function authInput(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const record = inputRecord(value, [...fields, ...ignoredAuthority], true);
  return Object.fromEntries(fields.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
}

export async function readAuthBody(request: Request, fields: readonly string[]): Promise<Record<string, unknown>> {
  let value: unknown = {};
  try {
    if (request.body) value = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return authInput(value, fields);
}

export function authEmail(value: unknown): { original: string; normalized: string } {
  if (typeof value !== "string" || value.length > 320) throw badRequest("Email must be valid bounded text.");
  const original = value.trim();
  const parts = original.split("@");
  const [local, domain] = parts;
  if (parts.length !== 2 || original.length > 254 || !local || local.length > 64
    || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local)
    || local.startsWith(".") || local.endsWith(".") || local.includes("..")
    || !domain || !domain.includes(".")
    || domain.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    throw badRequest("Email must be a valid supported address.");
  }
  return { original, normalized: original.toLowerCase() };
}

export function authPassword(value: unknown, creating: boolean): string {
  if (typeof value !== "string" || value.length > 1024 || Buffer.byteLength(value, "utf8") > 1024
    || Array.from(value).some((character) => {
      const code = character.codePointAt(0)!;
      return code >= 0xd800 && code <= 0xdfff;
    })) throw badRequest("Password must be valid text within 1024 UTF-8 bytes.");
  // Login verifies legacy hashes; the new-password policy applies only on creation/reset.
  if (Array.from(value).length < (creating ? 15 : 1)) {
    throw badRequest(creating ? "Password must be at least 15 characters." : "Password is required.");
  }
  return value;
}

export function authDisplayName(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return inputText(value, "Display name", 120);
}

export function authToken(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)
    || Buffer.from(value, "base64url").toString("base64url") !== value) {
    throw badRequest("Token must be a valid 32-byte base64url value.");
  }
  return value;
}

export function authOptionalText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return inputText(value, field, max);
}

export function authRateLimitEmail(value: unknown): string | null {
  return typeof value === "string" && value.length <= 320 ? value : null;
}
