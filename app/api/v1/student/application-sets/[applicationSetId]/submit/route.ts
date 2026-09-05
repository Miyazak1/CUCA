import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getApplicationSubmissionHttpHandler } from "@/src/server/student/application-submission-http.ts";

type RouteContext = {
  params: Promise<{ applicationSetId: string }> | { applicationSetId: string };
};

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  return getApplicationSubmissionHttpHandler()(request, requireRouteUuid(params.applicationSetId));
});
