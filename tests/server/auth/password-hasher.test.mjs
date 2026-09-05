import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import test from "node:test";
import { classifyPasswordHash, createPasswordHasher, hashPassword, verifyPassword, verifyPasswordForLogin } from "../../../src/server/auth/password-hasher.ts";
import { AuthCredentialsService } from "../../../src/server/auth/credentials.ts";
import { PasswordResetService } from "../../../src/server/auth/password-reset.ts";
import { createAuthCredentialsHttpHandlers } from "../../../src/server/auth/credentials-http.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";

const password = "  synthetic credential with whitespace  ";
const salt = Buffer.from("0123456789abcdef").toString("base64url");
const legacyOptions = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const currentOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const legacyHash = `scrypt$${salt}$${scryptSync(password, salt, 64, legacyOptions).toString("base64url")}`;

async function waitForJobs(jobs, count) {
  for (let attempt = 0; attempt < 100 && jobs.length < count; attempt += 1) await nextTurn();
  assert.equal(jobs.length, count, `expected ${count} password jobs`);
}

test("new hashes use the fixed v2 profile while legacy text-salt records verify and produce a v2 upgrade", async () => {
  let settled = false;
  const pending = hashPassword(password).then(value => { settled = true; return value; });
  assert.ok(pending instanceof Promise);
  await nextTurn();
  assert.equal(settled, false);
  const hash = await pending;
  assert.equal(hash.length, 129);
  assert.equal(classifyPasswordHash(hash), "scrypt_v2");
  assert.equal(classifyPasswordHash(legacyHash), "scrypt_v1");
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password, legacyHash), true);
  assert.equal(await verifyPassword(password.trim(), legacyHash), false);
  const [algorithm, version, n, r, p, generatedSalt, expected] = hash.split("$");
  assert.deepEqual([algorithm, version, n, r, p], ["scrypt", "v2", "32768", "8", "3"]);
  assert.equal(scryptSync(password, generatedSalt, 64, currentOptions).toString("base64url"), expected);
  const current = await verifyPasswordForLogin(password, hash);
  assert.deepEqual(current, { valid: true, upgradedHash: null });
  const legacy = await verifyPasswordForLogin(password, legacyHash);
  assert.equal(legacy.valid, true);
  assert.equal(classifyPasswordHash(legacy.upgradedHash), "scrypt_v2");
  assert.equal(await verifyPassword(password, legacy.upgradedHash), true);
  assert.deepEqual(await verifyPasswordForLogin("wrong password", legacyHash), { valid: false, upgradedHash: null });
});

test("verification rejects unapproved profiles and malformed records after the same fixed two-profile work", async () => {
  const calls = [];
  const hasher = createPasswordHasher(async (...input) => { calls.push(input); return Buffer.alloc(64); });
  const zeroSalt = Buffer.alloc(16).toString("base64url");
  const zeroHash = Buffer.alloc(64).toString("base64url");
  const malformed = [null, "", `${legacyHash}$ignored`, `${legacyHash}\n`, `${legacyHash}=`, legacyHash.replace("scrypt$", "bcrypt$"),
    `scrypt$${zeroSalt.slice(0, -1)}B$${zeroHash}`, `scrypt$${zeroSalt}$${zeroHash.slice(0, -1)}B`,
    `scrypt$v2$65536$8$3$${zeroSalt}$${zeroHash}`, `scrypt$v2$32768$8$2$${zeroSalt}$${zeroHash}`,
    `scrypt$${salt.slice(1)}$${zeroHash}`, "scrypt$salt$hash", "scrypt$" + "x".repeat(10000)];
  for (const value of malformed) {
    assert.equal(classifyPasswordHash(value), null);
    assert.equal(await hasher.verify(password, value), false);
  }
  assert.equal(calls.length, malformed.length * 2);
  for (let index = 0; index < calls.length; index += 2) {
    assert.deepEqual([calls[index][0], calls[index][1], calls[index][2]], [password, zeroSalt, "scrypt_v1"]);
    assert.equal(calls[index + 1][0], password);
    assert.match(calls[index + 1][1], /^[A-Za-z0-9_-]{22}$/);
    assert.equal(calls[index + 1][2], "scrypt_v2");
  }
  assert.equal(await verifyPassword(password, `${legacyHash}$ignored`), false);
});

test("default hash and verify share a two-job limit without accumulating a queue", async () => {
  const first = hashPassword(password);
  const second = verifyPassword(password, null);
  try {
    await assert.rejects(hashPassword(password), error => error.status === 503 && /busy/.test(error.message));
  } finally {
    const results = await Promise.all([first, second]);
    assert.equal(results[1], false);
  }
  assert.equal(await verifyPassword(password, legacyHash), true);
});

test("admission remains occupied until completion and releases on success or a sanitized failure", async () => {
  const jobs = [];
  const hasher = createPasswordHasher((...input) => new Promise((resolve, reject) => jobs.push({ input, resolve, reject })));
  const first = hasher.hash(password);
  const second = hasher.verify(password, legacyHash);
  const secondFailure = assert.rejects(second, error => error.status === 503 && !error.message.includes("SECRET_CANARY"));
  try {
    await waitForJobs(jobs, 2);
    assert.deepEqual(jobs.map(job => job.input[2]), ["scrypt_v2", "scrypt_v1"]);
    await assert.rejects(hasher.hash(password), error => error.status === 503);
    const legacyKey = Buffer.alloc(64, 11);
    jobs[1].resolve(legacyKey);
    await waitForJobs(jobs, 3);
    assert.ok(legacyKey.every(byte => byte === 0));
    assert.equal(jobs[2].input[2], "scrypt_v2");
    await assert.rejects(hasher.hash(password), error => error.status === 503);
    const firstKey = Buffer.alloc(64, 12);
    jobs[0].resolve(firstKey);
    await first;
    assert.ok(firstKey.every(byte => byte === 0));
    const third = hasher.hash(password);
    await waitForJobs(jobs, 4);
    jobs[2].reject(new Error("SECRET_CANARY provider internals"));
    await secondFailure;
    const thirdKey = Buffer.alloc(64, 13);
    jobs[3].resolve(thirdKey);
    await third;
    assert.ok(thirdKey.every(byte => byte === 0));
    const fourth = hasher.hash(password);
    await waitForJobs(jobs, 5);
    jobs[4].resolve(Buffer.alloc(64, 14));
    await fourth;
  } finally {
    for (const job of jobs) job.resolve(Buffer.alloc(64));
    await Promise.allSettled([first, second]);
  }
});

test("synchronous native failures and invalid derived keys never leak capacity or private errors", async () => {
  for (const fail of [() => { throw new Error("SECRET_CANARY"); }, async () => Buffer.alloc(12), async () => null]) {
    let calls = 0;
    const hasher = createPasswordHasher((...input) => ++calls === 1 ? fail(...input) : Promise.resolve(Buffer.alloc(64)));
    await assert.rejects(hasher.hash(password), error => error.status === 503 && !error.message.includes("SECRET_CANARY"));
    assert.match(await hasher.hash(password), /^scrypt\$v2\$32768\$8\$3\$/);
    assert.equal(calls, 2);
  }
});

test("password limits apply before native work even when calling the internal helper directly", async () => {
  let calls = 0;
  const hasher = createPasswordHasher(async () => { calls++; return Buffer.alloc(64); });
  for (const value of [null, {}, "", "x".repeat(1025), "test\ud800"]) {
    await assert.rejects(hasher.hash(value), error => error.status === 400);
    await assert.rejects(hasher.verify(value, null), error => error.status === 400);
  }
  assert.equal(calls, 0);
});

function repository(identity = null) {
  const writes = [];
  return { writes,
    async findPasswordIdentityByEmailNormalized() { return identity; },
    async createStudentAccount() { writes.push("account"); return { userId: "student-1" }; },
    async createSession() { writes.push("session"); return { sessionId: "session-1" }; },
    async revokeSessionByTokenHash() { writes.push("revoke"); return { revoked: false }; },
  };
}

test("missing, inactive, hashless and malformed identities all perform both fixed profiles before generic denial", async () => {
  const identities = [null,
    { userId: "student-1", accountStatus: "disabled", passwordHash: legacyHash },
    { userId: "student-1", accountStatus: "active", passwordHash: null },
    { userId: "student-1", accountStatus: "active", passwordHash: "malformed" },
    { userId: "student-1", accountStatus: "active", passwordHash: legacyHash }];
  for (const identity of identities) {
    const calls = [];
    const hasher = createPasswordHasher(async (...args) => { calls.push(args); return Buffer.alloc(64); });
    const repo = repository(identity);
    const service = new AuthCredentialsService(repo, { passwordHasher: hasher });
    await assert.rejects(service.createStudentSession({ email: "student@example.com", password }), error => error.status === 403 && error.message === "Invalid email or password.");
    assert.deepEqual(calls.map(call => call[2]), ["scrypt_v1", "scrypt_v2"]);
    assert.deepEqual(repo.writes, []);
  }
});

test("busy hashing prevents registration, login and reset writes and successful audit events", async () => {
  const jobs = [];
  const hasher = createPasswordHasher(() => new Promise(resolve => jobs.push(resolve)));
  const first = hasher.hash(password);
  const second = hasher.verify(password, null);
  const writes = [];
  const auditSink = { async record() { writes.push("audit"); } };
  const signupRepo = repository();
  const loginRepo = repository({ userId: "student-1", accountStatus: "active", passwordHash: legacyHash });
  const reset = new PasswordResetService({
    async findActivePasswordResetChallenge() { return { id: "00000000-0000-4000-8000-000000000001", userId: "student-1" }; },
    async consumePasswordReset() { writes.push("reset"); },
  }, { passwordHasher: hasher, auditSink });
  try {
    await assert.rejects(new AuthCredentialsService(signupRepo, { passwordHasher: hasher, auditSink }).registerStudent({ email: "student@example.com", password }), error => error.status === 503);
    await assert.rejects(new AuthCredentialsService(loginRepo, { passwordHasher: hasher, auditSink }).createStudentSession({ email: "student@example.com", password }), error => error.status === 503);
    await assert.rejects(reset.resetPassword(createRequestContext(), "00000000-0000-4000-8000-000000000001", Buffer.alloc(32).toString("base64url"), password), error => error.status === 503);
    assert.deepEqual([...signupRepo.writes, ...loginRepo.writes, ...writes], []);
    assert.equal(jobs.length, 2);
  } finally {
    jobs[0](Buffer.alloc(64));
    jobs[1](Buffer.alloc(64));
    await waitForJobs(jobs, 3);
    jobs[2](Buffer.alloc(64));
    await Promise.all([first, second]);
  }
});

test("hash engine errors become generic HTTP 503 responses with no session cookie", async () => {
  const hasher = createPasswordHasher(async () => { throw new Error("SECRET_CANARY password or native failure"); });
  const handlers = createAuthCredentialsHttpHandlers(new AuthCredentialsService(repository(), { passwordHasher: hasher }));
  for (const handler of [handlers.registerStudent, handlers.createSession]) {
    const response = await handler(new Request("https://cuac.test/api/v1/auth/test", {
      method: "POST", body: JSON.stringify({ email: "student@example.com", password }),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("set-cookie"), null);
    const body = await response.text();
    assert.doesNotMatch(body, /SECRET_CANARY|student@example|synthetic credential/);
  }
});
