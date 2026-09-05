import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request, context: {
  params: { recordId: string } | Promise<{ recordId: string }>;
}) {
  return getStudentRouteHandlers().updateEducationRecord(request, requireRouteUuid((await context.params).recordId));
});
