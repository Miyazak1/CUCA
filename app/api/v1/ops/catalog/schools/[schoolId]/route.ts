import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type Context = { params: Promise<{ schoolId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().getSchool(request, requireRouteUuid((await context.params).schoolId));
});

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().updateSchool(request, requireRouteUuid((await context.params).schoolId));
});
