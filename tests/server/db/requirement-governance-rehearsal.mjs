import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PostgresRequirementGovernance } from "../../../src/server/catalog/postgres-requirement-governance.ts";
import { PostgresCatalogRepository } from "../../../src/server/catalog/postgres-repository.ts";
import { createTransactionalSqlClient } from "../../../src/server/db/postgres-client.ts";
import { requirementDigest } from "../../../src/server/catalog/requirements.ts";
import { createAuditFailureFixture, snapshotAuditedBusinessTables } from "./audit-failure-fixture.mjs";
import { governanceFixture, preparedRequirement, approvedRequirement, approveInput, publishInput } from "./requirement-governance-fixture.mjs";
import { requirementDocument } from "../catalog/requirements-fixture.mjs";

export async function runRequirementGovernanceRehearsal(t, pool) {
  const client = createTransactionalSqlClient(pool), catalog = new PostgresCatalogRepository(client);
  const get = f => catalog.getProgramRequirements(f.programId, f.intakeId);
  const publish = (f, version, revision = 0, service = f.service) => service.publish(f.reviewer, f.programId, f.intakeId, publishInput(version, revision));
  const withdraw = (f, id, revision, service = f.service) => service.withdraw(f.reviewer, f.programId, f.intakeId, { expectedVersionId: id, expectedPublicationRevision: revision, reason: "review_required" });
  const logs = async f => (await pool.query("select action, metadata_json, allowed from audit_logs where metadata_json->>'programIntakeId' = $1 order by created_at, id", [f.intakeId])).rows;
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
    assert.fail("Requirement commands did not reach the database lock barrier.");
  }
  async function raceOnIntake(f, operations) {
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select id from program_intakes where id = $1 for update", [f.intakeId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled(operations.map(op => op())); await blockedBy(pid, operations.length);
      await blocker.query("commit"); return await pending;
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
  }
  const oneWinner = results => { assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(results.find(r => r.status === "rejected").reason.status, 409); };

  await t.test("governed requirements prepare approve publish and withdraw independently with metadata-only atomic audits", async () => {
    const f = await governanceFixture(pool), id = randomUUID(), draft = await preparedRequirement(f, id);
    assert.equal(draft.governanceStatus, "draft"); assert.equal(draft.review, null); assert.equal(await get(f), null);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await preparedRequirement(f, id), draft); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const version = await f.service.approve(f.reviewer, f.programId, f.intakeId, approveInput(draft));
    assert.equal(version.governanceStatus, "approved"); assert.equal(version.review.preparedByUserId, f.preparerId); assert.equal(version.review.reviewedByUserId, f.reviewerId);
    assert.equal(await get(f), null); const published = await publish(f, version); assert.equal(published.revision, 1);
    const dto = await get(f); assert.equal(dto.versionId, id); assert.equal(Object.keys(dto).length, 11);
    assert.doesNotMatch(JSON.stringify(dto), new RegExp(`${f.preparerId}|${f.reviewerId}|scopeConfirmed|approvalSha256`));
    const snapshot = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await publish(f, version, 1), published); assert.deepEqual(await snapshotAuditedBusinessTables(pool), snapshot);
    await withdraw(f, id, 1); assert.equal(await get(f), null);
    const audit = await logs(f); assert.deepEqual(audit.map(row => row.action), ["prepare", "approve", "publish", "withdraw"].map(action => `catalog.requirements.${action}`));
    assert.doesNotMatch(JSON.stringify(audit), /Synthetic rule|university\.example|sourceChecks|reviewDueAt/);
    assert.ok(audit.every(row => row.allowed));
  });

  await t.test("governance separates preparer from reviewer and rejects foreign intake or changed creation identity", async () => {
    const f = await governanceFixture(pool), other = await governanceFixture(pool), version = await preparedRequirement(f);
    const before = await snapshotAuditedBusinessTables(pool);
    await assert.rejects(f.service.approve(f.preparer, f.programId, f.intakeId, approveInput(version)), e => e.status === 403);
    await assert.rejects(f.service.getVersion(f.reviewer, other.programId, f.intakeId, version.versionId), e => e.status === 403);
    await assert.rejects(f.service.getVersion(f.reviewer, other.programId, other.intakeId, version.versionId), e => e.status === 403);
    const changed = requirementDocument(); changed.requirements[0].ruleText = "Changed content";
    await assert.rejects(preparedRequirement(f, version.versionId, changed), e => e.status === 409);
    await assert.rejects(f.service.createDraft(f.reviewer, f.programId, f.intakeId, { versionId: version.versionId, document: version.document }), e => e.status === 409);
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    await pool.query("insert into user_roles (user_id, role) values ($1, 'cuac_admin')", [f.preparerId]);
    await assert.rejects(f.service.approve({ ...f.preparer, activeRole: "cuac_admin", authStrength: "step_up" },
      f.programId, f.intakeId, approveInput(version)), e => e.status === 409);
  });

  await t.test("approval binds every source exact digest and time while source attestation never guesses authenticity", async () => {
    const f = await governanceFixture(pool), draft = await preparedRequirement(f), input = approveInput(draft), before = await snapshotAuditedBusinessTables(pool);
    for (const extra of [{ expectedContentSha256: "f".repeat(64) }, { effectiveFrom: "2020-01-01T00:00:00.000Z" },
      { reviewDueAt: "2020-01-01T00:00:00.000Z" }, { sourceChecks: [{ ...input.sourceChecks[0], contentSha256: "b".repeat(64) }] }]) {
      await assert.rejects(f.service.approve(f.reviewer, f.programId, f.intakeId, { ...input, ...extra }), e => [400, 409].includes(e.status));
    }
    assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const future = requirementDocument(); future.sources[0].capturedAt = "2099-01-01T00:00:00.000Z";
    await assert.rejects(preparedRequirement(f, randomUUID(), future), e => e.status === 409);
    const version = await f.service.approve(f.reviewer, f.programId, f.intakeId, input); await publish(f, version);
    const changed = requirementDocument(); changed.requirements[0].ruleText = "Changed after review";
    await pool.query("update program_requirement_versions set content_json = $2::jsonb, content_sha256 = $3 where id = $1", [version.versionId, JSON.stringify(changed), requirementDigest(changed)]);
    await assert.rejects(get(f), e => e.status === 503);
    await assert.rejects(f.service.getVersion(f.reviewer, f.programId, f.intakeId, version.versionId), e => e.status === 503);
    await withdraw(f, version.versionId, 1); assert.equal(await get(f), null, "withdrawal does not require parsing damaged content");
  });

  await t.test("publication CAS prevents rollback stale withdrawal and resurrection of a withdrawn version", async () => {
    const f = await governanceFixture(pool), first = await approvedRequirement(f), second = await approvedRequirement(f);
    await publish(f, first);
    await assert.rejects(publish(f, second), e => e.status === 409);
    const two = await publish(f, second, 1); assert.equal(two.revision, 2);
    await assert.rejects(withdraw(f, first.versionId, 1), e => e.status === 409);
    await assert.rejects(withdraw(f, first.versionId, 2), e => e.status === 409);
    await assert.rejects(publish(f, first, 2), e => e.status === 409);
    await assert.rejects(f.service.publish(f.reviewer, f.programId, f.intakeId, { ...publishInput(second, 2), expectedApprovalSha256: "a".repeat(64) }), e => e.status === 409);
    const withdrawn = await withdraw(f, second.versionId, 2); assert.equal(withdrawn.revision, 3);
    await assert.rejects(publish(f, second, 3), e => e.status === 409);
    await assert.rejects(withdraw(f, second.versionId, 2), e => e.status === 409);
    const before = await snapshotAuditedBusinessTables(pool);
    assert.deepEqual(await withdraw(f, second.versionId, 3), withdrawn); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    const third = await approvedRequirement(f); assert.equal((await publish(f, third, 3)).revision, 4);
  });

  await t.test("every governed read and write rechecks live role and account state", async () => {
    for (const authority of ["account", "role"]) {
      const f = await governanceFixture(pool), draft = await preparedRequirement(f), approved = await approvedRequirement(f); await publish(f, approved);
      if (authority === "account") await pool.query("update users set account_status = 'disabled' where id = $1", [f.reviewerId]);
      else await pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.reviewerId]);
      const before = await snapshotAuditedBusinessTables(pool), args = [f.reviewer, f.programId, f.intakeId];
      for (const op of [() => f.service.getVersion(...args, draft.versionId), () => f.service.listVersions(...args),
        () => f.service.createDraft(...args, { versionId: randomUUID(), document: requirementDocument() }), () => f.service.approve(...args, approveInput(draft)),
        () => f.service.publish(...args, publishInput(approved, 1)), () => f.service.withdraw(...args, { expectedVersionId: approved.versionId, expectedPublicationRevision: 1, reason: "review_required" })]) {
        await assert.rejects(op(), e => e.status === 403);
      }
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
    }
  });

  await t.test("requirements audit failure rolls back draft approval publication and withdrawal without partial state", async () => {
    const f = await governanceFixture(pool), fault = await createAuditFailureFixture(pool);
    try {
      let before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.requirements.prepare", () => assert.rejects(preparedRequirement(f), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const draft = await preparedRequirement(f); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.requirements.approve", () => assert.rejects(f.service.approve(f.reviewer, f.programId, f.intakeId, approveInput(draft)), e => e.code === "P0001"));
      assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      const approved = await f.service.approve(f.reviewer, f.programId, f.intakeId, approveInput(draft)); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.requirements.publish", () => assert.rejects(publish(f, approved), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await publish(f, approved); before = await snapshotAuditedBusinessTables(pool);
      await fault.during("catalog.requirements.withdraw", () => assert.rejects(withdraw(f, approved.versionId, 1), e => e.code === "P0001")); assert.deepEqual(await snapshotAuditedBusinessTables(pool), before);
      await withdraw(f, approved.versionId, 1); assert.equal((await logs(f)).length, 4);
    } finally { await fault.close(); }
  });

  await t.test("concurrent requirement drafts allocate distinct serial versions and same UUID replay creates once", async () => {
    const f = await governanceFixture(pool), results = await raceOnIntake(f, [() => preparedRequirement(f), () => preparedRequirement(f)]);
    assert.ok(results.every(r => r.status === "fulfilled")); assert.deepEqual(results.map(r => r.value.version).sort(), [1, 2]);
    const id = randomUUID(), repeated = await raceOnIntake(f, [() => preparedRequirement(f, id), () => preparedRequirement(f, id)]);
    assert.ok(repeated.every(r => r.status === "fulfilled")); assert.deepEqual(repeated[0].value, repeated[1].value); assert.equal((await logs(f)).length, 3);
  });

  await t.test("two actual concurrent reviewers cannot both approve the same requirement version", async () => {
    const f = await governanceFixture(pool), draft = await preparedRequirement(f), input = approveInput(draft);
    const results = await raceOnIntake(f, [() => f.service.approve(f.reviewer, f.programId, f.intakeId, input), () => f.service.approve(f.otherReviewer, f.programId, f.intakeId, input)]);
    oneWinner(results); assert.equal((await logs(f)).filter(l => l.action.endsWith("approve")).length, 1);
    assert.equal((await f.service.getVersion(f.reviewer, f.programId, f.intakeId, draft.versionId)).approvalSha256, results.find(r => r.status === "fulfilled").value.approvalSha256);
  });

  await t.test("two actual concurrent publishers cannot both win an empty publication revision", async () => {
    const f = await governanceFixture(pool), first = await approvedRequirement(f), second = await approvedRequirement(f);
    const results = await raceOnIntake(f, [() => publish(f, first), () => publish(f, second)]);
    oneWinner(results); assert.equal((await get(f)).versionId, results.find(r => r.status === "fulfilled").value.versionId);
    assert.equal((await logs(f)).filter(l => l.action.endsWith("publish")).length, 1);
  });

  await t.test("racing publication and withdrawal cannot withdraw a replacement or undo a withdrawal", async () => {
    const f = await governanceFixture(pool), first = await approvedRequirement(f), second = await approvedRequirement(f); await publish(f, first);
    const results = await raceOnIntake(f, [() => publish(f, second, 1), () => withdraw(f, first.versionId, 1)]); oneWinner(results);
    const winner = results.find(r => r.status === "fulfilled").value;
    const current = (await f.service.listVersions(f.reviewer, f.programId, f.intakeId)).publication;
    assert.equal(current.revision, 2); assert.equal(current.status, winner.status); assert.equal(current.versionId, winner.versionId);
  });

  await t.test("revocation committed before a waiting requirements command prevents its write", async () => {
    for (const authority of ["account", "role"]) {
      const f = await governanceFixture(pool), blocker = await pool.connect(); let pending;
      try {
        await blocker.query("begin");
        if (authority === "account") await blocker.query("update users set account_status = 'disabled' where id = $1", [f.preparerId]);
        else await blocker.query("update user_roles set revoked_at = now() where user_id = $1", [f.preparerId]);
        const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
        pending = Promise.allSettled([preparedRequirement(f)]); await blockedBy(pid); await blocker.query("commit");
        assert.equal((await pending)[0].reason.status, 403); assert.equal((await logs(f)).length, 0);
      } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
    }
  });

  await t.test("requirements authority locks are retained through success audit and real COMMIT", async () => {
    const f = await governanceFixture(pool), blocker = await pool.connect(); let pending, revocation;
    try {
      await blocker.query("begin"); await blocker.query("select id from program_intakes where id = $1 for update", [f.intakeId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled([preparedRequirement(f)]); await blockedBy(pid);
      revocation = pool.query("update user_roles set revoked_at = now() where user_id = $1", [f.preparerId]); await blockedBy(pid, 2);
      await blocker.query("commit"); assert.equal((await pending)[0].status, "fulfilled"); await revocation;
      assert.equal((await logs(f)).length, 1); await assert.rejects(preparedRequirement(f), e => e.status === 403);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; if (revocation) await revocation; }
  });

  await t.test("publication checks the database clock after a requirement row lock wait", async () => {
    const f = await governanceFixture(pool), due = new Date(Date.now() + 1500).toISOString(), approved = await approvedRequirement(f, { reviewDueAt: due });
    const blocker = await pool.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("select id from program_requirement_versions where id = $1 for update", [approved.versionId]);
      const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0].pid;
      pending = Promise.allSettled([publish(f, approved)]); await blockedBy(pid);
      for (let i = 0; i < 300; i++) {
        if ((await pool.query("select clock_timestamp() >= $1::timestamptz as expired", [due])).rows[0].expired) break;
        await delay(10);
      }
      assert.equal((await pool.query("select clock_timestamp() >= $1::timestamptz as expired", [due])).rows[0].expired, true);
      await blocker.query("commit"); assert.equal((await pending)[0].reason.status, 409); assert.equal(await get(f), null);
      assert.equal((await logs(f)).filter(l => l.action.endsWith("publish")).length, 0);
    } finally { await blocker.query("rollback"); blocker.release(); if (pending) await pending; }
  });

  await t.test("lost governance COMMIT acknowledgements recover by stable ID or state reads without repeating writes", async () => {
    const f = await governanceFixture(pool), id = randomUUID(); let commits = 0;
    const ambiguous = new PostgresRequirementGovernance(createTransactionalSqlClient({ ...pool, connect: async () => {
      const connection = await pool.connect();
      return { async query(sql, params) { const result = await connection.query(sql, params); if (sql === "commit") { commits++; throw new Error("Synthetic governance COMMIT acknowledgement loss"); } return result; }, release: error => connection.release(error) };
    } }));
    await assert.rejects(preparedRequirement(f, id, requirementDocument(), ambiguous), /Synthetic governance COMMIT/);
    const draft = await preparedRequirement(f, id), input = approveInput(draft);
    await assert.rejects(ambiguous.approve(f.reviewer, f.programId, f.intakeId, input), /Synthetic governance COMMIT/);
    const approved = await f.service.getVersion(f.reviewer, f.programId, f.intakeId, id);
    await assert.rejects(f.service.approve(f.reviewer, f.programId, f.intakeId, input), e => e.status === 409);
    await assert.rejects(publish(f, approved, 0, ambiguous), /Synthetic governance COMMIT/);
    assert.equal((await get(f)).versionId, id); await assert.rejects(publish(f, approved), e => e.status === 409);
    await assert.rejects(withdraw(f, id, 1, ambiguous), /Synthetic governance COMMIT/);
    const state = await f.service.listVersions(f.reviewer, f.programId, f.intakeId); assert.equal(state.publication.revision, 2); assert.equal(state.publication.status, "withdrawn");
    assert.equal(commits, 4); assert.equal((await logs(f)).length, 4);
  });

  await t.test("requirements pagination is bounded and scope-safe while revision exhaustion never wraps", async () => {
    const f = await governanceFixture(pool), other = await governanceFixture(pool); await preparedRequirement(other);
    const first = await approvedRequirement(f); await preparedRequirement(f); await preparedRequirement(f);
    const page = await f.service.listVersions(f.reviewer, f.programId, f.intakeId, { limit: 2 });
    assert.deepEqual(page.items.map(r => r.version), [3, 2]); assert.equal(page.nextBeforeVersion, 2);
    const tail = await f.service.listVersions(f.reviewer, f.programId, f.intakeId, { beforeVersion: 2, limit: 2 });
    assert.deepEqual(tail.items.map(r => r.version), [1]); assert.equal(tail.nextBeforeVersion, null);
    assert.equal("document" in tail.items[0], false); await publish(f, first);
    await pool.query("update program_requirement_publications set revision = 2147483647 where program_intake_id = $1", [f.intakeId]);
    assert.equal((await publish(f, first, 2147483647)).revision, 2147483647);
    await assert.rejects(withdraw(f, first.versionId, 2147483647), e => e.status === 409);
    await pool.query("update program_requirement_versions set version = 2147483647 where program_intake_id = $1 and version = 3", [f.intakeId]);
    await assert.rejects(preparedRequirement(f), e => e.status === 409);
  });

  await t.test("retired scopes permit emergency withdrawal but never new publication or approval", async () => {
    const f = await governanceFixture(pool), approved = await approvedRequirement(f), draft = await preparedRequirement(f); await publish(f, approved);
    await pool.query("update schools set status = 'inactive' where id = $1", [f.schoolId]);
    await assert.rejects(preparedRequirement(f), e => e.status === 409);
    await assert.rejects(f.service.approve(f.reviewer, f.programId, f.intakeId, approveInput(draft)), e => e.status === 409);
    await assert.rejects(publish(f, approved, 1), e => e.status === 409);
    assert.equal((await withdraw(f, approved.versionId, 1)).status, "withdrawn");
    for (const change of ["prepared_by_user_id = approved_by_user_id", "review_evidence_json = null", "review_evidence_json = '[]'::jsonb", "review_evidence_json = jsonb_build_object('x', repeat('x', 17000))"]) {
      await assert.rejects(pool.query(`update program_requirement_versions set ${change} where id = $1`, [approved.versionId]), e => e.code === "23514");
    }
    await assert.rejects(pool.query("delete from users where id = $1", [f.preparerId]), e => e.code === "23503");
  });
}
