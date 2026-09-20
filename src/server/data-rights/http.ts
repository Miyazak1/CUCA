import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { toErrorEnvelope } from "../shared/errors.ts";
import type { DataRightsService } from "./service.ts";

type Service = Pick<DataRightsService, "listOwn" | "createOwn" | "cancelOwn" | "confirmOwn">;

export function createDataRightsHttpHandlers(service: Service, authRepository: AuthSessionRepository) {
  async function context(request: Request) {
    return resolveRequestContextFromRequest(request, authRepository, { purpose: "data_rights" });
  }
  async function respond(request: Request, work: (resolved: Awaited<ReturnType<typeof context>>) => Promise<unknown>) {
    const resolved = await context(request);
    try { return Response.json({ data: await work(resolved) }); }
    catch (error) { return Response.json(toErrorEnvelope(error, resolved.requestId), { status: error instanceof Error && "status" in error ? Number(error.status) : 500 }); }
  }
  return {
    list: (request: Request) => respond(request, resolved => service.listOwn(resolved)),
    create: (request: Request) => respond(request, async resolved => service.createOwn(resolved, await request.json())),
    cancel: (request: Request, requestId: string) => respond(request, async resolved => service.cancelOwn(resolved, requestId, await request.json())),
    confirmIdentity: (request: Request, requestId: string) => respond(request,
      async resolved => service.confirmOwn(resolved, requestId, await request.json())),
  };
}
