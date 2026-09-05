import { createCipheriv, createDecipheriv, createSecretKey, randomBytes, type KeyObject } from "node:crypto";
import {
  APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
  MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES,
  type ApplicationMaterialSnapshotBinding,
} from "./application-material-snapshot.ts";

export type ApplicationMaterialSnapshotEnvelope = {
  version: 1;
  keyId: string;
  nonce: string;
  ciphertext: string;
  tag: string;
};

export class ApplicationMaterialSnapshotEnvelopeError extends Error {
  readonly reason: "key_unavailable" | "invalid_envelope";
  constructor(reason: "key_unavailable" | "invalid_envelope") {
    super("Application material snapshot encryption is unavailable.");
    this.reason = reason;
  }
}

const keyIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digestPattern = /^[a-f0-9]{64}$/;

export class ApplicationMaterialSnapshotCipher {
  private readonly keys = new Map<string, KeyObject>();
  private readonly activeKeyId: string;

  constructor(input: { activeKeyId: string; keys: ReadonlyMap<string, Uint8Array> }) {
    if (!keyIdPattern.test(input.activeKeyId) || input.keys.size < 1 || input.keys.size > 8) throw unavailable();
    for (const [id, key] of input.keys) {
      if (!keyIdPattern.test(id) || !(key instanceof Uint8Array) || key.byteLength !== 32) throw unavailable();
      this.keys.set(id, createSecretKey(key));
    }
    if (!this.keys.has(input.activeKeyId)) throw unavailable();
    this.activeKeyId = input.activeKeyId;
  }

  seal(binding: ApplicationMaterialSnapshotBinding, plaintext: string): ApplicationMaterialSnapshotEnvelope {
    const bytes = Buffer.from(plaintext, "utf8");
    if (bytes.length < 1 || bytes.length > MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES || bytes.toString("utf8") !== plaintext) throw invalid();
    const keyId = this.activeKeyId, nonce = randomBytes(12);
    try {
      const cipher = createCipheriv("aes-256-gcm", this.keys.get(keyId)!, nonce, { authTagLength: 16 });
      cipher.setAAD(aad(binding, keyId));
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
      return { version: 1, keyId, nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url") };
    } finally { bytes.fill(0); }
  }

  open(binding: ApplicationMaterialSnapshotBinding, value: unknown): string {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    const data = value as Record<string, unknown>;
    if (Object.keys(data).sort().join(",") !== "ciphertext,keyId,nonce,tag,version" || data.version !== 1
      || typeof data.keyId !== "string" || !keyIdPattern.test(data.keyId)) throw invalid();
    const nonce = decode(data.nonce, 12, 12), tag = decode(data.tag, 16, 16);
    const ciphertext = decode(data.ciphertext, 1, MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES);
    const key = this.keys.get(data.keyId);
    if (!key) throw unavailable();
    let plaintext: Buffer | undefined;
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
      decipher.setAAD(aad(binding, data.keyId));
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      if (plaintext.length < 1 || plaintext.length > MAX_APPLICATION_MATERIAL_SNAPSHOT_BYTES) throw new Error();
      const value = plaintext.toString("utf8");
      if (!Buffer.from(value, "utf8").equals(plaintext)) throw new Error();
      return value;
    } catch {
      throw invalid();
    } finally { plaintext?.fill(0); ciphertext.fill(0); }
  }
}

export function resolveApplicationMaterialSnapshotCipher(
  env: Record<string, string | undefined> = process.env,
): ApplicationMaterialSnapshotCipher {
  const activeKeyId = env.CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID;
  const encoded = env.CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON;
  if (!activeKeyId || !encoded || encoded.length > 4096) throw unavailable();
  let value: unknown;
  try { value = JSON.parse(encoded); } catch { throw unavailable(); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw unavailable();
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length < 1 || entries.length > 8) throw unavailable();
  const keys = new Map<string, Uint8Array>();
  for (const [id, raw] of entries) {
    if (!keyIdPattern.test(id) || typeof raw !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(raw)) throw unavailable();
    const key = Buffer.from(raw, "base64url");
    if (key.length !== 32 || key.toString("base64url") !== raw) throw unavailable();
    keys.set(id, key);
  }
  return new ApplicationMaterialSnapshotCipher({ activeKeyId, keys });
}

function aad(binding: ApplicationMaterialSnapshotBinding, keyId: string): Buffer {
  const ids = [binding.snapshotId, binding.userId, binding.applicationSetId, binding.choiceId, binding.schoolId,
    binding.programId, binding.programIntakeId, binding.authorizationId];
  const digests = [binding.authorizationScopeSha256, binding.materialContentSha256, binding.payloadSha256];
  if (!ids.every(value => typeof value === "string" && uuidPattern.test(value))
    || !digests.every(value => typeof value === "string" && digestPattern.test(value))
    || binding.payloadFormat !== APPLICATION_MATERIAL_SNAPSHOT_FORMAT || !keyIdPattern.test(keyId)
    || !(binding.capturedAt instanceof Date) || !Number.isFinite(binding.capturedAt.getTime())) throw invalid();
  return Buffer.from(JSON.stringify(["cuac.application-material-snapshot", 1, keyId, ...ids, ...digests,
    binding.payloadFormat, binding.capturedAt.toISOString()]));
}

function decode(value: unknown, minBytes: number, maxBytes: number): Buffer {
  if (typeof value !== "string" || value.length < 2 || value.length > Math.ceil(maxBytes * 4 / 3) + 2
    || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length < minBytes || decoded.length > maxBytes || decoded.toString("base64url") !== value) throw invalid();
  return decoded;
}

const unavailable = () => new ApplicationMaterialSnapshotEnvelopeError("key_unavailable");
const invalid = () => new ApplicationMaterialSnapshotEnvelopeError("invalid_envelope");
