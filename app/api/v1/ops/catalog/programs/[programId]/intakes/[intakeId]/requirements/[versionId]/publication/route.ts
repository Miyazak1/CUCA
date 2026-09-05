import { getRequirementGovernanceRouteHandlers } from "@/src/server/catalog/runtime/requirement-governance-routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: { programId: string; intakeId: string; versionId: string }
  | Promise<{ programId: string; intakeId: string; versionId: string }> };

export const PUT = secureApiRoute("PUT", async function PUT(request: Request, context: RouteContext) {
  const { programId, intakeId, versionId } = await context.params;
  return getRequirementGovernanceRouteHandlers().publish(request, requireRouteUuid(programId), requireRouteUuid(intakeId),
    requireRouteUuid(versionId));
});
