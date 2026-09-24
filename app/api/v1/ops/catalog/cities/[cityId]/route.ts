import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type Context = { params: Promise<{ cityId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().getCity(request, requireRouteUuid((await context.params).cityId));
});

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().updateCity(request, requireRouteUuid((await context.params).cityId));
});
