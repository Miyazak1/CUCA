import { getSchoolCatalogIntakeRouteHandlers } from "@/src/server/school-catalog-intakes/runtime/routes.ts";
import { secureApiRoute } from "@/src/server/shared/http-boundary.ts";

export const GET = secureApiRoute("GET", request => getSchoolCatalogIntakeRouteHandlers().list(request));
export const POST = secureApiRoute("POST", request => getSchoolCatalogIntakeRouteHandlers().saveDraft(request));
