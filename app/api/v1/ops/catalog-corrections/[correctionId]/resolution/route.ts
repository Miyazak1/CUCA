import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getSchoolCatalogCorrectionRouteHandlers } from "@/src/server/school-catalog-corrections/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, { params }: { params: { correctionId: string } }) {
  return getSchoolCatalogCorrectionRouteHandlers().resolve(request, requireRouteUuid(params.correctionId));
});
