import { getOpsDataQualityRouteHandlers } from "@/src/server/ops-data-quality/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: Promise<{ entityType: string; entityId: string }> };

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const { entityType, entityId } = await context.params;
  return getOpsDataQualityRouteHandlers().resolve(request, entityType, requireRouteUuid(entityId));
});
