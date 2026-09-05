import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const PUT = secureApiRoute("PUT", async function PUT(request: Request, context: {
  params: { applicationSetId: string } | Promise<{ applicationSetId: string }>;
}) {
  const params = await context.params;
  return getStudentRouteHandlers().reorderApplicationChoices(request, requireRouteUuid(params.applicationSetId));
});
