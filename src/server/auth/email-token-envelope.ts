import { createCipheriv, createDecipheriv, createSecretKey, randomBytes, type KeyObject } from "node:crypto";
import type { AuthEmailMessageType } from "./email-delivery.ts";

export type EmailTokenBinding = {
  id: string;
  userId: string;
  challengeId: string;
  messageType: AuthEmailMessageType;
  expiresAt: Date;
};

export type EmailTokenEnvelope = { version: 1; keyId: string; nonce: string; ciphertext: string; tag: string };

export class EmailTokenEnvelopeError extends Error {
  readonly reason: "key_unavailable" | "invalid_envelope";
  constructor(reason: "key_unavailable" | "invalid_envelope") {
    super("Auth email credential is unavailable.");
    this.reason = reason;
  }
}

const keyIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export class EmailTokenCipher {
  private readonly keys = new Map<string, KeyObject>();
  private readonly activeKeyId: string;

  constructor(input: { activeKeyId: string; keys: ReadonlyMap<string, Uint8Array> }) {
    if (!keyIdPattern.test(input.activeKeyId) || input.keys.size < 1 || input.keys.size > 8) throw new EmailTokenEnvelopeError("key_unavailable");
    for (const [id, key] of input.keys) {
      if (!keyIdPattern.test(id) || !(key instanceof Uint8Array) || key.byteLength !== 32) throw new EmailTokenEnvelopeError("key_unavailable");
      this.keys.set(id, createSecretKey(key));
    }
    if (!this.keys.has(input.activeKeyId)) throw new EmailTokenEnvelopeError("key_unavailable");
    this.activeKeyId = input.activeKeyId;
  }

  seal(binding: EmailTokenBinding, token: string): EmailTokenEnvelope {
    if (!tokenPattern.test(token) || Buffer.from(token, "base64url").toString("base64url") !== token) throw new EmailTokenEnvelopeError("invalid_envelope");
    const keyId = this.activeKeyId;
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keys.get(keyId)!, nonce, { authTagLength: 16 });
    cipher.setAAD(aad(binding, keyId));
    const ciphertext = Buffer.concat([cipher.update(token, "ascii"), cipher.final()]);
    return { version: 1, keyId, nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
  }

  open(binding: EmailTokenBinding, value: unknown): string {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new EmailTokenEnvelopeError("invalid_envelope");
    const data = value as Record<string, unknown>;
    if (Object.keys(data).sort().join(",") !== "ciphertext,keyId,nonce,tag,version" || data.version !== 1 || typeof data.keyId !== "string" || !keyIdPattern.test(data.keyId)) throw new EmailTokenEnvelopeError("invalid_envelope");
    const nonce = decode(data.nonce, 12), tag = decode(data.tag, 16), ciphertext = decode(data.ciphertext, 43);
    const key = this.keys.get(data.keyId);
    if (!key) throw new EmailTokenEnvelopeError("key_unavailable");
    let plaintext: Buffer | undefined;
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
      decipher.setAAD(aad(binding, data.keyId));
      decipher.setAuthTag(tag);
      // Do not use any plaintext until final() authenticates the complete envelope.
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const token = plaintext.toString("ascii");
      if (!tokenPattern.test(token) || Buffer.from(token, "base64url").toString("base64url") !== token) throw new Error();
      return token;
    } catch {
      throw new EmailTokenEnvelopeError("invalid_envelope");
    } finally { plaintext?.fill(0); }
  }
}

function decode(value: unknown, bytes: number): Buffer {
  if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new EmailTokenEnvelopeError("invalid_envelope");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== bytes || decoded.toString("base64url") !== value) throw new EmailTokenEnvelopeError("invalid_envelope");
  return decoded;
}

function aad(binding: EmailTokenBinding, keyId: string): Buffer {
  if (![binding.id, binding.userId, binding.challengeId].every(value => typeof value === "string" && uuidPattern.test(value))
    || !["auth.email_verification", "auth.password_reset"].includes(binding.messageType)
    || !(binding.expiresAt instanceof Date) || !Number.isFinite(binding.expiresAt.getTime())) throw new EmailTokenEnvelopeError("invalid_envelope");
  return Buffer.from(JSON.stringify(["cuac.auth-email-token", 1, keyId, binding.id, binding.userId, binding.challengeId, binding.messageType, binding.expiresAt.toISOString()]));
}
