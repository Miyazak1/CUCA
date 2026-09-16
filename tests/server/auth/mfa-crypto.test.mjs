import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTotpUri,
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  mfaKeyringFromEnv,
  recoveryCodeHash,
  totpCode,
  verifyTotpCode,
} from "../../../src/server/auth/mfa-crypto.ts";

const key = Buffer.alloc(32, 7).toString("base64url");
const keyring = mfaKeyringFromEnv({
  CUAC_AUTH_MFA_ACTIVE_KEY_ID: "test-v1",
  CUAC_AUTH_MFA_KEYS_JSON: JSON.stringify({ "test-v1": key }),
});

test("TOTP follows the RFC vector, accepts bounded clock skew and rejects counter replay", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const at = new Date(59_000);
  const value = totpCode(secret, at);
  assert.deepEqual(value, { code: "287082", counter: 1 });
  assert.deepEqual(verifyTotpCode(secret, value.code, at), { valid: true, counter: 1 });
  assert.deepEqual(verifyTotpCode(secret, value.code, at, 1), { valid: false, counter: null });
  assert.equal(verifyTotpCode(secret, "287082", new Date(60_000)).valid, true);
  assert.equal(verifyTotpCode(secret, "12345", at).valid, false);
});

test("MFA secrets are random, encrypted with authenticated context and never embedded in recovery hashes", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const encrypted = encryptMfaSecret(secret, keyring);
  assert.equal(encrypted.keyId, "test-v1");
  assert.equal(encrypted.ciphertext.includes(secret), false);
  assert.equal(decryptMfaSecret(encrypted, keyring), secret);
  assert.throws(() => decryptMfaSecret({ ...encrypted, tag: Buffer.alloc(16).toString("base64url") }, keyring), /cannot be decrypted/);

  const codes = createRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  codes.forEach(code => assert.match(code, /^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){3}$/));
  const hash = recoveryCodeHash(codes[0], keyring);
  assert.match(hash, /^hmac-sha256:test-v1:[a-f0-9]{64}$/);
  assert.equal(hash.includes(codes[0]), false);
});

test("MFA keyring and authenticator URI fail closed around malformed secrets", () => {
  assert.throws(() => mfaKeyringFromEnv({}), /not configured/);
  assert.throws(() => mfaKeyringFromEnv({ CUAC_AUTH_MFA_ACTIVE_KEY_ID: "v1", CUAC_AUTH_MFA_KEYS_JSON: "{}" }), /unavailable/);
  const uri = buildTotpUri({ secret: "GEZDGNBVGY3TQOJQ", email: "staff+test@example.edu" });
  assert.match(uri, /^otpauth:\/\/totp\/CUAC%3Astaff%2Btest%40example\.edu\?/);
  assert.match(uri, /issuer=CUAC/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});
