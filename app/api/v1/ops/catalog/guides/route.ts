import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getGuideGovernanceRouteHandlers } from "@/src/server/catalog/runtime/guide-governance-routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getGuideGovernanceRouteHandlers().listGuides(request);
});
