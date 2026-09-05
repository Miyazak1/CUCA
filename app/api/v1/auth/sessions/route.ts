import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getAuthCredentialsRouteHandlers } from "@/src/server/auth/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getAuthCredentialsRouteHandlers().createSession(request);
});
