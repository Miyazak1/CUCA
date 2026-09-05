import { secureApiRoute, requireRouteUuid } from "@/src/server/shared/http-boundary.ts";
import { getMemoryManagementHttpHandler } from "@/src/server/agent/memory-management-http.ts";

export const DELETE = secureApiRoute("DELETE", async function DELETE(request: Request, context: {
  params: { memoryId: string } | Promise<{ memoryId: string }>;
}) {
  const { memoryId } = await context.params;
  return getMemoryManagementHttpHandler()(request, "clearOne", requireRouteUuid(memoryId));
}, { body: "empty" });
