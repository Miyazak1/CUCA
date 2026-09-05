import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getCatalogRouteHandlers } from "@/src/server/catalog/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getCatalogRouteHandlers().listCities(request);
});
