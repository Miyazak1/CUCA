import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { serviceUnavailable } from "../shared/errors.ts";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

export type MfaEncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyId: string;
};

export type MfaKeyring = {
  activeKeyId: string;
  keys: ReadonlyMap<string, Buffer>;
};

export function mfaKeyringFromEnv(env: NodeJS.ProcessEnv = process.env): MfaKeyring {
  const activeKeyId = env.CUAC_AUTH_MFA_ACTIVE_KEY_ID?.trim();
  const source = env.CUAC_AUTH_MFA_KEYS_JSON;
  if (!activeKeyId || !source) throw serviceUnavailable("MFA encryption keyring is not configured.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw serviceUnavailable("MFA encryption keyring is invalid.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw serviceUnavailable("MFA encryption keyring is invalid.");
  }
  const keys = new Map<string, Buffer>();
  for (const [keyId, encoded] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof encoded !== "string") {
      throw serviceUnavailable("MFA encryption keyring is invalid.");
    }
    const key = Buffer.from(encoded, "base64url");
    if (key.length !== 32 || key.toString("base64url") !== encoded) {
      throw serviceUnavailable("MFA encryption keys must be 32-byte base64url values.");
    }
    keys.set(keyId, key);
  }
  if (!keys.has(activeKeyId)) throw serviceUnavailable("MFA active encryption key is unavailable.");
  return { activeKeyId, keys };
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function encryptMfaSecret(secret: string, keyring: MfaKeyring): MfaEncryptedSecret {
  const key = requiredKey(keyring, keyring.activeKeyId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`cuac:mfa:totp:${keyring.activeKeyId}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    keyId: keyring.activeKeyId,
  };
}

export function decryptMfaSecret(value: MfaEncryptedSecret, keyring: MfaKeyring): string {
  try {
    const decipher = createDecipheriv("aes-256-gcm", requiredKey(keyring, value.keyId), Buffer.from(value.iv, "base64url"));
    decipher.setAAD(Buffer.from(`cuac:mfa:totp:${value.keyId}`, "utf8"));
    decipher.setAuthTag(Buffer.from(value.tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw serviceUnavailable("MFA secret cannot be decrypted with the configured keyring.");
  }
}

export function totpCode(secret: string, at: Date = new Date()): { code: string; counter: number } {
  const counter = Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  return { code: hotp(secret, counter), counter };
}

export function verifyTotpCode(
  secret: string,
  input: unknown,
  at: Date = new Date(),
  lastUsedCounter: number | null = null,
): { valid: boolean; counter: number | null } {
  if (typeof input !== "string" || !/^\d{6}$/.test(input)) return { valid: false, counter: null };
  const current = Math.floor(at.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  for (const candidate of [current, current - 1, current + 1]) {
    if (candidate <= (lastUsedCounter ?? -1)) continue;
    const expected = Buffer.from(hotp(secret, candidate));
    if (timingSafeEqual(expected, Buffer.from(input))) return { valid: true, counter: candidate };
  }
  return { valid: false, counter: null };
}

export function createRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const value = encodeBase32(randomBytes(10));
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`;
  });
}

export function recoveryCodeHash(code: string, keyring: MfaKeyring): string {
  const normalized = code.replaceAll("-", "").toUpperCase();
  return `hmac-sha256:${keyring.activeKeyId}:${createHmac("sha256", requiredKey(keyring, keyring.activeKeyId))
    .update(`cuac:mfa:recovery:${normalized}`)
    .digest("hex")}`;
}

export function buildTotpUri(input: { secret: string; email: string; issuer?: string }): string {
  const issuer = input.issuer ?? "CUAC";
  const label = `${issuer}:${input.email}`;
  const query = new URLSearchParams({ secret: input.secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
}

function hotp(secret: string, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of input.replaceAll("=", "").toUpperCase()) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function requiredKey(keyring: MfaKeyring, keyId: string): Buffer {
  const key = keyring.keys.get(keyId);
  if (!key) throw serviceUnavailable("MFA encryption key is unavailable.");
  return key;
}
