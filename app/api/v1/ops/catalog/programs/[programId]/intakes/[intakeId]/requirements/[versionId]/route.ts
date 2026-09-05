import { getRequirementGovernanceRouteHandlers } from "@/src/server/catalog/runtime/requirement-governance-routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: { programId: string; intakeId: string; versionId: string }
  | Promise<{ programId: string; intakeId: string; versionId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const { programId, intakeId, versionId } = await context.params;
  return getRequirementGovernanceRouteHandlers().getVersion(request, requireRouteUuid(programId), requireRouteUuid(intakeId),
    requireRouteUuid(versionId));
});
