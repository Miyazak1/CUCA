import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getGuideGovernanceRouteHandlers } from "@/src/server/catalog/runtime/guide-governance-routes.ts";

type Context = { params: Promise<{ guideId: string; versionId: string }> | { guideId: string; versionId: string } };
export const GET = secureApiRoute("GET", async (request: Request, context: Context) => {
  const { guideId, versionId } = await context.params;
  return getGuideGovernanceRouteHandlers().getVersion(request, requireRouteUuid(guideId), requireRouteUuid(versionId));
});
