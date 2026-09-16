import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSchoolHandoffHttpHandlers } from "@/src/server/student/school-handoff-http.ts";

type RouteContext = { params: Promise<{ applicationSetId: string }> | { applicationSetId: string } };

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  return getSchoolHandoffHttpHandlers().handoff(request, requireRouteUuid(params.applicationSetId));
});
