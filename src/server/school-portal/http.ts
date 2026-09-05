import {
  resolveRequestContextFromRequest,
  type AuthSessionRepository,
  type SchoolTenantMembershipRepository,
} from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import type { SchoolPortalService } from "./service.ts";
import type { SchoolApplicationContactCommand, SchoolApplicationStatusCommand } from "./workflow.ts";

type SchoolPortalRouteName = "listApplications" | "getApplication" | "updateApplicationStatus" | "recordApplicationContact";
export type SchoolPortalHttpService = Pick<SchoolPortalService,
  "listTenantApplicationQueue" | "getTenantApplication" | "updateTenantApplicationStatus" | "recordTenantApplicationContact">;

export function createSchoolPortalHttpHandlers(
  service: SchoolPortalHttpService,
  authRepository: AuthSessionRepository,
  schoolTenantMembershipRepository?: SchoolTenantMembershipRepository,
) {
  return {
    listApplications: (request: Request) =>
      handleSchoolPortalRoute(request, service, authRepository, schoolTenantMembershipRepository, "listApplications"),
    getApplication: (request: Request, applicationId: string) =>
      handleSchoolPortalRoute(request, service, authRepository, schoolTenantMembershipRepository, "getApplication", applicationId),
    updateApplicationStatus: (request: Request, applicationId: string) =>
      handleSchoolPortalRoute(request, service, authRepository, schoolTenantMembershipRepository, "updateApplicationStatus", applicationId),
    recordApplicationContact: (request: Request, applicationId: string) =>
      handleSchoolPortalRoute(request, service, authRepository, schoolTenantMembershipRepository, "recordApplicationContact", applicationId),
  };
}

async function handleSchoolPortalRoute(
  request: Request,
  service: SchoolPortalHttpService,
  authRepository: AuthSessionRepository,
  schoolTenantMembershipRepository: SchoolTenantMembershipRepository | undefined,
  routeName: SchoolPortalRouteName,
  routeId?: string,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, {
    purpose: "school_review",
    schoolTenantMembershipRepository,
  });

  try {
    const data = await callSchoolPortalRoute(request, service, context, routeName, routeId);
    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function callSchoolPortalRoute(
  request: Request,
  service: SchoolPortalHttpService,
  context: Parameters<SchoolPortalHttpService["listTenantApplicationQueue"]>[0],
  routeName: SchoolPortalRouteName,
  routeId?: string,
) {
  switch (routeName) {
    case "listApplications":
      return service.listTenantApplicationQueue(context, {
        cuacId: new URL(request.url).searchParams.get("cuacId") ?? undefined,
      });
    case "getApplication":
      return service.getTenantApplication(context, requireRouteId(routeId));
    case "updateApplicationStatus":
      return service.updateTenantApplicationStatus(context, requireRouteId(routeId),
        await readJsonBody(request) as SchoolApplicationStatusCommand,
        { idempotencyKey: request.headers.get("idempotency-key") ?? undefined });
    case "recordApplicationContact":
      return service.recordTenantApplicationContact(context, requireRouteId(routeId),
        await readJsonBody(request) as SchoolApplicationContactCommand,
        { idempotencyKey: request.headers.get("idempotency-key") ?? undefined });
    default:
      throw new Error("Unsupported school portal route.");
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
}

function requireRouteId(routeId?: string): string {
  if (!routeId) {
    throw new Error("School portal route id is required.");
  }

  return routeId;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
