import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getStudentRouteHandlers } from "@/src/server/student/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request, context: {
  params: { recordId: string } | Promise<{ recordId: string }>;
}) {
  return getStudentRouteHandlers().removeEducationRecord(request, requireRouteUuid((await context.params).recordId));
});
