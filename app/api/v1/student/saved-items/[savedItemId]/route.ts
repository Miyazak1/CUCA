import { requireRouteUuid, secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const DELETE = secureApiRoute("DELETE", async function DELETE(request: Request, context: {
  params: { savedItemId: string } | Promise<{ savedItemId: string }>;
}) {
  const params = await context.params;
  return getStudentRouteHandlers().removeSavedItem(request, requireRouteUuid(params.savedItemId));
}, { body: "empty" });
