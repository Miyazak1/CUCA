import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import type { OpsOperationsMonitoringService } from "./service.ts";

export type OpsOperationsMonitoringHttpService = Pick<OpsOperationsMonitoringService, "getOperationsSummary">;

export function createOpsOperationsMonitoringHttpHandlers(
  service: OpsOperationsMonitoringHttpService,
  authRepository: AuthSessionRepository,
) {
  return {
    getOperationsSummary: async (request: Request): Promise<Response> => {
      const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "ops_monitoring" });
      try {
        const url = new URL(request.url);
        if ([...url.searchParams.keys()].length !== 0) throw badRequest("Query parameters are not supported.");
        return jsonResponse({ data: await service.getOperationsSummary(context) });
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
