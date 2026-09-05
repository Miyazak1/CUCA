import { getOpsDataQualityRouteHandlers } from "@/src/server/ops-data-quality/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getOpsDataQualityRouteHandlers().list(request);
});
