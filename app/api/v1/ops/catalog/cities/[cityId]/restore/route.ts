import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type Context = { params: Promise<{ cityId: string }> };

export const POST = secureApiRoute("POST", async function POST(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().restoreCity(request, requireRouteUuid((await context.params).cityId));
});
