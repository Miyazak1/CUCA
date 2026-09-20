import { getOpsDataRightsRouteHandlers } from "@/src/server/ops-data-rights/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
export const GET=secureApiRoute("GET",request=>getOpsDataRightsRouteHandlers().list(request));
