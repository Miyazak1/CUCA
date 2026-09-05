import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getCatalogRouteHandlers } from "@/src/server/catalog/runtime/routes.ts";

type RouteContext = {
  params: Promise<{ programId: string; intakeId: string }> | { programId: string; intakeId: string };
};

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return getCatalogRouteHandlers().getProgramRequirements(request, requireRouteUuid(params.programId), requireRouteUuid(params.intakeId));
});
