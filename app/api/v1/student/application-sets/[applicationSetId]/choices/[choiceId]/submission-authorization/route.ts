import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getApplicationSubmissionAuthorizationHttpHandler } from "@/src/server/student/application-submission-authorization-http.ts";

type RouteContext = { params: { applicationSetId: string; choiceId: string }
  | Promise<{ applicationSetId: string; choiceId: string }> };

async function route(request: Request, context: RouteContext, operation: "get" | "record" | "withdraw") {
  const params = await context.params;
  return getApplicationSubmissionAuthorizationHttpHandler()(request, requireRouteUuid(params.applicationSetId),
    requireRouteUuid(params.choiceId), operation);
}

export const GET = secureApiRoute("GET", (request: Request, context: RouteContext) => route(request, context, "get"));
export const POST = secureApiRoute("POST", (request: Request, context: RouteContext) => route(request, context, "record"));
export const DELETE = secureApiRoute("DELETE", (request: Request, context: RouteContext) => route(request, context, "withdraw"));
