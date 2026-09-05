import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";
import { authPassword } from "./input.ts";

export type PasswordHashProfile = "scrypt_v1" | "scrypt_v2";
export type PasswordVerification = {
  valid: boolean;
  upgradedHash: string | null;
};

export type PasswordHasher = {
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string | null): Promise<boolean>;
  verifyForLogin(password: string, storedHash: string | null): Promise<PasswordVerification>;
};

type DeriveKey = (password: string, salt: string, profile: PasswordHashProfile) => Promise<Buffer>;
type ParsedHash = { profile: PasswordHashProfile; salt: string; expected: Buffer };
const keyLength = 64;
const maxConcurrent = 2;
const dummySalt = Buffer.alloc(16).toString("base64url");
// v1 preserves the implicit parameters and TEXT salt used by existing records.
const legacyOptions = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const currentOptions = Object.freeze({ N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });

function deriveKey(password: string, salt: string, profile: PasswordHashProfile): Promise<Buffer> {
  const options = profile === "scrypt_v1" ? legacyOptions : currentOptions;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export function createPasswordHasher(derive: DeriveKey = deriveKey): PasswordHasher {
  let active = 0;
  async function run<T>(work: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) throw serviceUnavailable("Password processing is busy. Try again later.");
    active += 1;
    try {
      return await work();
    } catch {
      throw serviceUnavailable("Password processing is temporarily unavailable.");
    } finally {
      active -= 1;
    }
  }

  async function deriveChecked(password: string, salt: string, profile: PasswordHashProfile): Promise<Buffer> {
    const key = await derive(password, salt, profile);
    if (!Buffer.isBuffer(key) || key.length !== keyLength) {
      if (Buffer.isBuffer(key)) key.fill(0);
      throw new Error("Invalid derived key.");
    }
    return key;
  }

  async function verifyInternal(password: string, storedHash: string | null, includeUpgrade: boolean): Promise<PasswordVerification> {
    const value = authPassword(password, false);
    return run(async () => {
      const parsed = parseHash(storedHash);
      const legacyExpected = parsed?.profile === "scrypt_v1" ? parsed.expected : Buffer.alloc(keyLength);
      const currentExpected = parsed?.profile === "scrypt_v2" ? parsed.expected : Buffer.alloc(keyLength);
      const currentSalt = parsed?.profile === "scrypt_v2" ? parsed.salt : randomBytes(16).toString("base64url");
      let legacyKey: Buffer | undefined;
      let currentKey: Buffer | undefined;
      try {
        legacyKey = await deriveChecked(value, parsed?.profile === "scrypt_v1" ? parsed.salt : dummySalt, "scrypt_v1");
        const legacyMatches = timingSafeEqual(legacyKey, legacyExpected);
        legacyKey.fill(0);
        legacyKey = undefined;
        legacyExpected.fill(0);
        currentKey = await deriveChecked(value, currentSalt, "scrypt_v2");
        const currentMatches = timingSafeEqual(currentKey, currentExpected);
        const valid = parsed?.profile === "scrypt_v1" ? legacyMatches : parsed?.profile === "scrypt_v2" && currentMatches;
        return {
          valid,
          upgradedHash: includeUpgrade && parsed?.profile === "scrypt_v1" && legacyMatches
            ? encodeHash("scrypt_v2", currentSalt, currentKey)
            : null,
        };
      } finally {
        legacyKey?.fill(0);
        currentKey?.fill(0);
        legacyExpected.fill(0);
        currentExpected.fill(0);
      }
    });
  }

  return Object.freeze({
    async hash(password: string) {
      const value = authPassword(password, false);
      return run(async () => {
        const salt = randomBytes(16).toString("base64url");
        const key = await deriveChecked(value, salt, "scrypt_v2");
        try {
          return encodeHash("scrypt_v2", salt, key);
        } finally {
          key.fill(0);
        }
      });
    },
    async verify(password: string, storedHash: string | null) {
      return (await verifyInternal(password, storedHash, false)).valid;
    },
    async verifyForLogin(password: string, storedHash: string | null) {
      return verifyInternal(password, storedHash, true);
    },
  });
}

function encodeHash(profile: PasswordHashProfile, salt: string, key: Buffer): string {
  const prefix = profile === "scrypt_v1" ? "scrypt" : "scrypt$v2$32768$8$3";
  return `${prefix}$${salt}$${key.toString("base64url")}`;
}

function decodeHash(match: RegExpExecArray, profile: PasswordHashProfile): ParsedHash | null {
  const saltText = match[1];
  const expectedText = match[2];
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(expectedText, "base64url");
  const canonical = salt.length === 16 && expected.length === keyLength
    && salt.toString("base64url") === saltText && expected.toString("base64url") === expectedText;
  salt.fill(0);
  if (!canonical) {
    expected.fill(0);
    return null;
  }
  return { profile, salt: saltText, expected };
}

function parseHash(value: string | null): ParsedHash | null {
  if (typeof value !== "string") return null;
  const profile: PasswordHashProfile | null = value.length === 116 ? "scrypt_v1" : value.length === 129 ? "scrypt_v2" : null;
  if (!profile) return null;
  const match = profile === "scrypt_v1"
    ? /^scrypt\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/.exec(value)
    : /^scrypt\$v2\$32768\$8\$3\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/.exec(value);
  if (!match) return null;
  return decodeHash(match, profile);
}

export function classifyPasswordHash(value: string | null): PasswordHashProfile | null {
  const parsed = parseHash(value);
  try {
    return parsed?.profile ?? null;
  } finally {
    parsed?.expected.fill(0);
  }
}

// All production services in this module instance share one admission limit.
export const passwordHasher = createPasswordHasher();
export const hashPassword = passwordHasher.hash;
export const verifyPassword = passwordHasher.verify;
export const verifyPasswordForLogin = passwordHasher.verifyForLogin;
