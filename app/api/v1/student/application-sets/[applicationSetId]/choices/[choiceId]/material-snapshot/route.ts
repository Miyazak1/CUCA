import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getApplicationMaterialSnapshotHttpHandler } from "@/src/server/student/application-material-snapshot-http.ts";

type RouteContext = { params: { applicationSetId: string; choiceId: string }
  | Promise<{ applicationSetId: string; choiceId: string }> };

async function route(request: Request, context: RouteContext, operation: "get" | "create") {
  const params = await context.params;
  return getApplicationMaterialSnapshotHttpHandler()(request, requireRouteUuid(params.applicationSetId),
    requireRouteUuid(params.choiceId), operation);
}

export const GET = secureApiRoute("GET", (request: Request, context: RouteContext) => route(request, context, "get"));
export const POST = secureApiRoute("POST", (request: Request, context: RouteContext) => route(request, context, "create"));
