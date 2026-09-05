import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getPasswordResetRouteHandlers } from "@/src/server/auth/password-reset-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getPasswordResetRouteHandlers().requestReset(request);
});
