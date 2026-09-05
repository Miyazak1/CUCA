import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getSignInContinuationRouteHandlers } from "@/src/server/auth/continuations-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getSignInContinuationRouteHandlers().create(request);
});
