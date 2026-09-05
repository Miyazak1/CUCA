import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresNoticeGovernance } from "../../../src/server/notices/postgres-governance.ts";
import { MAX_NOTICE_VERSION, noticeDigest } from "../../../src/server/notices/document.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { noticeFixture, preparedNotice, approvedNotice, noticeApproveInput, noticePublishInput, publishNotice, withdrawNotice } from "./notices-fixture.mjs";
import { noticeDocument } from "../notices/fixture.mjs";

export async function runNoticesRehearsal(t, pool) {
  const logs = async f => (await pool.query("select action, metadata_json, allowed from audit_logs where actor_user_id = any($1::uuid[]) order by created_at, id",
    [[f.preparer.actorUserId, f.reviewer.actorUserId, f.otherReviewer.actorUserId]])).rows;
  async function blockedBy(pid, count = 1) {
    for (let i = 0; i < 300; i++) {
      const rows = (await pool.query(`with recursive blocked(pid) as (
        select pid from pg_stat_activity where datname = current_database() and state = 'active' and wait_event_type = 'Lock' and $1 = any(pg_blocking_pids(pid))
        union select a.pid from pg_stat_activity a join blocked b on b.pid = any(pg_blocking_pids(a.pid))
          where a.datname = current_database() and a.state = 'active' and a.wait_event_type = 'Lock'
      ) select pid from blocked`, [pid])).rows;
      if (rows.length >= count) return;
      await delay(10);
    }
    assert.fail("Notice operations did not reach the real database lock barrier.");
  }
  async function race(f, operations, initial = false) {
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin");
      if (initial) await blocker.query("select id from user_roles where user_id = $1 for update", [f.preparer.actorUserId]);
      else await blocker.query("select scope_key from privacy_notice_scopes where scope_key = $1 for update", [f.scopeKey]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled(operations.map(op => op())); await blockedBy(pid, operations.length);
      await blocker.query("commit"); return await pending;
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
  }
  function oneWinner(results) {
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.find(r => r.status === "rejected").reason.status, 409);
    return results.find(r => r.status === "fulfilled").value;
  }
  async function mutationFixture(command) {
    const f = await noticeFixture(pool), draft = await preparedNotice(f), first = await approvedNotice(f), second = await approvedNotice(f);
    await publishNotice(f, first); const id = randomUUID();
    const run = (service = f.service) => {
      if (command === "prepare") return preparedNotice(f, id, noticeDocument(), service, f.reviewer);
      if (command === "approve") return service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft));
      if (command === "publish") return publishNotice(f, second, 1, service);
      return withdrawNotice(f, first.versionId, 1, service);
    };
    return { ...f, run, id, draft, first, second };
  }

  await t.test("notices remain absent until explicit independent approval and publication and never write student consent", async () => {
    const f = await noticeFixture(pool); assert.equal(await f.get(), null);
    const empty = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await f.service.listVersions(f.preparer, f.key, f.locale), { items: [], nextBeforeVersion: null, publication: null });
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), empty);
    const id = randomUUID(), draft = await preparedNotice(f, id), before = await snapshotAuditedBusinessTables(pool);
    assert.equal(draft.status, "draft"); assert.equal(draft.review, null); assert.equal(await f.get(), null);
    assert.deepEqual(await preparedNotice(f, id), draft); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const version = await f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft)); assert.equal(await f.get(), null);
    const publication = await publishNotice(f, version), dto = await f.get();
    assert.equal(publication.revision, 1); assert.equal(dto.versionId, id); assert.equal(Object.keys(dto).length, 9);
    assert.doesNotMatch(JSON.stringify(dto), new RegExp(`${f.preparer.actorUserId}|${f.reviewer.actorUserId}|reviewReference|wordingReviewed|approvalSha256`));
    const snapshot = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await publishNotice(f, version, 1), publication); assert.deepEqual(await snapshotAuditedBusinessTables(pool), snapshot);
    await withdrawNotice(f, id, 1); assert.equal(await f.get(), null);
    const audit = await logs(f); assert.deepEqual(audit.map(a => a.action).sort(), ["notices.prepare", "notices.approve", "notices.publish", "notices.withdraw"].sort());
    assert.doesNotMatch(JSON.stringify(audit), /Synthetic|synthetic-review|Not a production|reviewReference|sections|coveredData/);
    assert.ok(audit.every(a => a.allowed));
    const after = await snapshotAuditedBusinessTables(pool);
    for (const table of Object.keys(empty).filter(name => !name.startsWith("privacy_notice_") && name !== "audit_logs")) assert.deepEqual(after[table], empty[table], table);
  });

  await t.test("notice creation identity language and independent reviewer cannot be substituted", async () => {
    const f = await noticeFixture(pool), draft = await preparedNotice(f), before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(preparedNotice(f, draft.versionId, noticeDocument("en", { title: "Different title" })), e => e.status === 409);
    await assert.rejects(preparedNotice(f, draft.versionId, noticeDocument(), f.service, f.reviewer), e => e.status === 409);
    await assert.rejects(f.service.createDraft(f.preparer, f.key, "zh-CN", { versionId: draft.versionId, document: noticeDocument("zh-CN") }), e => e.status === 409);
    await assert.rejects(f.service.getVersion(f.reviewer, f.key, "zh-CN", draft.versionId), e => e.status === 403);
    await assert.rejects(f.service.approve({ ...f.reviewer, authStrength: "session" }, f.key, f.locale, noticeApproveInput(draft)), e => e.status === 403);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_admin')", [f.preparer.actorUserId]);
    await assert.rejects(f.service.approve({ ...f.preparer, activeRole: "cuac_admin", authStrength: "step_up" }, f.key, f.locale, noticeApproveInput(draft)), e => e.status === 409);
  });

  await t.test("every notice management read and write checks current account and role even with an earlier step-up context", async () => {
    for (const authority of ["account", "role"]) {
      const f = await mutationFixture("prepare");
      if (authority === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.reviewer.actorUserId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.reviewer.actorUserId]);
      const before = await snapshotAuditedBusinessTables(pool), args = [f.reviewer, f.key, f.locale];
      for (const run of [() => f.service.getVersion(...args, f.first.versionId), () => f.service.listVersions(...args), () => f.run(),
        () => f.service.approve(...args, noticeApproveInput(f.draft)), () => publishNotice(f, f.second, 1), () => withdrawNotice(f, f.first.versionId, 1)]) await assert.rejects(run(), e => e.status === 403);
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("notice approval and publication require exact digests explicit confirmation and valid database time windows", async () => {
    const f = await noticeFixture(pool), draft = await preparedNotice(f), before = await snapshotAuditedBusinessTables(pool);
    for (const extra of [{ expectedContentSha256: "f".repeat(64) }, { effectiveFrom: "2020-01-01T00:00:00.000Z" },
      { reviewDueAt: "2020-01-01T00:00:00.000Z" }, { wordingReviewed: false }, { scopeConfirmed: false }, { publicContentConfirmed: false }, { reviewReference: null }]) {
      await assert.rejects(f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft, extra)), e => [400, 409].includes(e.status));
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const future = await f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft, { effectiveFrom: new Date(Date.now() + 3600000).toISOString() }));
    await assert.rejects(publishNotice(f, future), e => e.status === 409); assert.equal(await f.get(), null);
    const current = await approvedNotice(f);
    await assert.rejects(f.service.publish(f.reviewer, f.key, f.locale, { ...noticePublishInput(current), expectedApprovalSha256: "a".repeat(64) }), e => e.status === 409);
    await publishNotice(f, current); assert.equal((await f.get()).versionId, current.versionId);
  });

  await t.test("notice publication CAS prevents rollback stale removal and resurrection while allowing a reviewed successor", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f), second = await approvedNotice(f); await publishNotice(f, first);
    await assert.rejects(publishNotice(f, second), e => e.status === 409);
    assert.equal((await publishNotice(f, second, 1)).revision, 2);
    await assert.rejects(publishNotice(f, first, 2), e => e.status === 409);
    await assert.rejects(withdrawNotice(f, first.versionId, 2), e => e.status === 409);
    const withdrawn = await withdrawNotice(f, second.versionId, 2); assert.equal(withdrawn.revision, 3);
    await assert.rejects(publishNotice(f, second, 3), e => e.status === 409);
    await assert.rejects(withdrawNotice(f, second.versionId, 2), e => e.status === 409);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await withdrawNotice(f, second.versionId, 3), withdrawn); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const third = await approvedNotice(f); assert.equal((await publishNotice(f, third, 3)).revision, 4);
  });

  await t.test("notice public reads do not fall back across language unpublished future expired or withdrawn versions", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f); await publishNotice(f, first); const second = await approvedNotice(f);
    assert.equal((await f.get()).versionId, first.versionId); assert.equal(await f.get("zh-CN"), null);
    await publishNotice(f, second, 1);
    await pool.query("update privacy_notice_versions set effective_from = now() + interval '1 hour' where id = $1", [second.versionId]);
    assert.equal(await f.get(), null);
    await pool.query("update privacy_notice_versions set created_at = now() - interval '3 days', reviewed_at = now() - interval '2 days', effective_from = now() - interval '2 days', review_due_at = now() - interval '1 day' where id = $1", [second.versionId]);
    assert.equal(await f.get(), null);
    await withdrawNotice(f, second.versionId, 2); assert.equal(await f.get(), null);
    const zh = { ...f, locale: "zh-CN", scopeKey: "application_disclosure:zh-CN" }, chinese = await approvedNotice(zh); await publishNotice(zh, chinese);
    assert.equal((await f.get("zh-CN")).versionId, chinese.versionId); assert.equal(await f.get(), null);
  });

  await t.test("notice public reads bind the full approved evidence and fail closed when only its reference changes", async () => {
    for (const mutation of ["body", "reference", "publication"]) {
      const f = await noticeFixture(pool), version = await approvedNotice(f); await publishNotice(f, version);
      if (mutation === "body") {
        const document = { ...version.document, title: "Changed after publication" };
        await pool.query("update privacy_notice_versions set content_json = $2::jsonb, content_sha256 = $3 where id = $1", [version.versionId, JSON.stringify(document), noticeDigest(document)]);
      } else if (mutation === "reference") await pool.query("update privacy_notice_versions set review_evidence_json = jsonb_set(review_evidence_json, '{reviewReference}', '\"changed-reference\"') where id = $1", [version.versionId]);
      else await pool.query("update privacy_notice_publications set approval_sha256 = $2 where scope_key = $1", [f.scopeKey, "a".repeat(64)]);
      await assert.rejects(f.get(), e => e.status === 503 && !e.message.includes("changed-reference"));
      await withdrawNotice(f, version.versionId, 1); assert.equal(await f.get(), null, "emergency withdrawal does not parse the damaged body or review");
    }
  });

  await t.test("notice audit failures roll back first scope creation approval publication and withdrawal across the complete snapshot", async () => {
    const f = await noticeFixture(pool), fault = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool); assert.equal(Object.keys(before).length, 51);
      assert.ok(Object.hasOwn(before, "application_material_selections"));
      assert.ok(Object.hasOwn(before, "application_submission_authorizations"));
      assert.ok(Object.hasOwn(before, "application_material_snapshots"));
      assert.ok(Object.hasOwn(before, "official_submission_policy_versions"));
      assert.ok(Object.hasOwn(before, "official_submission_policy_version_targets"));
      assert.ok(Object.hasOwn(before, "official_submission_policy_publications"));
      assert.ok(Object.hasOwn(before, "application_submissions"));
      assert.ok(Object.hasOwn(before, "official_submission_groups"));
      assert.ok(Object.hasOwn(before, "official_submission_group_members"));
      assert.ok(Object.hasOwn(before, "notification_preferences"));
      assert.ok(Object.hasOwn(before, "notification_templates"));
      assert.ok(Object.hasOwn(before, "notification_events"));
      assert.ok(Object.hasOwn(before, "notification_deliveries"));
      assert.ok(Object.hasOwn(before, "official_submission_outbox"));
      await fault.during("notices.prepare", () => assert.rejects(preparedNotice(f), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const draft = await preparedNotice(f); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("notices.approve", () => assert.rejects(f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft)), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const approved = await f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft)); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("notices.publish", () => assert.rejects(publishNotice(f, approved), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await publishNotice(f, approved); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("notices.withdraw", () => assert.rejects(withdrawNotice(f, approved.versionId, 1), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await withdrawNotice(f, approved.versionId, 1); assert.equal((await logs(f)).length, 4);
    } finally { await fault.close(); }
  });

  await t.test("concurrent first notice scopes serialize versions and a repeated creation UUID creates once", async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const f = await noticeFixture(pool), created = await race(f, [() => preparedNotice(f), () => preparedNotice(f)], true);
      for (const result of created) assert.equal(result.status, "fulfilled", `${result.reason?.code ?? ""}/${result.reason?.constraint ?? ""}`);
      assert.deepEqual(created.map(r => r.value.version).sort(), [1, 2]);
      const id = randomUUID(), repeated = await race(f, [() => preparedNotice(f, id), () => preparedNotice(f, id)]);
      for (const result of repeated) assert.equal(result.status, "fulfilled", `${result.reason?.code ?? ""}/${result.reason?.constraint ?? ""}`);
      assert.deepEqual(repeated[0].value, repeated[1].value); assert.equal((await logs(f)).length, 3);
    }
  });

  await t.test("concurrent notice reviewers cannot both approve one immutable version", async () => {
    const f = await noticeFixture(pool), draft = await preparedNotice(f), input = noticeApproveInput(draft);
    const winner = oneWinner(await race(f, [() => f.service.approve(f.reviewer, f.key, f.locale, input), () => f.service.approve(f.otherReviewer, f.key, f.locale, input)]));
    assert.equal((await f.service.getVersion(f.reviewer, f.key, f.locale, draft.versionId)).approvalSha256, winner.approvalSha256);
    assert.equal((await logs(f)).filter(l => l.action === "notices.approve").length, 1);
  });

  await t.test("concurrent notice publishers have exactly one initial revision winner", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f), second = await approvedNotice(f);
    const winner = oneWinner(await race(f, [() => publishNotice(f, first), () => publishNotice(f, second)]));
    assert.equal((await f.get()).versionId, winner.versionId); assert.equal((await logs(f)).filter(l => l.action === "notices.publish").length, 1);
  });

  await t.test("racing notice replacement and withdrawal cannot act on the wrong publication", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f), second = await approvedNotice(f); await publishNotice(f, first);
    const winner = oneWinner(await race(f, [() => publishNotice(f, second, 1), () => withdrawNotice(f, first.versionId, 1)]));
    const current = (await f.service.listVersions(f.reviewer, f.key, f.locale)).publication;
    assert.equal(current.revision, 2); assert.equal(current.status, winner.status); assert.equal(current.versionId, winner.versionId);
  });

  await t.test("notice account or role revocation committed first prevents each of the four waiting mutations", async () => {
    for (const authority of ["account", "role"]) for (const command of ["prepare", "approve", "publish", "withdraw"]) {
      const f = await mutationFixture(command), blocker = await pool.connect(); let pending;
      try {
        await blocker.query("begin");
        if (authority === "account") await blocker.query("update users set account_status = 'disabled' where id = $1", [f.reviewer.actorUserId]);
        else await blocker.query("update user_roles set revoked_at = now() where user_id = $1", [f.reviewer.actorUserId]);
        const expected = await snapshotAuditedBusinessTables(blocker), pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        pending = Promise.allSettled([f.run()]); await blockedBy(pid); await blocker.query("commit");
        assert.equal((await pending)[0].reason.status, 403); assert.deepEqual(await snapshotAuditedBusinessTables(pool), expected, `${authority}/${command}`);
      } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
    }
  });

  await t.test("all notice mutations hold current authority locks through the actual successful audit until commit", async () => {
    for (const authority of ["account", "role"]) for (const command of ["prepare", "approve", "publish", "withdraw"]) {
      const f = await mutationFixture(command); let reached, release, pid, mutation, revocation;
      const hit = new Promise(resolve => { reached = resolve; }), gate = new Promise(resolve => { release = resolve; });
      const service = new PostgresNoticeGovernance({ ...f.client, transaction: work => f.client.transaction(async tx => {
        pid = (await tx.query("select pg_backend_pid() as pid", []))[0].pid;
        return work({ ...tx, query: async (sql, args) => {
          const rows = await tx.query(sql, args);
          if (/insert into audit_logs/i.test(sql)) { reached(); await gate; }
          return rows;
        } });
      }) });
      try {
        mutation = Promise.allSettled([f.run(service)]); await Promise.race([hit, mutation.then(() => assert.fail("Mutation did not reach its real audit insert"))]);
        revocation = authority === "account" ? pool.query("update users set account_status = 'disabled' where id = $1", [f.reviewer.actorUserId])
          : pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.reviewer.actorUserId]);
        await blockedBy(pid); release(); assert.equal((await mutation)[0].status, "fulfilled"); await revocation;
        await assert.rejects(f.service.listVersions(f.reviewer, f.key, f.locale), e => e.status === 403);
      } finally { release(); if (mutation) await mutation; if (revocation) await revocation; }
    }
  });

  await t.test("notice publication rechecks database time after a version-row lock wait", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f); await publishNotice(f, first);
    const due = new Date(Date.now() + 750), second = await approvedNotice(f, { reviewDueAt: due.toISOString() }), blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select id from privacy_notice_versions where id = $1 for update", [second.versionId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled([publishNotice(f, second, 1)]); await blockedBy(pid); await delay(Math.max(0, due.getTime() - Date.now()) + 30);
      await blocker.query("commit"); assert.equal((await pending)[0].reason.status, 409); assert.equal((await f.get()).versionId, first.versionId);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
  });

  await t.test("lost notice commit acknowledgements recover by stable ID or current publication without repeated writes", async () => {
    for (const command of ["prepare", "approve", "publish", "withdraw"]) {
      const f = await mutationFixture(command);
      const service = new PostgresNoticeGovernance({ ...f.client, async transaction(work) { await f.client.transaction(work); throw new Error("Synthetic committed acknowledgement loss"); } });
      await assert.rejects(f.run(service), /Synthetic committed acknowledgement loss/);
      const afterCommit = await snapshotAuditedBusinessTables(pool);
      if (command === "prepare") {
        assert.equal((await f.service.getVersion(f.reviewer, f.key, f.locale, f.id)).versionId, f.id); await f.run();
      } else {
        await assert.rejects(f.run(), e => e.status === 409);
        if (command === "approve") assert.equal((await f.service.getVersion(f.reviewer, f.key, f.locale, f.draft.versionId)).status, "approved");
        if (command === "publish") assert.equal((await f.get()).versionId, f.second.versionId);
        if (command === "withdraw") assert.equal(await f.get(), null);
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), afterCommit);
    }
  });

  await t.test("notice SQL constraints protect scope version review identity and retained approval references", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f); await publishNotice(f, first);
    const before = await snapshotAuditedBusinessTables(pool);
    for (const [sql, args, code] of [
      ["update privacy_notice_scopes set locale = 'EN' where scope_key = $1", [f.scopeKey], "23514"],
      ["update privacy_notice_versions set version = 0 where id = $1", [first.versionId], "23514"],
      ["update privacy_notice_versions set approved_by_user_id = prepared_by_user_id where id = $1", [first.versionId], "23514"],
      ["update privacy_notice_versions set review_evidence_json = '{}'::jsonb || jsonb_build_object('large', repeat('x',9000)) where id = $1", [first.versionId], "23514"],
      ["update privacy_notice_publications set scope_key = 'application_disclosure:zh-CN' where scope_key = $1", [f.scopeKey], "23503"],
      ["update privacy_notice_publications set approval_sha256 = 'bad' where scope_key = $1", [f.scopeKey], "23514"],
      ["delete from users where id = $1", [f.reviewer.actorUserId], "23503"],
      ["delete from privacy_notice_versions where id = $1", [first.versionId], "23503"],
    ]) await assert.rejects(pool.query(sql, args), e => e.code === code);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("notice history reads are bounded and exhausted version or publication counters never wrap", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f), second = await approvedNotice(f), third = await preparedNotice(f); await publishNotice(f, first);
    const page = await f.service.listVersions(f.preparer, f.key, f.locale, { limit: 2 });
    assert.deepEqual(page.items.map(v => v.version), [3, 2]); assert.equal(page.nextBeforeVersion, 2);
    const tail = await f.service.listVersions(f.preparer, f.key, f.locale, { limit: 2, beforeVersion: 2 }); assert.deepEqual(tail.items.map(v => v.version), [1]); assert.equal(tail.nextBeforeVersion, null);
    await pool.query("update privacy_notice_versions set version = $2 where id = $1", [third.versionId, MAX_NOTICE_VERSION]);
    await assert.rejects(preparedNotice(f), e => e.status === 409);
    assert.equal((await preparedNotice(f, third.versionId)).version, MAX_NOTICE_VERSION);
    await pool.query("update privacy_notice_publications set revision = $2 where scope_key = $1", [f.scopeKey, MAX_NOTICE_VERSION]);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.equal((await publishNotice(f, first, MAX_NOTICE_VERSION)).revision, MAX_NOTICE_VERSION);
    await assert.rejects(publishNotice(f, second, MAX_NOTICE_VERSION), e => e.status === 409);
    await assert.rejects(withdrawNotice(f, first.versionId, MAX_NOTICE_VERSION), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
  });

  await t.test("public notice reads see complete old or new publication while the actual publisher transaction is in flight", async () => {
    const f = await noticeFixture(pool), first = await approvedNotice(f);
    const draft = await preparedNotice(f, randomUUID(), noticeDocument("en", { title: "Different synthetic successor" }));
    const second = await f.service.approve(f.reviewer, f.key, f.locale, noticeApproveInput(draft));
    assert.notEqual(first.contentSha256, second.contentSha256); await publishNotice(f, first);
    let reached, release, pending;
    const hit = new Promise(resolve => { reached = resolve; }), gate = new Promise(resolve => { release = resolve; });
    const service = new PostgresNoticeGovernance({ ...f.client, transaction: work => f.client.transaction(tx => work({ ...tx, query: async (sql, args) => {
      const rows = await tx.query(sql, args); if (/insert into audit_logs/i.test(sql)) { reached(); await gate; } return rows;
    } })) });
    try {
      pending = Promise.allSettled([publishNotice(f, second, 1, service)]);
      await Promise.race([hit, pending.then(() => assert.fail("Publisher did not reach its audit barrier"))]);
      const old = await f.get(); assert.equal(old.versionId, first.versionId); assert.equal(old.publicationRevision, 1); assert.equal(old.contentSha256, first.contentSha256);
      release(); assert.equal((await pending)[0].status, "fulfilled");
      const next = await f.get(); assert.equal(next.versionId, second.versionId); assert.equal(next.publicationRevision, 2); assert.equal(next.contentSha256, second.contentSha256);
    } finally { release(); if (pending) await pending; }
  });
}
