import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getApplicationPreflightHandler } from "@/src/server/student/application-preflight-http.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request, context: {
  params: { applicationSetId: string; choiceId: string } | Promise<{ applicationSetId: string; choiceId: string }>;
}) {
  const params = await context.params;
  return getApplicationPreflightHandler()(request, requireRouteUuid(params.applicationSetId), requireRouteUuid(params.choiceId));
});
