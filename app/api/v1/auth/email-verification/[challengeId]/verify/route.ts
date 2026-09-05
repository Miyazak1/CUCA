import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getEmailVerificationRouteHandlers } from "@/src/server/auth/email-verification-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: { params: { challengeId: string } | Promise<{ challengeId: string }> }) {
  const params = await context.params;
  return getEmailVerificationRouteHandlers().verifyEmail(request, requireRouteUuid(params.challengeId));
});
