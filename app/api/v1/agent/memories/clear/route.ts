import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getMemoryManagementHttpHandler } from "@/src/server/agent/memory-management-http.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getMemoryManagementHttpHandler()(request, "clearAll");
});
