import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type Context = { params: Promise<{ entityType: string; entityId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) {
  const params = await context.params;
  return getCatalogAdminRouteHandlers().getReadiness(request, params.entityType, requireRouteUuid(params.entityId));
});
