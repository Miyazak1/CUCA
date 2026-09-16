import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSchoolHandoffHttpHandlers } from "@/src/server/student/school-handoff-http.ts";

type RouteContext = { params: Promise<{ applicationSetId: string }> | { applicationSetId: string } };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return getSchoolHandoffHttpHandlers().getProgress(request, requireRouteUuid(params.applicationSetId));
});
