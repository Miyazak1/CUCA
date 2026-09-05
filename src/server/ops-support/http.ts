import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import type { OpsApplicationSupportService } from "./service.ts";

export type OpsApplicationSupportHttpService = Pick<OpsApplicationSupportService,
  "openApplicationSupportSession" | "getApplicationBySupportSession" | "closeApplicationSupportSession">;

export function createOpsApplicationSupportHttpHandlers(
  service: OpsApplicationSupportHttpService,
  authRepository: AuthSessionRepository,
) {
  return {
    openSupportSession: async (request: Request): Promise<Response> => {
      const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "ops_support" });
      try {
        const url = new URL(request.url);
        if ([...url.searchParams.keys()].length !== 0) throw badRequest("Query parameters are not supported.");
        return jsonResponse({ data: await service.openApplicationSupportSession(context, await request.json()) });
      } catch (error) {
        return jsonResponse(toErrorEnvelope(error, context.requestId),
          error instanceof Error && "status" in error ? Number(error.status) : 500);
      }
    },
    lookupApplication: async (request: Request): Promise<Response> => {
      const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "ops_support" });
      try {
        const url = new URL(request.url);
        if ([...url.searchParams.keys()].length !== 0) throw badRequest("Query parameters are not supported.");
        const data = await service.getApplicationBySupportSession(context, await request.json());
        return jsonResponse({ data });
      } catch (error) {
        return jsonResponse(toErrorEnvelope(error, context.requestId),
          error instanceof Error && "status" in error ? Number(error.status) : 500);
      }
    },
    closeSupportSession: async (request: Request, supportSessionId: string): Promise<Response> => {
      const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "ops_support" });
      try {
        return jsonResponse({ data: await service.closeApplicationSupportSession(context, supportSessionId) });
      } catch (error) {
        return jsonResponse(toErrorEnvelope(error, context.requestId),
          error instanceof Error && "status" in error ? Number(error.status) : 500);
      }
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
