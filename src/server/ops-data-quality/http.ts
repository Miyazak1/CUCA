import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { OpsDataQualityService } from "./service.ts";

export type OpsDataQualityHttpService = Pick<OpsDataQualityService,
  "listCandidates" | "claimReview" | "escalateReview" | "resolveReview">;

export function createOpsDataQualityHttpHandlers(service: OpsDataQualityHttpService,
  authRepository: AuthSessionRepository) {
  return {
    list: (request: Request) => withContext(request, authRepository,
      context => service.listCandidates(context, listInput(request))),
    claim: (request: Request, entityType: string, entityId: string) => withContext(request, authRepository,
      async context => service.claimReview(context, entityType, entityId,
        inputRecord(await request.json(), ["expectedRevision"]))),
    escalate: (request: Request, entityType: string, entityId: string) => withContext(request, authRepository,
      async context => service.escalateReview(context, entityType, entityId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference"]))),
    resolve: (request: Request, entityType: string, entityId: string) => withContext(request, authRepository,
      async context => service.resolveReview(context, entityType, entityId,
        inputRecord(await request.json(), ["expectedRevision", "code", "reference", "reviewDueAt"]))),
  };
}

async function withContext(request: Request, authRepository: AuthSessionRepository,
  work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "data_quality_review" });
  try {
    return jsonResponse({ data: await work(context) });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId),
      error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

function listInput(request: Request): { cursorType?: string; cursor?: string; limit?: number } {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (!["cursorType", "cursor", "limit"].includes(key) || query.getAll(key).length !== 1) {
      throw badRequest("Unsupported data-quality query.");
    }
  }
  const input: { cursorType?: string; cursor?: string; limit?: number } = {};
  const cursorType = query.get("cursorType"), cursor = query.get("cursor");
  if (cursorType !== null) input.cursorType = cursorType;
  if (cursor !== null) input.cursor = cursor;
  const limit = query.get("limit");
  if (limit !== null) {
    if (!/^[1-9][0-9]?$/.test(limit)) throw badRequest("Data-quality limit must be a canonical positive integer.");
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
