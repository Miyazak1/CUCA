import assert from "node:assert/strict";
import test from "node:test";
import { createRequestContext } from "../../../src/server/shared/request-context.ts";
import { OpsDataRightsService } from "../../../src/server/ops-data-rights/service.ts";
const actor=(extra={})=>createRequestContext({actorUserId:"a1111111-a111-4111-8111-a11111111111",activeRole:"cuac_ops",
  selectedSurface:"ops",purpose:"data_rights_review",authStrength:"session",...extra});
const row=(extra={})=>({requestId:"b1111111-b111-4111-8111-b11111111111",requestType:"access",correctionScope:null,
  preferredLocale:"en",status:"received",revision:1,receivedAt:new Date("2026-09-20T00:00:00Z"),
  identityConfirmedAt:new Date("2026-09-20T00:01:00Z"),deadlinePolicyVersion:"data_rights_response_v1",
  internalTargetAt:new Date("2026-10-05T00:00:00Z"),responseDueAt:new Date("2026-10-20T00:00:00Z"),extendedDueAt:null,
  observedAt:new Date("2026-09-21T00:00:00Z"),updatedAt:new Date("2026-09-20T00:00:00Z"),review:null,outcome:null,...extra});
const review={reviewId:"c1111111-c111-4111-8111-c11111111111",revision:1,status:"investigating",assignedUserId:actor().actorUserId,
  assignedRole:"cuac_ops",escalationCode:null,escalationReference:null,escalatedAt:null,createdAt:new Date(),updatedAt:new Date()};
const unused={async propose(){throw 0;},async approve(){throw 0;}};
test("Ops queue exposes minimal request metadata and rechecks authority",async()=>{const calls=[];
  const service=new OpsDataRightsService({async list(input){calls.push(input);return{authorized:true,value:[row()]};},async claim(){throw 0;},async escalate(){throw 0;},...unused},{async record(){}});
  const result=await service.list(actor(),{}); assert.equal(result.length,1); assert.equal("userId" in result[0],false); assert.equal(calls[0].actorUserId,actor().actorUserId);
  assert.equal("observedAt" in result[0],false);assert.equal(result[0].deadlineState,"on_track");
  await assert.rejects(service.list(actor({purpose:"ops_support"}),{}),e=>e.status===403);
});
test("deadline states use database time and the effective response deadline",async()=>{const service=new OpsDataRightsService({
  async list(){return{authorized:true,value:[
    row({observedAt:new Date("2026-10-02T00:00:00Z")}),
    row({observedAt:new Date("2026-10-05T00:00:00Z")}),
    row({observedAt:new Date("2026-10-14T00:00:00Z")}),
    row({observedAt:new Date("2026-10-21T00:00:00Z")}),
    row({responseDueAt:new Date("2026-10-20T00:00:00Z"),extendedDueAt:new Date("2026-11-19T00:00:00Z"),observedAt:new Date("2026-10-21T00:00:00Z")}),
  ]};},async claim(){throw 0;},async escalate(){throw 0;},...unused},{async record(){}});
  assert.deepEqual((await service.list(actor())).map(item=>item.deadlineState),
    ["internal_due_soon","internal_target_missed","response_due_soon","overdue","internal_target_missed"]);
});
test("claim and escalation are revision-bound and use fixed codes",async()=>{const audits=[];
  const service=new OpsDataRightsService({async list(){throw 0;},async claim(){return{authorized:true,value:row({status:"in_progress",revision:2,review})};},
    async escalate(){return{authorized:true,value:row({status:"escalated",revision:3,review:{...review,status:"escalated",revision:2,
      escalationCode:"legal_review_required",escalationReference:"case:123",escalatedAt:new Date()}})};},...unused},{async record(e){audits.push(e);}});
  assert.equal((await service.claim(actor(),row().requestId,{expectedRevision:1})).status,"in_progress");
  assert.equal((await service.escalate(actor(),row().requestId,{expectedRevision:2,expectedReviewRevision:1,code:"legal_review_required",reference:"case:123"})).status,"escalated");
  assert.deepEqual(audits.map(e=>e.action),["ops.data_rights.claim","ops.data_rights.escalate"]);
  await assert.rejects(service.escalate(actor(),row().requestId,{expectedRevision:2,expectedReviewRevision:1,code:"erase_now",reference:"case:123"}),e=>e.status===400);
});
test("repository denial and stale transitions never acknowledge success",async()=>{const service=new OpsDataRightsService({async list(){return{authorized:false};},
  async claim(){return{authorized:true,value:null};},async escalate(){return{authorized:true,value:null};},
  async propose(){return{authorized:true,value:null};},async approve(){return{authorized:true,value:null};}},{async record(){}});
  await assert.rejects(service.list(actor()),e=>e.status===403);
  await assert.rejects(service.claim(actor(),row().requestId,{expectedRevision:1}),e=>e.status===409);
});

test("access and correction outcomes are single-operator approvals",async()=>{const received=[];
  const service=new OpsDataRightsService({async list(){throw 0;},async claim(){throw 0;},async escalate(){throw 0;},
    async propose(input){received.push(input);const outcome={outcomeId:input.proposalId,outcomeCode:input.outcomeCode,reasonCode:null,
      caseReference:input.caseReference,proposalSha256:input.proposalSha256,approvalMode:input.approvalMode,status:"approved",revision:1,
      proposedByUserId:input.actorUserId,proposedByRole:input.activeRole,approvedByUserId:input.actorUserId,approvedAt:new Date(),createdAt:new Date(),updatedAt:new Date()};
      return{authorized:true,value:row({status:"in_progress",revision:2,review,outcome})};},async approve(){throw 0;}},{async record(){}});
  const result=await service.propose(actor(),row().requestId,{proposalId:"d1111111-d111-4111-8111-d11111111111",expectedRevision:2,
    expectedReviewRevision:1,outcomeCode:"access_ready",reasonCode:null,caseReference:"case:access-1"});
  assert.equal(result.outcome.status,"approved");assert.equal(received[0].approvalMode,"single_operator");
});

test("portable export requires a step-up administrator",async()=>{let called=false;
  const service=new OpsDataRightsService({async list(){throw 0;},async claim(){throw 0;},async escalate(){throw 0;},
    async propose(input){called=true;const outcome={outcomeId:input.proposalId,outcomeCode:input.outcomeCode,reasonCode:null,
      caseReference:input.caseReference,proposalSha256:input.proposalSha256,approvalMode:input.approvalMode,status:"approved",revision:1,
      proposedByUserId:input.actorUserId,proposedByRole:input.activeRole,approvedByUserId:input.actorUserId,approvedAt:new Date(),createdAt:new Date(),updatedAt:new Date()};
      return{authorized:true,value:row({requestType:"portable_export",status:"in_progress",revision:2,review,outcome})};},async approve(){throw 0;}},{async record(){}});
  const body={proposalId:"d1111111-d111-4111-8111-d11111111111",expectedRevision:2,expectedReviewRevision:1,
    outcomeCode:"portable_export_ready",reasonCode:null,caseReference:"case:export-1"};
  await assert.rejects(service.propose(actor(),row().requestId,body),e=>e.status===403);assert.equal(called,false);
  const result=await service.propose(actor({activeRole:"cuac_admin",authStrength:"step_up"}),row().requestId,body);
  assert.equal(result.outcome.approvalMode,"single_admin");assert.equal(called,true);
});

test("deletion approval is bound to a different step-up administrator and exact digest",async()=>{let proposal;
  const service=new OpsDataRightsService({async list(){throw 0;},async claim(){throw 0;},async escalate(){throw 0;},
    async propose(input){proposal=input;const outcome={outcomeId:input.proposalId,outcomeCode:input.outcomeCode,reasonCode:null,
      caseReference:input.caseReference,proposalSha256:input.proposalSha256,approvalMode:input.approvalMode,status:"proposed",revision:1,
      proposedByUserId:input.actorUserId,proposedByRole:input.activeRole,approvedByUserId:null,approvedAt:null,createdAt:new Date(),updatedAt:new Date()};
      return{authorized:true,value:row({requestType:"account_deletion",status:"in_progress",revision:2,review,outcome})};},
    async approve(input){assert.notEqual(input.actorUserId,proposal.actorUserId);assert.equal(input.expectedProposalSha256,proposal.proposalSha256);
      return{authorized:true,value:row({requestType:"account_deletion",status:"in_progress",revision:2,review,outcome:{outcomeId:proposal.proposalId,
        outcomeCode:proposal.outcomeCode,reasonCode:null,caseReference:proposal.caseReference,proposalSha256:proposal.proposalSha256,
        approvalMode:"dual_control",status:"approved",revision:2,proposedByUserId:proposal.actorUserId,proposedByRole:proposal.activeRole,
        approvedByUserId:input.actorUserId,approvedAt:new Date(),createdAt:new Date(),updatedAt:new Date()}})};}},{async record(){}});
  const proposed=await service.propose(actor(),row().requestId,{proposalId:"d1111111-d111-4111-8111-d11111111111",expectedRevision:2,
    expectedReviewRevision:1,outcomeCode:"account_deletion_ready",reasonCode:null,caseReference:"case:delete-1"});
  assert.equal(proposed.outcome.status,"proposed");assert.equal(proposal.approvalMode,"dual_control");
  await assert.rejects(service.approve(actor({activeRole:"cuac_admin",authStrength:"session"}),row().requestId,
    {expectedOutcomeRevision:1,expectedProposalSha256:proposal.proposalSha256}),e=>e.status===403);
  const approved=await service.approve(actor({actorUserId:"e1111111-e111-4111-8111-e11111111111",activeRole:"cuac_admin",authStrength:"step_up"}),
    row().requestId,{expectedOutcomeRevision:1,expectedProposalSha256:proposal.proposalSha256});
  assert.equal(approved.outcome.status,"approved");
  await assert.rejects(service.approve(actor({actorUserId:"e1111111-e111-4111-8111-e11111111111",activeRole:"cuac_admin",authStrength:"step_up"}),
    row().requestId,{expectedOutcomeRevision:1,expectedProposalSha256:"sha256:not-a-digest"}),e=>e.status===400);
});
