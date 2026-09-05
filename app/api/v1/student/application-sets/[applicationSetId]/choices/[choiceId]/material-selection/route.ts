import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getMaterialSelectionHttpHandler } from "@/src/server/student/material-selection-http.ts";

type RouteContext = { params: { applicationSetId: string; choiceId: string } | Promise<{ applicationSetId: string; choiceId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return getMaterialSelectionHttpHandler()(request, requireRouteUuid(params.applicationSetId), requireRouteUuid(params.choiceId), "get");
});

export const PUT = secureApiRoute("PUT", async function PUT(request: Request, context: RouteContext) {
  const params = await context.params;
  return getMaterialSelectionHttpHandler()(request, requireRouteUuid(params.applicationSetId), requireRouteUuid(params.choiceId), "put");
});
