import assert from "node:assert/strict";
import { noticeFixture, preparedNotice, approvedNotice, noticeApproveInput, publishNotice, withdrawNotice } from "./notices-fixture.mjs";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";

export async function runNoticesHttpRehearsal(t, pool, { send, browser, register }) {
  const path = "/api/v1/notices/application_disclosure/en";

  await t.test("network notice reads follow real preparation approval publication and withdrawal without creating consent", async () => {
    const f = await noticeFixture(pool), draft = await preparedNotice(f), student = browser(); await register(student);
    assert.deepEqual(await (await send(path)).json(), { data: null });
    const approved = await f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft));
    assert.deepEqual(await (await send(path)).json(), { data: null });
    await publishNotice(f, approved); const before = await snapshotAuditedBusinessTables(pool);
    const response = await send(path); assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok(response.headers.get("x-request-id")); assert.equal(response.headers.get("set-cookie"), null);
    const dto = (await response.json()).data; assert.equal(dto.versionId, draft.versionId); assert.equal(Object.keys(dto).length, 9);
    assert.doesNotMatch(JSON.stringify(dto), new RegExp(`${f.preparer.actorUserId}|${f.reviewer.actorUserId}|reviewReference|approvalSha256|wordingReviewed`));
    assert.deepEqual((await (await student.send(path)).json()).data, dto);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before, "GET cannot write a consent, session, profile, application or audit");
    await withdrawNotice(f, draft.versionId, 1); assert.deepEqual(await (await send(path)).json(), { data: null });
  });

  await t.test("network notice scope is exact and forged authority or write methods cannot manage a publication", async () => {
    const f = await noticeFixture(pool), version = await approvedNotice(f); await publishNotice(f, version);
    const dto = (await (await send(path)).json()).data, before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual((await (await send(path + "?locale=zh-CN&noticeKey=privacy&version=999", { headers: { "x-role": "cuac_admin" } })).json()).data, dto);
    assert.deepEqual(await (await send("/api/v1/notices/application_disclosure/zh-CN")).json(), { data: null });
    for (const badPath of ["/api/v1/notices/privacy/en", "/api/v1/notices/application_disclosure/EN", "/api/v1/notices/application_disclosure/zh"]) assert.equal((await send(badPath)).status, 400);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const response = await send(path, { method, body: { role: "cuac_admin", authStrength: "step_up", approved: true, consent: true } });
      assert.ok([404, 405].includes(response.status));
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("network changed notice review reference fails closed with no internal evidence and withdrawal stays available", async () => {
    const f = await noticeFixture(pool), version = await approvedNotice(f); await publishNotice(f, version);
    await pool.query("update privacy_notice_versions set review_evidence_json = jsonb_set(review_evidence_json, '{reviewReference}', '\"PRIVATE_CHANGED_REVIEW\"') where id = $1", [version.versionId]);
    const damaged = await send(path); assert.equal(damaged.status, 503); assert.equal(damaged.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await damaged.text(), /PRIVATE_CHANGED_REVIEW|review_evidence|select |prepared_by|notice_versions/i);
    await withdrawNotice(f, version.versionId, 1); assert.deepEqual(await (await send(path)).json(), { data: null });
  });

  await t.test("network notice pointer remains unchanged when actual publication or withdrawal audit storage fails", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f), second = await approvedNotice(f); await publishNotice(f, first);
    const fault = await createAuditFailureFixture(pool);
    try {
      const before = await snapshotAuditedBusinessTables(pool);
      await fault.during("notices.publish", () => assert.rejects(publishNotice(f, second, 1), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before); assert.equal((await (await send(path)).json()).data.versionId, first.versionId);
      await fault.during("notices.withdraw", () => assert.rejects(withdrawNotice(f, first.versionId, 1), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before); assert.equal((await (await send(path)).json()).data.publicationRevision, 1);
      await publishNotice(f, second, 1); assert.equal((await (await send(path)).json()).data.versionId, second.versionId);
    } finally { await fault.close(); }
  });
}
