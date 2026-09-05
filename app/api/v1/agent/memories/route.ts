import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getMemoryManagementHttpHandler } from "@/src/server/agent/memory-management-http.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) {
  return getMemoryManagementHttpHandler()(request, "list");
});
