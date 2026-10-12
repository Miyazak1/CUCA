import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
import { getInsightGovernanceRouteHandlers } from "@/src/server/insights/runtime/routes.ts";

export const GET = secureApiRoute("GET", async function GET(request: Request) { return getInsightGovernanceRouteHandlers().listPosts(request); });
export const POST = secureApiRoute("POST", async function POST(request: Request) { return getInsightGovernanceRouteHandlers().createPost(request); });
