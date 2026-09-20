import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import type { OpsAccountDeletionService } from "./service.ts";

export type OpsAccountDeletionHttpService = Pick<OpsAccountDeletionService, "list" | "refresh" | "reviewLegalHold">;
export function createOpsAccountDeletionHttpHandlers(service: OpsAccountDeletionHttpService, auth: AuthSessionRepository) {
  const run = async (request: Request, work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>) => {
    const context = await resolveRequestContextFromRequest(request, auth, { purpose: "account_deletion_execution" });
    try { return Response.json({ data: await work(context) }); }
    catch (error) { return Response.json(toErrorEnvelope(error, context.requestId),
      { status: error instanceof Error && "status" in error ? Number(error.status) : 500 }); }
  };
  return {
    list: (request: Request) => run(request, context => service.list(context, listInput(request))),
    refresh: (request: Request, id: string) => run(request, async context => service.refresh(context, id,
      inputRecord(await request.json(), ["expectedRevision"]))),
    reviewLegalHold: (request: Request, id: string) => run(request, async context => service.reviewLegalHold(context, id,
      inputRecord(await request.json(), ["reviewId", "expectedRevision", "result", "reasonCode", "caseReference"]))),
  };
}
function listInput(request: Request) { const query = new URL(request.url).searchParams;
  for (const key of query.keys()) if (key !== "limit" || query.getAll(key).length !== 1) throw badRequest("Unsupported query.");
  const raw = query.get("limit"); if (raw === null) return {};
  if (!/^[1-9][0-9]?$|^100$/.test(raw)) throw badRequest("Invalid limit."); return { limit: Number(raw) }; }
