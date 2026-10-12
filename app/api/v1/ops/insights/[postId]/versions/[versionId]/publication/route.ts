import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getInsightGovernanceRouteHandlers } from "@/src/server/insights/runtime/routes.ts";
type Context = { params: Promise<{ postId: string; versionId: string }> };
export const POST = secureApiRoute("POST", async function POST(request: Request, context: Context) { const { postId, versionId } = await context.params; return getInsightGovernanceRouteHandlers().publish(request, postId, versionId); });
