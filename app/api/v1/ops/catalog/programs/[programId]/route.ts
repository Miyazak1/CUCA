import { getCatalogAdminRouteHandlers } from "@/src/server/catalog-admin/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type Context = { params: Promise<{ programId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().getProgram(request, requireRouteUuid((await context.params).programId));
});

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: Context) {
  return getCatalogAdminRouteHandlers().updateProgram(request, requireRouteUuid((await context.params).programId));
});
