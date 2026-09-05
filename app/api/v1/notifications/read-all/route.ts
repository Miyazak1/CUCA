import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getNotificationRouteHandler } from "@/src/server/notifications/runtime/routes.ts";

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request) {
  return getNotificationRouteHandler()(request, "markAllRead");
}, { body: "empty" });
