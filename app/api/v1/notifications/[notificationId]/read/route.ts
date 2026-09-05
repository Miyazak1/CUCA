import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getNotificationRouteHandler } from "@/src/server/notifications/runtime/routes.ts";

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: {
  params: { notificationId: string } | Promise<{ notificationId: string }>;
}) {
  const { notificationId } = await context.params;
  return getNotificationRouteHandler()(request, "markRead", requireRouteUuid(notificationId));
});
