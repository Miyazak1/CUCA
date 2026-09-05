import { getOpsBillingReviewRouteHandlers } from "@/src/server/ops-billing-review/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getOpsBillingReviewRouteHandlers().list(request);
});
