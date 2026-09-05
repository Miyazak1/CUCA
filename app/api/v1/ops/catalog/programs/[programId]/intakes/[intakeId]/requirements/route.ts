import { getRequirementGovernanceRouteHandlers } from "@/src/server/catalog/runtime/requirement-governance-routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: { programId: string; intakeId: string } | Promise<{ programId: string; intakeId: string }> };

export const GET = secureApiRoute("GET", async function GET(request: Request, context: RouteContext) {
  const { programId, intakeId } = await context.params;
  return getRequirementGovernanceRouteHandlers().listVersions(request, requireRouteUuid(programId), requireRouteUuid(intakeId));
});

export const POST = secureApiRoute("POST", async function POST(request: Request, context: RouteContext) {
  const { programId, intakeId } = await context.params;
  return getRequirementGovernanceRouteHandlers().createDraft(request, requireRouteUuid(programId), requireRouteUuid(intakeId));
});
