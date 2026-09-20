import { getSchoolCatalogIntakeRouteHandlers } from "@/src/server/school-catalog-intakes/runtime/routes.ts";
import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const POST = secureApiRoute("POST", async (request: Request,
  context: { params: { versionId: string } | Promise<{ versionId: string }> }) => {
  const params = await context.params;
  return getSchoolCatalogIntakeRouteHandlers().withdraw(request, requireRouteUuid(params.versionId));
}, { body: "empty" });
