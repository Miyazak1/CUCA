import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getNotificationRouteHandler } from "@/src/server/notifications/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getNotificationRouteHandler()(request, "list");
});
