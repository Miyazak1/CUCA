import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: { params: { applicationSetId: string } | Promise<{ applicationSetId: string }> }) {
  const params = await context.params;
  return getStudentRouteHandlers().addApplicationChoice(request, requireRouteUuid(params.applicationSetId));
});
