import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getInsightGovernanceRouteHandlers } from "@/src/server/insights/runtime/routes.ts";
type Context = { params: Promise<{ postId: string; versionId: string }> };
export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) { const { postId, versionId } = await context.params; return getInsightGovernanceRouteHandlers().getVersion(request, postId, versionId); });
