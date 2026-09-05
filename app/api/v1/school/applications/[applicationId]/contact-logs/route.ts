import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSchoolPortalRouteHandlers } from "@/src/server/school-portal/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(
  request: Request,
  context: { params: { applicationId: string } | Promise<{ applicationId: string }> },
) {
  const params = await context.params;
  return getSchoolPortalRouteHandlers().recordApplicationContact(request, requireRouteUuid(params.applicationId));
});
