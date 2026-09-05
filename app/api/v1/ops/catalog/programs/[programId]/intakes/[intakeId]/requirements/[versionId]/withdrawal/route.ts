import { getRequirementGovernanceRouteHandlers } from "@/src/server/catalog/runtime/requirement-governance-routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: { programId: string; intakeId: string; versionId: string }
  | Promise<{ programId: string; intakeId: string; versionId: string }> };

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const { programId, intakeId, versionId } = await context.params;
  return getRequirementGovernanceRouteHandlers().withdraw(request, requireRouteUuid(programId), requireRouteUuid(intakeId),
    requireRouteUuid(versionId));
});
