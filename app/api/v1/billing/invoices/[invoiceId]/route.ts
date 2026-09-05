import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getBillingRouteHandlers } from "@/src/server/billing/runtime/routes.ts";

type RouteContext = {
  params: Promise<{ invoiceId: string }> | { invoiceId: string };
};

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  return getBillingRouteHandlers().getCheckoutStatus(request, requireRouteUuid(params.invoiceId));
});
