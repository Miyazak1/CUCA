import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSchoolPortalRouteHandlers } from "@/src/server/school-portal/runtime/routes.ts";

export const PATCH = secureApiRoute("PATCH", async function PATCH(
  request: Request,
  context: { params: { applicationId: string } | Promise<{ applicationId: string }> },
) {
  const params = await context.params;
  return getSchoolPortalRouteHandlers().updateApplicationStatus(request, requireRouteUuid(params.applicationId));
});
