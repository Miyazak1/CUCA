import { PostgresAuthSessionRepository } from "../auth/postgres-repository.ts";
import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { PostgresAuditWriter } from "../audit/postgres-writer.ts";
import { createTransactionalSqlClient, getSharedPostgresPool, type TransactionalSqlClient } from "../db/postgres-client.ts";
import { transactionalMethod } from "../db/transactional-method.ts";
import { badRequest, serviceUnavailable, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord, inputUuid } from "../shared/input.ts";
import { AgentContextService, recordDeniedCandidateAudit, type AgentContextCandidateInput, type AgentContextRepository } from "./context.ts";
import { PostgresAgentContextRepository } from "./postgres-context-repository.ts";
import { agentRuntimeUnavailableResponse, isAgentRuntimeEnabled } from "./runtime/config.ts";

type AgentContextRouteName = "proposeCandidate" | "carryForwardCandidate";
type AgentContextServicePort = Pick<AgentContextService, keyof AgentContextService>;

const guestOnlyAuthRepository: AuthSessionRepository = {
  async findActiveSessionByTokenHash() {
    return null;
  },
};

const unavailableAgentContextRepository: AgentContextRepository = {
  async assertMemoryAllowed() {
    throw serviceUnavailable("Agent context repository is not configured.");
  },
  async createCandidate() {
    throw serviceUnavailable("Agent context repository is not configured.");
  },
  async findCandidateForConfirmation() {
    return null;
  },
  async markCandidateAccepted() {
    throw serviceUnavailable("Agent context repository is not configured.");
  },
  async createMemoryEntry() {
    throw serviceUnavailable("Agent context repository is not configured.");
  },
};

export function createAgentContextHttpHandlers(service: AgentContextServicePort, authRepository: AuthSessionRepository) {
  return {
    proposeCandidate: (request: Request) => handleAgentContextRoute(request, service, authRepository, "proposeCandidate"),
    carryForwardCandidate: (request: Request) => handleAgentContextRoute(request, service, authRepository, "carryForwardCandidate"),
  };
}

export function createAgentContextRouteHandlers(repository: AgentContextRepository = unavailableAgentContextRepository) {
  return createAgentContextHttpHandlers(new AgentContextService(repository), guestOnlyAuthRepository);
}

export function getAgentContextRouteHandlers(env: Record<string, string | undefined> = process.env) {
  try {
    if (!isAgentRuntimeEnabled(env)) {
      return {
        proposeCandidate: agentRuntimeUnavailableResponse,
        carryForwardCandidate: agentRuntimeUnavailableResponse,
      };
    }
  } catch {
    return {
      proposeCandidate: agentRuntimeUnavailableResponse,
      carryForwardCandidate: agentRuntimeUnavailableResponse,
    };
  }
  try {
    const pool = getSharedPostgresPool();
    const client = createTransactionalSqlClient(pool);
    return createAgentContextHttpHandlers(
      createPostgresAgentContextService(client),
      new PostgresAuthSessionRepository(client),
    );
  } catch {
    return createAgentContextRouteHandlers();
  }
}

export function createPostgresAgentContextService(client: TransactionalSqlClient): AgentContextServicePort {
  const create = (tx: TransactionalSqlClient) => new AgentContextService(
    new PostgresAgentContextRepository(tx), new PostgresAuditWriter(tx), { deniedAuditSink: null },
  );
  const propose = transactionalMethod(client, create, "proposeCandidate");
  return {
    async proposeCandidate(...args: Parameters<AgentContextService["proposeCandidate"]>) {
      try { return await propose(...args); }
      catch (error) {
        // Rejections must survive business rollback; never label a storage failure as a policy denial.
        await recordDeniedCandidateAudit(new PostgresAuditWriter(client), args[0], error);
        throw error;
      }
    },
    acceptCandidateAsMemory: transactionalMethod(client, create, "acceptCandidateAsMemory"),
    carryForwardGuestCandidateToStudentMemory: transactionalMethod(client, create, "carryForwardGuestCandidateToStudentMemory"),
  };
}

async function handleAgentContextRoute(
  request: Request,
  service: AgentContextServicePort,
  authRepository: AuthSessionRepository,
  routeName: AgentContextRouteName,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "agent_tool" });

  try {
    const data = await callAgentContextRoute(request, service, context, routeName);
    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function callAgentContextRoute(
  request: Request,
  service: AgentContextServicePort,
  context: Parameters<AgentContextService["proposeCandidate"]>[0],
  routeName: AgentContextRouteName,
) {
  const body = await readJsonBody(request);

  switch (routeName) {
    case "proposeCandidate": {
      const candidate = await service.proposeCandidate(context, body as AgentContextCandidateInput);
      return { id: candidate.id, candidateType: candidate.candidateType, contextScope: candidate.contextScope, summary: candidate.summary,
        structured: candidate.structured, confidence: candidate.confidence, status: candidate.status, expiresAt: candidate.expiresAt };
    }
    case "carryForwardCandidate": {
      const memory = await service.carryForwardGuestCandidateToStudentMemory(context, requireCandidateId(body));
      return { id: memory.id, memoryType: memory.memoryType, summary: memory.summary, structured: memory.structured,
        confidence: memory.confidence, expiresAt: memory.expiresAt };
    }
    default:
      throw new Error("Unsupported Agent context route.");
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) {
    return {};
  }

  return request.json();
}

function requireCandidateId(body: unknown): string {
  const input = inputRecord(body, ["candidateId", "confirmed"], true);
  if (input.confirmed !== true) throw badRequest("Explicit candidate confirmation is required.");
  return inputUuid(input.candidateId, "candidateId");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
