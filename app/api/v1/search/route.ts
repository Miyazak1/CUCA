import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getSiteSearchRouteHandler } from "@/src/server/search/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getSiteSearchRouteHandler()(request);
});
