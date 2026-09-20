import { getOpsDataRightsRouteHandlers } from "@/src/server/ops-data-rights/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
export const POST=secureApiRoute("POST",async(request,context:{params:Promise<{requestId:string}>})=>{
  const {requestId}=await context.params;return getOpsDataRightsRouteHandlers().propose(request,requestId);});
