import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { OpsBillingReviewService } from "./service.ts";

export type OpsBillingReviewHttpService = Pick<OpsBillingReviewService,
  "listQuarantinedEvents" | "claimReview" | "escalateReview" | "resolveReview">;

export function createOpsBillingReviewHttpHandlers(service: OpsBillingReviewHttpService, authRepository: AuthSessionRepository) {
  return {
    list: (request: Request) => withContext(request, authRepository,
      context => service.listQuarantinedEvents(context, listInput(request))),
    claim: (request: Request, eventId: string) => withContext(request, authRepository,
      async context => service.claimReview(context, eventId, inputRecord(await request.json(), ["expectedRevision"]))),
    escalate: (request: Request, eventId: string) => withContext(request, authRepository,
      async context => service.escalateReview(context, eventId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference"]))),
    resolve: (request: Request, eventId: string) => withContext(request, authRepository,
      async context => service.resolveReview(context, eventId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference"]))),
  };
}

async function withContext(request: Request, authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "billing_review" });
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
      throw badRequest("Unsupported billing review query.");
    }
  }
  const input: { cursor?: string; limit?: number } = {};
  const cursor = query.get("cursor");
  if (cursor !== null) input.cursor = cursor;
  const limit = query.get("limit");
  if (limit !== null) {
    if (!/^[1-9][0-9]?$/.test(limit)) throw badRequest("Billing review limit must be a canonical positive integer.");
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
