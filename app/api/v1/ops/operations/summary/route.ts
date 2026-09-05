import { getOpsOperationsMonitoringRouteHandlers } from "@/src/server/ops-monitoring/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getOpsOperationsMonitoringRouteHandlers().getOperationsSummary(request);
});
