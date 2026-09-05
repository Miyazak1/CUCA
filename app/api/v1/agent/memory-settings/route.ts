import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getMemoryManagementHttpHandler } from "@/src/server/agent/memory-management-http.ts";

export const PATCH = secureApiRoute("PATCH", async function PATCH(request: Request) {
  return getMemoryManagementHttpHandler()(request, "setEnabled");
});
