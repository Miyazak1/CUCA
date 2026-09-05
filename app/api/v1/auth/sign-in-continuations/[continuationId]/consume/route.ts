import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getSignInContinuationRouteHandlers } from "@/src/server/auth/continuations-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: { params: { continuationId: string } | Promise<{ continuationId: string }> }) {
  const params = await context.params;
  return getSignInContinuationRouteHandlers().consume(request, requireRouteUuid(params.continuationId));
});
