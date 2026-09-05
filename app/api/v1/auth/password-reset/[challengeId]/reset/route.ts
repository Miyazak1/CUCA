import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getPasswordResetRouteHandlers } from "@/src/server/auth/password-reset-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: { params: { challengeId: string } | Promise<{ challengeId: string }> }) {
  const params = await context.params;
  return getPasswordResetRouteHandlers().resetPassword(request, requireRouteUuid(params.challengeId));
});
