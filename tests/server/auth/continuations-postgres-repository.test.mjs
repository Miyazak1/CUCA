import assert from "node:assert/strict";
import test from "node:test";
import { PostgresSignInContinuationRepository } from "../../../src/server/index.ts";

test("Postgres sign-in continuation repository creates fixed SQL rows with hashed token only", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const expiresAt = new Date("2026-08-28T00:15:00.000Z");
  const repository = new PostgresSignInContinuationRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ continuationId: "continuation-1" }];
    },
  });

  const result = await repository.createContinuation({
    continuationTokenHash: "sha256:abc",
    guestSessionId: "guest-session-1",
    targetRoute: "/application.html#add-choice",
    actionKey: "application.add_choice",
    requiredRole: "student",
    tenantSchoolId: null,
    payloadPreview: { programId: "program-1" },
    deviceFingerprintHash: "sha256:device",
    now,
    expiresAt,
  });

  assert.deepEqual(result, { continuationId: "continuation-1" });
  assert.match(calls[0].statement, /insert into sign_in_continuations/);
  assert.match(calls[0].statement, /continuation_token_hash/);
  assert.match(calls[0].statement, /payload_preview_json/);
  assert.match(calls[0].statement, /\$7::jsonb/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password|payment_token/i);
  assert.deepEqual(calls[0].params, [
    "sha256:abc",
    "guest-session-1",
    "/application.html#add-choice",
    "application.add_choice",
    "student",
    null,
    JSON.stringify({ programId: "program-1" }),
    "sha256:device",
    now,
    expiresAt,
  ]);
});

test("Postgres sign-in continuation repository reads active continuation by id and token hash", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresSignInContinuationRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [
        {
          id: "continuation-1",
          guestSessionId: "guest-session-1",
          targetRoute: "/application.html#add-choice",
          actionKey: "application.add_choice",
          requiredRole: "student",
          tenantSchoolId: null,
          payloadPreviewJson: { programId: "program-1" },
          expiresAt: new Date("2026-08-28T00:15:00.000Z"),
          consumedAt: null,
        },
      ];
    },
  });

  const continuation = await repository.findActiveContinuation({
    continuationId: "continuation-1",
    continuationTokenHash: "sha256:abc",
    now,
  });

  assert.equal(continuation.id, "continuation-1");
  assert.equal(continuation.payloadPreview.programId, "program-1");
  assert.match(calls[0].statement, /from sign_in_continuations/);
  assert.match(calls[0].statement, /id = \$1/);
  assert.match(calls[0].statement, /continuation_token_hash = \$2/);
  assert.match(calls[0].statement, /expires_at > \$3/);
  assert.match(calls[0].statement, /consumed_at is null/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password/i);
  assert.deepEqual(calls[0].params, ["continuation-1", "sha256:abc", now]);
});

test("Postgres sign-in continuation repository marks continuation consumed once", async () => {
  const calls = [];
  const now = new Date("2026-08-28T00:00:00.000Z");
  const repository = new PostgresSignInContinuationRepository({
    async query(statement, params) {
      calls.push({ statement, params });
      return [{ continuationId: "continuation-1" }];
    },
  });

  const result = await repository.markContinuationConsumed({
    continuationId: "continuation-1",
    consumedByUserId: "student-1",
    continuationTokenHash: "sha256:abc",
    guestSessionId: "guest-session-1",
    requiredRole: "student",
    activeRole: "student",
    now,
  });

  assert.deepEqual(result, { consumed: true });
  assert.match(calls[0].statement, /update sign_in_continuations/);
  assert.match(calls[0].statement, /set consumed_at = \$2/);
  assert.match(calls[0].statement, /consumed_by_user_id = \$3/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.match(calls[0].statement, /consumed_at is null/);
  assert.doesNotMatch(calls[0].statement, /select \*|raw_token|password/i);
  assert.match(calls[0].statement, /continuation_token_hash = \$4 and guest_session_id = \$5/);
  assert.match(calls[0].statement, /required_role = \$6/);
  assert.match(calls[0].statement, /tenant_school_id is null/);
  assert.match(calls[0].statement, /expires_at > greatest\(\$2::timestamptz, clock_timestamp\(\)\)/);
  assert.match(calls[0].statement, /r\.revoked_at is null/);
  assert.match(calls[0].statement, /r\.role = \$7/);
  assert.deepEqual(calls[0].params, ["continuation-1", now, "student-1", "sha256:abc", "guest-session-1", "student", "student"]);
});
