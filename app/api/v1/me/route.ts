import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getAuthHttpHandlers } from "@/src/server/auth/http.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getAuthHttpHandlers().getMe(request);
});

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request) {
  return getAuthHttpHandlers().updateLocale(request);
});
