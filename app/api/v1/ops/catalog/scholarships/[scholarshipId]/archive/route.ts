import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
type Context = { params: Promise<{ scholarshipId: string }> };
export const POST = secureApiRoute("POST", async function POST(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().archiveScholarship(request, requireRouteUuid((await context.params).scholarshipId));
});
