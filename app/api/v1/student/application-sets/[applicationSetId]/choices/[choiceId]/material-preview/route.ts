import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getApplicationMaterialPreviewHandler } from "@/src/server/student/application-material-preview-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: {
  params: { applicationSetId: string; choiceId: string } | Promise<{ applicationSetId: string; choiceId: string }>;
}) {
  const params = await context.params;
  return getApplicationMaterialPreviewHandler()(request, requireRouteUuid(params.applicationSetId), requireRouteUuid(params.choiceId));
});
