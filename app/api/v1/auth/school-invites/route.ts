import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getSchoolStaffInviteRouteHandlers } from "@/src/server/auth/school-invites-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getSchoolStaffInviteRouteHandlers().create(request);
});
