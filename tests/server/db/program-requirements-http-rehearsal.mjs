import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requirementFixture, syntheticRequirementVersion, syntheticPublication } from "./requirements-fixture.mjs";
import { governanceFixture, preparedRequirement, approveInput, publishInput } from "./requirement-governance-fixture.mjs";

export async function runProgramRequirementsHttpRehearsal(t, pool, { send, browser, register }) {
  const path = f => `/api/v1/catalog/programs/${f.programId}/intakes/${f.intakeId}/requirements`;
  async function fixture() {
    const f = await requirementFixture(pool); f.versionId = await syntheticRequirementVersion(pool, f); await syntheticPublication(pool, f, f.versionId); return f;
  }
  await t.test("network public requirements follow actual internal review publication withdrawal and approval binding", async () => {
    const f = await governanceFixture(pool), draft = await preparedRequirement(f);
    assert.deepEqual(await (await send(path(f))).json(), { data: null });
    const approved = await f.service.approve(f.reviewer, f.programId, f.intakeId, approveInput(draft));
    assert.deepEqual(await (await send(path(f))).json(), { data: null });
    await f.service.publish(f.reviewer, f.programId, f.intakeId, publishInput(approved));
    const response = await send(path(f)); assert.equal(response.status, 200); const dto = (await response.json()).data;
    assert.equal(dto.versionId, draft.versionId); assert.equal(dto.assessmentMode, "information_only");
    assert.doesNotMatch(JSON.stringify(dto), new RegExp(`${f.preparerId}|${f.reviewerId}|officialSourceConfirmed|scopeConfirmed|approvalSha256`));
    await pool.query("update program_requirement_versions set review_evidence_json = review_evidence_json || '{\"scopeConfirmed\":false}'::jsonb where id = $1", [draft.versionId]);
    const damaged = await send(path(f)); assert.equal(damaged.status, 503); assert.doesNotMatch(await damaged.text(), /scopeConfirmed|review_evidence|select /);
    await f.service.withdraw(f.reviewer, f.programId, f.intakeId, { expectedVersionId: draft.versionId, expectedPublicationRevision: 1, reason: "source_disputed" });
    assert.deepEqual(await (await send(path(f))).json(), { data: null });
    const denied = await send(path(f), { method: "POST", body: { ...publishInput(approved, 2), activeRole: "cuac_admin" } });
    assert.ok([404, 405].includes(denied.status)); assert.deepEqual(await (await send(path(f))).json(), { data: null });
  });
  await t.test("network requirements are guest-readable with strict headers, no private fields and no write endpoint", async () => {
    const f = await fixture(), client = browser(); await register(client);
    const guest = await send(path(f)); assert.equal(guest.status, 200, await guest.clone().text());
    assert.equal(guest.headers.get("cache-control"), "no-store"); assert.equal(guest.headers.get("x-content-type-options"), "nosniff");
    assert.ok(guest.headers.get("x-request-id")); assert.equal(guest.headers.get("set-cookie"), null);
    const dto = (await guest.json()).data;
    assert.equal(dto.versionId, f.versionId); assert.equal(dto.assessmentMode, "information_only");
    assert.equal(Object.keys(dto).length, 11); assert.doesNotMatch(JSON.stringify(dto), new RegExp(`${f.reviewerId}|approvedBy|reviewNote`));
    assert.deepEqual((await (await client.send(path(f))).json()).data, dto);
    assert.deepEqual((await (await send(path(f) + `?programId=${randomUUID()}&version=999`)).json()).data, dto);
    const response = await client.send(path(f), { method: "POST", body: { status: "active", approved: true } });
    assert.ok([404, 405].includes(response.status));
    assert.deepEqual((await (await send(path(f))).json()).data, dto);
  });

  await t.test("network requirements conceal cross-project, unpublished, withdrawn and expired versions without fallback", async () => {
    const f = await fixture(), other = await fixture();
    for (const target of [{ ...f, intakeId: other.intakeId }, { programId: randomUUID(), intakeId: randomUUID() }]) {
      const r = await send(path(target)); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { data: null });
    }
    const draft = await syntheticRequirementVersion(pool, f, { version: 2, approved: false });
    await syntheticPublication(pool, f, draft); assert.deepEqual(await (await send(path(f))).json(), { data: null });
    await syntheticPublication(pool, f, f.versionId, "withdrawn"); assert.deepEqual(await (await send(path(f))).json(), { data: null });
    await syntheticPublication(pool, f, f.versionId);
    await pool.query("update program_requirement_versions set review_due_at = now() where id = $1", [f.versionId]);
    assert.deepEqual(await (await send(path(f))).json(), { data: null });
    assert.equal((await send(path({ ...f, programId: "invalid" }))).status, 400);
    assert.equal((await send(path({ ...f, intakeId: "invalid" }))).status, 400);
  });

  await t.test("network damaged reviewed requirements return redacted unavailability rather than legacy rules", async () => {
    const f = await fixture();
    await pool.query("update program_requirement_versions set content_json = content_json || '{\"privateNote\":\"PRIVATE_REQUIREMENT_NOTE\"}'::jsonb where id = $1", [f.versionId]);
    const response = await send(path(f)); assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /PRIVATE_REQUIREMENT_NOTE|content_json|select |Legacy description/);
    await syntheticPublication(pool, f, f.versionId, "withdrawn");
    assert.deepEqual(await (await send(path(f))).json(), { data: null });
  });
}
