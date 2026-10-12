import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getInsightGovernanceRouteHandlers } from "@/src/server/insights/runtime/routes.ts";
type Context = { params: Promise<{ postId: string }> };
export const POST = secureApiRoute("POST", async function POST(request: Request, context: Context) { return getInsightGovernanceRouteHandlers().withdraw(request, (await context.params).postId); });
