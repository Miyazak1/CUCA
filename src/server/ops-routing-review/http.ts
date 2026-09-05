import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { OpsRoutingReviewService } from "./service.ts";

export type OpsRoutingReviewHttpService = Pick<OpsRoutingReviewService,
  "listQuarantinedDeliveries" | "claimReview" | "escalateReview" | "closeReview" | "approveRetry">;

export function createOpsRoutingReviewHttpHandlers(service: OpsRoutingReviewHttpService,
  authRepository: AuthSessionRepository) {
  return {
    list: (request: Request) => withContext(request, authRepository,
      context => service.listQuarantinedDeliveries(context, listInput(request))),
    claim: (request: Request, outboxId: string) => withContext(request, authRepository,
      async context => service.claimReview(context, outboxId,
        inputRecord(await request.json(), ["expectedRevision"]))),
    escalate: (request: Request, outboxId: string) => withContext(request, authRepository,
      async context => service.escalateReview(context, outboxId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference"]))),
    close: (request: Request, outboxId: string) => withContext(request, authRepository,
      async context => service.closeReview(context, outboxId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference"]))),
    retry: (request: Request, outboxId: string) => withContext(request, authRepository,
      async context => service.approveRetry(context, outboxId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference"]))),
  };
}

async function withContext(request: Request, authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "routing_review" });
  try {
    return jsonResponse({ data: await work(context) });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId),
      error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

function listInput(request: Request): { cursor?: string; limit?: number } {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!["cursor", "limit"].includes(key) || query.getAll(key).length !== 1) {
      throw badRequest("Unsupported routing review query.");
    }
  }
  const input: { cursor?: string; limit?: number } = {};
  const cursor = query.get("cursor");
  if (cursor !== null) input.cursor = cursor;
  const limit = query.get("limit");
  if (limit !== null) {
    if (!/^[1-9][0-9]?$/.test(limit)) throw badRequest("Routing review limit must be a canonical positive integer.");
    input.limit = Number(limit);
  }
  return input;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
