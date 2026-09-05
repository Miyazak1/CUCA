import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getEmailVerificationRouteHandlers } from "@/src/server/auth/email-verification-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getEmailVerificationRouteHandlers().requestVerification(request);
});
