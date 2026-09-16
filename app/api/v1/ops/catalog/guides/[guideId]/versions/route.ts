import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getGuideGovernanceRouteHandlers } from "@/src/server/catalog/runtime/guide-governance-routes.ts";

type Context = { params: Promise<{ guideId: string }> | { guideId: string } };
export const GET = secureApiRoute("GET", async (request: Request, context: Context) => {
  const { guideId } = await context.params;
  return getGuideGovernanceRouteHandlers().listVersions(request, requireRouteUuid(guideId));
});
export const POST = secureApiRoute("POST", async (request: Request, context: Context) => {
  const { guideId } = await context.params;
  return getGuideGovernanceRouteHandlers().createDraft(request, requireRouteUuid(guideId));
});
