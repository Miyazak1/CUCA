import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { secureApiRoute } from "../../../src/server/shared/http-boundary.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { buildMaterialPreview } from "../../../src/server/student/application-material-preview.ts";
import {
  APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
  createApplicationMaterialSnapshotPayload,
  parseApplicationMaterialSnapshotInput,
  parseApplicationMaterialSnapshotPayload,
  requireApplicationMaterialSnapshotQuery,
} from "../../../src/server/student/application-material-snapshot.ts";
import {
  ApplicationMaterialSnapshotCipher,
  ApplicationMaterialSnapshotEnvelopeError,
  resolveApplicationMaterialSnapshotCipher,
} from "../../../src/server/student/application-material-snapshot-envelope.ts";
import { createApplicationMaterialSnapshotHttpHandler } from "../../../src/server/student/application-material-snapshot-http.ts";
import { PostgresApplicationMaterialSnapshot } from "../../../src/server/student/postgres-application-material-snapshot.ts";

const sha = character => character.repeat(64);
const key = randomBytes(32);
const cipher = (activeKeyId = "key-a", keys = new Map([["key-a", key]])) =>
  new ApplicationMaterialSnapshotCipher({ activeKeyId, keys });
const input = () => ({ authorizationId: randomUUID(), expectedAuthorizationScopeSha256: sha("a"),
  expectedMaterialContentSha256: sha("b") });
const context = extra => createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student",
  purpose: "student_action", ...extra });

function materialFixture() {
  const ids = Array.from({ length: 8 }, randomUUID);
  const target = { applicationSetId: ids[1], choiceId: ids[2], schoolId: ids[3], programId: ids[4], programIntakeId: ids[5] };
  const preview = buildMaterialPreview(ids[0], target, new Date("2026-09-01T00:00:00Z"), {
    expectedVersions: { applicationSet: 2, applicant: 1, education: 0, assessments: 0 },
    selection: { applicantFields: ["fullName"], educationRecordIds: [], assessmentRecordIds: [] },
  }, { applicant: { fullName: "PRIVATE_STUDENT_NAME", contactEmail: null, citizenshipCountry: null }, education: [], assessments: [] });
  const authorization = { id: ids[6], scopeSha256: sha("a") };
  const payload = createApplicationMaterialSnapshotPayload(ids[0], authorization, preview);
  const binding = { snapshotId: ids[7], userId: ids[0], ...target, authorizationId: authorization.id,
    authorizationScopeSha256: authorization.scopeSha256, materialContentSha256: preview.contentSha256,
    payloadSha256: payload.payloadSha256, payloadFormat: APPLICATION_MATERIAL_SNAPSHOT_FORMAT,
    capturedAt: new Date("2026-09-01T00:00:01Z") };
  return { ids, target, preview, authorization, payload, binding };
}

test("material snapshot input is exact and contains no client authority or body", () => {
  const value = input();
  assert.deepEqual(parseApplicationMaterialSnapshotInput(value), value);
  for (const bad of [null, [], {}, { ...value, userId: randomUUID() }, { ...value, paid: true },
    { ...value, authorizationId: "bad" }, { ...value, expectedAuthorizationScopeSha256: "A".repeat(64) },
    { ...value, expectedMaterialContentSha256: "PRIVATE" }]) {
    assert.throws(() => parseApplicationMaterialSnapshotInput(bad), error => error.status === 400);
  }
  requireApplicationMaterialSnapshotQuery("https://cuac.test/material-snapshot");
  for (const query of ["userId=x", "schoolId=x", "decrypt=true"]) {
    assert.throws(() => requireApplicationMaterialSnapshotQuery(`https://cuac.test/material-snapshot?${query}`), error => error.status === 400);
  }
});

test("material snapshot payload is canonical, bounded and bound to one authorization and program intake", () => {
  const f = materialFixture();
  const parsed = parseApplicationMaterialSnapshotPayload(f.payload.serialized, { ownerUserId: f.ids[0],
    authorizationId: f.authorization.id, authorizationScopeSha256: f.authorization.scopeSha256,
    materialContentSha256: f.preview.contentSha256, payloadSha256: f.payload.payloadSha256, target: f.target });
  assert.equal(parsed.content.materials.applicant.fullName, "PRIVATE_STUDENT_NAME");
  assert.equal(f.payload.payloadBytes, Buffer.byteLength(f.payload.serialized));
  for (const patch of [{ ownerUserId: randomUUID() }, { authorizationId: randomUUID() },
    { authorizationScopeSha256: sha("c") }, { materialContentSha256: sha("d") }, { payloadSha256: sha("e") },
    { target: { ...f.target, programId: randomUUID() } }]) {
    assert.throws(() => parseApplicationMaterialSnapshotPayload(f.payload.serialized, {
      ownerUserId: f.ids[0], authorizationId: f.authorization.id, authorizationScopeSha256: f.authorization.scopeSha256,
      materialContentSha256: f.preview.contentSha256, payloadSha256: f.payload.payloadSha256, target: f.target, ...patch,
    }), error => error.status === 503);
  }
  const changed = JSON.parse(f.payload.serialized); changed.content.materials.applicant.extra = "PRIVATE";
  const serialized = JSON.stringify(changed);
  assert.throws(() => parseApplicationMaterialSnapshotPayload(serialized, { ownerUserId: f.ids[0],
    authorizationId: f.authorization.id, authorizationScopeSha256: f.authorization.scopeSha256,
    materialContentSha256: f.preview.contentSha256,
    payloadSha256: createHash("sha256").update(serialized).digest("hex"), target: f.target }),
  error => error.status === 503);
});

test("AES-GCM snapshot envelope hides plaintext and rejects swapping or tampering", () => {
  const f = materialFixture(), c = cipher();
  const one = c.seal(f.binding, f.payload.serialized), two = c.seal(f.binding, f.payload.serialized);
  assert.notEqual(one.nonce, two.nonce); assert.notEqual(one.ciphertext, two.ciphertext);
  assert.equal(c.open(f.binding, one), f.payload.serialized);
  assert.doesNotMatch(JSON.stringify(one), /PRIVATE_STUDENT_NAME/);
  for (const patch of [{ snapshotId: randomUUID() }, { userId: randomUUID() }, { programId: randomUUID() },
    { programIntakeId: randomUUID() }, { authorizationId: randomUUID() }, { payloadSha256: sha("f") },
    { capturedAt: new Date(f.binding.capturedAt.getTime() + 1) }]) {
    assert.throws(() => c.open({ ...f.binding, ...patch }, one), invalid("invalid_envelope"));
  }
  for (const name of ["nonce", "tag", "ciphertext"]) {
    const bytes = Buffer.from(one[name], "base64url"); bytes[0] ^= 1;
    assert.throws(() => c.open(f.binding, { ...one, [name]: bytes.toString("base64url") }), invalid("invalid_envelope"));
  }
  for (const value of [null, [], {}, { ...one, version: 2 }, { ...one, extra: true }, { ...one, tag: "a".repeat(2000) }]) {
    assert.throws(() => c.open(f.binding, value), invalid("invalid_envelope"));
  }
});

test("snapshot keyring validates, rotates and never falls back when an old key is missing", () => {
  const f = materialFixture(), first = cipher(), envelope = first.seal(f.binding, f.payload.serialized), next = randomBytes(32);
  const rotated = cipher("key-b", new Map([["key-a", key], ["key-b", next]]));
  assert.equal(rotated.open(f.binding, envelope), f.payload.serialized);
  assert.equal(rotated.seal(f.binding, f.payload.serialized).keyId, "key-b");
  assert.throws(() => cipher("key-b", new Map([["key-b", next]])).open(f.binding, envelope), invalid("key_unavailable"));
  for (const size of [0, 16, 31, 33]) assert.throws(() => cipher("bad", new Map([["bad", randomBytes(size)]])), invalid("key_unavailable"));
  const env = { CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID: "key-a",
    CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON: JSON.stringify({ "key-a": key.toString("base64url") }) };
  assert.equal(resolveApplicationMaterialSnapshotCipher(env).open(f.binding, envelope), f.payload.serialized);
  for (const bad of [{}, { ...env, CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID: "missing" },
    { ...env, CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON: "PRIVATE_INVALID" }]) {
    assert.throws(() => resolveApplicationMaterialSnapshotCipher(bad), invalid("key_unavailable"));
  }
});

test("material snapshot service denies nonstudent contexts before opening PostgreSQL", async () => {
  let transactions = 0;
  const service = new PostgresApplicationMaterialSnapshot({ async transaction() { transactions++; } }, cipher());
  const setId = randomUUID(), choiceId = randomUUID(), value = input();
  for (const extra of [{ actorUserId: null }, { activeRole: "school_staff" }, { activeRole: "cuac_ops" },
    { selectedSurface: "public" }, { selectedSurface: "school" }, { purpose: "agent_tool" },
    { tenantSchoolId: randomUUID() }, { authStrength: "guest" }, { dataClassAllowlist: ["student_pii"] },
    { dataClassAllowlist: ["education_record"] }]) {
    await assert.rejects(service.create(context(extra), setId, choiceId, value, "material-snapshot-key-0001"), error => error.status === 403);
    await assert.rejects(service.get(context(extra), setId, choiceId), error => error.status === 403);
  }
  await assert.rejects(service.create(context(), "bad", choiceId, value, "material-snapshot-key-0001"), error => error.status === 400);
  await assert.rejects(service.create(context(), setId, choiceId, value, "short"), error => error.status === 400);
  assert.equal(transactions, 0);
});

test("material snapshot HTTP derives identity and exposes only GET and idempotent POST", async () => {
  const userId = randomUUID(), setId = randomUUID(), choiceId = randomUUID(), snapshotId = randomUUID(), calls = [];
  const auth = { async findActiveSessionByTokenHash() { return { userId, selectedSurface: "student", activeRole: "student",
    tenantSchoolId: null, authStrength: "session", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, accountStatus: "active" }; } };
  const service = { async get(...args) { calls.push(["get", ...args]); return null; },
    async create(...args) { calls.push(["create", ...args]); return { id: snapshotId, canSubmit: false }; } };
  const handler = createApplicationMaterialSnapshotHttpHandler(service, auth), value = input();
  for (const [method, operation, body] of [["GET", "get", undefined], ["POST", "create", value]]) {
    const request = (query = "", headers = {}) => new Request(`https://cuac.test/material-snapshot${query}`, { method,
      ...(body ? { body: JSON.stringify(body) } : {}), headers: { cookie: "cuac_session=synthetic", origin: "https://cuac.test",
        ...(body ? { "content-type": "application/json", "idempotency-key": "material-snapshot-key-0001" } : {}),
        "x-user-id": randomUUID(), "x-role": "cuac_admin", ...headers } });
    const route = secureApiRoute(method, req => handler(req, setId, choiceId, operation),
      { env: { CUAC_ENV: "development", CUAC_PUBLIC_APP_URL: "https://cuac.test" } });
    const response = await route(request()); assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const call = calls.at(-1); assert.equal(call[0], operation); assert.equal(call[1].actorUserId, userId);
    assert.equal(call[2], setId); assert.equal(call[3], choiceId);
    if (operation === "create") assert.equal(call[5], "material-snapshot-key-0001");
    assert.equal((await route(request("?decrypt=true"))).status, 400);
    assert.equal((await route(request("", { "sec-fetch-site": "same-site" }))).status, 403);
  }
  const unavailable = createApplicationMaterialSnapshotHttpHandler();
  const response = await unavailable(new Request("https://cuac.test/material-snapshot", { headers: { cookie: "cuac_session=x" } }),
    setId, choiceId, "get");
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /key|cipher|postgres|PRIVATE/i);
});

const invalid = reason => error => error instanceof ApplicationMaterialSnapshotEnvelopeError
  && error.reason === reason && !error.message.includes(key.toString("hex"));
