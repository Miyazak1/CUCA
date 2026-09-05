import { getOpsRoutingReviewRouteHandlers } from "@/src/server/ops-routing-review/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getOpsRoutingReviewRouteHandlers().list(request);
});
