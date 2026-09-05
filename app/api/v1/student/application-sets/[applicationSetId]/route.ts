import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request, context: { params: { applicationSetId: string } | Promise<{ applicationSetId: string }> }) {
  const params = await context.params;
  return getStudentRouteHandlers().getApplicationSet(request, requireRouteUuid(params.applicationSetId));
});
