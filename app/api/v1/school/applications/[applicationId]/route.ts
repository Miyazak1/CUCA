import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSchoolPortalRouteHandlers } from "@/src/server/school-portal/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request, context: { params: { applicationId: string } | Promise<{ applicationId: string }> }) {
  const params = await context.params;
  return getSchoolPortalRouteHandlers().getApplication(request, requireRouteUuid(params.applicationId));
});
