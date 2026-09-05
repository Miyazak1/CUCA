import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getAgentContextRouteHandlers } from "@/src/server/agent/runtime/routes.ts";

export const POST = secureApiRoute("POST", async function POST(request: Request) {
  return getAgentContextRouteHandlers().proposeCandidate(request);
});
