import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import type { OpsDataRightsService } from "./service.ts";
type Service = Pick<OpsDataRightsService,"list"|"claim"|"escalate"|"propose"|"approve">;
export function createOpsDataRightsHttpHandlers(service: Service, auth: AuthSessionRepository) {
  const run = async (request: Request, work: (context: Awaited<ReturnType<typeof resolveRequestContextFromRequest>>) => Promise<unknown>) => {
    const context = await resolveRequestContextFromRequest(request, auth, { purpose: "data_rights_review" });
    try { return Response.json({ data: await work(context) }); }
    catch (error) { return Response.json(toErrorEnvelope(error, context.requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 }); }
  };
  return {
    list: (request: Request) => run(request, context => service.list(context, listInput(request))),
    claim: (request: Request,id: string) => run(request, async context => service.claim(context,id,await request.json())),
    escalate: (request: Request,id: string) => run(request, async context => service.escalate(context,id,await request.json())),
    propose: (request: Request,id: string) => run(request, async context => service.propose(context,id,await request.json())),
    approve: (request: Request,id: string) => run(request, async context => service.approve(context,id,await request.json())),
  };
}
function listInput(request: Request) { const query = new URL(request.url).searchParams;
  for (const key of query.keys()) if (key !== "limit" || query.getAll(key).length !== 1) throw badRequest("Unsupported query.");
  const raw = query.get("limit"); if (raw === null) return {}; if (!/^[1-9][0-9]?$|^100$/.test(raw)) throw badRequest("Invalid limit.");
  return { limit: Number(raw) }; }
