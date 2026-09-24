import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
type Context = { params: Promise<{ scholarshipId: string }> };
export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().getScholarship(request, requireRouteUuid((await context.params).scholarshipId));
});
export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().updateScholarship(request, requireRouteUuid((await context.params).scholarshipId));
});
