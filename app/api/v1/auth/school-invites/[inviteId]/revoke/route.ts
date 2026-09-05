import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSchoolStaffInviteRouteHandlers } from "@/src/server/auth/school-invites-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: { params: { inviteId: string } | Promise<{ inviteId: string }> }) {
  const params = await context.params;
  return getSchoolStaffInviteRouteHandlers().revoke(request, requireRouteUuid(params.inviteId));
});
