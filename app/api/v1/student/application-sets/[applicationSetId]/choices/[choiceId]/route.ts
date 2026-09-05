import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const DELETE = secureApiRoute("DELETE", async function DELETE(request: Request, context: {
  params: { applicationSetId: string; choiceId: string } | Promise<{ applicationSetId: string; choiceId: string }>;
}) {
  const params = await context.params;
  return getStudentRouteHandlers().removeApplicationChoice(request, requireRouteUuid(params.applicationSetId), requireRouteUuid(params.choiceId));
}, { body: "empty" });

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: {
  params: { applicationSetId: string; choiceId: string } | Promise<{ applicationSetId: string; choiceId: string }>;
}) {
  const params = await context.params;
  return getStudentRouteHandlers().updateApplicationChoice(request, requireRouteUuid(params.applicationSetId), requireRouteUuid(params.choiceId));
});
