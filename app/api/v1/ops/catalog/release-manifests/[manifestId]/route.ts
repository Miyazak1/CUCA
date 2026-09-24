import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type Context = { params: Promise<{ manifestId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().getReleaseManifest(request, requireRouteUuid((await context.params).manifestId));
});
