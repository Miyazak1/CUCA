import assert from "node:assert/strict";
import test from "node:test";
import { PostgresAgentContextRepository } from "../../../src/server/index.ts";

const now = new Date("2026-08-28T00:00:00.000Z");

function createClient(responder) {
  const calls = [];
  return {
    calls,
    client: {
      async query(statement, params) {
        calls.push({ statement, params });
        return responder(statement, params, calls.length);
      },
    },
  };
}

test("Postgres Agent context repository creates candidates with fixed parameterized SQL", async () => {
  const { client, calls } = createClient(() => [
    {
      id: "candidate-1",
      anonymousSessionHash: "guest-1",
      userId: null,
      continuationId: null,
      candidateType: "study_goal",
      contextScope: "guest_page",
      activeRole: "guest",
      tenantSchoolId: null,
      memoryNamespace: null,
      dataClass: "low_sensitive_preference",
      confidence: "user_stated",
      summary: "Interested in English-taught CS programs.",
      structuredJson: { subjectArea: "Computer Science" },
      sourceEntityIdsJson: ["program-1"],
      status: "proposed",
      expiresAt: new Date("2026-08-29T00:00:00.000Z"),
      createdAt: now,
      acceptedAt: null,
    },
  ]);
  const repository = new PostgresAgentContextRepository(client);

  const candidate = await repository.createCandidate({
    anonymousSessionHash: "guest-1",
    userId: null,
    continuationId: null,
    candidateType: "study_goal",
    contextScope: "guest_page",
    activeRole: "guest",
    tenantSchoolId: null,
    memoryNamespace: null,
    dataClass: "low_sensitive_preference",
    confidence: "user_stated",
    summary: "Interested in English-taught CS programs.",
    structured: { subjectArea: "Computer Science" },
    sourceEntityIds: ["program-1"],
    status: "proposed",
    expiresAt: new Date("2026-08-29T00:00:00.000Z"),
  });

  assert.equal(candidate.id, "candidate-1");
  assert.deepEqual(candidate.structured, { subjectArea: "Computer Science" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].statement, /pg_advisory_xact_lock\(hashtextextended/);
  assert.deepEqual(calls[0].params, ["guest_page", "guest-1", null]);
  assert.match(calls[1].statement, /insert into agent_context_candidates/);
  assert.match(calls[1].statement, /candidate_clock as materialized \(select clock_timestamp\(\) as created_at\)/);
  assert.match(calls[1].statement, /candidate_capacity as materialized/);
  assert.match(calls[1].statement, /existing\.anonymous_session_hash = \$1/);
  assert.match(calls[1].statement, /candidate_capacity\.stored_count < case/);
  assert.match(calls[1].statement, /least\(\$15::timestamptz, candidate_clock.created_at/);
  assert.match(calls[1].statement, /interval '24 hours' else interval '168 hours'/);
  assert.match(calls[1].statement, /\$12::jsonb/);
  assert.match(calls[1].statement, /\$13::jsonb/);
  assert.doesNotMatch(calls[1].statement, /select \*/i);
  assert.doesNotMatch(calls[1].statement, /agent_messages|agent_conversations|payments|student_profiles/i);
  assert.equal(calls[1].params[0], "guest-1");
  assert.equal(calls[1].params[11], JSON.stringify({ subjectArea: "Computer Science" }));
  assert.equal(calls[1].params[12], JSON.stringify(["program-1"]));
  assert.equal(calls[1].params[15], 12);
  assert.equal(calls[1].params[16], 24);
});

test("Postgres Agent context repository returns a stable quota error when the locked insert has no capacity", async () => {
  const { client } = createClient(() => []);
  const repository = new PostgresAgentContextRepository(client);

  await assert.rejects(repository.createCandidate({
    anonymousSessionHash: "guest-1", userId: null, continuationId: null, candidateType: "study_goal",
    contextScope: "guest_page", activeRole: "guest", tenantSchoolId: null, memoryNamespace: null,
    dataClass: "low_sensitive_preference", confidence: "inferred", summary: "Degree: master",
    structured: { degreeLevel: "master" }, sourceEntityIds: [], status: "proposed",
    expiresAt: new Date("2026-08-29T00:00:00.000Z"),
  }), error => error.code === "TOO_MANY_REQUESTS" && error.status === 429
    && !JSON.stringify(error).includes("Degree: master"));
});

test("Postgres Agent context repository locks only eligible owner-scoped candidates", async () => {
  const { client, calls } = createClient(() => [
    {
      id: "candidate-1",
      anonymousSessionHash: null,
      userId: "student-1",
      continuationId: null,
      candidateType: "study_goal",
      contextScope: "student_account",
      activeRole: "student",
      tenantSchoolId: null,
      memoryNamespace: "user:student-1:student",
      dataClass: "low_sensitive_preference",
      confidence: "user_stated",
      summary: "Interested in scholarships.",
      structuredJson: {},
      sourceEntityIdsJson: [],
      status: "proposed",
      expiresAt: new Date("2026-09-04T00:00:00.000Z"),
      createdAt: now,
      acceptedAt: null,
    },
  ]);
  const repository = new PostgresAgentContextRepository(client);

  const candidate = await repository.findCandidateForConfirmation("candidate-1", { destinationUserId: "student-1", contextScope: "student_account", userId: "student-1", memoryNamespace: "user:student-1:student" });

  assert.equal(candidate.userId, "student-1");
  assert.match(calls[0].statement, /from agent_context_candidates/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.match(calls[0].statement, /for update/);
  assert.match(calls[0].statement, /user_id = \$4::uuid/);
  assert.match(calls[0].statement, /anonymous_session_hash = \$3/);
  assert.match(calls[0].statement, /memory_namespace = \$5/);
  assert.match(calls[0].statement, /tenant_school_id is null/);
  assert.match(calls[0].statement, /isfinite\(expires_at\) and expires_at > clock_timestamp\(\)/);
  assert.doesNotMatch(calls[0].statement, /select \*/i);
  assert.deepEqual(calls[0].params, ["candidate-1", "student_account", null, "student-1", "user:student-1:student", "student-1"]);
});

test("Postgres Agent context repository marks only proposed candidates accepted", async () => {
  const { client, calls } = createClient(() => []);
  const repository = new PostgresAgentContextRepository(client);

  assert.equal(await repository.markCandidateAccepted("candidate-1", { destinationUserId: "student-1", contextScope: "guest_page", anonymousSessionHash: "guest-1" }), false);

  assert.match(calls[0].statement, /update agent_context_candidates/);
  assert.match(calls[0].statement, /set status = 'accepted'/);
  assert.match(calls[0].statement, /where id = \$1/);
  assert.match(calls[0].statement, /and status = 'proposed'/);
  assert.match(calls[0].statement, /accepted_at = clock_timestamp\(\)/);
  assert.match(calls[0].statement, /expires_at > clock_timestamp\(\)/);
  assert.match(calls[0].statement, /returning id/);
  assert.deepEqual(calls[0].params, ["candidate-1", "guest_page", "guest-1", null, null, "student-1"]);
});

test("Postgres Agent context repository creates memory entries with namespace-scoped fields", async () => {
  const { client, calls } = createClient(sql => sql.includes("select count(*)") ? [{ count: 0 }] : [
    {
      id: "memory-1",
      userId: "student-1",
      memoryType: "study_goal",
      contextScope: "student_account",
      activeRole: "student",
      tenantSchoolId: null,
      memoryNamespace: "user:student-1:student",
      dataClass: "low_sensitive_preference",
      confidence: "user_confirmed",
      summary: "Interested in CS programs in Hangzhou.",
      structuredJson: { preferredCity: "Hangzhou" },
      source: "guest_context_carry_forward",
      sourceCandidateId: "candidate-1",
      expiresAt: new Date("2027-08-28T00:00:00.000Z"),
      createdAt: now,
      clearedAt: null,
    },
  ]);
  const repository = new PostgresAgentContextRepository(client);

  const memory = await repository.createMemoryEntry({
    userId: "student-1",
    memoryType: "study_goal",
    contextScope: "student_account",
    activeRole: "student",
    tenantSchoolId: null,
    memoryNamespace: "user:student-1:student",
    dataClass: "low_sensitive_preference",
    confidence: "user_confirmed",
    summary: "Interested in CS programs in Hangzhou.",
    structured: { preferredCity: "Hangzhou" },
    source: "guest_context_carry_forward",
    sourceCandidateId: "candidate-1",
  });

  assert.equal(memory.memoryNamespace, "user:student-1:student");
  assert.deepEqual(memory.structured, { preferredCity: "Hangzhou" });
  assert.match(calls[0].statement, /cleared_at is null/);
  assert.match(calls[1].statement, /insert into agent_memory_entries/);
  assert.match(calls[1].statement, /memory_clock as materialized \(select clock_timestamp\(\) as created_at\)/);
  assert.match(calls[1].statement, /memory_clock\.created_at \+ \(\$13::int \* interval '1 day'\)/);
  assert.match(calls[1].statement, /\$10::jsonb/);
  assert.doesNotMatch(calls[1].statement, /select \*/i);
  assert.doesNotMatch(calls[1].statement, /agent_messages|agent_conversations|payments|student_profiles/i);
  assert.equal(calls[1].params[0], "student-1");
  assert.equal(calls[1].params[5], "user:student-1:student");
  assert.equal(calls[1].params[9], JSON.stringify({ preferredCity: "Hangzhou" }));
  assert.equal(calls[1].params[12], 365);
  assert.equal(memory.expiresAt.toISOString(), "2027-08-28T00:00:00.000Z");
});
