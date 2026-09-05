import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { noticeScope } from "@/src/server/notices/document.ts";
import { getNoticeRouteHandler } from "@/src/server/notices/http.ts";

type RouteContext = { params: Promise<{ noticeKey: string; locale: string }> | { noticeKey: string; locale: string } };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const params = await context.params, scope = noticeScope(params.noticeKey, params.locale);
  return getNoticeRouteHandler()(request, scope.noticeKey, scope.locale);
});
