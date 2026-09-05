import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getHealthRouteHandlers } from "@/src/server/health/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET() {
  return getHealthRouteHandlers().getHealth();
});
