import { getOpsApplicationSupportRouteHandlers } from "@/src/server/ops-support/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const DELETE = secureApiRoute("DELETE", async function DELETE(request: Request, context: {
  params: { supportSessionId: string } | Promise<{ supportSessionId: string }>;
}) {
  const { supportSessionId } = await context.params;
  return getOpsApplicationSupportRouteHandlers().closeSupportSession(request, requireRouteUuid(supportSessionId));
}, { body: "empty" });
