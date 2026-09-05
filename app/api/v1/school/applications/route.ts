import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getSchoolPortalRouteHandlers } from "@/src/server/school-portal/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getSchoolPortalRouteHandlers().listApplications(request);
});
