import { getOpsAccountDeletionRouteHandlers } from "@/src/server/ops-account-deletions/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
type RouteContext = { params: Promise<{ executionId: string }> };
export const POST = secureApiRoute("POST", async (request: Request, context: RouteContext) => {
  const { executionId } = await context.params;
  return getOpsAccountDeletionRouteHandlers().reviewLegalHold(request, requireRouteUuid(executionId));
});
