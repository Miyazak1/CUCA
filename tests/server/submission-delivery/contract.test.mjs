import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createOfficialSubmissionPackage,
  officialSubmissionProviderIdempotencyKey,
  validateOfficialSubmissionDeliveryResult,
} from "../../../src/server/submission-delivery/contract.ts";

const digest = value => value.repeat(64);

function packageInput() {
  const schoolId = randomUUID(), programId = randomUUID(), programIntakeId = randomUUID();
  return {
    outboxId: randomUUID(),
    groupId: randomUUID(),
    applicationSubmissionId: randomUUID(),
    schoolId,
    admissionRouteKey: "direct_university",
    externalChannelType: "university_portal",
    memberManifestSha256: digest("a"),
    members: [{
      position: 1,
      schoolApplicationId: randomUUID(),
      programId,
      programIntakeId,
      materialContentSha256: digest("b"),
      content: { schoolId, programId, programIntakeId },
    }],
  };
}

test("official submission package is deterministic, school-scoped and provider-idempotent", () => {
  const input = packageInput();
  const first = createOfficialSubmissionPackage(input), second = createOfficialSubmissionPackage(input);
  assert.equal(first.serialized, second.serialized);
  assert.equal(first.payloadSha256, second.payloadSha256);
  assert.equal(first.payload.members.length, 1);
  assert.equal(first.serialized.includes("payment"), false);
  assert.equal(first.serialized.includes("agent"), false);
  assert.equal(officialSubmissionProviderIdempotencyKey(input.groupId), `official-submission:${input.groupId}`);
});

test("official submission package rejects cross-school, duplicate and reordered members", () => {
  const input = packageInput(), member = input.members[0];
  for (const changed of [
    { ...input, members: [{ ...member, content: { ...member.content, schoolId: randomUUID() } }] },
    { ...input, members: [{ ...member, position: 2 }] },
    { ...input, members: [member, { ...member, position: 2 }] },
  ]) assert.throws(() => createOfficialSubmissionPackage(changed), error => error.status === 503);
});

test("provider result validation binds provider, payload, receipt and finite time", () => {
  const expected = { providerName: "cuac_handoff_gateway_v1", payloadSha256: digest("c") };
  const accepted = { status: "accepted", ...expected, receiptId: "receipt:2026.1", receivedAt: new Date() };
  assert.deepEqual(validateOfficialSubmissionDeliveryResult(accepted, expected), accepted);
  assert.equal(validateOfficialSubmissionDeliveryResult({ status: "not_accepted", ...expected }, expected).status, "not_accepted");
  for (const value of [
    { ...accepted, providerName: "other_provider" },
    { ...accepted, payloadSha256: digest("d") },
    { ...accepted, receiptId: "https://secret.invalid/?token=x" },
    { ...accepted, receivedAt: new Date(Number.NaN) },
  ]) assert.throws(() => validateOfficialSubmissionDeliveryResult(value, expected), error => error.status === 503);
});
