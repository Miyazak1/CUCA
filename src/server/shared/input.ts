import { badRequest } from "./errors.ts";

const authorityFields = ["userId", "actorUserId", "role", "activeRole", "tenantSchoolId", "selectedSurface"];

export function inputRecord(value: unknown, fields: readonly string[], ignoreAuthority = false): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw badRequest("Input must be an object.");
  if (Object.keys(value).some((key) => !fields.includes(key) && !(ignoreAuthority && authorityFields.includes(key)))) {
    throw badRequest("Input contains unsupported fields.");
  }
  return Object.fromEntries(fields.filter((key) => Object.hasOwn(value, key)).map((key) => [key, (value as Record<string, unknown>)[key]]));
}

export function inputText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength || Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
  })) {
    throw badRequest(`${field} must be bounded text without control characters.`);
  }
  const text = value.trim();
  if (!text) throw badRequest(`${field} must not be empty.`);
  return text;
}

export function inputUuid(value: unknown, field = "Identifier"): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    throw badRequest(`${field} must be a UUID.`);
  }
  return value.toLowerCase();
}

export function inputEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw badRequest(`${field} is not supported.`);
  return value as T;
}

export function inputInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw badRequest(`${field} must be an integer in the allowed range.`);
  }
  return value;
}

export function inputList<T>(value: unknown, field: string, max: number, parse: (entry: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) throw badRequest(`${field} must be a bounded list.`);
  const items = Array.from(value, parse);
  if (new Set(items).size !== items.length) throw badRequest(`${field} contains duplicate values.`);
  return items;
}
