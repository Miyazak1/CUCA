import { getStudentFileRouteHandlers } from "@/src/server/files/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

type RouteContext = { params: Promise<{ fileId: string }> };

export const POST = secureApiRoute("POST", async function POST(request: Request, routeContext: RouteContext) {
  const { fileId } = await routeContext.params;
  return getStudentFileRouteHandlers().completeUpload(request, fileId);
});
