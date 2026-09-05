import { getOpsBillingReviewRouteHandlers } from "@/src/server/ops-billing-review/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: Promise<{ eventId: string }> };

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  return getOpsBillingReviewRouteHandlers().resolve(request, requireRouteUuid(eventId));
});
