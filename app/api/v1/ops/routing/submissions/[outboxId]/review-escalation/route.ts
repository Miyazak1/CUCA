import { getOpsRoutingReviewRouteHandlers } from "@/src/server/ops-routing-review/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: Promise<{ outboxId: string }> };

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const { outboxId } = await context.params;
  return getOpsRoutingReviewRouteHandlers().escalate(request, requireRouteUuid(outboxId));
});
