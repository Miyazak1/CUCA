import assert from "node:assert/strict";
import test from "node:test";
import { canReadStudentOwnedResource, canWriteStudentOwnedResource, createRequestContext } from "../../../src/server/index.ts";

test("student ownership helper allows a student to read and write own resources", () => {
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });

  assert.equal(canReadStudentOwnedResource(context, { id: "profile-1", ownerUserId: "student-1" }).allowed, true);
  assert.equal(canWriteStudentOwnedResource(context, { id: "choice-1", ownerUserId: "student-1" }).allowed, true);
});

test("student ownership helper denies direct-ID access to other students", () => {
  const context = createRequestContext({ activeRole: "student", actorUserId: "student-1" });
  const decision = canReadStudentOwnedResource(context, { id: "profile-2", ownerUserId: "student-2" });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /owner mismatch/);
});

test("student ownership helper denies when context data class is not allowed", () => {
  const context = createRequestContext({
    activeRole: "guest",
    actorUserId: null,
    dataClassAllowlist: ["public_catalog"],
  });
  const decision = canReadStudentOwnedResource(context, {
    id: "profile-1",
    ownerUserId: "student-1",
    dataClasses: ["education_record"],
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /Data class is not allowed/);
});
