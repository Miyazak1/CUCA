import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getStaffMfaRouteHandlers } from "@/src/server/auth/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getStaffMfaRouteHandlers().startEnrollment(request);
});
