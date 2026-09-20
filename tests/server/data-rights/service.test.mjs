import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { DataRightsService } from "../../../src/server/data-rights/service.ts";

const student = (extra = {}) => createRequestContext({ actorUserId: randomUUID(), activeRole: "student", selectedSurface: "student",
  purpose: "data_rights", authStrength: "session", ...extra });
const row = (extra = {}) => ({ id: randomUUID(), userId:randomUUID(), requestType: "access", correctionScope: null, preferredLocale: "en",
  status: "received", revision: 1, receivedAt: new Date("2026-09-20T00:00:00.000Z"), identityConfirmedAt: null,
  closedAt: null, updatedAt: new Date("2026-09-20T00:00:00.000Z"), ...extra });

test("students create minimal rights requests without free text or another user identity", async () => {
  const calls = [], audits = [], context = student(), requestId = randomUUID();
  const service = new DataRightsService({
    async listOwn() { return { authorized: true, rows: [] }; },
    async createOwn(input) { calls.push(input); return { authorized: true, row: row({ id: input.requestId, requestType: input.requestType,
      correctionScope: input.correctionScope, preferredLocale: input.preferredLocale }) }; },
    async cancelOwn() { throw new Error("unused"); },
    async confirmOwn() { throw new Error("unused"); },
  }, { async record(event) { audits.push(event); } });
  const result = await service.createOwn(context, { requestId, requestType: "correction", correctionScope: "education", preferredLocale: "zh-CN" });
  assert.equal(result.requestId, requestId);
  assert.equal(calls[0].userId, context.actorUserId);
  assert.match(calls[0].subjectReferenceHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(audits[0].action, "data_rights.request.create");
  await assert.rejects(service.createOwn(context, { requestId: randomUUID(), requestType: "access", correctionScope: null,
    preferredLocale: "en", note: "do not store this" }), e => e.status === 400);
});

test("export and deletion requests require fresh authentication while access and correction use a live session", async () => {
  let creates = 0;
  const repository = { async listOwn() { return { authorized: true, rows: [] }; },
    async createOwn(input) { creates++; return { authorized: true, row: row({ id: input.requestId, requestType: input.requestType }) }; },
    async cancelOwn() { throw new Error("unused"); },
    async confirmOwn(input) { return { authorized: true, row: row({ id: input.requestId, requestType: "portable_export",
      status: "identity_confirmed", revision: 2, identityConfirmedAt: new Date("2026-09-20T00:01:00.000Z") }) }; } };
  const service = new DataRightsService(repository, { async record() {} });
  for (const requestType of ["portable_export", "account_deletion"]) {
    await assert.rejects(service.createOwn(student(), { requestId: randomUUID(), requestType, correctionScope: null, preferredLocale: "en" }), e => e.status === 403);
    await service.createOwn(student({ authStrength: "step_up" }), { requestId: randomUUID(), requestType, correctionScope: null, preferredLocale: "en" });
  }
  assert.equal(creates, 2);
});

test("rights requests are owner-only and received requests use optimistic cancellation", async () => {
  const target = row(), audits = [];
  const service = new DataRightsService({
    async listOwn() { return { authorized: true, rows: [target] }; },
    async createOwn() { throw new Error("unused"); },
    async cancelOwn(input) { return { authorized: true, row: input.expectedRevision === 1
      ? row({ ...target, status: "cancelled", revision: 2, closedAt: new Date("2026-09-21T00:00:00.000Z") }) : null }; },
    async confirmOwn() { throw new Error("unused"); },
  }, { async record(event) { audits.push(event); } });
  assert.equal((await service.listOwn(student())).length, 1);
  assert.equal((await service.cancelOwn(student(), target.id, { expectedRevision: 1 })).status, "cancelled");
  assert.equal(audits[0].action, "data_rights.request.cancel");
  await assert.rejects(service.cancelOwn(student(), target.id, { expectedRevision: 2 }), e => e.status === 409);
  for (const context of [createRequestContext(), student({ activeRole: "school_staff", selectedSurface: "school" }), student({ purpose: "student_action" })]) {
    await assert.rejects(service.listOwn(context), e => e.status === 403);
  }
});

test("repository and audit failures do not become successful acknowledgements", async () => {
  const context = student(), requestId = randomUUID();
  const unavailable = new DataRightsService({ async listOwn() { return { authorized: false, rows: [] }; },
    async createOwn() { return { authorized: false, row: null }; }, async cancelOwn() { return { authorized: false, row: null }; },
    async confirmOwn() { return { authorized: false, row: null }; } }, { async record() {} });
  await assert.rejects(unavailable.listOwn(context), e => e.status === 403);
  await assert.rejects(unavailable.createOwn(context, { requestId, requestType: "access", correctionScope: null, preferredLocale: "en" }), e => e.status === 403);
  const auditFailure = new DataRightsService({ async listOwn() { return { authorized: true, rows: [] }; },
    async createOwn(input) { return { authorized: true, row: row({ id: input.requestId }) }; }, async cancelOwn() { return { authorized: true, row: row() }; },
    async confirmOwn() { return { authorized: true, row: row() }; } },
  { async record() { throw new Error("audit unavailable"); } });
  await assert.rejects(auditFailure.createOwn(context, { requestId, requestType: "access", correctionScope: null, preferredLocale: "en" }), /audit unavailable/);
});

test("identity confirmation requires step-up and records only bounded evidence",async()=>{const calls=[],audits=[],target=row();
  const service=new DataRightsService({async listOwn(){throw 0;},async createOwn(){throw 0;},async cancelOwn(){throw 0;},
    async confirmOwn(input){calls.push(input);return{authorized:true,row:row({...target,status:"identity_confirmed",revision:2,
      identityConfirmedAt:new Date("2026-09-20T00:02:00.000Z")})};}},{async record(event){audits.push(event);}});
  const body={confirmationId:randomUUID(),expectedRevision:1};
  await assert.rejects(service.confirmOwn(student(),target.id,body),e=>e.status===403);
  const confirmed=await service.confirmOwn(student({authStrength:"step_up"}),target.id,body);
  assert.equal(confirmed.status,"identity_confirmed");
  assert.match(calls[0].confirmationReferenceSha256,/^sha256:[a-f0-9]{64}$/);
  assert.equal(audits[0].action,"data_rights.request.identity_confirm");
  assert.deepEqual(audits[0].metadata,{method:"password_step_up",revision:2});
});

test("request lifecycle materializes only locale-bound notification events",async()=>{const events=[],context=student(),target=row({userId:context.actorUserId,preferredLocale:"zh-CN"});
  const service=new DataRightsService({async listOwn(){throw 0;},async createOwn(){return{authorized:true,row:target};},
    async confirmOwn(){return{authorized:true,row:row({...target,status:"identity_confirmed",revision:2,identityConfirmedAt:new Date()})};},
    async cancelOwn(){return{authorized:true,row:row({...target,status:"cancelled",revision:2,closedAt:new Date()})};}},
  {async record(){}},{async publish(event){events.push(event);}});
  await service.createOwn(context,{requestId:target.id,requestType:"access",correctionScope:null,preferredLocale:"zh-CN"});
  await service.confirmOwn(student({actorUserId:context.actorUserId,authStrength:"step_up"}),target.id,{confirmationId:randomUUID(),expectedRevision:1});
  await service.cancelOwn(context,target.id,{expectedRevision:1});
  assert.deepEqual(events.map(event=>event.eventType),["data_rights_received","data_rights_identity_required",
    "data_rights_identity_confirmed","data_rights_cancelled"]);
  assert.ok(events.every(event=>event.templates.every(template=>template.locale==="zh-CN")));
});
