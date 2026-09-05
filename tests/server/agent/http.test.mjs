import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { issueGuestSession } from "../../../src/server/auth/guest-session.ts";
import {
  AgentContextService,
  createAgentContextHttpHandlers,
  getAgentContextRouteHandlers,
  GUEST_SESSION_COOKIE_NAME,
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from "../../../src/server/index.ts";

const guest = issueGuestSession();

test("disabled Agent context runtime fails closed before configuring PostgreSQL", async () => {
  const handlers = getAgentContextRouteHandlers({ CUAC_AGENT_ENABLED: "false" });
  for (const handler of [handlers.proposeCandidate, handlers.carryForwardCandidate]) {
    const response = await handler(new Request("https://cuac.test/api/v1/agent/context", { method: "POST" }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
  }
  assert.equal((await getAgentContextRouteHandlers({ CUAC_AGENT_ENABLED: "invalid" }).proposeCandidate(
    new Request("https://cuac.test/api/v1/agent/context", { method: "POST" }))).status, 503);
});

test("Agent HTTP carry-forward requires explicit confirmation and a UUID before candidate lookup", async () => {
  for (const body of [{ candidateId: "40000000-0000-0000-0000-000000000001" }, { candidateId: "bad-id", confirmed: true }, { candidateId: "40000000-0000-0000-0000-000000000001", confirmed: "true" }]) {
    const { handlers, calls } = createHandlers([], activeStudentSession);
    const response = await handlers.carryForwardCandidate(new Request("https://cuac.test/api", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=student-token` }, body: JSON.stringify(body) }));
    assert.equal(response.status, 400);
    assert.equal(calls.some(c => c.method === "findCandidateForConfirmation"), false);
  }
});
const activeStudentSession = {
  userId: "student-1",
  selectedSurface: "student",
  activeRole: "student",
  tenantSchoolId: null,
  authStrength: "session",
  expiresAt: new Date("2026-12-29T00:00:00.000Z"),
  revokedAt: null,
  accountStatus: "active",
};

function createHandlers(seedCandidates = [], authSession = null) {
  const calls = [];
  const candidates = new Map(seedCandidates.map((candidate) => [candidate.id, candidate]));
  const repository = {
    async assertMemoryAllowed() {},
    async createCandidate(input) {
      calls.push({ method: "createCandidate", input });
      return {
        id: "candidate-1",
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        acceptedAt: null,
        ...input,
      };
    },
    async findCandidateForConfirmation(candidateId, owner) {
      calls.push({ method: "findCandidateForConfirmation", candidateId, owner });
      return candidates.get(candidateId) ?? null;
    },
    async markCandidateAccepted(candidateId, owner) {
      calls.push({ method: "markCandidateAccepted", candidateId, owner });
      return true;
    },
    async createMemoryEntry(input) {
      calls.push({ method: "createMemoryEntry", input });
      return {
        id: "memory-1",
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        expiresAt: new Date("2027-08-28T00:00:00.000Z"),
        clearedAt: null,
        ...input,
      };
    },
  };
  const authRepository = {
    async findActiveSessionByTokenHash(sessionTokenHash) {
      calls.push({ method: "findActiveSessionByTokenHash", sessionTokenHash });
      return authSession;
    },
  };

  return {
    calls,
    handlers: createAgentContextHttpHandlers(new AgentContextService(repository), authRepository),
  };
}

test("Agent context HTTP creates guest candidates without trusting body authority", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.proposeCandidate(
    new Request("https://cuac.test/api/v1/agent/context/candidates", {
      method: "POST",
      headers: { cookie: `${GUEST_SESSION_COOKIE_NAME}=${guest.token}` },
      body: JSON.stringify({
        userId: "attacker",
        tenantSchoolId: "school-1",
        candidateType: "study_goal",
        structured: { subjectAreas: ["computer_science"] },
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.userId, undefined);
  assert.equal(body.data.anonymousSessionHash, undefined);
  assert.equal(body.data.tenantSchoolId, undefined);
  assert.equal(body.data.memoryNamespace, undefined);
  assert.equal(calls[0].input.anonymousSessionHash, guest.guestSessionId);
  assert.equal(calls[0].input.userId, null);
  assert.equal(calls[0].input.tenantSchoolId, null);
  assert.equal(calls[0].method, "createCandidate");
});

test("Agent context HTTP rejects unbound guest context before storage", async () => {
  const { handlers, calls } = createHandlers();
  const response = await handlers.proposeCandidate(new Request("https://cuac.test/api/v1/agent/context/candidates", {
    method: "POST", headers: { cookie: "cuac_guest=untrusted-client-id" },
    body: JSON.stringify({ candidateType: "study_goal", contextScope: "guest_page", dataClass: "low_sensitive_preference", confidence: "user_stated", summary: "Synthetic preference" }),
  }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test("Agent context HTTP rejects sensitive memory candidates", async () => {
  const { handlers } = createHandlers();
  const response = await handlers.proposeCandidate(
    new Request("https://cuac.test/api/v1/agent/context/candidates", {
      method: "POST",
      headers: { cookie: `${GUEST_SESSION_COOKIE_NAME}=${guest.token}` },
      body: JSON.stringify({
        candidateType: "payment_detail",
        contextScope: "guest_page",
        dataClass: "payment_sensitive",
        confidence: "user_stated",
        summary: "My card number is 4111111111111111.",
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "BAD_REQUEST");
});

test("Agent context HTTP carries guest candidate forward for authenticated student only", async () => {
  const { handlers, calls } = createHandlers(
    [
      {
        id: "40000000-0000-0000-0000-000000000001",
        anonymousSessionHash: guest.guestSessionId,
        userId: null,
        continuationId: null,
        candidateType: "study_goal",
        contextScope: "guest_page",
        activeRole: "guest",
        tenantSchoolId: null,
        memoryNamespace: null,
        dataClass: "low_sensitive_preference",
        confidence: "user_stated",
        summary: "Interested in CS programs in Hangzhou.",
        structured: { fundingIntent: "scholarship_possible" },
        sourceEntityIds: ["city:hangzhou"],
        status: "proposed",
        expiresAt: new Date("2026-12-29T00:00:00.000Z"),
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        acceptedAt: null,
      },
    ],
    activeStudentSession,
  );

  const response = await handlers.carryForwardCandidate(
    new Request("https://cuac.test/api/v1/agent/context/carry-forward", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token; ${GUEST_SESSION_COOKIE_NAME}=${guest.token}` },
      body: JSON.stringify({ candidateId: "40000000-0000-0000-0000-000000000001", confirmed: true, userId: "attacker" }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.userId, undefined);
  assert.equal(body.data.memoryNamespace, undefined);
  assert.equal(body.data.summary, "Funding: scholarship_possible");
  assert.equal(calls.find(call => call.method === "createMemoryEntry").input.userId, "student-1");
  assert.equal(calls[0].sessionTokenHash, hashSessionToken("student-token"));
  assert.equal(calls.some((call) => call.method === "createMemoryEntry"), true);
});

test("Agent context HTTP returns bad request when carry-forward id is missing", async () => {
  const { handlers } = createHandlers([], activeStudentSession);
  const response = await handlers.carryForwardCandidate(
    new Request("https://cuac.test/api/v1/agent/context/carry-forward", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=student-token; ${GUEST_SESSION_COOKIE_NAME}=${guest.token}` },
      body: JSON.stringify({}),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "BAD_REQUEST");
});

test("Agent context app route files stay thin and do not read demo data directly", async () => {
  const routePaths = [
    "../../../app/api/v1/agent/context/candidates/route.ts",
    "../../../app/api/v1/agent/context/carry-forward/route.ts",
  ];

  const contents = await Promise.all(routePaths.map((routePath) => readFile(new URL(routePath, import.meta.url), "utf8")));

  contents.forEach((source) => {
    assert.match(source, /getAgentContextRouteHandlers/);
    assert.doesNotMatch(source, /cuac-data|public\/|design-lab|db\/schema|select\s+\*/i);
  });
});
