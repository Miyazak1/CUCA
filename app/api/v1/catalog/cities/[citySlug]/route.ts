import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getCatalogRouteHandlers } from "@/src/server/catalog/runtime/routes.ts";

type RouteContext = {
  params: Promise<{ citySlug: string }> | { citySlug: string };
};

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return getCatalogRouteHandlers().getCity(request, params.citySlug);
});
