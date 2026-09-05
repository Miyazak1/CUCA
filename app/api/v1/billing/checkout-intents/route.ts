import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getBillingRouteHandlers } from "@/src/server/billing/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getBillingRouteHandlers().createCheckoutIntent(request);
});
