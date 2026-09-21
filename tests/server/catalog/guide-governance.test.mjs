import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGuideGovernanceHttpHandlers, createRequestContext, evaluatePolicy, guideDigest, parseGuideDocument,
  PostgresGuideGovernance, SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const guideId = randomUUID(), versionId = randomUUID();
const document = () => ({
  schemaVersion: 1, slug: "visa-arrival", titleEn: "Visa and Arrival Steps", titleZh: "签证与抵达步骤",
  subtitleEn: "Admission notice and JW form", subtitleZh: "录取通知与 JW 表",
  summaryEn: "Confirm the current post-offer route.", summaryZh: "确认当前录取后流程。", href: "guides.html#visa",
  searchTerms: ["JW201", "X1 visa"],
  sections: [{ key: "visa", headingEn: "Visa route", headingZh: "签证路径", bodyEn: "Confirm the embassy checklist.", bodyZh: "确认使领馆材料清单。" }],
  sources: [{ url: "https://example.edu/official/visa", label: "Official university notice", capturedAt: "2026-09-01T00:00:00.000Z" }],
});

const context = (overrides = {}) => createRequestContext({ actorUserId: randomUUID(), activeRole: "cuac_admin", selectedSurface: "ops",
  purpose: "catalog_management", authStrength: "step_up", ...overrides });

test("guide documents are canonical bounded plain text with official source evidence", () => {
  const parsed = parseGuideDocument(document());
  assert.equal(parsed.slug, "visa-arrival");
  assert.match(guideDigest(parsed), /^[a-f0-9]{64}$/);
  for (const mutate of [
    value => { value.titleEn = "<script>"; }, value => { value.href = "javascript:alert(1)"; },
    value => { value.sources = []; }, value => { value.sections[0].key = "Bad Key"; },
    value => { value.privateNotes = "do not expose"; },
  ]) {
    const value = structuredClone(document()); mutate(value);
    assert.throws(() => parseGuideDocument(value), error => error.status === 400);
  }
});

test("guide schema v2 accepts only complete section-aligned student-language translations", () => {
  const value = { ...document(), schemaVersion: 2, translations: {
    vi: {
      title: "Các bước xin thị thực và nhập cảnh", subtitle: "Giấy báo nhập học và biểu mẫu JW",
      summary: "Xác nhận lộ trình hiện hành sau khi nhận thư mời.", searchTerms: ["thị thực X1", "biểu mẫu JW201"],
      sections: [{ key: "visa", heading: "Lộ trình thị thực", body: "Xác nhận danh sách hồ sơ hiện hành của đại sứ quán." }],
    },
    ar: {
      title: "خطوات التأشيرة والوصول", subtitle: "خطاب القبول ونموذج JW",
      summary: "تحقق من المسار الحالي بعد الحصول على القبول.", searchTerms: ["تأشيرة X1", "نموذج JW201"],
      sections: [{ key: "visa", heading: "مسار التأشيرة", body: "تحقق من قائمة السفارة الحالية." }],
    },
  } };
  const parsed = parseGuideDocument(value);
  assert.equal(parsed.schemaVersion, 2);
  assert.deepEqual(Object.keys(parsed.translations), ["vi", "ar"]);
  assert.equal(parsed.translations.vi.sections[0].key, parsed.sections[0].key);
  assert.match(guideDigest(parsed), /^[a-f0-9]{64}$/);

  for (const mutate of [
    candidate => { candidate.translations = {}; },
    candidate => { candidate.translations.fr = structuredClone(candidate.translations.vi); },
    candidate => { candidate.translations.vi.sections = []; },
    candidate => { candidate.translations.vi.sections[0].key = "other"; },
    candidate => { candidate.translations.vi.sections[0].body = "<b>unsafe</b>"; },
  ]) {
    const candidate = structuredClone(value); mutate(candidate);
    assert.throws(() => parseGuideDocument(candidate), error => error.status === 400);
  }
});

test("guide governance policy requires Ops context and step-up admin for approval publication and withdrawal", () => {
  const resource = { type: "catalog", dataClasses: ["internal_catalog_metadata"] };
  for (const role of ["guest", "student", "school_staff", "cuac_ops", "cuac_admin"]) {
    const c = context({ activeRole: role });
    for (const action of ["catalog.read_guides_review", "catalog.prepare_guides", "catalog.approve_guides", "catalog.publish_guides", "catalog.withdraw_guides"]) {
      const expected = role === "cuac_admin" || (role === "cuac_ops" && ["catalog.read_guides_review", "catalog.prepare_guides"].includes(action));
      assert.equal(evaluatePolicy(c, action, resource).allowed, expected, `${role}: ${action}`);
    }
  }
  assert.equal(evaluatePolicy(context({ authStrength: "session" }), "catalog.publish_guides", resource).allowed, false);
  assert.equal(evaluatePolicy(context({ selectedSurface: "student" }), "catalog.prepare_guides", resource).allowed, false);
});

test("guide governance rejects malformed authority and commands before database access", async () => {
  const unavailable = new Proxy({}, { get() { throw new Error("Database accessed before validation"); } });
  const service = new PostgresGuideGovernance(unavailable), c = context(), hash = guideDigest(parseGuideDocument(document()));
  for (const override of [{ actorUserId: null }, { activeRole: "student" }, { purpose: "agent_tool" }, { selectedSurface: "public" }, { dataClassAllowlist: [] }]) {
    await assert.rejects(service.listVersions({ ...c, ...override }, guideId, {}), error => error.status === 403);
  }
  for (const [method, input] of [
    ["createDraft", { versionId, document: { ...document(), extra: true } }],
    ["approve", { versionId, expectedContentSha256: hash, effectiveFrom: null, reviewDueAt: "bad", reviewReference: "OPS-1", contentReviewed: true, sourcesVerified: true, publicContentConfirmed: true }],
    ["publish", { versionId, expectedContentSha256: hash, expectedApprovalSha256: hash, expectedPublicationRevision: "0" }],
    ["withdraw", { expectedVersionId: versionId, expectedPublicationRevision: 1, reason: "free text" }],
  ]) await assert.rejects(service[method](c, guideId, input), error => error.status === 400);
});

function httpFixture() {
  const calls = [];
  const service = Object.fromEntries(["listGuides", "listVersions", "getVersion", "createDraft", "approve", "publish", "withdraw"].map(method => [method,
    async (...args) => { calls.push({ method, args }); return { method }; }]));
  const auth = {
    async findActiveSessionByTokenHash() { return { userId: randomUUID(), selectedSurface: "ops", activeRole: "cuac_admin", tenantSchoolId: null,
      authStrength: "step_up", expiresAt: new Date("2027-09-29T00:00:00Z"), revokedAt: null, accountStatus: "active" }; },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role) { return { userId, role, status: "approved", expiresAt: new Date("2027-09-29T00:00:00Z") }; },
  };
  return { calls, handlers: createGuideGovernanceHttpHandlers(service, auth) };
}
function request(path, method = "GET", body) {
  return new Request(`https://cuac.test${path}`, { method, headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`,
    ...(method === "GET" ? {} : { "content-type": "application/json" }) }, body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
}

test("guide governance HTTP binds all lifecycle commands to authenticated route scope", async () => {
  const { calls, handlers } = httpFixture(), base = `/api/v1/ops/catalog/guides/${guideId}/versions`;
  assert.equal((await handlers.listGuides(request("/api/v1/ops/catalog/guides"))).status, 200);
  assert.equal((await handlers.listVersions(request(`${base}?limit=5`), guideId)).status, 200);
  assert.equal((await handlers.createDraft(request(base, "POST", { versionId, document: document() }), guideId)).status, 201);
  assert.equal((await handlers.getVersion(request(`${base}/${versionId}`), guideId, versionId)).status, 200);
  assert.equal((await handlers.approve(request(`${base}/${versionId}/approval`, "POST", { expectedContentSha256: "a".repeat(64), effectiveFrom: null,
    reviewDueAt: "2027-01-01T00:00:00.000Z", reviewReference: "OPS-1", contentReviewed: true, sourcesVerified: true, publicContentConfirmed: true }), guideId, versionId)).status, 200);
  assert.equal((await handlers.publish(request(`${base}/${versionId}/publication`, "POST", { expectedContentSha256: "a".repeat(64),
    expectedApprovalSha256: "b".repeat(64), expectedPublicationRevision: 0 }), guideId, versionId)).status, 200);
  assert.equal((await handlers.withdraw(request(`${base}/${versionId}/withdrawal`, "POST", { expectedPublicationRevision: 1, reason: "content_correction" }), guideId, versionId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listGuides", "listVersions", "createDraft", "getVersion", "approve", "publish", "withdraw"]);
  assert.ok(calls.every(call => call.args[0].purpose === "catalog_management" && call.args[0].selectedSurface === "ops"));
});

test("guide governance route files are thin UUID-validating secure adapters", async () => {
  const paths = [
    "../../../app/api/v1/ops/catalog/guides/route.ts",
    "../../../app/api/v1/ops/catalog/guides/[guideId]/versions/route.ts",
    "../../../app/api/v1/ops/catalog/guides/[guideId]/versions/[versionId]/route.ts",
    "../../../app/api/v1/ops/catalog/guides/[guideId]/versions/[versionId]/approval/route.ts",
    "../../../app/api/v1/ops/catalog/guides/[guideId]/versions/[versionId]/publication/route.ts",
    "../../../app/api/v1/ops/catalog/guides/[guideId]/versions/[versionId]/withdrawal/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /secureApiRoute\(/);
    if (path.includes("[guideId]")) assert.match(source, /requireRouteUuid\(/);
    assert.doesNotMatch(source, /select |insert |update |delete from|Agent/i);
  }
});

test("guide publication projects reviewed translations and source evidence into the public record", async () => {
  const source = await readFile(new URL("../../../src/server/catalog/postgres-guide-governance.ts", import.meta.url), "utf8");
  assert.match(source, /sources: document\.sources/);
  assert.match(source, /document\.schemaVersion === 2 \? \{ translations: document\.translations \}/);
  assert.doesNotMatch(source, /machine.?translat|auto.?translat/i);
});
