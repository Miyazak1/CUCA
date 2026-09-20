import { getOpsAccountDeletionRouteHandlers } from "@/src/server/ops-account-deletions/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";
export const GET = secureApiRoute("GET", request => getOpsAccountDeletionRouteHandlers().list(request));
