import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getInsightGovernanceRouteHandlers } from "@/src/server/insights/runtime/routes.ts";
type Context = { params: Promise<{ postId: string }> };
export const GET = secureApiRoute("GET", async function GET(request: Request, context: Context) { return getInsightGovernanceRouteHandlers().listVersions(request, (await context.params).postId); });
export const POST = secureApiRoute("POST", async function POST(request: Request, context: Context) { return getInsightGovernanceRouteHandlers().createDraft(request, (await context.params).postId); });
