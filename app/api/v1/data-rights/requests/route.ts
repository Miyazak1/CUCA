import { getDataRightsRouteHandlers } from "@/src/server/data-rights/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", async request => getDataRightsRouteHandlers().list(request));
export const POST = secureApiRoute("POST", async request => getDataRightsRouteHandlers().create(request));
