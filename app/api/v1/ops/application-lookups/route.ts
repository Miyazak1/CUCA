import { getOpsApplicationSupportRouteHandlers } from "@/src/server/ops-support/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getOpsApplicationSupportRouteHandlers().lookupApplication(request);
});
