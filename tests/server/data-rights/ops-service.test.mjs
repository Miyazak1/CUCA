import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { OpsDataRightsService } from "../../../src/server/ops-data-rights/service.ts";
const actor=(extra={})=>createRequestContext({actorUserId:"a1111111-a111-4111-8111-a11111111111",activeRole:"cuac_ops",
  selectedSurface:"ops",purpose:"data_rights_review",authStrength:"session",...extra});
const row=(extra={})=>({requestId:"b1111111-b111-4111-8111-b11111111111",requestType:"access",correctionScope:null,
  preferredLocale:"en",status:"received",revision:1,receivedAt:new Date("2026-09-20T00:00:00Z"),updatedAt:new Date("2026-09-20T00:00:00Z"),review:null,...extra});
test("Ops queue exposes minimal request metadata and rechecks authority",async()=>{const calls=[];
  const service=new OpsDataRightsService({async list(input){calls.push(input);return{authorized:true,value:[row()]};},async claim(){throw 0;},async escalate(){throw 0;}},{async record(){}});
  const result=await service.list(actor(),{}); assert.equal(result.length,1); assert.equal("userId" in result[0],false); assert.equal(calls[0].actorUserId,actor().actorUserId);
  await assert.rejects(service.list(actor({purpose:"ops_support"}),{}),e=>e.status===403);
});
test("claim and escalation are revision-bound and use fixed codes",async()=>{const audits=[];
  const review={reviewId:"c1111111-c111-4111-8111-c11111111111",revision:1,status:"investigating",assignedUserId:actor().actorUserId,
    assignedRole:"cuac_ops",escalationCode:null,escalationReference:null,escalatedAt:null,createdAt:new Date(),updatedAt:new Date()};
  const service=new OpsDataRightsService({async list(){throw 0;},async claim(){return{authorized:true,value:row({status:"in_progress",revision:2,review})};},
    async escalate(){return{authorized:true,value:row({status:"escalated",revision:3,review:{...review,status:"escalated",revision:2,
      escalationCode:"legal_review_required",escalationReference:"case:123",escalatedAt:new Date()}})};}},{async record(e){audits.push(e);}});
  assert.equal((await service.claim(actor(),row().requestId,{expectedRevision:1})).status,"in_progress");
  assert.equal((await service.escalate(actor(),row().requestId,{expectedRevision:2,expectedReviewRevision:1,code:"legal_review_required",reference:"case:123"})).status,"escalated");
  assert.deepEqual(audits.map(e=>e.action),["ops.data_rights.claim","ops.data_rights.escalate"]);
  await assert.rejects(service.escalate(actor(),row().requestId,{expectedRevision:2,expectedReviewRevision:1,code:"erase_now",reference:"case:123"}),e=>e.status===400);
});
test("repository denial and stale transitions never acknowledge success",async()=>{const service=new OpsDataRightsService({async list(){return{authorized:false};},
  async claim(){return{authorized:true,value:null};},async escalate(){return{authorized:true,value:null};}},{async record(){}});
  await assert.rejects(service.list(actor()),e=>e.status===403);
  await assert.rejects(service.claim(actor(),row().requestId,{expectedRevision:1}),e=>e.status===409);
});
