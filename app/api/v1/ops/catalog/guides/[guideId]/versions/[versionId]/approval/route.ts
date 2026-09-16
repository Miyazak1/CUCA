import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getGuideGovernanceRouteHandlers } from "@/src/server/catalog/runtime/guide-governance-routes.ts";

type Context = { params: Promise<{ guideId: string; versionId: string }> | { guideId: string; versionId: string } };
export const POST = secureApiRoute("POST", async (request: Request, context: Context) => {
  const { guideId, versionId } = await context.params;
  return getGuideGovernanceRouteHandlers().approve(request, requireRouteUuid(guideId), requireRouteUuid(versionId));
});
