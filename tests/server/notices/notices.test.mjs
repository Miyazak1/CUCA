import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { evaluatePolicy } from "../../../src/server/policy/policy.ts";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { MAX_NOTICE_VERSION, noticeDigest, noticeScope, parseNoticeDocument, parseNoticeReview } from "../../../src/server/notices/document.ts";
import { PostgresNoticeGovernance } from "../../../src/server/notices/postgres-governance.ts";
import { PostgresNoticeReader } from "../../../src/server/notices/public-reader.ts";
import { managedNoticeVersion } from "../../../src/server/notices/versions.ts";
import { createNoticeHttpHandler } from "../../../src/server/notices/http.ts";
import { noticeDocument, noticeRow } from "./fixture.mjs";

const scope = noticeScope("application_disclosure", "en");
const publicContext = () => createRequestContext({ purpose: "public_notice_read" });
const internal = (extra = {}) => createRequestContext({ actorUserId: randomUUID(), activeRole: "cuac_admin", selectedSurface: "ops", purpose: "notice_management", authStrength: "step_up", ...extra });
const bad = e => e.status === 400;

test("notice documents preserve paragraphs and scope while normalizing category sets without retaining mutable input", () => {
  const input = noticeDocument(); input.coveredData.reverse(); input.sections[0].body = "First paragraph\r\nSecond paragraph";
  const document = parseNoticeDocument(input, scope);
  assert.equal(document.sections[0].body, "First paragraph\nSecond paragraph");
  assert.deepEqual(document.coveredData, noticeDocument().coveredData);
  input.sections[0].body = "Changed later"; input.coveredData.length = 0;
  assert.equal(document.sections[0].body, "First paragraph\nSecond paragraph"); assert.equal(document.coveredData.length, 4);
  const reordered = Object.fromEntries(Object.entries(document).reverse());
  assert.equal(noticeDigest(parseNoticeDocument(reordered, scope)), noticeDigest(document));
});

test("notice grammar rejects incomplete duplicate oversized secret-bearing or executable-shaped structures", () => {
  const input = noticeDocument();
  const sparseSections = [...input.sections]; delete sparseSections[4];
  for (const extra of [{ consent: true }, { userId: randomUUID() }, { schemaVersion: 2 }, { title: "<script>alert(1)</script>" },
    { title: "bad\u0000title" }, { title: "bad\ud800" }, { title: "bad\u202etitle" }, { title: "two\nlines" }, { title: "x".repeat(161) },
    { coveredData: [] }, { coveredData: Array(1) }, { coveredData: ["payment_sensitive"] }, { coveredData: ["applicant_basics", "applicant_basics"] },
    { sections: sparseSections },
    { sections: input.sections.slice(1) }, { sections: input.sections.map(() => input.sections[0]) },
    { sections: input.sections.map(s => ({ ...s, secret: "forbidden" })) }, { sections: input.sections.map(s => ({ ...s, body: 7 })) },
    { sections: input.sections.map(s => ({ ...s, body: "x".repeat(6001) })) },
    { sections: input.sections.map(s => ({ ...s, body: "\u4e2d".repeat(5500) })) }]) {
    assert.throws(() => parseNoticeDocument({ ...input, ...extra }, scope), bad);
  }
});

test("notice identity binds exact purpose and locale without fallback or client authority", () => {
  for (const [key, locale] of [["privacy", "en"], ["application_disclosure", "EN"], ["application_disclosure", "zh"], ["application_disclosure", null]]) assert.throws(() => noticeScope(key, locale), bad);
  assert.throws(() => parseNoticeDocument(noticeDocument("zh-CN"), scope), bad);
  const chinese = noticeScope("application_disclosure", "zh-CN");
  assert.equal(parseNoticeDocument(noticeDocument("zh-CN"), chinese).locale, "zh-CN");
});

test("notice review binds identity body scope and dates but does not assert legal compliance", () => {
  const row = noticeRow(), review = row.reviewEvidence;
  const binding = { versionId: row.versionId, scopeKey: scope.scopeKey, documentSha256: row.contentSha256, preparedByUserId: row.preparedByUserId,
    reviewedByUserId: row.approvedByUserId, reviewedAt: row.reviewedAt.toISOString(), effectiveFrom: row.effectiveFrom.toISOString(), reviewDueAt: row.reviewDueAt.toISOString() };
  assert.deepEqual(parseNoticeReview(review, binding), review);
  for (const extra of [{ versionId: randomUUID() }, { scopeKey: "application_disclosure:zh-CN" }, { documentSha256: "a".repeat(64) },
    { reviewedByUserId: row.preparedByUserId }, { reviewedAt: "2026-02-30T00:00:00.000Z" }, { scopeConfirmed: false }, { wordingReviewed: "true" },
    { publicContentConfirmed: null }, { reviewReference: "not a reference" }, { legalComplianceVerified: true }]) {
    assert.throws(() => parseNoticeReview({ ...review, ...extra }, binding), bad);
  }
});

test("notice policy isolates public reads and requires explicit step-up admin publication authority", () => {
  const resource = { type: "notice", dataClasses: ["ops_confidential"] };
  for (const action of ["notice.read_review", "notice.prepare", "notice.approve", "notice.publish", "notice.withdraw"]) {
    assert.equal(evaluatePolicy(internal(), action, resource).allowed, true);
    for (const extra of [{ actorUserId: null }, { activeRole: "guest" }, { activeRole: "student" }, { activeRole: "school_staff" },
      { selectedSurface: "student" }, { purpose: "catalog_management" }, { purpose: "agent_tool" }, { tenantSchoolId: randomUUID() },
      { authStrength: "guest" }, { authStrength: "invented" }, { dataClassAllowlist: ["public_notice"] }]) assert.equal(evaluatePolicy(internal(extra), action, resource).allowed, false);
  }
  for (const action of ["notice.approve", "notice.publish", "notice.withdraw"]) {
    assert.equal(evaluatePolicy(internal({ authStrength: "session" }), action, resource).allowed, false);
    assert.equal(evaluatePolicy(internal({ activeRole: "cuac_ops" }), action, resource).allowed, false);
  }
  assert.equal(evaluatePolicy(internal({ activeRole: "cuac_ops", authStrength: "session" }), "notice.prepare", resource).allowed, true);
  assert.equal(evaluatePolicy(publicContext(), "notice.read_public", { type: "notice", dataClasses: ["public_notice"] }).allowed, true);
  assert.equal(evaluatePolicy(createRequestContext(), "notice.read_public", { type: "notice", dataClasses: ["public_notice"] }).allowed, false);
});

test("all notice management entry points reject invalid authority before accessing database operations", async () => {
  let calls = 0;
  const service = new PostgresNoticeGovernance({ async transaction() { calls++; throw new Error("Must not enter database"); } });
  for (const method of ["getVersion", "listVersions", "createDraft", "approve", "publish", "withdraw"]) {
    for (const context of [publicContext(), internal({ purpose: "agent_tool" }), internal({ actorUserId: null })]) {
      await assert.rejects(service[method](context, "bad", "bad", {}), e => e.status === 403);
    }
  }
  assert.equal(calls, 0);
});

test("notice commands reject unknown authority fields malformed revisions and missing approvals before a transaction", async () => {
  let calls = 0;
  const service = new PostgresNoticeGovernance({ async transaction() { calls++; throw new Error("Must not enter database"); } });
  const commands = [["getVersion", "invalid-id"], ["listVersions", { limit: 51 }], ["listVersions", { beforeVersion: 0 }],
    ["createDraft", { versionId: randomUUID(), document: noticeDocument(), userId: randomUUID() }], ["approve", {}],
    ["publish", { versionId: randomUUID(), expectedContentSha256: "f".repeat(64), expectedApprovalSha256: "a".repeat(64), expectedPublicationRevision: MAX_NOTICE_VERSION + 1 }],
    ["withdraw", { expectedVersionId: randomUUID(), expectedPublicationRevision: 1, reason: "arbitrary reason" }]];
  for (const [method, input] of commands) await assert.rejects(service[method](internal(), scope.noticeKey, scope.locale, input), bad);
  assert.equal(calls, 0);
});

test("public notice reader returns nine explicit fields and one scope-bound database snapshot", async () => {
  const row = noticeRow(), calls = [];
  const reader = new PostgresNoticeReader({ async query(sql, params) { calls.push({ sql, params }); return [row]; } });
  const result = await reader.getPublished(publicContext(), scope.noticeKey, scope.locale);
  assert.deepEqual(Object.keys(result).sort(), ["noticeKey", "locale", "versionId", "version", "contentSha256", "publicationRevision", "effectiveFrom", "reviewDueAt", "document"].sort());
  assert.equal(result.versionId, row.versionId); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [scope.scopeKey, scope.noticeKey, scope.locale]);
  assert.match(calls[0].sql, /pub\.version_id/); assert.match(calls[0].sql, /statement_timestamp/);
  assert.doesNotMatch(calls[0].sql, /student_|auth_sessions|agent_|max\(version\)/);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${row.preparedByUserId}|${row.approvedByUserId}|reviewReference|scopeConfirmed|approvalSha256`));
});

test("public notices fail closed on body review-reference publication-binding or structural corruption", async () => {
  const row = noticeRow();
  for (const extra of [{ contentSha256: "a".repeat(64) }, { content: { ...row.content, secret: "hidden" } },
    { reviewEvidence: { ...row.reviewEvidence, reviewReference: "changed-after-publication" } }, { publishedApprovalSha256: "b".repeat(64) },
    { publishedContentSha256: "c".repeat(64) }, { scopeKey: "application_disclosure:zh-CN" }, { version: 0 }, { publicationRevision: 0 },
    { createdAt: new Date("invalid") }, { approvedByUserId: row.preparedByUserId }]) {
    const reader = new PostgresNoticeReader({ async query() { return [{ ...row, ...extra }]; } });
    await assert.rejects(reader.getPublished(publicContext(), scope.noticeKey, scope.locale), e => e.status === 503 && !e.message.includes("hidden"));
  }
  const multiple = new PostgresNoticeReader({ async query() { return [row, row]; } });
  await assert.rejects(multiple.getPublished(publicContext(), scope.noticeKey, scope.locale), e => e.status === 503);
});

test("no public notice is not consent and blocked purposes never query storage", async () => {
  let calls = 0;
  const reader = new PostgresNoticeReader({ async query() { calls++; return []; } });
  assert.equal(await reader.getPublished(publicContext(), scope.noticeKey, scope.locale), null);
  for (const context of [createRequestContext(), publicContextWithNoClass(), internal({ purpose: "agent_tool" })]) await assert.rejects(reader.getPublished(context, scope.noticeKey, scope.locale), e => e.status === 403);
  assert.equal(calls, 1);
  function publicContextWithNoClass() { return createRequestContext({ purpose: "public_notice_read", dataClassAllowlist: ["public_catalog"] }); }
});

test("managed notice projection validates drafts separately from complete approved versions", () => {
  const row = noticeRow();
  assert.equal(managedNoticeVersion(row, scope).status, "approved");
  const draft = { ...row, reviewStatus: "draft", approvedByUserId: null, reviewedAt: null, effectiveFrom: null, reviewDueAt: null, reviewEvidence: null };
  assert.equal(managedNoticeVersion(draft, scope).approvalSha256, null);
  for (const extra of [{ reviewStatus: "unknown" }, { reviewEvidence: {} }, { effectiveFrom: new Date() }]) assert.throws(() => managedNoticeVersion({ ...draft, ...extra }, scope), e => e.status === 503);
});

test("notice HTTP uses guest public scope ignores forged authority and never treats unavailable storage as empty", async () => {
  let captured;
  const handler = createNoticeHttpHandler({ async getPublished(context, key, locale) { captured = { context, key, locale }; return null; } });
  const request = new Request("https://cuac.example/api/v1/notices/application_disclosure/en?locale=zh-CN&version=999", { headers: { "x-role": "cuac_admin", "x-user-id": randomUUID(), cookie: "role=cuac_admin" } });
  const result = await handler(request, scope.noticeKey, scope.locale);
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { data: null });
  assert.equal(captured.locale, "en"); assert.equal(captured.context.actorUserId, null); assert.equal(captured.context.activeRole, "guest"); assert.equal(captured.context.purpose, "public_notice_read");
  assert.equal((await handler(request, "unknown", "en")).status, 400);
  const unavailable = await createNoticeHttpHandler()(request, scope.noticeKey, scope.locale);
  assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).error.code, "SERVICE_UNAVAILABLE");
  const broken = await createNoticeHttpHandler({ async getPublished() { throw new Error("secret raw failure"); } })(request, scope.noticeKey, scope.locale);
  assert.equal(broken.status, 500); assert.doesNotMatch(await broken.text(), /secret raw failure/);
});
